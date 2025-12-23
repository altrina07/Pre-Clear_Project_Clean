using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using System.Text.Json.Serialization;

namespace PreClear.Api.Models
{
    [Table("notifications")]
    public class Notification
    {
        [Key]
        [Column("id")]
        public long Id { get; set; }

        [Column("user_id")]
        [Required]
        public long UserId { get; set; }

        [Column("type")]
        [MaxLength(100)]
        [Required]
        public string Type { get; set; } = null!;

        [Column("title")]
        [MaxLength(255)]
        [Required]
        public string Title { get; set; } = null!;

        [Column("message")]
        [Required]
        public string Message { get; set; } = null!;

        [Column("shipment_id")]
        public long? ShipmentId { get; set; }

        [Column("redirect_url")]
        [MaxLength(500)]
        public string? RedirectUrl { get; set; }

        [Column("is_read")]
        public bool IsRead { get; set; } = false;

        [Column("created_at")]
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

        // Navigation
        [ForeignKey("UserId")]
        public User? User { get; set; }

        [ForeignKey("ShipmentId")]
        [JsonIgnore]
        public Shipment? Shipment { get; set; }
    }
}
