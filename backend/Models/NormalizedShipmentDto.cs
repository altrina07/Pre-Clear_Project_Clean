using System;
using System.Collections.Generic;

namespace PreClear.Api.Models
{
    // Flat, frontend-aligned DTO for Shipment Details
    public class NormalizedShipmentDto
    {
        // Core identifiers
        public long id { get; set; }
        public string referenceId { get; set; } = string.Empty;

        // Top-level shipment fields (flattened)
        public string? title { get; set; }
        public string mode { get; set; } = "Air";
        public string shipmentType { get; set; } = "International";
        public string? serviceLevel { get; set; }
        public string? currency { get; set; } = "USD";
        public decimal? customsValue { get; set; }
        public decimal? pricingTotal { get; set; }

        // Pickup information
        public string? pickupType { get; set; }
        public string? pickupLocation { get; set; }
        public DateTime? pickupDate { get; set; }
        public string? pickupTimeEarliest { get; set; }
        public string? pickupTimeLatest { get; set; }
        public DateTime? estimatedDropoffDate { get; set; }

        // Status/approvals
        public string status { get; set; } = "draft";
        public string? aiApprovalStatus { get; set; }
        public string? brokerApprovalStatus { get; set; }
        public decimal? aiComplianceScore { get; set; }
        public string? preclearToken { get; set; }
        public DateTime? tokenGeneratedAt { get; set; }
        public long? assignedBrokerId { get; set; }

        // Parties
        public PartyView? shipper { get; set; }
        public PartyView? consignee { get; set; }

        // Packages (with products inside)
        public List<PackageView> packages { get; set; } = new();

        // Documents flags object (optional; UI tolerates empty)
        public object documents { get; set; } = new { };

        // Timestamps
        public DateTime createdAt { get; set; }
        public DateTime updatedAt { get; set; }

        // Optional services container (kept minimal for compatibility)
        public ServiceView? services { get; set; }
    }

    public class PartyView
    {
        public string? company { get; set; }
        public string? contactName { get; set; }
        public string? phone { get; set; }
        public string? email { get; set; }
        public string? address1 { get; set; }
        public string? address2 { get; set; }
        public string? city { get; set; }
        public string? state { get; set; }
        public string? postalCode { get; set; }
        public string? country { get; set; }
        public string? taxId { get; set; }
    }

    public class PackageView
    {
        public string? type { get; set; }
        public decimal? length { get; set; }
        public decimal? width { get; set; }
        public decimal? height { get; set; }
        public string? dimUnit { get; set; }
        public decimal? weight { get; set; }
        public string? weightUnit { get; set; }
        public bool stackable { get; set; }
        public List<ProductView> products { get; set; } = new();
    }

    public class ProductView
    {
        public string? name { get; set; }
        public string? description { get; set; }
        public string? category { get; set; }
        public string? hsCode { get; set; }
        public decimal qty { get; set; }
        public string uom { get; set; } = "pcs";
        public decimal? unitPrice { get; set; }
        public decimal? totalValue { get; set; }
        public string? originCountry { get; set; }
        public string? reasonForExport { get; set; }
    }

    public class ServiceView
    {
        public string? serviceLevel { get; set; }
        public string? currency { get; set; }
        public decimal? customsValue { get; set; }
    }
}
