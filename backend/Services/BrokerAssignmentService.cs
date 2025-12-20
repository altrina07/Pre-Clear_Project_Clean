using System;
using System.Collections.Generic;
using System.Linq;
using System.Text.Json;
using System.Threading.Tasks;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using PreClear.Api.Data;
using PreClear.Api.Interfaces;
using PreClear.Api.Models;

namespace PreClear.Api.Services
{
    /// <summary>
    /// Service for automatically assigning shipments to brokers based on:
    /// - Origin country
    /// - Destination country
    /// - HS code category (first 2 digits)
    /// </summary>
    public class BrokerAssignmentService
    {
        private readonly PreclearDbContext _db;
        private readonly ILogger<BrokerAssignmentService> _logger;
        private readonly INotificationService _notificationService;

        public BrokerAssignmentService(PreclearDbContext db, ILogger<BrokerAssignmentService> logger, INotificationService notificationService)
        {
            _db = db;
            _logger = logger;
            _notificationService = notificationService;
        }

        /// <summary>
        /// Automatically assign a shipment to the best matching broker
        /// </summary>
        public async Task<bool> AssignBrokerAsync(long shipmentId)
        {
            try
            {
                var shipment = await _db.Shipments
                    .Include(s => s.Parties)
                    .Include(s => s.Packages)
                        .ThenInclude(p => p.Products)
                    .FirstOrDefaultAsync(s => s.Id == shipmentId);

                if (shipment == null)
                {
                    _logger.LogWarning("Shipment {ShipmentId} not found for broker assignment", shipmentId);
                    return false;
                }

                // Extract shipment details
                var shipper = shipment.Parties?.FirstOrDefault(p => p.PartyType == "shipper");
                var consignee = shipment.Parties?.FirstOrDefault(p => p.PartyType == "consignee");
                var originCountry = shipper?.Country ?? "US";
                var destinationCountry = consignee?.Country ?? "US";

                // Get HS categories from products
                var hsCategories = new HashSet<string>();
                if (shipment.Packages != null)
                {
                    foreach (var pkg in shipment.Packages)
                    {
                        if (pkg.Products != null)
                        {
                            foreach (var prod in pkg.Products)
                            {
                                if (!string.IsNullOrEmpty(prod.HsCode) && prod.HsCode.Length >= 2)
                                {
                                    // Get first 2 digits as category
                                    hsCategories.Add(prod.HsCode.Substring(0, 2));
                                }
                            }
                        }
                    }
                }

                // Find matching brokers
                var candidates = await FindMatchingBrokersAsync(originCountry, destinationCountry, hsCategories);

                if (candidates.Count == 0)
                {
                    _logger.LogWarning("No matching brokers found for shipment {ShipmentId} (origin: {Origin}, destination: {Destination}, HS: {HS})",
                        shipmentId, originCountry, destinationCountry, string.Join(",", hsCategories));
                    return false;
                }

                // Select broker with least assignments
                var selectedBroker = await SelectBrokerAsync(candidates);

                if (selectedBroker == null)
                {
                    _logger.LogWarning("Could not select broker for shipment {ShipmentId}", shipmentId);
                    return false;
                }

                // Assign broker to shipment
                shipment.AssignedBrokerId = selectedBroker.Id;
                shipment.UpdatedAt = DateTime.UtcNow;

                await _db.SaveChangesAsync();
                _logger.LogInformation("Assigned shipment {ShipmentId} to broker {BrokerId} ({BrokerName})",
                    shipmentId, selectedBroker.Id, selectedBroker.Company);

                // Create notification for broker
                try
                {
                    await _notificationService.CreateNotificationAsync(
                        selectedBroker.Id,
                        "broker_assignment",
                        "New Shipment Assigned",
                        $"Shipment #{shipmentId} has been assigned to you for review.",
                        shipmentId
                    );
                }
                catch (Exception notifEx)
                {
                    _logger.LogError(notifEx, "Failed to create notification for broker {BrokerId} for shipment {ShipmentId}", selectedBroker.Id, shipmentId);
                }

                return true;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error assigning broker to shipment {ShipmentId}", shipmentId);
                return false;
            }
        }

        private async Task<List<User>> FindMatchingBrokersAsync(string originCountry, string destinationCountry, HashSet<string> hsCategories)
        {
            // Get all available brokers with profiles
            var brokers = await _db.Users
                .Where(u => u.Role == "broker")
                .Include(u => u.BrokerProfile)
                .Where(u => u.BrokerProfile != null && u.BrokerProfile.IsAvailable)
                .ToListAsync();

            var matches = new List<User>();

            foreach (var broker in brokers)
            {
                var profile = broker.BrokerProfile!;

                // Check if broker can handle this shipment
                bool originMatch = MatchesCountryList(profile.OriginCountriesJson, originCountry);
                // Destination is optional; if broker specified destinations, honor them, otherwise accept any
                bool destinationMatch = string.IsNullOrWhiteSpace(profile.DestinationCountriesJson)
                    ? true
                    : MatchesCountryList(profile.DestinationCountriesJson, destinationCountry);
                bool hsMatch = hsCategories.Count == 0 || MatchesHsCategories(profile.HsCategoriesJson, hsCategories);

                // Require origin and HS; destination only if provided
                if (originMatch && destinationMatch && hsMatch)
                {
                    matches.Add(broker);
                }
            }

            return matches;
        }

        private async Task<User?> SelectBrokerAsync(List<User> candidates)
        {
            if (candidates.Count == 0)
                return null;

            // Count current assignments for each broker
            var brokerLoads = new Dictionary<long, int>();

            foreach (var broker in candidates)
            {
                var count = await _db.Shipments
                    .Where(s => s.AssignedBrokerId == broker.Id && s.Status != "completed" && s.Status != "cancelled")
                    .CountAsync();

                brokerLoads[broker.Id] = count;
            }

            // Select broker with lowest load
            var selectedId = brokerLoads.OrderBy(x => x.Value).First().Key;
            return candidates.FirstOrDefault(b => b.Id == selectedId);
        }

        private bool MatchesCountryList(string? jsonList, string targetCountry)
        {
            if (string.IsNullOrEmpty(jsonList))
                return true; // Accept all if not specified

            try
            {
                var countries = JsonSerializer.Deserialize<List<string>>(jsonList);
                if (countries == null || countries.Count == 0)
                    return true;

                return countries.Any(c => c.Equals(targetCountry, StringComparison.OrdinalIgnoreCase));
            }
            catch
            {
                return false;
            }
        }

        private bool MatchesHsCategories(string? jsonList, HashSet<string> targetCategories)
        {
            if (targetCategories.Count == 0)
                return true; // No HS codes specified, accept all

            if (string.IsNullOrEmpty(jsonList))
                return false; // Broker has no HS categories but shipment requires them

            try
            {
                var categories = JsonSerializer.Deserialize<List<string>>(jsonList);
                if (categories == null || categories.Count == 0)
                    return false;

                // Check if any target category matches broker's categories (exact or range)
                foreach (var target in targetCategories)
                {
                    if (!int.TryParse(target, out var targetChapter))
                        continue;

                    foreach (var brokerCat in categories)
                    {
                        // Check if it's a range (e.g., "10-15" or "84-85")
                        if (brokerCat.Contains("-"))
                        {
                            var parts = brokerCat.Split('-');
                            if (parts.Length == 2 && 
                                int.TryParse(parts[0], out var start) && 
                                int.TryParse(parts[1], out var end))
                            {
                                if (targetChapter >= start && targetChapter <= end)
                                    return true;
                            }
                        }
                        // Exact match
                        else if (brokerCat.Equals(target, StringComparison.OrdinalIgnoreCase))
                        {
                            return true;
                        }
                    }
                }

                return false;
            }
            catch
            {
                return false;
            }
        }
    }
}
