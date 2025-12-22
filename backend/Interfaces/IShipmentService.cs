namespace PreClear.Api.Interfaces
{
    public interface IShipmentService
    {
        System.Threading.Tasks.Task<System.Collections.Generic.List<PreClear.Api.Models.Shipment>> GetByUserAsync(long userId);
        System.Threading.Tasks.Task<System.Collections.Generic.List<PreClear.Api.Models.ShipmentListItemDto>> GetUserListAsync(long userId);
        System.Threading.Tasks.Task<System.Collections.Generic.List<PreClear.Api.Models.ShipmentListItemDto>> GetBrokerListAsync(long brokerId);
        System.Threading.Tasks.Task<System.Collections.Generic.List<PreClear.Api.Models.Shipment>> GetAllShipmentsAsync();
        System.Threading.Tasks.Task<System.Collections.Generic.List<PreClear.Api.Models.NormalizedShipmentDto>> GetAllShipmentsDetailedAsync();
        System.Threading.Tasks.Task<PreClear.Api.Models.Shipment> CreateAsync(PreClear.Api.Models.UpsertShipmentDto dto);
        System.Threading.Tasks.Task<PreClear.Api.Models.Shipment?> GetByIdAsync(long id);
        System.Threading.Tasks.Task<PreClear.Api.Models.ShipmentDetailDto?> GetDetailAsync(long id);
        System.Threading.Tasks.Task<PreClear.Api.Models.AiComplianceResponse> RunAiComplianceCheckAsync(long shipmentId);
        System.Threading.Tasks.Task<PreClear.Api.Models.ShipmentDetailDto?> StartAiComplianceCheckAsync(long shipmentId);
        System.Threading.Tasks.Task<PreClear.Api.Models.Shipment?> UpdateAsync(long id, PreClear.Api.Models.UpsertShipmentDto dto);
        System.Threading.Tasks.Task<bool> UpdateStatusAsync(long shipmentId, string status);
        System.Threading.Tasks.Task<bool> PersistAiPredictedDocumentsAsync(long shipmentId, string[] predictedDocuments);
        System.Threading.Tasks.Task<(bool success, string? token)> GenerateTokenIfBothApprovalsCompleteAsync(long shipmentId);
        System.Threading.Tasks.Task<bool> DeleteShipmentAsync(long shipmentId);
    }
}
