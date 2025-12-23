using System;
using System.Collections.Generic;
using System.Globalization;
using System.IO;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
using Amazon.Textract;
using Amazon.Textract.Model;
using iText.Kernel.Pdf;
using iText.Kernel.Pdf.Canvas.Parser;
using Microsoft.Extensions.Logging;
using PreClear.Api.Interfaces;
using PreClear.Api.Models;
using Microsoft.Extensions.Options;

namespace PreClear.Api.AI.Services.DocumentValidator
{
    /// <summary>
    /// Extracts document contents from S3 storage (shippers/{shipper_id}/shipments/{shipment_id}/)
    /// Supports PDF text extraction, CSV parsing, and other document types
    /// </summary>
    public class DocumentExtractor
    {
        private readonly IS3StorageService _s3Service;
        private readonly IDocumentRepository _docRepo;
        private readonly IAmazonTextract _textractClient;
        private readonly ILogger<DocumentExtractor> _logger;
        private readonly IAiDocumentAnalyzer? _aiAnalyzer;
        private readonly string _bucketName;

        public DocumentExtractor(
            IS3StorageService s3Service, 
            IDocumentRepository docRepo,
            IAmazonTextract textractClient,
            ILogger<DocumentExtractor> logger,
            IOptions<AwsS3Settings>? s3Options = null,
            IAiDocumentAnalyzer? aiAnalyzer = null)
        {
            _s3Service = s3Service;
            _docRepo = docRepo;
            _textractClient = textractClient;
            _logger = logger;
            _aiAnalyzer = aiAnalyzer;
            var settings = s3Options?.Value;
            _bucketName = settings?.BucketName ?? Environment.GetEnvironmentVariable("S3_BUCKET_NAME") ?? "pre-clear-s3-docs";
        }

        /// <summary>
        /// Extracts all documents from the S3 folder structure for a shipment
        /// Folder structure: shippers/{shipper_id}/shipments/{shipment_id}/
        /// </summary>
        public async Task<List<ExtractedDocument>> ExtractShipmentDocumentsAsync(
            long shipmentId, 
            long shipperId)
        {
            var extractedDocs = new List<ExtractedDocument>();

            try
            {
                // Get all documents from database for this shipment
                var dbDocuments = await _docRepo.GetByShipmentIdAsync(shipmentId);

                foreach (var dbDoc in dbDocuments)
                {
                    if (string.IsNullOrWhiteSpace(dbDoc.FilePath))
                    {
                        _logger.LogWarning("Document {DocId} has no FilePath", dbDoc.Id);
                        continue;
                    }

                    try
                    {
                        var extracted = await ExtractDocumentContentAsync(dbDoc);
                        if (extracted != null)
                        {
                            extractedDocs.Add(extracted);
                        }
                    }
                    catch (Exception ex)
                    {
                        _logger.LogError(ex, "Error extracting document {DocId}: {FilePath}", dbDoc.Id, dbDoc.FilePath);
                    }
                }

                _logger.LogInformation("Extracted {Count} documents from shipment {ShipmentId}", extractedDocs.Count, shipmentId);
                return extractedDocs;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error extracting shipment documents for shipment {ShipmentId}", shipmentId);
                return extractedDocs;
            }
        }

        /// <summary>
        /// Extracts content from a single document
        /// Supports: PDF, CSV, TXT, images (via Textract)
        /// </summary>
        private async Task<ExtractedDocument> ExtractDocumentContentAsync(ShipmentDocument dbDoc)
        {
            var fileExtension = Path.GetExtension(dbDoc.FileName).ToLowerInvariant();

            try
            {
                var key = dbDoc.FilePath!; // guarded earlier against null/whitespace
                var content = await _s3Service.DownloadFileAsync(key);
                content.Position = 0;

                string extractedText = fileExtension switch
                {
                    ".pdf" => ExtractPdfText(content),
                    ".csv" => ExtractCsvText(content),
                    ".txt" => ExtractPlainText(content),
                    ".json" => ExtractJsonText(content),
                    ".jpg" or ".jpeg" or ".png" or ".bmp" => await ExtractImageTextAsync(key),
                    _ => await ExtractImageTextAsync(key), // Try Textract for unknown types
                };

                // AI-assisted parsing (if configured)
                var aiParsed = new Dictionary<string,string>();
                try
                {
                    if (_aiAnalyzer != null)
                    {
                        aiParsed = await _aiAnalyzer.ExtractFieldsAsync(extractedText, dbDoc.DocumentType);
                    }
                }
                catch (Exception ex)
                {
                    _logger.LogWarning(ex, "AI analyzer failed; continuing with heuristic parsing");
                }

                var parsed = ParseDocumentContent(extractedText, dbDoc.DocumentType);
                foreach (var kv in aiParsed)
                {
                    if (!parsed.ContainsKey(kv.Key) && !string.IsNullOrWhiteSpace(kv.Value))
                        parsed[kv.Key] = kv.Value;
                }

                return new ExtractedDocument
                {
                    DocumentId = dbDoc.Id,
                    ShipmentId = dbDoc.ShipmentId,
                    DocumentType = dbDoc.DocumentType,
                    FileName = dbDoc.FileName,
                    FilePath = dbDoc.FilePath,
                    ExtractedContent = extractedText,
                    ExtractedAt = DateTime.UtcNow,
                    SourceType = GetSourceType(fileExtension),
                    ParsedData = parsed
                };
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Failed to extract document content: {FileName}", dbDoc.FileName);
                throw;
            }
        }

        /// <summary>
        /// Extracts text from PDF files
        /// </summary>
        private string ExtractPdfText(Stream pdfStream)
        {
            try
            {
                var text = new StringBuilder();
                using (var reader = new PdfReader(pdfStream))
                {
                    var document = new PdfDocument(reader);
                    for (int pageNum = 1; pageNum <= document.GetNumberOfPages(); pageNum++)
                    {
                        var page = document.GetPage(pageNum);
                        var pageText = PdfTextExtractor.GetTextFromPage(page);
                        text.AppendLine(pageText);
                    }
                    document.Close();
                }
                return text.ToString();
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error extracting PDF text");
                throw;
            }
        }

        /// <summary>
        /// Extracts and parses CSV content
        /// </summary>
        private string ExtractCsvText(Stream csvStream)
        {
            using (var reader = new StreamReader(csvStream, Encoding.UTF8))
            {
                return reader.ReadToEnd();
            }
        }

        /// <summary>
        /// Extracts plain text from TXT files
        /// </summary>
        private string ExtractPlainText(Stream textStream)
        {
            using (var reader = new StreamReader(textStream, Encoding.UTF8))
            {
                return reader.ReadToEnd();
            }
        }

        /// <summary>
        /// Extracts text from JSON files
        /// </summary>
        private string ExtractJsonText(Stream jsonStream)
        {
            using (var reader = new StreamReader(jsonStream, Encoding.UTF8))
            {
                return reader.ReadToEnd();
            }
        }

        /// <summary>
        /// Uses AWS Textract to extract text from images
        /// </summary>
        private async Task<string> ExtractImageTextAsync(string s3Key)
        {
            try
            {
                var request = new AnalyzeDocumentRequest
                {
                    Document = new Document
                    {
                        S3Object = new Amazon.Textract.Model.S3Object
                        {
                            Bucket = _bucketName,
                            Name = s3Key
                        }
                    },
                    FeatureTypes = new List<string> { "TABLES", "FORMS" }
                };

                var response = await _textractClient.AnalyzeDocumentAsync(request);

                var text = new StringBuilder();
                foreach (var block in response.Blocks)
                {
                    if (block.BlockType == BlockType.LINE)
                    {
                        text.AppendLine(block.Text);
                    }
                }

                return text.ToString();
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Textract extraction failed for {Key}", s3Key);
                return string.Empty;
            }
        }

        /// <summary>
        /// Parses extracted document content into structured data
        /// Looks for key fields like invoice number, shipment details, etc.
        /// </summary>
        private Dictionary<string, string> ParseDocumentContent(string content, string documentType)
        {
            var data = new Dictionary<string, string>();

            if (string.IsNullOrWhiteSpace(content))
                return data;

            // Extract common fields
            var lines = content.Split(new[] { "\r\n", "\r", "\n" }, StringSplitOptions.None);

            foreach (var line in lines)
            {
                // Invoice number patterns
                if (line.Contains("invoice", StringComparison.OrdinalIgnoreCase))
                {
                    var number = ExtractNumber(line);
                    if (!string.IsNullOrEmpty(number))
                        data["invoice_number"] = number;
                }

                // Shipment/Tracking number
                if (line.Contains("tracking", StringComparison.OrdinalIgnoreCase) ||
                    line.Contains("shipment", StringComparison.OrdinalIgnoreCase) ||
                    line.Contains("bl", StringComparison.OrdinalIgnoreCase))
                {
                    var number = ExtractNumber(line);
                    if (!string.IsNullOrEmpty(number))
                        data["tracking_number"] = number;
                }

                // Weight
                if (line.Contains("weight", StringComparison.OrdinalIgnoreCase))
                {
                    var weight = ExtractDecimal(line);
                    if (weight.HasValue)
                        data["weight"] = weight.Value.ToString();
                }

                // Total value
                if (line.Contains("total", StringComparison.OrdinalIgnoreCase) || 
                    line.Contains("value", StringComparison.OrdinalIgnoreCase))
                {
                    var value = ExtractDecimal(line);
                    if (value.HasValue)
                        data["total_value"] = value.Value.ToString();
                }

                // HS Code
                if (line.Contains("hs", StringComparison.OrdinalIgnoreCase) || 
                    line.Contains("tariff", StringComparison.OrdinalIgnoreCase))
                {
                    var code = ExtractHsCode(line);
                    if (!string.IsNullOrEmpty(code))
                        data["hs_code"] = code;
                }

                // Country
                if (line.Contains("origin", StringComparison.OrdinalIgnoreCase))
                    data["origin_country"] = ExtractCountry(line);
                if (line.Contains("destination", StringComparison.OrdinalIgnoreCase))
                    data["destination_country"] = ExtractCountry(line);
            }

            return data;
        }

        private string ExtractNumber(string text)
        {
            var match = System.Text.RegularExpressions.Regex.Match(text, @"#?\s*(\d{6,})");
            return match.Success ? match.Groups[1].Value : string.Empty;
        }

        private decimal? ExtractDecimal(string text)
        {
            var match = System.Text.RegularExpressions.Regex.Match(text, @"(\d+[.,]\d{2})");
            if (match.Success && decimal.TryParse(match.Groups[1].Value.Replace(",", "."), CultureInfo.InvariantCulture, out var result))
                return result;
            return null;
        }

        private string ExtractHsCode(string text)
        {
            var match = System.Text.RegularExpressions.Regex.Match(text, @"\b(\d{6})\b");
            return match.Success ? match.Groups[1].Value : string.Empty;
        }

        private string ExtractCountry(string text)
        {
            // Simple extraction - would be enhanced with country name database
            var words = text.Split(new[] { " ", ",", ":", "\t" }, StringSplitOptions.None);
            return words.LastOrDefault(w => w.Length > 2) ?? string.Empty;
        }

        private string GetSourceType(string extension)
        {
            return extension switch
            {
                ".pdf" => "pdf",
                ".csv" => "csv",
                ".txt" => "text",
                ".json" => "json",
                ".jpg" or ".jpeg" or ".png" or ".bmp" => "image",
                _ => "unknown"
            };
        }
    }

    public class ExtractedDocument
    {
        public long DocumentId { get; set; }
        public long ShipmentId { get; set; }
        public string DocumentType { get; set; } = string.Empty;
        public string FileName { get; set; } = string.Empty;
        public string FilePath { get; set; } = string.Empty;
        public string ExtractedContent { get; set; } = string.Empty;
        public DateTime ExtractedAt { get; set; }
        public string SourceType { get; set; } = string.Empty; // pdf, csv, text, image, json
        public Dictionary<string, string> ParsedData { get; set; } = new();
    }
}
