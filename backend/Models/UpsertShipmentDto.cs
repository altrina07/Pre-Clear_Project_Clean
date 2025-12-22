using System.Collections.Generic;

namespace PreClear.Api.Models
{
    public class UpsertShipmentDto
    {
        public string? ShipmentName { get; set; }
        public string Mode { get; set; } = "Air";
        public string ShipmentType { get; set; } = "International";
        public string Status { get; set; } = "draft";
        public string? ServiceLevel { get; set; }
        public decimal? CustomsValue { get; set; }
        public string? Currency { get; set; }
        public decimal? PricingTotal { get; set; }

        // Pickup Information
        public string? PickupType { get; set; }
        public string? PickupLocation { get; set; }
        public DateTime? PickupDate { get; set; }
        public string? PickupTimeEarliest { get; set; }
        public string? PickupTimeLatest { get; set; }
        public DateTime? EstimatedDropoffDate { get; set; }

        // Parties
        public PartyDto? Shipper { get; set; }
        public PartyDto? Consignee { get; set; }
        public List<PartyDto>? OtherParties { get; set; }

        // Packages and items (products inside packages in UI)
        public List<PackageDto>? Packages { get; set; }

        // Services
        public List<ServiceDto>? Services { get; set; }
    }

    public class PartyDto
    {
        public string PartyType { get; set; } = "shipper";
        public string CompanyName { get; set; } = string.Empty;
        public string? ContactName { get; set; }
        public string? Phone { get; set; }
        public string? Email { get; set; }
        public string? Address1 { get; set; }
        public string? Address2 { get; set; }
        public string? City { get; set; }
        public string? State { get; set; }
        public string? PostalCode { get; set; }
        public string? Country { get; set; }
        public string? TaxId { get; set; }
    }

    public class PackageDto
    {
        public string PackageType { get; set; } = "Box";
        public decimal? Length { get; set; }
        public decimal? Width { get; set; }
        public decimal? Height { get; set; }
        public string DimensionUnit { get; set; } = "cm";
        public decimal? Weight { get; set; }
        public string WeightUnit { get; set; } = "kg";
        public bool Stackable { get; set; }
        public List<ProductDto>? Products { get; set; }
    }

    public class ProductDto
    {
        public string? Name { get; set; }
        public string? Description { get; set; }
        public string? Category { get; set; }
        public string? HsCode { get; set; }
        public decimal Quantity { get; set; } = 1;
        public string Unit { get; set; } = "pcs";
        public decimal? UnitPrice { get; set; }
        public decimal? TotalValue { get; set; }
        public string? OriginCountry { get; set; }
        public string? ExportReason { get; set; } = "Sale";
    }

    public class ServiceDto
    {
        public string? ServiceType { get; set; }
        public string? Notes { get; set; }
    }
}
