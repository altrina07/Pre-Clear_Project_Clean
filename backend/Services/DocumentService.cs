using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Text.RegularExpressions;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.Logging;
using PreClear.Api.Interfaces;
using PreClear.Api.Models;

namespace PreClear.Api.Services
{
    public class DocumentService : IDocumentService
    {
        private readonly IDocumentRepository _repo;
        private readonly IShipmentRepository _shipmentRepo;
        private readonly IS3StorageService _storage;
        private readonly ILogger<DocumentService> _logger;
        private readonly INotificationService _notificationService;
        private static readonly HashSet<string> _allowedExt = new(StringComparer.OrdinalIgnoreCase)
        {
            ".pdf",
            ".jpg",
            ".jpeg",
            ".png",
            ".doc",
            ".docx",
            ".xls",
            ".xlsx",
            ".csv",
            ".txt"
        };

        public DocumentService(IDocumentRepository repo, IShipmentRepository shipmentRepo, IS3StorageService storage, ILogger<DocumentService> logger, INotificationService notificationService)
        {
            _repo = repo;
            _shipmentRepo = shipmentRepo;
            _storage = storage;
            _logger = logger;
            _notificationService = notificationService;
        }

        public async Task<ShipmentDocument> UploadAsync(long shipmentId, long? uploadedBy, IFormFile file, string docType)
        {
            if (file == null || file.Length == 0) throw new ArgumentException("file_required", nameof(file));

            var originalFileName = file.FileName;
            var ext = Path.GetExtension(originalFileName);
            if (string.IsNullOrWhiteSpace(ext) || !_allowedExt.Contains(ext))
                throw new ArgumentException("file_type_not_allowed", nameof(originalFileName));

            var shipment = await _shipmentRepo.GetByIdAsync(shipmentId);
            if (shipment == null)
                throw new ArgumentException("shipment_not_found", nameof(shipmentId));

            var docFolder = SlugifyDocType(docType);
            var folder = $"shippers/{shipment.CreatedBy}/shipments/{shipmentId}/{docFolder}";

            string storedPath;

            try
            {
                // Primary path: upload to S3
                storedPath = await _storage.UploadFileAsync(file, folder);
            }
            catch (Exception ex)
            {
                // Fallback path: persist to local disk so uploads still work in dev/offline
                _logger.LogError(ex, "S3 upload failed, falling back to local storage for shipment {ShipmentId}", shipmentId);

                var localRoot = Path.Combine(Path.GetTempPath(), "preclear-docs", shipmentId.ToString());
                Directory.CreateDirectory(localRoot);
                var localName = $"{Guid.NewGuid()}{ext}";
                var localPath = Path.Combine(localRoot, localName);
                using (var fs = File.Create(localPath))
                {
                    await file.CopyToAsync(fs);
                }

                // Prefix with local: so downloader knows to read from disk
                storedPath = $"local:{localPath}";
            }

            var doc = new ShipmentDocument
            {
                ShipmentId = shipmentId,
                DocumentType = docType,
                FileName = Path.GetFileName(originalFileName),
                FilePath = storedPath,
                FileSize = file.Length,
                MimeType = file.ContentType,
                UploadedBy = uploadedBy,
                UploadedAt = DateTime.UtcNow,
                DownloadUrl = BuildDownloadUrlPlaceholder(0) // temporary placeholder, updated below
            };

            var created = await _repo.AddAsync(doc);
            created.DownloadUrl = BuildDownloadUrlPlaceholder(created.Id);

            _logger.LogInformation("Uploaded document {DocId} for shipment {ShipmentId} to storage path {Path}", created.Id, shipmentId, storedPath);
            return created;
        }

        public async Task<List<ShipmentDocument>> GetByShipmentIdAsync(long shipmentId)
        {
            var docs = await _repo.GetByShipmentIdAsync(shipmentId);
            foreach (var doc in docs)
            {
                doc.DownloadUrl = BuildDownloadUrlPlaceholder(doc.Id);
            }

            return docs;
        }

        public async Task<(ShipmentDocument? Document, Stream? Content, string? ContentType, string? FileName)> GetDocumentAsync(long id)
        {
            var doc = await _repo.FindAsync(id);
            if (doc == null) return (null, null, null, null);

            if (string.IsNullOrWhiteSpace(doc.FilePath))
            {
                return (doc, null, null, null);
            }

            // Detect local fallback path
            if (doc.FilePath.StartsWith("local:", StringComparison.OrdinalIgnoreCase))
            {
                var localPath = doc.FilePath.Substring("local:".Length);
                if (!File.Exists(localPath))
                {
                    return (doc, null, null, null);
                }

                var localStream = File.OpenRead(localPath);
                var localContentType = !string.IsNullOrWhiteSpace(doc.MimeType)
                    ? doc.MimeType
                    : GuessContentType(doc.FileName ?? localPath);
                var localName = string.IsNullOrWhiteSpace(doc.FileName)
                    ? Path.GetFileName(localPath)
                    : doc.FileName;

                return (doc, localStream, localContentType, localName);
            }

            try
            {
                var stream = await _storage.DownloadFileAsync(doc.FilePath);
                var contentType = !string.IsNullOrWhiteSpace(doc.MimeType)
                    ? doc.MimeType
                    : GuessContentType(doc.FileName ?? doc.FilePath);
                var fileName = string.IsNullOrWhiteSpace(doc.FileName)
                    ? Path.GetFileName(doc.FilePath)
                    : doc.FileName;

                return (doc, stream, contentType, fileName);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error downloading document {DocId} from S3", id);
                throw;
            }
        }

        public async Task<bool> MarkAsUploadedAsync(long shipmentId, string documentName)
        {
            return await _repo.MarkAsUploadedAsync(shipmentId, documentName);
        }

        private static string SlugifyDocType(string docType)
        {
            if (string.IsNullOrWhiteSpace(docType)) return "other";
            var cleaned = Regex.Replace(docType.ToLowerInvariant(), "[^a-z0-9]+", "-").Trim('-');
            return string.IsNullOrWhiteSpace(cleaned) ? "other" : cleaned;
        }

        private static string GuessContentType(string fileName)
        {
            var ext = Path.GetExtension(fileName).ToLowerInvariant();
            return ext switch
            {
                ".pdf" => "application/pdf",
                ".jpg" => "image/jpeg",
                ".jpeg" => "image/jpeg",
                ".png" => "image/png",
                ".doc" => "application/msword",
                ".docx" => "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
                ".xls" => "application/vnd.ms-excel",
                ".xlsx" => "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                ".csv" => "text/csv",
                _ => "application/octet-stream",
            };
        }

        private static string BuildDownloadUrlPlaceholder(long id) =>
            id <= 0 ? "/api/documents/pending/download" : $"/api/documents/{id}/download";

        public async Task<DocumentRequest> RequestDocumentsAsync(long shipmentId, long brokerId, List<string> documentNames, string message)
        {
            try
            {
                var docNames = string.Join(", ", documentNames ?? new List<string>());
                _logger.LogInformation("RequestDocumentsAsync: Starting for shipment {ShipmentId}, broker {BrokerId}, docs: {DocNames}", shipmentId, brokerId, docNames);
                
                var request = new DocumentRequest
                {
                    ShipmentId = shipmentId,
                    RequestedByBrokerId = brokerId,
                    RequestedDocumentNames = docNames,
                    RequestMessage = message,
                    Status = "pending",
                    CreatedAt = DateTime.UtcNow
                };

                await _repo.CreateDocumentRequestAsync(request);
                _logger.LogInformation("Document request saved: ID={RequestId}, Shipment={ShipmentId}", request.Id, shipmentId);

                // Notify shipper (creator of the shipment)
                var shipment = await _shipmentRepo.GetByIdAsync(shipmentId);
                _logger.LogInformation("Shipment lookup: ShipmentId={ShipmentId}, Found={Found}", shipmentId, shipment != null);
                
                if (shipment != null)
                {
                    var shipperId = shipment.CreatedBy;
                    var title = "Additional Documents Requested";
                    var messageText = string.IsNullOrWhiteSpace(message)
                        ? $"Broker requested: {docNames}"
                        : $"{message}\nRequested: {docNames}";
                    try
                    {
                        await _notificationService.CreateNotificationAsync(shipperId, "document_request", title, messageText, shipmentId);
                        _logger.LogInformation("Notification created for shipper {ShipperId}", shipperId);
                    }
                    catch (Exception ex)
                    {
                        _logger.LogWarning(ex, "Failed to create notification for shipper {UserId} on shipment {ShipmentId}", shipperId, shipmentId);
                    }
                }
                else
                {
                    _logger.LogWarning("Shipment {ShipmentId} not found; skipping shipper notification", shipmentId);
                }

                return request;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "RequestDocumentsAsync failed for shipment {ShipmentId}", shipmentId);
                throw;
            }
        }

        public async Task<List<DocumentRequest>> GetDocumentRequestsAsync(long shipmentId)
        {
            var requests = await _repo.GetDocumentRequestsByShipmentAsync(shipmentId);
            _logger.LogInformation("Retrieved {Count} document requests for shipment {ShipmentId}", requests.Count, shipmentId);
            return requests;
        }
    }
}
 
