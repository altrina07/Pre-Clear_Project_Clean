using System.Collections.Generic;
using System.Threading.Tasks;
using PreClear.Api.AI.Services.DocumentValidator;
using PreClear.Api.Models;

namespace PreClear.Api.Interfaces
{
    public interface IDocumentValidationService
    {
        /// <summary>
        /// Validates all documents for a shipment
        /// </summary>
        Task<ValidationResult> ValidateShipmentDocumentsAsync(long shipmentId);

        /// <summary>
        /// Extracts content from all shipment documents
        /// </summary>
        Task<List<ExtractedDocument>> ExtractShipmentDocumentsAsync(long shipmentId, long shipperId);

        /// <summary>
        /// Loads compliance dataset from file
        /// </summary>
        Task InitializeComplianceDatasetAsync(string datasetPath);

        /// <summary>
        /// Gets validation result for a shipment (if cached)
        /// </summary>
        Task<ValidationResult?> GetValidationResultAsync(long shipmentId);

        /// <summary>
        /// Saves validation result to database
        /// </summary>
        Task SaveValidationResultAsync(long shipmentId, ValidationResult result);
    }
}
