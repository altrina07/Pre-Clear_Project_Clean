using System.Collections.Generic;
using System.IO;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Http;
using PreClear.Api.Models;

namespace PreClear.Api.Interfaces
{
    public interface IDocumentService
    {
        Task<ShipmentDocument> UploadAsync(long shipmentId, long? uploadedBy, IFormFile file, string docType);
        Task<List<ShipmentDocument>> GetByShipmentIdAsync(long shipmentId);
        Task<(ShipmentDocument? Document, Stream? Content, string? ContentType, string? FileName)> GetDocumentAsync(long id);
        Task<bool> MarkAsUploadedAsync(long shipmentId, string documentName);
    }
}
 
