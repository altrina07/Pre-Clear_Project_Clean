using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using PreClear.Api.Data;
using System.Linq;
using System.Threading.Tasks;

namespace PreClear.Api.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class DashboardController : ControllerBase
    {
        private readonly PreclearDbContext _db;

        public DashboardController(PreclearDbContext db)
        {
            _db = db;
        }

        [HttpGet("stats")]
        public async Task<IActionResult> GetStats()
        {
            var total = await _db.Shipments.CountAsync();
            var brokerApproved = await _db.Shipments.CountAsync(s => s.BrokerApprovalStatus == "approved");
            var tokenGenerated = await _db.Shipments.CountAsync(s => s.Status == "token-generated");
            var paid = await _db.Shipments.CountAsync(s => s.Status == "paid" || s.Status == "payment-completed");
            var documentsRequested = await _db.Shipments.CountAsync(s => s.BrokerApprovalStatus == "documents-requested" || s.Status == "document-requested");
            var aiApproved = await _db.Shipments.CountAsync(s => s.AiApprovalStatus == "approved");
            var pending = await _db.Shipments.CountAsync(s =>
                s.BrokerApprovalStatus == "pending" ||
                s.BrokerApprovalStatus == "documents-requested" ||
                s.BrokerApprovalStatus == "awaiting-broker" ||
                s.BrokerApprovalStatus == "not-started" ||
                s.Status == "awaiting-broker"
            );

            // Top routes by shipper/consignee country
            var routes = await _db.ShipmentParties
                .GroupBy(p => new { p.ShipmentId })
                .Select(g => new
                {
                    ShipmentId = g.Key.ShipmentId,
                    ShipperCountry = g.Where(p => p.PartyType == "shipper").Select(p => p.Country).FirstOrDefault(),
                    ConsigneeCountry = g.Where(p => p.PartyType == "consignee").Select(p => p.Country).FirstOrDefault()
                })
                .ToListAsync();

            var topRoutes = routes
                .Where(r => !string.IsNullOrWhiteSpace(r.ShipperCountry) && !string.IsNullOrWhiteSpace(r.ConsigneeCountry))
                .GroupBy(r => new { r.ShipperCountry, r.ConsigneeCountry })
                .Select(grp => new
                {
                    Route = grp.Key.ShipperCountry + " → " + grp.Key.ConsigneeCountry,
                    Count = grp.Count()
                })
                .OrderByDescending(x => x.Count)
                .Take(5)
                .ToList();

            var result = new
            {
                totalShipments = total,
                completedShipments = brokerApproved + tokenGenerated + paid,
                pendingShipments = pending,
                aiApprovedShipments = aiApproved,
                brokerApprovedShipments = brokerApproved,
                paidShipments = paid,
                documentsRequested,
                topRoutes
            };

            return Ok(result);
        }
    }
}
