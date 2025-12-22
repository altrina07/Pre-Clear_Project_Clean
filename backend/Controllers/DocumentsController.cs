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
        private readonly ILogger<DocumentsController> _logger;

        public DocumentsController(IDocumentService service, ILogger<DocumentsController> logger)
        {
            _service = service;
            _logger = logger;
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
    }
}
 
