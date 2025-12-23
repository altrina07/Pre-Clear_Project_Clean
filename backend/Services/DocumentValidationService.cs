using System;
using System.Collections.Generic;
using System.Text.Json;
using System.Threading.Tasks;
using Amazon.Textract;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using PreClear.Api.AI.Services.DocumentValidator;
using PreClear.Api.Interfaces;
using PreClear.Api.Models;

namespace PreClear.Api.Services
{
    public class DocumentValidationService : IDocumentValidationService
    {
        private readonly DocumentExtractor _extractor;
        private readonly DocumentValidator _validator;
        private readonly ComplianceDatasetLoader _complianceLoader;
        private readonly IShipmentRepository _shipmentRepo;
        private readonly IDocumentRepository _docRepo;
        private readonly IS3StorageService _s3Service;
        private readonly IAmazonTextract _textractClient;
        private readonly ILogger<DocumentValidationService> _logger;
        private readonly Dictionary<long, ValidationResult> _validationCache;

        public DocumentValidationService(
            IShipmentRepository shipmentRepo,
            IDocumentRepository docRepo,
            IS3StorageService s3Service,
            IAmazonTextract textractClient,
            ILogger<DocumentValidationService> logger,
            ComplianceDatasetLoader complianceLoader,
            DocumentExtractor extractor,
            DocumentValidator validator)
        {
            _shipmentRepo = shipmentRepo;
            _docRepo = docRepo;
            _s3Service = s3Service;
            _textractClient = textractClient;
            _logger = logger;
            _validationCache = new Dictionary<long, ValidationResult>();

            // Initialize validator components (resolved via DI)
            _complianceLoader = complianceLoader;
            _extractor = extractor;
            _validator = validator;
        }

        public async Task InitializeComplianceDatasetAsync(string datasetPath)
        {
            try
            {
                await _complianceLoader.LoadDatasetAsync(datasetPath);
                _logger.LogInformation("Compliance dataset loaded successfully from {Path}", datasetPath);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error initializing compliance dataset");
                throw;
            }
        }

        public async Task<List<ExtractedDocument>> ExtractShipmentDocumentsAsync(long shipmentId, long shipperId)
        {
            try
            {
                _logger.LogInformation("Extracting documents for shipment {ShipmentId}", shipmentId);
                var documents = await _extractor.ExtractShipmentDocumentsAsync(shipmentId, shipperId);
                _logger.LogInformation("Extracted {Count} documents for shipment {ShipmentId}", documents.Count, shipmentId);
                return documents;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error extracting shipment documents for shipment {ShipmentId}", shipmentId);
                throw;
            }
        }

        public async Task<ValidationResult> ValidateShipmentDocumentsAsync(long shipmentId)
        {
            try
            {
                _logger.LogInformation("Starting document validation for shipment {ShipmentId}", shipmentId);

                // Get shipment details
                var shipment = await _shipmentRepo.GetByIdAsync(shipmentId);
                if (shipment == null)
                {
                    _logger.LogWarning("Shipment {ShipmentId} not found", shipmentId);
                    return new ValidationResult
                    {
                        ShipmentId = shipmentId,
                        IsValid = false,
                        Status = "error",
                        Message = "Shipment not found",
                        ValidationStartedAt = DateTime.UtcNow,
                        ValidationCompletedAt = DateTime.UtcNow
                    };
                }

                // Extract documents
                var extractedDocuments = await ExtractShipmentDocumentsAsync(shipmentId, shipment.CreatedBy);

                // Build detail model
                var parties = await _shipmentRepo.GetPartiesAsync(shipmentId);
                var packages = await _shipmentRepo.GetPackagesAsync(shipmentId);
                var items = await _shipmentRepo.GetItemsAsync(shipmentId);
                var services = await _shipmentRepo.GetServicesAsync(shipmentId);
                var detail = new ShipmentDetailDto
                {
                    Shipment = shipment,
                    Parties = parties ?? new List<ShipmentParty>(),
                    Packages = packages ?? new List<ShipmentPackage>(),
                    Items = items ?? new List<ShipmentProduct>(),
                    Services = services
                };

                // Run validation
                var result = await _validator.ValidateShipmentAsync(detail, extractedDocuments);

                // Cache result
                _validationCache[shipmentId] = result;

                // Save result to documents
                await SaveValidationResultAsync(shipmentId, result);

                // Update shipment AI approval status and compliance score
                try
                {
                    shipment.AiApprovalStatus = result.IsValid ? "approved" : "rejected";
                    shipment.AiComplianceScore = result.ValidationScore;
                    await _shipmentRepo.UpdateAsync(shipment);
                }
                catch (Exception ex2)
                {
                    _logger.LogError(ex2, "Failed to update shipment AI approval status for {ShipmentId}", shipmentId);
                }

                _logger.LogInformation(
                    "Document validation completed for shipment {ShipmentId}. Valid={Valid}, Score={Score}",
                    shipmentId, result.IsValid, result.ValidationScore);

                return result;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error validating shipment documents for shipment {ShipmentId}", shipmentId);
                return new ValidationResult
                {
                    ShipmentId = shipmentId,
                    IsValid = false,
                    Status = "error",
                    Message = $"Validation error: {ex.Message}",
                    ValidationStartedAt = DateTime.UtcNow,
                    ValidationCompletedAt = DateTime.UtcNow,
                    Issues = new List<ValidationIssue>
                    {
                        new ValidationIssue
                        {
                            Severity = "error",
                            Category = "system",
                            Message = "Validation system error",
                            Details = ex.Message
                        }
                    }
                };
            }
        }

        public async Task<ValidationResult?> GetValidationResultAsync(long shipmentId)
        {
            if (_validationCache.TryGetValue(shipmentId, out var cached))
            {
                return cached;
            }

            // In a production system, fetch from database cache
            // For now, return null to indicate need for validation
            return null;
        }

        public async Task SaveValidationResultAsync(long shipmentId, ValidationResult result)
        {
            try
            {
                // Get all documents for this shipment
                var documents = await _docRepo.GetByShipmentIdAsync(shipmentId);

                if (documents == null || documents.Count == 0)
                {
                    _logger.LogWarning("No documents found to update validation results for shipment {ShipmentId}", shipmentId);
                    return;
                }

                // Update each document with validation status
                var validationStatus = result.IsValid ? "pass" : "fail";
                var validationNotes = JsonSerializer.Serialize(new
                {
                    status = result.Status,
                    message = result.Message,
                    score = result.ValidationScore,
                    issues = result.Issues,
                    completedAt = result.ValidationCompletedAt
                });

                foreach (var doc in documents)
                {
                    doc.ValidationStatus = validationStatus;
                    doc.ValidationConfidence = (decimal)result.ValidationScore / 100;
                    doc.ValidationNotesJson = validationNotes;
                    
                    // Update in repository
                    await _docRepo.UpdateAsync(doc);
                }

                _logger.LogInformation(
                    "Saved validation results for {Count} documents in shipment {ShipmentId}",
                    documents.Count, shipmentId);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error saving validation results for shipment {ShipmentId}", shipmentId);
                // Don't throw - validation was successful even if we can't save the result
            }
        }
    }
}
