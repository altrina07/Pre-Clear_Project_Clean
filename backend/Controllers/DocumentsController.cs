using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Security.Claims;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Logging;
using PreClear.Api.Interfaces;
using PreClear.Api.Models;

namespace PreClear.Api.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    [Authorize] // SECURITY: Require authentication for all document operations
    public class DocumentsController : ControllerBase
    {
        private readonly IDocumentService _service;
        private readonly IDocumentValidationService _validationService;
        private readonly ILogger<DocumentsController> _logger;
        private readonly IS3StorageService _s3;

        public DocumentsController(
            IDocumentService service, 
            IDocumentValidationService validationService,
            ILogger<DocumentsController> logger,
            IS3StorageService s3)
        {
            _service = service;
            _validationService = validationService;
            _logger = logger;
            _s3 = s3;
        }

        private long GetUserId()
        {
            var claim = User.FindFirst(ClaimTypes.NameIdentifier);
            return long.TryParse(claim?.Value, out var id) ? id : 0;
        }

        [HttpPost("shipments/{shipmentId}/upload")]
        [RequestSizeLimit(50_000_000)]
        public async Task<IActionResult> Upload(long shipmentId, [FromForm] Models.FileUploadRequest request, [FromForm] string docType = "Other")
        {
            var file = request?.File;
            if (file == null) return BadRequest(new { error = "file_required" });

            try
            {
                // SECURITY: Extract uploadedBy from JWT claims, not client input
                var uploadedBy = GetUserId();
                if (uploadedBy == 0)
                    return Unauthorized(new { error = "invalid_token" });

                _logger.LogInformation("Uploading document for shipment {ShipmentId}, file {FileName}, docType {DocType}", shipmentId, file.FileName, docType);
                var created = await _service.UploadAsync(shipmentId, uploadedBy, file, docType);
                var location = created.DownloadUrl ?? $"/api/documents/{created.Id}/download";
                _logger.LogInformation("Document uploaded successfully: ID={DocId}, S3Key={S3Key}", created.Id, created.FilePath);
                return Created(location, created);
            }
            catch (ArgumentException aex)
            {
                _logger.LogWarning(aex, "Invalid upload request");
                return BadRequest(new { error = aex.Message });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error uploading document for shipment {ShipmentId}", shipmentId);
                return StatusCode(500, new { error = "internal_error", detail = ex.Message });
            }
        }

        [HttpGet("shipments/{shipmentId}/documents")]
        public async Task<IActionResult> ListByShipment(string shipmentId)
        {
            if (string.IsNullOrWhiteSpace(shipmentId))
            {
                return BadRequest(new { error = "shipment_id_required" });
            }

            // Try to parse as long ID
            if (!long.TryParse(shipmentId, out long numericId))
            {
                // String ID (like SHP-xxx) - log and return empty list
                _logger.LogInformation("Attempt to list documents with string shipment ID: {ShipmentId}", shipmentId);
                return Ok(new List<ShipmentDocument>());
            }

            try
            {
                _logger.LogInformation("Listing documents for shipment {ShipmentId}", shipmentId);
                var list = await _service.GetByShipmentIdAsync(numericId);
                _logger.LogInformation("Found {DocumentCount} documents for shipment {ShipmentId}", list.Count, shipmentId);
                return Ok(list);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error listing documents for shipment {ShipmentId}", shipmentId);
                return StatusCode(500, new { error = "internal_error", detail = ex.Message });
            }
        }

        [HttpPost("shipments/{shipmentId}/mark-uploaded")]
        public async Task<IActionResult> MarkAsUploaded(string shipmentId, [FromBody] MarkUploadedRequest request)
        {
            if (string.IsNullOrWhiteSpace(request?.DocumentName))
                return BadRequest(new { error = "document_name_required" });

            // Try to parse as long ID, otherwise return success for string IDs (not yet in DB)
            if (!long.TryParse(shipmentId, out long numericId))
            {
                // String ID (like SHP-xxx) - return success as document tracking happens in frontend
                return Ok(new { success = true });
            }

            try
            {
                var success = await _service.MarkAsUploadedAsync(numericId, request.DocumentName);
                if (!success) return NotFound(new { error = "document_not_found" });
                return Ok(new { success = true });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error marking document as uploaded");
                return StatusCode(500, new { error = "internal_error" });
            }
        }

        [HttpGet("{id:long}/download")]
        public async Task<IActionResult> Download(long id)
        {
            try
            {
                var (doc, content, contentType, fileName) = await _service.GetDocumentAsync(id);
                if (doc == null || content == null) return NotFound();

                var resolvedContentType = !string.IsNullOrWhiteSpace(contentType)
                    ? contentType
                    : GetContentType(fileName ?? "");

                return File(content, resolvedContentType, fileName ?? $"document-{id}");
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error downloading document {Id}", id);
                return StatusCode(500, new { error = "internal_error" });
            }
        }

        [HttpDelete("{id:long}")]
        public async Task<IActionResult> DeleteDocument(long id)
        {
            try
            {
                _logger.LogInformation("Deleting document {DocumentId}", id);
                var deleted = await _service.DeleteDocumentAsync(id);
                if (!deleted) 
                {
                    _logger.LogWarning("Document {DocumentId} not found", id);
                    return NotFound(new { error = "document_not_found" });
                }
                _logger.LogInformation("Document {DocumentId} deleted successfully", id);
                return Ok(new { success = true, message = "Document deleted successfully" });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error deleting document {Id}", id);
                return StatusCode(500, new { error = "internal_error", detail = ex.Message });
            }
        }

        private static string GetContentType(string path)
        {
            var ext = Path.GetExtension(path).ToLowerInvariant();
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

        [HttpPost("shipments/{shipmentId}/validate")]
        public async Task<IActionResult> ValidateShipmentDocuments(long shipmentId)
        {
            try
            {
                _logger.LogInformation("Starting document validation for shipment {ShipmentId}", shipmentId);
                
                var validationResult = await _validationService.ValidateShipmentDocumentsAsync(shipmentId);
                
                if (validationResult.IsValid)
                {
                    _logger.LogInformation("Shipment {ShipmentId} passed validation with score {Score}", 
                        shipmentId, validationResult.ValidationScore);
                    return Ok(new
                    {
                        success = true,
                        status = "approved",
                        message = validationResult.Message,
                        validationScore = validationResult.ValidationScore,
                        issues = validationResult.Issues,
                        packingNotes = validationResult.PackingNotes
                    });
                }
                else
                {
                    _logger.LogWarning("Shipment {ShipmentId} failed validation. Issues: {IssueCount}", 
                        shipmentId, validationResult.IssueCount);
                    return BadRequest(new
                    {
                        success = false,
                        status = "failed",
                        message = validationResult.Message,
                        validationScore = validationResult.ValidationScore,
                        issues = validationResult.Issues,
                        packingNotes = validationResult.PackingNotes
                    });
                }
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error validating shipment {ShipmentId}", shipmentId);
                return StatusCode(500, new
                {
                    success = false,
                    status = "error",
                    message = "Validation error occurred",
                    detail = ex.Message
                });
            }
        }

        [HttpGet("shipments/{shipmentId}/validation-status")]
        public async Task<IActionResult> GetValidationStatus(long shipmentId)
        {
            try
            {
                var result = await _validationService.GetValidationResultAsync(shipmentId);
                
                if (result == null)
                {
                    return Ok(new
                    {
                        status = "not_validated",
                        message = "Shipment has not been validated yet"
                    });
                }

                return Ok(new
                {
                    status = result.Status,
                    isValid = result.IsValid,
                    message = result.Message,
                    validationScore = result.ValidationScore,
                    issues = result.Issues,
                    completedAt = result.ValidationCompletedAt
                });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error getting validation status for shipment {ShipmentId}", shipmentId);
                return StatusCode(500, new { error = "internal_error", detail = ex.Message });
            }
        }

        [HttpDelete("shipments/{shipmentId}/documents")]
        public async Task<IActionResult> DeleteShipmentDocuments(long shipmentId)
        {
            try
            {
                var removed = await _service.DeleteShipmentDocumentsAsync(shipmentId);
                // If DB rows are already gone (manual delete), fall back to S3 scan
                if (removed == 0)
                {
                    var s3Deleted = await _s3.DeleteAllFilesForShipmentAsync(shipmentId);
                    return Ok(new { deleted = 0, s3Deleted });
                }
                return Ok(new { deleted = removed, s3Deleted = 0 });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error deleting documents for shipment {ShipmentId}", shipmentId);
                return StatusCode(500, new { error = "internal_error", detail = ex.Message });
            }
        }

        // Direct S3 cleanup by shipment id when DB rows are gone
        [HttpDelete("shipments/{shipmentId}/s3")] 
        public async Task<IActionResult> DeleteShipmentS3(long shipmentId)
        {
            try
            {
                var count = await _s3.DeleteAllFilesForShipmentAsync(shipmentId);
                return Ok(new { s3Deleted = count });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error deleting S3 objects for shipment {ShipmentId}", shipmentId);
                return StatusCode(500, new { error = "internal_error", detail = ex.Message });
            }
        }

        [HttpPost("shipments/{shipmentId}/request-documents")]
        public async Task<IActionResult> RequestDocuments(long shipmentId, [FromBody] CreateDocumentRequestDto dto)
        {
            try
            {
                var brokerId = GetUserId();
                _logger.LogInformation("Broker {BrokerId} requesting documents for shipment {ShipmentId}", brokerId, shipmentId);
                
                var request = await _service.RequestDocumentsAsync(shipmentId, brokerId, dto.DocumentNames, dto.Message);
                
                return Ok(new { success = true, request });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error requesting documents for shipment {ShipmentId}", shipmentId);
                return StatusCode(500, new { error = "internal_error", detail = ex.Message });
            }
        }

        [HttpGet("shipments/{shipmentId}/document-requests")]
        public async Task<IActionResult> GetDocumentRequests(long shipmentId)
        {
            try
            {
                var requests = await _service.GetDocumentRequestsAsync(shipmentId);
                return Ok(requests);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error getting document requests for shipment {ShipmentId}", shipmentId);
                return StatusCode(500, new { error = "internal_error", detail = ex.Message });
            }
        }
    }
}
 
