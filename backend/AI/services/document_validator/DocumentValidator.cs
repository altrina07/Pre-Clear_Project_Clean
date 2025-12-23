using System;
using System.Collections.Generic;
using System.Globalization;
using System.Linq;
using System.Text.Json;
using System.Threading.Tasks;
using Microsoft.Extensions.Logging;
using PreClear.Api.Models;

namespace PreClear.Api.AI.Services.DocumentValidator
{
    /// <summary>
    /// Main document validator service
    /// Validates extracted documents against:
    /// 1. Shipment form data (matching)
    /// 2. Compliance rules from dataset (restrictions, bans, requirements)
    /// </summary>
    public class DocumentValidator
    {
        private readonly DocumentExtractor _extractor;
        private readonly ComplianceDatasetLoader _complianceLoader;
        private readonly ILogger<DocumentValidator> _logger;
        private List<ValidationIssue> _issues = new();

        public DocumentValidator(
            DocumentExtractor extractor,
            ComplianceDatasetLoader complianceLoader,
            ILogger<DocumentValidator> logger)
        {
            _extractor = extractor;
            _complianceLoader = complianceLoader;
            _logger = logger;
        }

        /// <summary>
        /// Validates all documents for a shipment against form data and compliance rules
        /// </summary>
        public async Task<ValidationResult> ValidateShipmentAsync(
            ShipmentDetailDto detail,
            List<ExtractedDocument> extractedDocuments)
        {
            _issues.Clear();
            var result = new ValidationResult
            {
                ShipmentId = detail.Shipment.Id,
                ValidationStartedAt = DateTime.UtcNow
            };

            try
            {
                // Step 1: Validate documents exist and are not empty
                ValidateDocumentsExist(extractedDocuments);

                // Step 2: Validate data consistency between documents and form
                ValidateDataConsistency(detail, extractedDocuments);

                // Step 3: Validate compliance rules
                var packingNotes = await ValidateComplianceRulesAsync(detail, extractedDocuments);

                // Step 4: Validate product restrictions and bans
                ValidateProductRestrictions(detail, extractedDocuments);

                // Step 5: Validate packing and handling requirements
                ValidatePackingRequirements(detail, extractedDocuments);

                // Filter out any disabled origin mismatch warnings (defensive)
                _issues = _issues
                    .Where(i => !(string.Equals(i.Message, "Origin country mismatch", StringComparison.OrdinalIgnoreCase)
                                  && string.Equals(i.Category, "data_consistency", StringComparison.OrdinalIgnoreCase)))
                    .ToList();

                // Compile results: pass if there are no errors; warnings/info do not fail validation
                var hasErrors = _issues.Any(i => string.Equals(i.Severity, "error", StringComparison.OrdinalIgnoreCase));
                result.IsValid = !hasErrors;
                result.Issues = _issues;
                result.PackingNotes = packingNotes;
                result.ValidationCompletedAt = DateTime.UtcNow;
                result.ValidationScore = CalculateValidationScore(_issues);

                if (result.IsValid)
                {
                    result.Status = "approved";
                    result.Message = "All documents validated successfully. Request for Broker Review is available.";
                }
                else
                {
                    result.Status = "failed";
                    result.Message = $"Validation failed with {_issues.Count} issue(s). Please fix and resubmit documents.";
                }

                _logger.LogInformation(
                    "Shipment {ShipmentId} validation completed. Valid={Valid}, Issues={Issues}, Score={Score}",
                    detail.Shipment.Id, result.IsValid, result.IssueCount, result.ValidationScore);

                return result;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error validating shipment {ShipmentId}", detail.Shipment.Id);
                result.Status = "error";
                result.Message = $"Validation error: {ex.Message}";
                result.IsValid = false;
                result.Issues = new List<ValidationIssue>
                {
                    new ValidationIssue
                    {
                        Severity = "error",
                        Category = "system",
                        Message = ex.Message,
                        Details = ex.StackTrace
                    }
                };
                return result;
            }
        }

        private void ValidateDocumentsExist(List<ExtractedDocument> documents)
        {
            if (documents == null || documents.Count == 0)
            {
                _issues.Add(new ValidationIssue
                {
                    Severity = "error",
                    Category = "documents",
                    Message = "No documents provided",
                    Details = "At least one document must be uploaded for validation",
                    SuggestedAction = "Upload required base documents: Commercial Invoice and Packing List."
                });
                return;
            }

            // Check for required document types
            var documentTypes = documents.Select(d => d.DocumentType.ToLowerInvariant()).ToList();
            var requiredDocs = new[] { "commercial invoice", "packing list" };

            foreach (var required in requiredDocs)
            {
                if (!documentTypes.Any(d => d.Contains(required)))
                {
                    _issues.Add(new ValidationIssue
                    {
                        Severity = "error",
                        Category = "documents",
                        Message = $"Missing required document: {required}",
                        Details = "This document type is mandatory for international shipments",
                        SuggestedAction = required.Contains("commercial")
                            ? "Upload the Commercial Invoice with itemized values, HS codes, origin and consignee details."
                            : "Upload the Packing List with package counts, weights, and dimensions."
                    });
                }
            }
        }

        private void ValidateDataConsistency(ShipmentDetailDto detail, List<ExtractedDocument> documents)
        {
            if (documents == null || documents.Count == 0) return;

            // Extract all parsed data from documents
            var allParsedData = new Dictionary<string, string>();
            foreach (var doc in documents)
            {
                foreach (var kvp in doc.ParsedData)
                {
                    if (!allParsedData.ContainsKey(kvp.Key))
                        allParsedData[kvp.Key] = kvp.Value;
                }
            }

            // Gather form data
            var shipment = detail.Shipment;
            var originCountry = detail.Parties.FirstOrDefault(p => p.PartyType.Equals("shipper", StringComparison.OrdinalIgnoreCase))?.Country;
            var destinationCountry = detail.Parties.FirstOrDefault(p => p.PartyType.Equals("consignee", StringComparison.OrdinalIgnoreCase))?.Country;
            var totalWeight = detail.Packages.Any() ? detail.Packages.Sum(p => p.Weight ?? 0m) : (decimal?)null;
            var packageType = detail.Packages.FirstOrDefault()?.PackageType;
            var hsCode = detail.Items.FirstOrDefault()?.HsCode;
            var productDescription = detail.Items.FirstOrDefault()?.Description ?? detail.Items.FirstOrDefault()?.Name;
            var customsValue = shipment.CustomsValue;

            // Validate origin country - DISABLED per requirements
            // Origin country validation skipped to allow flexible sourcing
            // if (allParsedData.TryGetValue("origin_country", out var docOrigin))
            // {
            //     if (!string.IsNullOrWhiteSpace(originCountry) && !docOrigin.Equals(originCountry, StringComparison.OrdinalIgnoreCase))
            //     {
            //         _issues.Add(new ValidationIssue
            //         {
            //             Severity = "warning",
            //             Category = "data_consistency",
            //             Message = "Origin country mismatch",
            //             Details = $"Form shows '{originCountry}' but documents indicate '{docOrigin}'"
            //         });
            //     }
            // }

            // Validate destination country
            if (allParsedData.TryGetValue("destination_country", out var docDest))
            {
                if (!string.IsNullOrWhiteSpace(destinationCountry) && !docDest.Equals(destinationCountry, StringComparison.OrdinalIgnoreCase))
                {
                    _issues.Add(new ValidationIssue
                    {
                        Severity = "warning",
                        Category = "data_consistency",
                        Message = "Destination country mismatch",
                        Details = $"Form shows '{destinationCountry}' but documents indicate '{docDest}'"
                    });
                }
            }

            // Validate weight
            if (allParsedData.TryGetValue("weight", out var docWeight))
            {
                if (decimal.TryParse(docWeight, out var parsedWeight) && totalWeight.HasValue)
                {
                    var tolerance = totalWeight.Value * 0.1m; // 10% tolerance
                    if (Math.Abs(parsedWeight - totalWeight.Value) > tolerance)
                    {
                        _issues.Add(new ValidationIssue
                        {
                            Severity = "warning",
                            Category = "data_consistency",
                            Message = "Weight discrepancy",
                            Details = $"Form shows {totalWeight}kg but documents indicate {parsedWeight}kg"
                        });
                    }
                }
            }

            // Validate HS Code
            if (allParsedData.TryGetValue("hs_code", out var docHsCode))
            {
                if (!string.IsNullOrEmpty(hsCode) &&
                    !hsCode.StartsWith(docHsCode.Substring(0, Math.Min(4, docHsCode.Length))))
                {
                    _issues.Add(new ValidationIssue
                    {
                        Severity = "warning",
                        Category = "data_consistency",
                        Message = "HS Code mismatch",
                        Details = $"Form shows '{hsCode}' but documents indicate '{docHsCode}'"
                    });
                }
            }

            // Validate total value
            if (allParsedData.TryGetValue("total_value", out var docValue))
            {
                if (decimal.TryParse(docValue, out var parsedValue) && customsValue.HasValue)
                {
                    var tolerance = customsValue.Value * 0.05m; // 5% tolerance
                    if (Math.Abs(parsedValue - customsValue.Value) > tolerance)
                    {
                        _issues.Add(new ValidationIssue
                        {
                            Severity = "info",
                            Category = "data_consistency",
                            Message = "Shipment value difference",
                            Details = $"Form shows {customsValue} but documents indicate {parsedValue}"
                        });
                    }
                }
            }
        }

        private async Task<List<string>> ValidateComplianceRulesAsync(ShipmentDetailDto detail, List<ExtractedDocument> documents)
        {
            var notes = new List<string>();
            try
            {
                var shipment = detail.Shipment;
                var originCountry = detail.Parties.FirstOrDefault(p => p.PartyType.Equals("shipper", StringComparison.OrdinalIgnoreCase))?.Country ?? string.Empty;
                var destinationCountry = detail.Parties.FirstOrDefault(p => p.PartyType.Equals("consignee", StringComparison.OrdinalIgnoreCase))?.Country ?? string.Empty;
                var packageType = detail.Packages.FirstOrDefault()?.PackageType ?? string.Empty;
                var hsCode = detail.Items.FirstOrDefault()?.HsCode ?? string.Empty;
                var totalWeight = detail.Packages.Any() ? detail.Packages.Sum(p => p.Weight ?? 0m) : (decimal?)null;
                var matchingRules = _complianceLoader.FindMatchingRules(
                    originCountry,
                    destinationCountry,
                    shipment.Mode,
                    packageType,
                    hsCode);

                _logger.LogDebug("Compliance rules matched: {Count} for O={O} D={D} Mode={M} Package={P} HS={HS}",
                    matchingRules.Count, originCountry, destinationCountry, shipment.Mode, packageType, hsCode);

                foreach (var rule in matchingRules)
                { _logger.LogDebug("Rule: O={O} D={D} Mode={M} Package={P} HS={HS} Banned={Banned} Restricted={Restricted}",
                        rule.OriginCountry, rule.DestinationCountry, rule.Mode, rule.PackageType, rule.HsCode, rule.Banned, rule.Restricted);
                    if (!string.IsNullOrWhiteSpace(rule.PackingNotes))
                    {
                        notes.Add(rule.PackingNotes);
                    }
                    // Check if product is banned
                    if (rule.Banned)
                    {
                        _issues.Add(new ValidationIssue
                        {
                            Severity = "error",
                            Category = "compliance",
                            Message = "Product is banned for this route",
                            Details = $"This shipment cannot be sent from {rule.OriginCountry} to {rule.DestinationCountry}. Reason: {rule.BannedDetails}",
                            SuggestedAction = "Change origin/destination or product category, or consult broker for alternative compliance options."
                        });
                        continue;
                    }

                    // Check if product is restricted
                    if (rule.Restricted)
                    {
                        _issues.Add(new ValidationIssue
                        {
                            Severity = "warning",
                            Category = "compliance",
                            Message = "Product is restricted for this route",
                            Details = $"Special requirements apply: {rule.RestrictedDetails}. Ensure all documents address these restrictions.",
                            SuggestedAction = "Provide permits/certifications noted in restrictions (e.g., licenses, declarations) and ensure documents reflect them."
                        });
                    }

                    // Check weight limits
                    if (rule.MaxWeightKgPerPackage.HasValue && totalWeight.HasValue)
                    {
                        if (totalWeight.Value > rule.MaxWeightKgPerPackage.Value)
                        {
                            _issues.Add(new ValidationIssue
                            {
                                Severity = "error",
                                Category = "compliance",
                                Message = "Package weight exceeds limit",
                                Details = $"Maximum {rule.MaxWeightKgPerPackage}kg per package. Your shipment is {totalWeight}kg."
                            });
                        }
                    }

                    if (rule.MaxTotalWeightKg.HasValue && totalWeight.HasValue)
                    {
                        if (totalWeight.Value > rule.MaxTotalWeightKg.Value)
                        {
                            _issues.Add(new ValidationIssue
                            {
                                Severity = "error",
                                Category = "compliance",
                                Message = "Total shipment weight exceeds limit",
                                Details = $"Maximum {rule.MaxTotalWeightKg}kg total. Your shipment is {totalWeight}kg."
                            });
                        }
                    }
                }
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error validating compliance rules for shipment {ShipmentId}", detail.Shipment.Id);
                _issues.Add(new ValidationIssue
                {
                    Severity = "warning",
                    Category = "compliance",
                    Message = "Compliance validation incomplete",
                    Details = "Could not fully validate compliance rules. Please review manually."
                });
            }
            return notes.Distinct().ToList();
        }

        private void ValidateProductRestrictions(ShipmentDetailDto detail, List<ExtractedDocument> documents)
        {
            var mode = detail.Shipment.Mode?.ToLowerInvariant() ?? "";
            var productDesc = (detail.Items.FirstOrDefault()?.Description ?? detail.Items.FirstOrDefault()?.Name ?? "").ToLowerInvariant();

            // Lithium batteries restrictions
            if (productDesc.Contains("lithium") || productDesc.Contains("battery"))
            {
                if (mode == "air")
                {
                    // Check for IATA DG declaration in documents
                    var hasIataDoc = documents.Any(d => 
                        d.ExtractedContent.Contains("IATA", StringComparison.OrdinalIgnoreCase) ||
                        d.ExtractedContent.Contains("DG", StringComparison.OrdinalIgnoreCase));

                    if (!hasIataDoc)
                    {
                        _issues.Add(new ValidationIssue
                        {
                            Severity = "error",
                            Category = "product_restriction",
                            Message = "Missing IATA dangerous goods documentation",
                            Details = "Lithium batteries shipped by air require IATA DG declarations (UN3480/UN3090). Upload IATA certification."
                        });
                    }
                }
            }

            // Pharmaceutical restrictions
            if (productDesc.Contains("pharmaceutical") || productDesc.Contains("medicine") || productDesc.Contains("drug"))
            {
                var hasPharmDoc = documents.Any(d => 
                    d.DocumentType.Contains("license", StringComparison.OrdinalIgnoreCase) ||
                    d.DocumentType.Contains("certificate", StringComparison.OrdinalIgnoreCase) ||
                    d.ExtractedContent.Contains("GMP", StringComparison.OrdinalIgnoreCase));

                if (!hasPharmDoc)
                {
                    _issues.Add(new ValidationIssue
                    {
                        Severity = "error",
                        Category = "product_restriction",
                        Message = "Missing pharmaceutical certifications",
                        Details = "Pharmaceutical products require GMP certificates, pharmacy licenses, and import permits. Upload required documentation."
                    });
                }
            }

            // Hazardous materials
            if (productDesc.Contains("hazard") || productDesc.Contains("chemical") || productDesc.Contains("solvent"))
            {
                var hasHazmatDoc = documents.Any(d =>
                    d.ExtractedContent.Contains("ADR", StringComparison.OrdinalIgnoreCase) ||
                    d.ExtractedContent.Contains("IMDG", StringComparison.OrdinalIgnoreCase) ||
                    d.ExtractedContent.Contains("SDS", StringComparison.OrdinalIgnoreCase));

                if (!hasHazmatDoc)
                {
                    _issues.Add(new ValidationIssue
                    {
                        Severity = "error",
                        Category = "product_restriction",
                        Message = "Missing hazardous materials documentation",
                        Details = "Hazardous materials require Safety Data Sheets (SDS) and ADR/IMDG compliance certificates. Upload documentation."
                    });
                }
            }

            // Live animals
            if (productDesc.Contains("animal") || productDesc.Contains("pet"))
            {
                var hasAnimalDoc = documents.Any(d =>
                    d.ExtractedContent.Contains("veterinary", StringComparison.OrdinalIgnoreCase) ||
                    d.ExtractedContent.Contains("health certificate", StringComparison.OrdinalIgnoreCase));

                if (!hasAnimalDoc)
                {
                    _issues.Add(new ValidationIssue
                    {
                        Severity = "error",
                        Category = "product_restriction",
                        Message = "Missing animal health documentation",
                        Details = "Live animals require veterinary health certificates, import permits, and humane transport certifications. Upload required documents."
                    });
                }
            }
        }

        private void ValidatePackingRequirements(ShipmentDetailDto detail, List<ExtractedDocument> documents)
        {
            var mode = detail.Shipment.Mode?.ToLowerInvariant() ?? "";
            var packageType = (detail.Packages.FirstOrDefault()?.PackageType ?? "").ToLowerInvariant();
            var productDesc = (detail.Items.FirstOrDefault()?.Description ?? detail.Items.FirstOrDefault()?.Name ?? "").ToLowerInvariant();

            // Sea/IMDG requirements
            if (mode == "sea" || mode == "multimodal")
            {
                var hasImdgCompliance = documents.Any(d =>
                    d.ExtractedContent.Contains("IMDG", StringComparison.OrdinalIgnoreCase) ||
                    d.ExtractedContent.Contains("packing", StringComparison.OrdinalIgnoreCase));

                if (!hasImdgCompliance && productDesc.Contains("chemical"))
                {
                    _issues.Add(new ValidationIssue
                    {
                        Severity = "warning",
                        Category = "packing_requirement",
                        Message = "IMDG packing compliance not documented",
                        Details = "Sea shipments of chemicals should document IMDG-compliant packing. Verify in packing list."
                    });
                }
            }

            // Temperature-controlled requirements
            if (productDesc.Contains("pharmaceutical") || productDesc.Contains("fresh") || productDesc.Contains("fruit") || productDesc.Contains("vegetable"))
            {
                var hasTemperatureControl = documents.Any(d =>
                    d.ExtractedContent.Contains("temperature", StringComparison.OrdinalIgnoreCase) ||
                    d.ExtractedContent.Contains("cold chain", StringComparison.OrdinalIgnoreCase) ||
                    d.ExtractedContent.Contains("refrigerat", StringComparison.OrdinalIgnoreCase));

                if (!hasTemperatureControl)
                {
                    _issues.Add(new ValidationIssue
                    {
                        Severity = "info",
                        Category = "packing_requirement",
                        Message = "Temperature control requirements not documented",
                        Details = "Perishable goods typically require cold-chain documentation. Consider adding temperature monitoring documentation."
                    });
                }
            }

            // Fragile/sensitive goods
            if (productDesc.Contains("electronic") || productDesc.Contains("fragile") || productDesc.Contains("toy"))
            {
                var hasShockProtection = documents.Any(d =>
                    d.ExtractedContent.Contains("shock", StringComparison.OrdinalIgnoreCase) ||
                    d.ExtractedContent.Contains("protection", StringComparison.OrdinalIgnoreCase) ||
                    d.ExtractedContent.Contains("cushion", StringComparison.OrdinalIgnoreCase));

                if (!hasShockProtection)
                {
                    _issues.Add(new ValidationIssue
                    {
                        Severity = "info",
                        Category = "packing_requirement",
                        Message = "Shock protection not documented",
                        Details = "Consider documenting protective packing measures for electronics and fragile items."
                    });
                }
            }
        }

        private decimal CalculateValidationScore(List<ValidationIssue> issues)
        {
            if (issues.Count == 0) return 100m;

            var errorCount = issues.Count(i => i.Severity == "error");
            var warningCount = issues.Count(i => i.Severity == "warning");
            var infoCount = issues.Count(i => i.Severity == "info");

            // Hard fail cases: missing core documents -> score 0
            var hasCoreDocError = issues.Any(i => i.Category == "documents" && i.Severity == "error");
            if (hasCoreDocError)
            {
                return 0m;
            }

            // Heavier penalty for any errors
            var score = 100m - (errorCount * 30) - (warningCount * 5) - (infoCount * 1);
            return Math.Max(0, Math.Min(100, score));
        }
    }

    public class ValidationResult
    {
        public long ShipmentId { get; set; }
        public bool IsValid { get; set; }
        public string Status { get; set; } = "pending"; // pending, approved, failed, error
        public string Message { get; set; } = string.Empty;
        public List<ValidationIssue> Issues { get; set; } = new();
        public int IssueCount => Issues.Count;
        public decimal ValidationScore { get; set; }
        public DateTime ValidationStartedAt { get; set; }
        public DateTime? ValidationCompletedAt { get; set; }
        public List<string> PackingNotes { get; set; } = new();
    }

    public class ValidationIssue
    {
        public string Severity { get; set; } = "info"; // info, warning, error
        public string Category { get; set; } = "general"; // documents, data_consistency, compliance, product_restriction, packing_requirement, system
        public string Message { get; set; } = string.Empty;
        public string? Details { get; set; }
        public string? SuggestedAction { get; set; }
    }
}
