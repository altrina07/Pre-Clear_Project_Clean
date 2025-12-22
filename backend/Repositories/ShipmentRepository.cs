using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using Microsoft.EntityFrameworkCore;
using PreClear.Api.Data;
using PreClear.Api.Interfaces;
using PreClear.Api.Models;

namespace PreClear.Api.Repositories
{
    public class ShipmentRepository : IShipmentRepository
    {
        private readonly PreclearDbContext _db;
        public ShipmentRepository(PreclearDbContext db) => _db = db;

        public async Task<Shipment> AddAsync(Shipment shipment)
        {
            _db.Shipments.Add(shipment);
            await _db.SaveChangesAsync();
            return shipment;
        }

        public async Task<Shipment?> GetByIdAsync(long id)
        {
            return await _db.Shipments.FindAsync(id);
        }

        public async Task<List<Shipment>> GetByUserAsync(long userId)
        {
            // Filter by created_by to ensure strict data isolation between users
            // Include all shipment details without tracking for read operations
            return await _db.Shipments
                .AsNoTracking()
                .Where(s => s.CreatedBy == userId)
                .OrderByDescending(s => s.CreatedAt)
                .ToListAsync();
        }

        public async Task<List<ShipmentListItemDto>> GetUserListAsync(long userId)
        {
            // Project shipments and related summary fields needed by dashboard
            var query = from s in _db.Shipments.AsNoTracking()
                        where s.CreatedBy == userId
                        orderby s.CreatedAt descending
                        select new ShipmentListItemDto
                        {
                            Id = s.Id,
                            ReferenceId = s.ReferenceId,
                            Title = s.ShipmentName,
                            OriginCity = _db.ShipmentParties
                                .Where(p => p.ShipmentId == s.Id && p.PartyType == "shipper")
                                .Select(p => p.City)
                                .FirstOrDefault(),
                            OriginCompany = _db.ShipmentParties
                                .Where(p => p.ShipmentId == s.Id && p.PartyType == "shipper")
                                .Select(p => p.CompanyName)
                                .FirstOrDefault(),
                            OriginCountry = _db.ShipmentParties
                                .Where(p => p.ShipmentId == s.Id && p.PartyType == "shipper")
                                .Select(p => p.Country)
                                .FirstOrDefault(),
                            DestinationCity = _db.ShipmentParties
                                .Where(p => p.ShipmentId == s.Id && p.PartyType == "consignee")
                                .Select(p => p.City)
                                .FirstOrDefault(),
                            DestinationCompany = _db.ShipmentParties
                                .Where(p => p.ShipmentId == s.Id && p.PartyType == "consignee")
                                .Select(p => p.CompanyName)
                                .FirstOrDefault(),
                            DestinationCountry = _db.ShipmentParties
                                .Where(p => p.ShipmentId == s.Id && p.PartyType == "consignee")
                                .Select(p => p.Country)
                                .FirstOrDefault(),
                            Mode = s.Mode,
                            ShipmentType = s.ShipmentType,
                            Value = s.CustomsValue,
                            Currency = s.Currency,
                            AiComplianceScore = s.AiComplianceScore,
                            AiApprovalStatus = s.AiApprovalStatus,
                            BrokerApprovalStatus = s.BrokerApprovalStatus,
                            PreclearToken = s.PreclearToken,
                            Status = s.Status,
                            AssignedBrokerId = s.AssignedBrokerId,
                            CreatedAt = s.CreatedAt,
                            UpdatedAt = s.UpdatedAt
                        };

            return await query.ToListAsync();
        }

        public async Task<List<ShipmentListItemDto>> GetBrokerListAsync(long brokerId)
        {
            var query = from s in _db.Shipments.AsNoTracking()
                        where s.AssignedBrokerId == brokerId
                        orderby s.CreatedAt descending
                        select new ShipmentListItemDto
                        {
                            Id = s.Id,
                            ReferenceId = s.ReferenceId,
                            Title = s.ShipmentName,
                            OriginCity = _db.ShipmentParties
                                .Where(p => p.ShipmentId == s.Id && p.PartyType == "shipper")
                                .Select(p => p.City)
                                .FirstOrDefault(),
                            OriginCompany = _db.ShipmentParties
                                .Where(p => p.ShipmentId == s.Id && p.PartyType == "shipper")
                                .Select(p => p.CompanyName)
                                .FirstOrDefault(),
                            OriginCountry = _db.ShipmentParties
                                .Where(p => p.ShipmentId == s.Id && p.PartyType == "shipper")
                                .Select(p => p.Country)
                                .FirstOrDefault(),
                            DestinationCity = _db.ShipmentParties
                                .Where(p => p.ShipmentId == s.Id && p.PartyType == "consignee")
                                .Select(p => p.City)
                                .FirstOrDefault(),
                            DestinationCompany = _db.ShipmentParties
                                .Where(p => p.ShipmentId == s.Id && p.PartyType == "consignee")
                                .Select(p => p.CompanyName)
                                .FirstOrDefault(),
                            DestinationCountry = _db.ShipmentParties
                                .Where(p => p.ShipmentId == s.Id && p.PartyType == "consignee")
                                .Select(p => p.Country)
                                .FirstOrDefault(),
                            Mode = s.Mode,
                            ShipmentType = s.ShipmentType,
                            Value = s.CustomsValue,
                            Currency = s.Currency,
                            AiComplianceScore = s.AiComplianceScore,
                            AiApprovalStatus = s.AiApprovalStatus,
                            BrokerApprovalStatus = s.BrokerApprovalStatus,
                            PreclearToken = s.PreclearToken,
                            Status = s.Status,
                            AssignedBrokerId = s.AssignedBrokerId,
                            CreatedAt = s.CreatedAt,
                            UpdatedAt = s.UpdatedAt
                        };

            return await query.ToListAsync();
        }

        public async Task<List<Shipment>> GetAllShipmentsAsync()
        {
            // Return all shipments - used by admin and broker roles with filtering in service layer
            return await _db.Shipments
                .OrderByDescending(s => s.CreatedAt)
                .ToListAsync();
        }

        public async Task ReplacePartiesAsync(long shipmentId, IEnumerable<ShipmentParty> parties)
        {
            var existing = _db.ShipmentParties.Where(p => p.ShipmentId == shipmentId);
            _db.ShipmentParties.RemoveRange(existing);
            await _db.SaveChangesAsync();

            if (parties != null)
            {
                foreach (var p in parties)
                {
                    p.ShipmentId = shipmentId;
                    _db.ShipmentParties.Add(p);
                }
                await _db.SaveChangesAsync();
            }
        }

        public async Task ReplacePackagesAsync(long shipmentId, IEnumerable<ShipmentPackage> packages)
        {
            var existing = _db.ShipmentPackages.Where(p => p.ShipmentId == shipmentId);
            _db.ShipmentPackages.RemoveRange(existing);
            await _db.SaveChangesAsync();

            if (packages != null)
            {
                foreach (var p in packages)
                {
                    p.ShipmentId = shipmentId;
                    _db.ShipmentPackages.Add(p);
                }
                await _db.SaveChangesAsync();
            }
        }

        public async Task ReplaceItemsAsync(long shipmentId, IEnumerable<ShipmentProduct> items)
        {
            var existing = _db.ShipmentProducts.Where(i => i.ShipmentId == shipmentId);
            _db.ShipmentProducts.RemoveRange(existing);
            await _db.SaveChangesAsync();

            if (items != null)
            {
                foreach (var i in items)
                {
                    i.ShipmentId = shipmentId;
                    _db.ShipmentProducts.Add(i);
                }
                await _db.SaveChangesAsync();
            }
        }

        public async Task ReplaceServicesAsync(long shipmentId, IEnumerable<ShipmentServiceData> services)
        {
            // Services are now embedded in shipments table (ServiceLevel, Incoterm, BillTo, Currency, etc.)
            // This method is kept for backward compatibility but does nothing
            await Task.CompletedTask;
        }

        public async Task UpdateAsync(Shipment shipment)
        {
            if (shipment == null)
                throw new ArgumentNullException(nameof(shipment), "Shipment cannot be null");

            if (shipment.Id <= 0)
                throw new ArgumentException($"Invalid shipment ID: {shipment.Id}", nameof(shipment));

            // Ensure UpdatedAt is set
            shipment.UpdatedAt = DateTime.UtcNow;
            
            _db.Shipments.Update(shipment);
            await _db.SaveChangesAsync();
        }

        public async Task PersistAiDocumentsAsync(long shipmentId, string[] predictedDocuments)
        {
            using var transaction = await _db.Database.BeginTransactionAsync();
            try
            {
                var compliance = await _db.ShipmentCompliance.FirstOrDefaultAsync(sc => sc.ShipmentId == shipmentId);
                if (compliance == null)
                {
                    compliance = new ShipmentCompliance
                    {
                        ShipmentId = shipmentId,
                        RiskLevel = "low",
                        OverallScore = 0
                    };
                    _db.ShipmentCompliance.Add(compliance);
                    await _db.SaveChangesAsync();
                }

                var existingNames = await _db.ShipmentDocuments
                    .Where(sd => sd.ShipmentId == shipmentId && sd.FileName != null)
                    .Select(sd => sd.FileName)
                    .ToListAsync();

                var seen = new HashSet<string>(existingNames.Where(n => !string.IsNullOrWhiteSpace(n)).Select(n => n!.Trim()), StringComparer.OrdinalIgnoreCase);

                foreach (var raw in predictedDocuments)
                {
                    if (string.IsNullOrWhiteSpace(raw))
                        continue;

                    var name = raw.Trim();
                    if (seen.Contains(name))
                        continue;

                    seen.Add(name);

                    var doc = new ShipmentDocument
                    {
                        ShipmentId = shipmentId,
                        FileName = name,
                        DocumentType = "Other",
                        UploadedAt = DateTime.UtcNow,
                        UploadedBy = null
                    };

                    _db.ShipmentDocuments.Add(doc);
                }

                await _db.SaveChangesAsync();
                await transaction.CommitAsync();
            }
            catch (Exception ex)
            {
                await transaction.RollbackAsync();
                throw new InvalidOperationException($"Failed to persist AI documents for shipment {shipmentId}", ex);
            }
        }

        public async Task<List<ShipmentParty>> GetPartiesAsync(long shipmentId)
        {
            return await _db.ShipmentParties.AsNoTracking()
                .Where(p => p.ShipmentId == shipmentId)
                .ToListAsync();
        }

        public async Task<List<ShipmentPackage>> GetPackagesAsync(long shipmentId)
        {
            return await _db.ShipmentPackages.AsNoTracking()
                .Where(p => p.ShipmentId == shipmentId)
                .ToListAsync();
        }

        public async Task<List<ShipmentProduct>> GetItemsAsync(long shipmentId)
        {
            return await _db.ShipmentProducts.AsNoTracking()
                .Where(i => i.ShipmentId == shipmentId)
                .ToListAsync();
        }

        public async Task<ShipmentServiceData?> GetServicesAsync(long shipmentId)
        {
            // Services are now embedded in shipments table
            // Return null as services are not separate entities anymore
            return null;
        }

        public async Task<bool> DeleteAsync(long shipmentId)
        {
            var shipment = await _db.Shipments.FindAsync(shipmentId);
            if (shipment == null) return false;

            // Delete related records first due to foreign key constraints
            var packages = await _db.ShipmentPackages.Where(p => p.ShipmentId == shipmentId).ToListAsync();
            _db.ShipmentPackages.RemoveRange(packages);

            var products = await _db.ShipmentProducts.Where(p => p.ShipmentId == shipmentId).ToListAsync();
            _db.ShipmentProducts.RemoveRange(products);

            var parties = await _db.ShipmentParties.Where(p => p.ShipmentId == shipmentId).ToListAsync();
            _db.ShipmentParties.RemoveRange(parties);

            // Delete the shipment itself
            _db.Shipments.Remove(shipment);
            
            await _db.SaveChangesAsync();
            return true;
        }
    }
}
