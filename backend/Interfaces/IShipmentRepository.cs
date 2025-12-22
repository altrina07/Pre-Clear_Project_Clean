using System.Collections.Generic;
using System.Threading.Tasks;
using PreClear.Api.Models;

namespace PreClear.Api.Interfaces
{
    public interface IShipmentRepository
    {
        Task<Shipment> AddAsync(Shipment shipment);
        Task<Shipment?> GetByIdAsync(long id);
        Task<List<Shipment>> GetByUserAsync(long userId);
        Task<List<ShipmentListItemDto>> GetUserListAsync(long userId);
        Task<List<ShipmentListItemDto>> GetBrokerListAsync(long brokerId);
        Task<List<Shipment>> GetAllShipmentsAsync();
        Task UpdateAsync(Shipment shipment);
        Task PersistAiDocumentsAsync(long shipmentId, string[] predictedDocuments);
        Task ReplacePartiesAsync(long shipmentId, IEnumerable<ShipmentParty> parties);
        Task ReplacePackagesAsync(long shipmentId, IEnumerable<ShipmentPackage> packages);
        Task ReplaceItemsAsync(long shipmentId, IEnumerable<ShipmentProduct> items);
        Task ReplaceServicesAsync(long shipmentId, IEnumerable<ShipmentServiceData> services);
        Task<List<ShipmentParty>> GetPartiesAsync(long shipmentId);
        Task<List<ShipmentPackage>> GetPackagesAsync(long shipmentId);
        Task<List<ShipmentProduct>> GetItemsAsync(long shipmentId);
        Task<ShipmentServiceData?> GetServicesAsync(long shipmentId);
        Task<bool> DeleteAsync(long shipmentId);
    }

    public class ShipmentServiceData
    {
        public long ShipmentId { get; set; }
        public string? ServiceLevel { get; set; }
        public string? Incoterm { get; set; }
        public string? BillTo { get; set; }
        public string? Currency { get; set; }
        public decimal? CustomsValue { get; set; }
        public bool InsuranceRequired { get; set; }
    }
}
