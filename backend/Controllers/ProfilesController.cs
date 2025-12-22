using System;
using System.Collections.Generic;
using System.Linq;
using System.Security.Claims;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using PreClear.Api.Data;
using PreClear.Api.Models;

namespace PreClear.Api.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    [Authorize]
    public class ProfilesController : ControllerBase
    {
        private readonly PreclearDbContext _db;

        public ProfilesController(PreclearDbContext db) => _db = db;

        private long GetUserId()
        {
            var claim = User.FindFirst(ClaimTypes.NameIdentifier);
            return long.TryParse(claim?.Value, out var id) ? id : 0;
        }

        // GET: api/profiles - Get current user's profile
        [HttpGet]
        public async Task<ActionResult<object>> GetProfile()
        {
            var userId = GetUserId();
            Console.WriteLine($"ProfilesController.GetProfile: userId = {userId}");
            if (userId == 0) {
                Console.WriteLine("ProfilesController.GetProfile: userId is 0, returning Unauthorized");
                return Unauthorized();
            }

            var user = await _db.Users
                .Include(u => u.ShipperProfile)
                .Include(u => u.BrokerProfile)
                .FirstOrDefaultAsync(u => u.Id == userId);

            Console.WriteLine($"ProfilesController.GetProfile: user found = {user != null}");
            if (user != null) {
                Console.WriteLine($"ProfilesController.GetProfile: user.Email = {user.Email}, user.Role = {user.Role}");
            }

            if (user == null) {
                // Return default profile for missing user
                return new
                {
                    Id = userId,
                    FirstName = "Unknown",
                    LastName = "User",
                    Email = "unknown@example.com",
                    Phone = "",
                    Company = "",
                    Role = "shipper",
                    IsActive = true,
                    Profile = (object)null
                };
            }

            // Return profile based on role
            if (user.Role?.ToLower() == "shipper")
            {
                return new
                {
                    user.Id,
                    user.FirstName,
                    user.LastName,
                    user.Email,
                    user.Phone,
                    user.Company,
                    user.Role,
                    user.IsActive,
                    Profile = user.ShipperProfile == null ? null : new
                    {
                        AddressLine1 = user.ShipperProfile.AddressLine1 ?? string.Empty,
                        AddressLine2 = user.ShipperProfile.AddressLine2 ?? string.Empty,
                        City = user.ShipperProfile.City ?? string.Empty,
                        State = user.ShipperProfile.State ?? string.Empty,
                        PostalCode = user.ShipperProfile.PostalCode ?? string.Empty,
                        CountryCode = user.ShipperProfile.CountryCode ?? string.Empty,
                        Timezone = user.ShipperProfile.Timezone ?? string.Empty,
                        Language = user.ShipperProfile.Language ?? string.Empty,
                        CompanyRole = user.ShipperProfile.CompanyRole ?? string.Empty
                    }
                };
            }
            else if (user.Role?.ToLower() == "broker")
            {
                return new
                {
                    user.Id,
                    user.FirstName,
                    user.LastName,
                    user.Email,
                    user.Phone,
                    user.Company,
                    user.Role,
                    user.IsActive,
                    Profile = user.BrokerProfile == null ? null : new
                    {
                        LicenseNumber = user.BrokerProfile.LicenseNumber ?? string.Empty,
                        YearsOfExperience = user.BrokerProfile.YearsOfExperience,
                        OriginCountries = user.BrokerProfile.OriginCountries ?? new List<string>(),
                        DestinationCountries = user.BrokerProfile.DestinationCountries ?? new List<string>(),
                        HsCategories = user.BrokerProfile.HsCategories ?? new List<string>(),
                        Timezone = user.BrokerProfile.Timezone ?? string.Empty,
                        Language = user.BrokerProfile.Language ?? string.Empty,
                        IsAvailable = user.BrokerProfile.IsAvailable,
                        MaxConcurrentShipments = user.BrokerProfile.MaxConcurrentShipments
                    }
                };
            }
            else if (user.Role?.ToLower() == "admin")
            {
                return new
                {
                    user.Id,
                    user.FirstName,
                    user.LastName,
                    user.Email,
                    user.Phone,
                    user.Company,
                    user.Role,
                    user.IsActive,
                    Profile = (object)null
                };
            }

            // If role doesn't match expected values, return basic user info
            return new
            {
                user.Id,
                user.FirstName,
                user.LastName,
                user.Email,
                user.Phone,
                user.Company,
                user.Role,
                user.IsActive,
                Profile = (object)null
            };
        }

        // PUT: api/profiles - Update current user's profile
        [HttpPut]
        public async Task<IActionResult> UpdateProfile([FromBody] ProfileUpdateRequest request)
        {
            var userId = GetUserId();
            if (userId == 0) return Unauthorized();

            var user = await _db.Users
                .Include(u => u.ShipperProfile)
                .Include(u => u.BrokerProfile)
                .FirstOrDefaultAsync(u => u.Id == userId);

            if (user == null) return NotFound();

            // Update user fields
            if (!string.IsNullOrWhiteSpace(request.FirstName))
                user.FirstName = request.FirstName;
            if (!string.IsNullOrWhiteSpace(request.LastName))
                user.LastName = request.LastName;
            if (!string.IsNullOrWhiteSpace(request.Phone))
                user.Phone = request.Phone;
            if (!string.IsNullOrWhiteSpace(request.Company))
                user.Company = request.Company;

            user.UpdatedAt = DateTime.UtcNow;

            // Ensure profile exists for the role
            if (user.Role?.ToLower() == "shipper" && user.ShipperProfile == null)
            {
                user.ShipperProfile = new ShipperProfile
                {
                    UserId = user.Id,
                    CreatedAt = DateTime.UtcNow,
                    UpdatedAt = DateTime.UtcNow
                };
            }

            if (user.Role?.ToLower() == "broker" && user.BrokerProfile == null)
            {
                user.BrokerProfile = new BrokerProfile
                {
                    UserId = user.Id,
                    CreatedAt = DateTime.UtcNow,
                    UpdatedAt = DateTime.UtcNow
                };
            }

            // Update profile based on role
            if (user.Role?.ToLower() == "shipper" && user.ShipperProfile != null)
            {
                if (!string.IsNullOrWhiteSpace(request.AddressLine1))
                    user.ShipperProfile.AddressLine1 = request.AddressLine1;
                if (!string.IsNullOrWhiteSpace(request.AddressLine2))
                    user.ShipperProfile.AddressLine2 = request.AddressLine2;
                if (!string.IsNullOrWhiteSpace(request.City))
                    user.ShipperProfile.City = request.City;
                if (!string.IsNullOrWhiteSpace(request.State))
                    user.ShipperProfile.State = request.State;
                if (!string.IsNullOrWhiteSpace(request.PostalCode))
                    user.ShipperProfile.PostalCode = request.PostalCode;
                if (!string.IsNullOrWhiteSpace(request.CountryCode))
                    user.ShipperProfile.CountryCode = request.CountryCode;
                if (!string.IsNullOrWhiteSpace(request.Timezone))
                    user.ShipperProfile.Timezone = request.Timezone;
                if (!string.IsNullOrWhiteSpace(request.Language))
                    user.ShipperProfile.Language = request.Language;
                if (!string.IsNullOrWhiteSpace(request.CompanyRole))
                    user.ShipperProfile.CompanyRole = request.CompanyRole;

                user.ShipperProfile.UpdatedAt = DateTime.UtcNow;
            }
            else if (user.Role?.ToLower() == "broker" && user.BrokerProfile != null)
            {
                if (!string.IsNullOrWhiteSpace(request.LicenseNumber))
                    user.BrokerProfile.LicenseNumber = request.LicenseNumber;
                if (request.YearsOfExperience.HasValue)
                    user.BrokerProfile.YearsOfExperience = request.YearsOfExperience;
                if (request.OriginCountries != null)
                    user.BrokerProfile.OriginCountries = request.OriginCountries;
                if (request.DestinationCountries != null)
                    user.BrokerProfile.DestinationCountries = request.DestinationCountries;
                if (request.HsCategories != null)
                    user.BrokerProfile.HsCategories = request.HsCategories;
                if (!string.IsNullOrWhiteSpace(request.Timezone))
                    user.BrokerProfile.Timezone = request.Timezone;
                if (!string.IsNullOrWhiteSpace(request.Language))
                    user.BrokerProfile.Language = request.Language;
                if (request.IsAvailable.HasValue)
                    user.BrokerProfile.IsAvailable = request.IsAvailable.Value;
                if (request.MaxConcurrentShipments.HasValue)
                    user.BrokerProfile.MaxConcurrentShipments = request.MaxConcurrentShipments.Value;

                user.BrokerProfile.UpdatedAt = DateTime.UtcNow;
            }

            await _db.SaveChangesAsync();
            return NoContent();
        }

        // PUT: api/profiles/admin/broker/{userId} - Admin update broker profile
        [HttpPut("admin/broker/{userId:long}")]
        [Authorize(Roles = "admin")]
        public async Task<IActionResult> UpdateBrokerProfile(long userId, [FromBody] BrokerProfileUpdateRequest request)
        {
            var user = await _db.Users
                .Include(u => u.BrokerProfile)
                .FirstOrDefaultAsync(u => u.Id == userId);

            if (user == null) return NotFound("User not found");
            if (user.Role?.ToLower() != "broker") return BadRequest("User is not a broker");
            if (user.BrokerProfile == null) return NotFound("Broker profile not found");

            // Update broker profile fields
            if (request.OriginCountries != null)
                user.BrokerProfile.OriginCountries = request.OriginCountries;
            if (request.DestinationCountries != null)
                user.BrokerProfile.DestinationCountries = request.DestinationCountries;
            if (request.HsCategories != null)
                user.BrokerProfile.HsCategories = request.HsCategories;
            if (!string.IsNullOrWhiteSpace(request.LicenseNumber))
                user.BrokerProfile.LicenseNumber = request.LicenseNumber;
            if (request.YearsOfExperience.HasValue)
                user.BrokerProfile.YearsOfExperience = request.YearsOfExperience.Value;
            if (!string.IsNullOrWhiteSpace(request.Timezone))
                user.BrokerProfile.Timezone = request.Timezone;
            if (!string.IsNullOrWhiteSpace(request.Language))
                user.BrokerProfile.Language = request.Language;
            if (request.IsAvailable.HasValue)
                user.BrokerProfile.IsAvailable = request.IsAvailable.Value;
            if (request.MaxConcurrentShipments.HasValue)
                user.BrokerProfile.MaxConcurrentShipments = request.MaxConcurrentShipments.Value;

            user.BrokerProfile.UpdatedAt = DateTime.UtcNow;
            await _db.SaveChangesAsync();
            return NoContent();
        }
    }

    public class ProfileUpdateRequest
    {
        // User fields
        public string? FirstName { get; set; }
        public string? LastName { get; set; }
        public string? Phone { get; set; }
        public string? Company { get; set; }

        // Shipper profile fields
        public string? AddressLine1 { get; set; }
        public string? AddressLine2 { get; set; }
        public string? City { get; set; }
        public string? State { get; set; }
        public string? PostalCode { get; set; }
        public string? CountryCode { get; set; }
        public string? Timezone { get; set; }
        public string? Language { get; set; }
        public string? CompanyRole { get; set; }

        // Broker profile fields
        public string? LicenseNumber { get; set; }
        public int? YearsOfExperience { get; set; }
        public List<string>? OriginCountries { get; set; }
        public List<string>? DestinationCountries { get; set; }
        public List<string>? HsCategories { get; set; }
        public bool? IsAvailable { get; set; }
        public int? MaxConcurrentShipments { get; set; }
    }

    public class BrokerProfileUpdateRequest
    {
        public string? LicenseNumber { get; set; }
        public int? YearsOfExperience { get; set; }
        public List<string>? OriginCountries { get; set; }
        public List<string>? DestinationCountries { get; set; }
        public List<string>? HsCategories { get; set; }
        public string? Timezone { get; set; }
        public string? Language { get; set; }
        public bool? IsAvailable { get; set; }
        public int? MaxConcurrentShipments { get; set; }
    }
}