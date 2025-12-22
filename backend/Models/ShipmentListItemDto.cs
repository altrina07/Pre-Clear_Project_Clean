using System;

namespace PreClear.Api.Models
{
    public class ShipmentListItemDto
    {
        public long Id { get; set; }
        public string ReferenceId { get; set; } = string.Empty;
        public string? Title { get; set; }

        public string? OriginCity { get; set; }
        public string? OriginCompany { get; set; }
        public string? OriginCountry { get; set; }
        public string? DestinationCity { get; set; }
        public string? DestinationCompany { get; set; }
        public string? DestinationCountry { get; set; }

        public string Mode { get; set; } = string.Empty;
        public string ShipmentType { get; set; } = string.Empty;

        public decimal? Value { get; set; }
        public string? Currency { get; set; }

        public decimal? AiComplianceScore { get; set; }
        public string? AiApprovalStatus { get; set; }
        public string? BrokerApprovalStatus { get; set; }
        public string? PreclearToken { get; set; }
        public string Status { get; set; } = string.Empty;
        public long? AssignedBrokerId { get; set; }
        public DateTime CreatedAt { get; set; }
        public DateTime UpdatedAt { get; set; }
    }
}
