using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using PreClear.Api.Data;
using PreClear.Api.Interfaces;
using PreClear.Api.Models;

namespace PreClear.Api.Services
{
    public class ChatService : IChatService
    {
        private readonly PreclearDbContext _db;
        private readonly IShipmentRepository _shipmentRepository;
        private readonly INotificationService _notificationService;
        private readonly ILogger<ChatService> _logger;

        public ChatService(PreclearDbContext db, IShipmentRepository shipmentRepository, INotificationService notificationService, ILogger<ChatService> logger)
        {
            _db = db;
            _shipmentRepository = shipmentRepository;
            _notificationService = notificationService;
            _logger = logger;
        }

        public async Task<IEnumerable<ShipmentMessage>> GetMessagesForShipmentAsync(long shipmentId)
        {
            // Include sender for UI display (name/role)
            return await _db.ShipmentMessages
                .AsNoTracking()
                .Include(m => m.Sender)
                .Where(m => m.ShipmentId == shipmentId)
                .Include(m => m.Sender)
                .OrderBy(m => m.CreatedAt)
                .ToListAsync();
        }

        public async Task<ShipmentMessage> SendMessageAsync(long shipmentId, long? senderId, string message)
        {
            if (string.IsNullOrWhiteSpace(message))
                throw new ArgumentException("message is required", nameof(message));
            if (!senderId.HasValue)
                throw new ArgumentException("sender_id is required", nameof(senderId));

            var shipment = await _shipmentRepository.GetByIdAsync(shipmentId);
            if (shipment == null)
                throw new ArgumentException("shipment_not_found", nameof(shipmentId));

            var msg = new ShipmentMessage
            {
                ShipmentId = shipmentId,
                SenderId = senderId.Value,
                Message = message,
                CreatedAt = DateTime.UtcNow
            };

            _db.ShipmentMessages.Add(msg);
            await _db.SaveChangesAsync();

            // Load sender navigation for downstream DTO mapping
            await _db.Entry(msg).Reference(m => m.Sender).LoadAsync();

            _logger.LogInformation("Saved message {MessageId} for shipment {ShipmentId}", msg.Id, shipmentId);

            // Notify the opposite party (shipper or broker) so they see a toast/email
            try
            {
                long? recipientId = null;
                if (shipment.AssignedBrokerId.HasValue && senderId.Value != shipment.AssignedBrokerId.Value)
                {
                    recipientId = shipment.AssignedBrokerId.Value; // sender is shipper
                }
                else if (senderId.Value != shipment.CreatedBy)
                {
                    recipientId = shipment.CreatedBy; // sender is broker/admin
                }

                if (recipientId.HasValue)
                {
                    await _notificationService.CreateNotificationAsync(
                        recipientId.Value,
                        "chat_message",
                        "New shipment message",
                        message.Length > 120 ? message[..120] + "…" : message,
                        shipmentId);
                }
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Failed to create chat notification for shipment {ShipmentId}", shipmentId);
            }
            return msg;
        }

        public async Task<bool> DeleteMessageAsync(long id)
        {
            var msg = await _db.ShipmentMessages.FindAsync(id);
            if (msg == null) return false;
            _db.ShipmentMessages.Remove(msg);
            await _db.SaveChangesAsync();
            _logger.LogInformation("Deleted message {MessageId}", id);
            return true;
        }
    }
}

