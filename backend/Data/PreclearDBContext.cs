using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using PreClear.Api.Models;
using PreClear.Api.Utils;

namespace PreClear.Api.Data
{
    public class PreclearDbContext : DbContext
    {
        public PreclearDbContext(DbContextOptions<PreclearDbContext> options) : base(options) { }

        public DbSet<User> Users { get; set; }
        public DbSet<ShipperProfile> ShipperProfiles { get; set; }
        public DbSet<BrokerProfile> BrokerProfiles { get; set; }
        public DbSet<Shipment> Shipments { get; set; }
        public DbSet<ShipmentParty> ShipmentParties { get; set; }
        public DbSet<ShipmentPackage> ShipmentPackages { get; set; }
        public DbSet<ShipmentProduct> ShipmentProducts { get; set; }
        public DbSet<ShipmentCompliance> ShipmentCompliance { get; set; }
        public DbSet<ShipmentDocument> ShipmentDocuments { get; set; }
        public DbSet<DocumentRequest> DocumentRequests { get; set; }
        public DbSet<BrokerReview> BrokerReviews { get; set; }
        public DbSet<Notification> Notifications { get; set; }
        public DbSet<ShipmentMessage> ShipmentMessages { get; set; }

        protected override void OnModelCreating(ModelBuilder modelBuilder)
        {
            base.OnModelCreating(modelBuilder);

            // -------- users
            modelBuilder.Entity<User>(entity =>
            {
                entity.ToTable("users");
                entity.HasKey(u => u.Id);
                entity.Property(u => u.Id).HasColumnName("id");
                entity.Property(u => u.FirstName).HasColumnName("first_name").HasMaxLength(150);
                entity.Property(u => u.LastName).HasColumnName("last_name").HasMaxLength(150);

                entity.Property(u => u.Email).HasColumnName("email").HasMaxLength(255).IsRequired();
                entity.HasIndex(u => u.Email).IsUnique();
                entity.Property(u => u.PasswordHash).HasColumnName("password_hash").HasMaxLength(255).IsRequired();
                entity.Property(u => u.Role).HasColumnName("role").HasMaxLength(50).IsRequired();
                entity.Property(u => u.Phone).HasColumnName("phone").HasMaxLength(50);
                entity.Property(u => u.Company).HasColumnName("company").HasMaxLength(255);

                entity.Property(u => u.TosAccepted).HasColumnName("tos_accepted").HasDefaultValue(false);
                entity.Property(u => u.EmailVerified).HasColumnName("email_verified").HasDefaultValue(false);
                entity.Property(u => u.IsActive).HasColumnName("is_active").HasDefaultValue(true);
                entity.Property(u => u.CreatedAt).HasColumnName("created_at").HasColumnType("datetime(3)").HasDefaultValueSql("CURRENT_TIMESTAMP(3)");
                entity.Property(u => u.UpdatedAt).HasColumnName("updated_at").HasColumnType("datetime(3)").ValueGeneratedOnAddOrUpdate();

                entity.Property(u => u.MetadataJson).HasColumnName("metadata").HasColumnType("json");

                entity.HasIndex(u => u.Role).HasDatabaseName("idx_users_role");
                entity.HasIndex(u => u.IsActive).HasDatabaseName("idx_users_active");
                
                // Navigation properties
                entity.HasOne(u => u.ShipperProfile).WithOne(sp => sp.User).HasForeignKey<ShipperProfile>(sp => sp.UserId).OnDelete(DeleteBehavior.Cascade);
                entity.HasOne(u => u.BrokerProfile).WithOne(bp => bp.User).HasForeignKey<BrokerProfile>(bp => bp.UserId).OnDelete(DeleteBehavior.Cascade);
            });

            // -------- shipper_profiles
            modelBuilder.Entity<ShipperProfile>(entity =>
            {
                entity.ToTable("shipper_profiles");
                entity.HasKey(sp => sp.UserId);
                entity.Property(sp => sp.UserId).HasColumnName("user_id");
                entity.Property(sp => sp.AddressLine1).HasColumnName("address_line_1").HasMaxLength(500);
                entity.Property(sp => sp.AddressLine2).HasColumnName("address_line_2").HasMaxLength(500);
                entity.Property(sp => sp.City).HasColumnName("city").HasMaxLength(150);
                entity.Property(sp => sp.State).HasColumnName("state").HasMaxLength(150);
                entity.Property(sp => sp.PostalCode).HasColumnName("postal_code").HasMaxLength(50);
                entity.Property(sp => sp.CountryCode).HasColumnName("country_code").HasMaxLength(2).HasDefaultValue("US");
                entity.Property(sp => sp.Timezone).HasColumnName("timezone").HasMaxLength(100).HasDefaultValue("America/New_York");
                entity.Property(sp => sp.Language).HasColumnName("language").HasMaxLength(10).HasDefaultValue("en");
                entity.Property(sp => sp.CompanyRole).HasColumnName("company_role").HasMaxLength(150);
                entity.Property(sp => sp.CreatedAt).HasColumnName("created_at").HasColumnType("datetime(3)").HasDefaultValueSql("CURRENT_TIMESTAMP(3)");
                entity.Property(sp => sp.UpdatedAt).HasColumnName("updated_at").HasColumnType("datetime(3)").ValueGeneratedOnAddOrUpdate();
            });

            // -------- broker_profiles
            modelBuilder.Entity<BrokerProfile>(entity =>
            {
                entity.ToTable("broker_profiles");
                entity.HasKey(bp => bp.UserId);
                entity.Property(bp => bp.UserId).HasColumnName("user_id");
                entity.Property(bp => bp.LicenseNumber).HasColumnName("license_number").HasMaxLength(150);
                entity.Property(bp => bp.YearsOfExperience).HasColumnName("years_of_experience");
                entity.Property(bp => bp.OriginCountriesJson).HasColumnName("origin_countries").HasColumnType("json");
                entity.Property(bp => bp.DestinationCountriesJson).HasColumnName("destination_countries").HasColumnType("json");
                entity.Property(bp => bp.HsCategoriesJson).HasColumnName("hs_categories").HasColumnType("json");
                entity.Property(bp => bp.IsAvailable).HasColumnName("is_available").HasDefaultValue(true);
                entity.Property(bp => bp.MaxConcurrentShipments).HasColumnName("max_concurrent_shipments").HasDefaultValue(10);
                entity.Property(bp => bp.CreatedAt).HasColumnName("created_at").HasColumnType("datetime(3)").HasDefaultValueSql("CURRENT_TIMESTAMP(3)");
                entity.Property(bp => bp.UpdatedAt).HasColumnName("updated_at").HasColumnType("datetime(3)").ValueGeneratedOnAddOrUpdate();
            });

            // -------- shipments
            modelBuilder.Entity<Shipment>(entity =>
            {
                entity.ToTable("shipments");
                entity.HasKey(s => s.Id);
                entity.Property(s => s.Id).HasColumnName("id");
                entity.Property(s => s.ReferenceId).HasColumnName("reference_id").HasMaxLength(120);
                entity.HasIndex(s => s.ReferenceId).IsUnique().HasDatabaseName("idx_shipments_reference");
                entity.Property(s => s.ShipmentName).HasColumnName("shipment_name").HasMaxLength(255);
                entity.Property(s => s.Mode).HasColumnName("mode").HasMaxLength(50);
                entity.Property(s => s.ShipmentType).HasColumnName("shipment_type").HasMaxLength(50);
                entity.Property(s => s.ServiceLevel).HasColumnName("service_level").HasMaxLength(50);
                entity.Property(s => s.PickupType).HasColumnName("pickup_type").HasMaxLength(50);
                entity.Property(s => s.PickupLocation).HasColumnName("pickup_location").HasMaxLength(500);
                entity.Property(s => s.PickupDate).HasColumnName("pickup_date").HasColumnType("datetime(3)");
                entity.Property(s => s.PickupTimeEarliest).HasColumnName("pickup_time_earliest").HasMaxLength(10);
                entity.Property(s => s.PickupTimeLatest).HasColumnName("pickup_time_latest").HasMaxLength(10);
                entity.Property(s => s.EstimatedDropoffDate).HasColumnName("estimated_dropoff_date").HasColumnType("datetime(3)");
                entity.Property(s => s.Currency).HasColumnName("currency").HasMaxLength(3).HasDefaultValue("USD");
                entity.Property(s => s.CustomsValue).HasColumnName("customs_value").HasColumnType("decimal(18,2)");
                entity.Property(s => s.Status).HasColumnName("status").HasMaxLength(50).HasDefaultValue("draft");
                entity.Property(s => s.AiApprovalStatus).HasColumnName("ai_approval_status").HasMaxLength(50);
                entity.Property(s => s.AiComplianceScore).HasColumnName("ai_compliance_score").HasColumnType("decimal(5,2)");
                entity.Property(s => s.BrokerApprovalStatus).HasColumnName("broker_approval_status").HasMaxLength(50);
                entity.Property(s => s.PreclearToken).HasColumnName("preclear_token").HasMaxLength(150);
                entity.Property(s => s.TokenGeneratedAt).HasColumnName("token_generated_at").HasColumnType("datetime(3)");
                entity.Property(s => s.CreatedBy).HasColumnName("created_by").IsRequired();
                entity.Property(s => s.AssignedBrokerId).HasColumnName("assigned_broker_id");
                entity.Property(s => s.CreatedAt).HasColumnName("created_at").HasColumnType("datetime(3)").HasDefaultValueSql("CURRENT_TIMESTAMP(3)");
                entity.Property(s => s.UpdatedAt).HasColumnName("updated_at").HasColumnType("datetime(3)").ValueGeneratedOnAddOrUpdate();

                entity.HasIndex(s => s.Mode).HasDatabaseName("idx_shipments_mode");
                entity.HasIndex(s => s.Status).HasDatabaseName("idx_shipments_status");
                entity.HasIndex(s => s.CreatedBy).HasDatabaseName("idx_shipments_created_by");
                entity.HasIndex(s => s.AssignedBrokerId).HasDatabaseName("idx_shipments_assigned_broker");
                
                // Ownership relationships
                entity.HasOne(s => s.Creator).WithMany().HasForeignKey(s => s.CreatedBy).HasConstraintName("FK_shipments_users_created_by").OnDelete(DeleteBehavior.Restrict);
                entity.HasOne(s => s.AssignedBroker).WithMany().HasForeignKey(s => s.AssignedBrokerId).HasConstraintName("FK_shipments_users_assigned_broker").OnDelete(DeleteBehavior.SetNull);
                
                // Collections
                entity.HasMany(s => s.Parties).WithOne(p => p.Shipment).HasForeignKey(p => p.ShipmentId).OnDelete(DeleteBehavior.Cascade);
                entity.HasMany(s => s.Packages).WithOne(p => p.Shipment).HasForeignKey(p => p.ShipmentId).OnDelete(DeleteBehavior.Cascade);
                entity.HasMany(s => s.Documents).WithOne(d => d.Shipment).HasForeignKey(d => d.ShipmentId).OnDelete(DeleteBehavior.Cascade);
                entity.HasOne(s => s.Compliance).WithOne(c => c.Shipment).HasForeignKey<ShipmentCompliance>(c => c.ShipmentId).OnDelete(DeleteBehavior.Cascade);
            });

            // -------- shipment_parties
            modelBuilder.Entity<ShipmentParty>(entity =>
            {
                entity.ToTable("shipment_parties");
                entity.HasKey(p => p.Id);
                entity.Property(p => p.Id).HasColumnName("id");
                entity.Property(p => p.ShipmentId).HasColumnName("shipment_id");
                entity.Property(p => p.PartyType).HasColumnName("party_type").HasMaxLength(20);
                entity.Property(p => p.CompanyName).HasColumnName("company_name").HasMaxLength(255).IsRequired();
                entity.Property(p => p.ContactName).HasColumnName("contact_name").HasMaxLength(200);
                entity.Property(p => p.Phone).HasColumnName("phone").HasMaxLength(50);
                entity.Property(p => p.Email).HasColumnName("email").HasMaxLength(255);
                entity.Property(p => p.Address1).HasColumnName("address_1").HasMaxLength(500);
                entity.Property(p => p.Address2).HasColumnName("address_2").HasMaxLength(500);
                entity.Property(p => p.City).HasColumnName("city").HasMaxLength(150);
                entity.Property(p => p.State).HasColumnName("state").HasMaxLength(150);
                entity.Property(p => p.PostalCode).HasColumnName("postal_code").HasMaxLength(50);
                entity.Property(p => p.Country).HasColumnName("country").HasMaxLength(100);
                entity.Property(p => p.TaxId).HasColumnName("tax_id").HasMaxLength(100);

                entity.HasIndex(p => p.ShipmentId).HasDatabaseName("idx_parties_shipment");
            });

            // -------- shipment_packages
            modelBuilder.Entity<ShipmentPackage>(entity =>
            {
                entity.ToTable("shipment_packages");
                entity.HasKey(p => p.Id);
                entity.Property(p => p.Id).HasColumnName("id");
                entity.Property(p => p.ShipmentId).HasColumnName("shipment_id");
                entity.Property(p => p.PackageType).HasColumnName("package_type").HasMaxLength(50);
                entity.Property(p => p.Length).HasColumnName("length").HasColumnType("decimal(10,3)");
                entity.Property(p => p.Width).HasColumnName("width").HasColumnType("decimal(10,3)");
                entity.Property(p => p.Height).HasColumnName("height").HasColumnType("decimal(10,3)");
                entity.Property(p => p.DimensionUnit).HasColumnName("dimension_unit").HasMaxLength(10);
                entity.Property(p => p.Weight).HasColumnName("weight").HasColumnType("decimal(12,3)");
                entity.Property(p => p.WeightUnit).HasColumnName("weight_unit").HasMaxLength(10);
                entity.Property(p => p.Stackable).HasColumnName("stackable").HasDefaultValue(false);

                entity.HasIndex(p => p.ShipmentId).HasDatabaseName("idx_packages_shipment");
                entity.HasMany(p => p.Products).WithOne(pr => pr.Package).HasForeignKey(pr => pr.PackageId).OnDelete(DeleteBehavior.Cascade);
            });

            // -------- shipment_products
            modelBuilder.Entity<ShipmentProduct>(entity =>
            {
                entity.ToTable("shipment_products");
                entity.HasKey(i => i.Id);
                entity.Property(i => i.Id).HasColumnName("id");
                entity.Property(i => i.PackageId).HasColumnName("package_id");
                entity.Property(i => i.ShipmentId).HasColumnName("shipment_id");
                entity.Property(i => i.Name).HasColumnName("name").HasMaxLength(500);
                entity.Property(i => i.Description).HasColumnName("description").HasColumnType("text");
                entity.Property(i => i.Category).HasColumnName("category").HasMaxLength(255);
                entity.Property(i => i.HsCode).HasColumnName("hs_code").HasMaxLength(50);
                entity.Property(i => i.Quantity).HasColumnName("quantity").HasColumnType("decimal(18,3)").HasDefaultValue(1);
                entity.Property(i => i.Unit).HasColumnName("unit").HasMaxLength(50).HasDefaultValue("pcs");
                entity.Property(i => i.UnitPrice).HasColumnName("unit_price").HasColumnType("decimal(18,4)");
                entity.Property(i => i.TotalValue).HasColumnName("total_value").HasColumnType("decimal(18,4)");
                entity.Property(i => i.OriginCountry).HasColumnName("origin_country").HasMaxLength(100);
                entity.Property(i => i.ExportReason).HasColumnName("export_reason").HasMaxLength(50).HasDefaultValue("Sale");

                entity.HasIndex(i => i.PackageId).HasDatabaseName("idx_products_package");
                entity.HasIndex(i => i.ShipmentId).HasDatabaseName("idx_products_shipment");
                entity.HasIndex(i => i.HsCode).HasDatabaseName("idx_products_hscode");
                entity.HasOne(i => i.Shipment).WithMany().HasForeignKey(i => i.ShipmentId).OnDelete(DeleteBehavior.Cascade);
            });

            // -------- shipment_compliance
            modelBuilder.Entity<ShipmentCompliance>(entity =>
            {
                entity.ToTable("shipment_compliance");
                entity.HasKey(c => c.ShipmentId);
                entity.Property(c => c.ShipmentId).HasColumnName("shipment_id");
                entity.Property(c => c.OverallScore).HasColumnName("overall_score").HasColumnType("decimal(5,2)");
                entity.Property(c => c.RiskLevel).HasColumnName("risk_level").HasMaxLength(50);
                entity.Property(c => c.DangerousGoods).HasColumnName("dangerous_goods").HasDefaultValue(false);
                entity.Property(c => c.LithiumBattery).HasColumnName("lithium_battery").HasDefaultValue(false);
                entity.Property(c => c.FoodPharmaFlag).HasColumnName("food_pharma_flag").HasDefaultValue(false);
                entity.Property(c => c.ExportLicenseRequired).HasColumnName("export_license_required").HasDefaultValue(false);
                entity.Property(c => c.SuggestedHsCode).HasColumnName("suggested_hs_code").HasMaxLength(50);
                entity.Property(c => c.EstimatedDuty).HasColumnName("estimated_duty").HasColumnType("decimal(18,2)");
                entity.Property(c => c.EstimatedTax).HasColumnName("estimated_tax").HasColumnType("decimal(18,2)");
                entity.Property(c => c.RequiredDocumentsJson).HasColumnName("required_documents").HasColumnType("json");
                entity.Property(c => c.MissingDocumentsJson).HasColumnName("missing_documents").HasColumnType("json");
                entity.Property(c => c.EvaluatedAt).HasColumnName("evaluated_at").HasColumnType("datetime(3)");
            });

            // -------- shipment_documents
            modelBuilder.Entity<ShipmentDocument>(entity =>
            {
                entity.ToTable("shipment_documents");
                entity.HasKey(d => d.Id);
                entity.Property(d => d.Id).HasColumnName("id");
                entity.Property(d => d.ShipmentId).HasColumnName("shipment_id");
                entity.Property(d => d.DocumentType).HasColumnName("document_type").HasMaxLength(100);
                entity.Property(d => d.FileName).HasColumnName("file_name").HasMaxLength(500);
                entity.Property(d => d.FilePath).HasColumnName("file_path").HasMaxLength(2000);
                entity.Property(d => d.FileSize).HasColumnName("file_size");
                entity.Property(d => d.MimeType).HasColumnName("mime_type").HasMaxLength(150);
                entity.Property(d => d.ValidationStatus).HasColumnName("validation_status").HasMaxLength(50);
                entity.Property(d => d.ValidationConfidence).HasColumnName("validation_confidence").HasColumnType("decimal(5,2)");
                entity.Property(d => d.ValidationNotesJson).HasColumnName("validation_notes").HasColumnType("json");
                entity.Property(d => d.UploadedBy).HasColumnName("uploaded_by");
                entity.Property(d => d.UploadedAt).HasColumnName("uploaded_at").HasColumnType("datetime(3)").HasDefaultValueSql("CURRENT_TIMESTAMP(3)");

                entity.HasIndex(d => d.ShipmentId).HasDatabaseName("idx_documents_shipment");
                entity.HasOne(d => d.Uploader).WithMany().HasForeignKey(d => d.UploadedBy).OnDelete(DeleteBehavior.SetNull);
            });

            // -------- broker_reviews
            modelBuilder.Entity<BrokerReview>(entity =>
            {
                entity.ToTable("broker_reviews");
                entity.HasKey(b => b.Id);
                entity.Property(b => b.Id).HasColumnName("id");
                entity.Property(b => b.ShipmentId).HasColumnName("shipment_id");
                entity.Property(b => b.BrokerId).HasColumnName("broker_id");
                entity.Property(b => b.Action).HasColumnName("action").HasMaxLength(50);
                entity.Property(b => b.Comments).HasColumnName("comments").HasColumnType("text");
                entity.Property(b => b.RequestedDocumentsJson).HasColumnName("requested_documents").HasColumnType("json");
                entity.Property(b => b.ReviewedAt).HasColumnName("reviewed_at").HasColumnType("datetime(3)");

                entity.HasOne(b => b.Shipment).WithMany().HasForeignKey(b => b.ShipmentId).OnDelete(DeleteBehavior.Cascade);
                entity.HasOne(b => b.Broker).WithMany().HasForeignKey(b => b.BrokerId).OnDelete(DeleteBehavior.SetNull);
                entity.HasIndex(b => b.ShipmentId).HasDatabaseName("idx_brokerreviews_shipment");
                entity.HasIndex(b => b.BrokerId).HasDatabaseName("idx_brokerreviews_broker");
            });

            // -------- notifications
            modelBuilder.Entity<Notification>(entity =>
            {
                entity.ToTable("notifications");
                entity.HasKey(n => n.Id);
                entity.Property(n => n.Id).HasColumnName("id");
                entity.Property(n => n.UserId).HasColumnName("user_id").IsRequired();
                entity.Property(n => n.Type).HasColumnName("type").HasMaxLength(100).IsRequired();
                entity.Property(n => n.Title).HasColumnName("title").HasMaxLength(500).IsRequired();
                entity.Property(n => n.Message).HasColumnName("message").HasColumnType("text").IsRequired();
                entity.Property(n => n.ShipmentId).HasColumnName("shipment_id");
                entity.Property(n => n.IsRead).HasColumnName("is_read").HasDefaultValue(false);
                entity.Property(n => n.CreatedAt).HasColumnName("created_at").HasColumnType("datetime(3)").HasDefaultValueSql("CURRENT_TIMESTAMP(3)");

                entity.HasOne(n => n.User).WithMany().HasForeignKey(n => n.UserId).OnDelete(DeleteBehavior.Cascade);
                entity.HasOne(n => n.Shipment).WithMany().HasForeignKey(n => n.ShipmentId).OnDelete(DeleteBehavior.Cascade);
                entity.HasIndex(n => n.UserId).HasDatabaseName("idx_notifications_user");
                entity.HasIndex(n => n.ShipmentId).HasDatabaseName("idx_notifications_shipment");
            });

            // -------- shipment_messages
            modelBuilder.Entity<ShipmentMessage>(entity =>
            {
                entity.ToTable("shipment_messages");
                entity.HasKey(m => m.Id);
                entity.Property(m => m.Id).HasColumnName("id");
                entity.Property(m => m.ShipmentId).HasColumnName("shipment_id");
                entity.Property(m => m.SenderId).HasColumnName("sender_id").IsRequired();
                entity.Property(m => m.Message).HasColumnName("message").HasColumnType("text").IsRequired();
                entity.Property(m => m.CreatedAt).HasColumnName("created_at").HasColumnType("datetime(3)").HasDefaultValueSql("CURRENT_TIMESTAMP(3)");

                entity.HasOne(m => m.Shipment).WithMany().HasForeignKey(m => m.ShipmentId).OnDelete(DeleteBehavior.Cascade);
                entity.HasOne(m => m.Sender).WithMany().HasForeignKey(m => m.SenderId).OnDelete(DeleteBehavior.Cascade);
                entity.HasIndex(m => m.ShipmentId).HasDatabaseName("idx_msgs_shipment");
                entity.HasIndex(m => m.SenderId).HasDatabaseName("idx_msgs_sender");
            });

            // -------- document_requests
            modelBuilder.Entity<DocumentRequest>(entity =>
            {
                entity.ToTable("document_requests");
                entity.HasKey(dr => dr.Id);
                entity.Property(dr => dr.Id).HasColumnName("id");
                entity.Property(dr => dr.ShipmentId).HasColumnName("shipment_id").IsRequired();
                entity.Property(dr => dr.RequestedByBrokerId).HasColumnName("requested_by_broker_id").IsRequired();
                entity.Property(dr => dr.RequestedDocumentNames).HasColumnName("requested_document_names").HasColumnType("text").IsRequired();
                entity.Property(dr => dr.RequestMessage).HasColumnName("request_message").HasColumnType("text");
                entity.Property(dr => dr.Status).HasColumnName("status").HasMaxLength(50).IsRequired().HasDefaultValue("pending");
                entity.Property(dr => dr.CreatedAt).HasColumnName("created_at").HasColumnType("datetime(3)").HasDefaultValueSql("CURRENT_TIMESTAMP(3)");
                entity.Property(dr => dr.FulfilledAt).HasColumnName("fulfilled_at").HasColumnType("datetime(3)");

                entity.HasOne(dr => dr.Shipment).WithMany().HasForeignKey(dr => dr.ShipmentId).OnDelete(DeleteBehavior.Cascade);
                entity.HasIndex(dr => dr.ShipmentId).HasDatabaseName("idx_docreq_shipment");
                entity.HasIndex(dr => dr.RequestedByBrokerId).HasDatabaseName("idx_docreq_broker");
                entity.HasIndex(dr => dr.Status).HasDatabaseName("idx_docreq_status");
            });
        }
    }
}
