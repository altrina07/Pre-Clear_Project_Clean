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
    [Authorize] // SECURITY: Require authentication for all user endpoints
    public class UsersController : ControllerBase
    {
        private readonly PreclearDbContext _db;
        public UsersController(PreclearDbContext db) => _db = db;

        private long GetUserId()
        {
            var claim = User.FindFirst(ClaimTypes.NameIdentifier);
            return long.TryParse(claim?.Value, out var id) ? id : 0;
        }

        // GET: api/users (only admin can list all users)
        [HttpGet]
        [Authorize(Roles = "admin")]
        public async Task<ActionResult<IEnumerable<object>>> GetAll()
        {
            var users = await _db.Users
                .Include(u => u.BrokerProfile)
                .AsNoTracking()
                .ToListAsync();

            return users.Select(u => new
            {
                u.Id,
                name = $"{u.FirstName} {u.LastName}".Trim(),
                u.Email,
                role = u.Role?.ToLower(),
                status = u.IsActive ? "active" : "inactive",
                brokerProfile = u.BrokerProfile != null ? new
                {
                    u.BrokerProfile.OriginCountries,
                    u.BrokerProfile.DestinationCountries,
                    u.BrokerProfile.HsCategories
                } : null
            }).ToList();
        }

        // GET: api/users/{id} - Users can only get their own profile; admins can get any
        [HttpGet("{id:long}")]
        public async Task<ActionResult<User>> Get(long id)
        {
            var currentUserId = GetUserId();
            var isAdmin = User.IsInRole("admin");

            // Only allow user to view their own profile OR if admin
            if (currentUserId != id && !isAdmin)
                return Forbid("Cannot view other users' profiles");

            var user = await _db.Users.FindAsync(id);
            if (user == null) return NotFound();
            return user;
        }

        // POST: api/users (admin only - new user registration should go through auth)
        [HttpPost]
        [Authorize(Roles = "admin")]
        public async Task<ActionResult<User>> Create(CreateUserRequest input)
        {
            // Validate required fields
            if (string.IsNullOrWhiteSpace(input.FirstName) || string.IsNullOrWhiteSpace(input.LastName) || string.IsNullOrWhiteSpace(input.Email))
            {
                return BadRequest("FirstName, LastName, and Email are required");
            }

            // Check if user with this email already exists
            var existingUser = await _db.Users.FirstOrDefaultAsync(u => u.Email == input.Email);
            if (existingUser != null)
            {
                return BadRequest("User with this email already exists");
            }

            // NOTE: in prod hash password properly. For now, using a placeholder.
            // TODO: Add password field to CreateUserRequest and hash it properly
            var defaultPasswordHash = "temp_password_hash"; // Placeholder

            var user = new User
            {
                FirstName = input.FirstName,
                LastName = input.LastName,
                Email = input.Email,
                Role = input.Role?.ToLower() ?? "shipper",
                IsActive = input.IsActive,
                PasswordHash = defaultPasswordHash,
                CreatedAt = DateTime.UtcNow,
                UpdatedAt = DateTime.UtcNow
            };

            _db.Users.Add(user);
            await _db.SaveChangesAsync();

            // Create profile based on role
            if (user.Role?.ToLower() == "broker")
            {
                var brokerProfile = new BrokerProfile
                {
                    UserId = user.Id,
                    OriginCountries = input.BrokerProfile?.OriginCountries ?? new List<string>(),
                    DestinationCountries = input.BrokerProfile?.DestinationCountries ?? new List<string>(),
                    HsCategories = input.BrokerProfile?.HsCategories ?? new List<string>(),
                    LicenseNumber = input.BrokerProfile?.LicenseNumber ?? "",
                    YearsOfExperience = input.BrokerProfile?.YearsOfExperience ?? 0,
                    Timezone = input.BrokerProfile?.Timezone ?? "UTC",
                    Language = input.BrokerProfile?.Language ?? "en",
                    IsAvailable = input.BrokerProfile?.IsAvailable ?? true,
                    MaxConcurrentShipments = input.BrokerProfile?.MaxConcurrentShipments ?? 10,
                    CreatedAt = DateTime.UtcNow,
                    UpdatedAt = DateTime.UtcNow
                };
                _db.BrokerProfiles.Add(brokerProfile);
            }
            else if (user.Role?.ToLower() == "shipper")
            {
                var shipperProfile = new ShipperProfile
                {
                    UserId = user.Id,
                    CreatedAt = DateTime.UtcNow,
                    UpdatedAt = DateTime.UtcNow
                };
                _db.ShipperProfiles.Add(shipperProfile);
            }

            await _db.SaveChangesAsync();
            return CreatedAtAction(nameof(Get), new { id = user.Id }, user);
        }

        // PUT: api/users/{id} - Users can only update their own; admins can update any
        [HttpPut("{id:long}")]
        public async Task<IActionResult> Update(long id, UpdateUserRequest input)
        {
            var currentUserId = GetUserId();
            var isAdmin = User.IsInRole("admin");

            // Only allow user to update their own profile OR if admin
            if (currentUserId != id && !isAdmin)
                return Forbid("Cannot update other users' profiles");

            var user = await _db.Users
                .Include(u => u.BrokerProfile)
                .Include(u => u.ShipperProfile)
                .FirstOrDefaultAsync(u => u.Id == id);
            if (user == null) return NotFound();

            // Validate required fields
            if (string.IsNullOrWhiteSpace(input.FirstName) || string.IsNullOrWhiteSpace(input.LastName))
            {
                return BadRequest("FirstName and LastName are required");
            }

            var originalRole = user.Role;

            // selective updates (avoid overwriting password_hash unless provided)
            user.FirstName = input.FirstName;
            user.LastName = input.LastName;
            user.Email = input.Email ?? user.Email; // Preserve existing if null
            user.Phone = input.Phone ?? user.Phone;
            user.Company = input.Company ?? user.Company;
            
            // Only admins can change role
            if (isAdmin && !string.IsNullOrWhiteSpace(input.Role))
                user.Role = input.Role;
            
            user.IsActive = input.IsActive;
            user.UpdatedAt = System.DateTime.UtcNow;

            // Handle role changes
            if (isAdmin && originalRole != user.Role)
            {
                // If role changed from broker to something else, remove broker profile
                if (originalRole?.ToLower() == "broker" && user.Role?.ToLower() != "broker" && user.BrokerProfile != null)
                {
                    _db.BrokerProfiles.Remove(user.BrokerProfile);
                }
                // If role changed from shipper to something else, remove shipper profile
                else if (originalRole?.ToLower() == "shipper" && user.Role?.ToLower() != "shipper" && user.ShipperProfile != null)
                {
                    _db.ShipperProfiles.Remove(user.ShipperProfile);
                }
                // If role changed to broker, create broker profile
                else if (user.Role?.ToLower() == "broker" && user.BrokerProfile == null)
                {
                    user.BrokerProfile = new BrokerProfile
                    {
                        UserId = user.Id,
                        OriginCountries = input.BrokerProfile?.OriginCountries ?? new List<string>(),
                        DestinationCountries = input.BrokerProfile?.DestinationCountries ?? new List<string>(),
                        HsCategories = input.BrokerProfile?.HsCategories ?? new List<string>(),
                        LicenseNumber = input.BrokerProfile?.LicenseNumber ?? "",
                        YearsOfExperience = input.BrokerProfile?.YearsOfExperience ?? 0,
                        Timezone = input.BrokerProfile?.Timezone ?? "UTC",
                        Language = input.BrokerProfile?.Language ?? "en",
                        IsAvailable = input.BrokerProfile?.IsAvailable ?? true,
                        MaxConcurrentShipments = input.BrokerProfile?.MaxConcurrentShipments ?? 10,
                        CreatedAt = DateTime.UtcNow,
                        UpdatedAt = DateTime.UtcNow
                    };
                }
                // If role changed to shipper, create shipper profile
                else if (user.Role?.ToLower() == "shipper" && user.ShipperProfile == null)
                {
                    user.ShipperProfile = new ShipperProfile
                    {
                        UserId = user.Id,
                        CreatedAt = DateTime.UtcNow,
                        UpdatedAt = DateTime.UtcNow
                    };
                }
            }

            // Update broker profile if provided and user is a broker
            if (isAdmin && user.Role?.ToLower() == "broker" && input.BrokerProfile != null)
            {
                // Create broker profile if it doesn't exist
                if (user.BrokerProfile == null)
                {
                    user.BrokerProfile = new BrokerProfile
                    {
                        UserId = user.Id,
                        CreatedAt = DateTime.UtcNow,
                        UpdatedAt = DateTime.UtcNow
                    };
                    _db.BrokerProfiles.Add(user.BrokerProfile);
                }

                // Update broker profile fields
                user.BrokerProfile.OriginCountries = input.BrokerProfile.OriginCountries ?? user.BrokerProfile.OriginCountries;
                user.BrokerProfile.DestinationCountries = input.BrokerProfile.DestinationCountries ?? user.BrokerProfile.DestinationCountries;
                user.BrokerProfile.HsCategories = input.BrokerProfile.HsCategories ?? user.BrokerProfile.HsCategories;
                user.BrokerProfile.LicenseNumber = input.BrokerProfile.LicenseNumber ?? user.BrokerProfile.LicenseNumber;
                user.BrokerProfile.YearsOfExperience = input.BrokerProfile.YearsOfExperience ?? user.BrokerProfile.YearsOfExperience;
                user.BrokerProfile.Timezone = input.BrokerProfile.Timezone ?? user.BrokerProfile.Timezone;
                user.BrokerProfile.Language = input.BrokerProfile.Language ?? user.BrokerProfile.Language;
                user.BrokerProfile.IsAvailable = input.BrokerProfile.IsAvailable ?? user.BrokerProfile.IsAvailable;
                user.BrokerProfile.MaxConcurrentShipments = input.BrokerProfile.MaxConcurrentShipments ?? user.BrokerProfile.MaxConcurrentShipments;
                user.BrokerProfile.UpdatedAt = DateTime.UtcNow;
            }

            await _db.SaveChangesAsync();
            return NoContent();
        }

        // DELETE: api/users/{id} (admin only)
        [HttpDelete("{id:long}")]
        [Authorize(Roles = "admin")]
        public async Task<IActionResult> Delete(long id)
        {
            var user = await _db.Users.FindAsync(id);
            if (user == null) return NotFound();
            _db.Users.Remove(user);
            await _db.SaveChangesAsync();
            return NoContent();
        }
    }

    public class CreateUserRequest
    {
        public string? FirstName { get; set; }
        public string? LastName { get; set; }
        public string? Email { get; set; }
        public string? Role { get; set; }
        public bool IsActive { get; set; } = true;
        public CreateBrokerProfileRequest? BrokerProfile { get; set; }
    }

    public class UpdateUserRequest
    {
        public string? FirstName { get; set; }
        public string? LastName { get; set; }
        public string? Email { get; set; }
        public string? Phone { get; set; }
        public string? Company { get; set; }
        public string? Role { get; set; }
        public bool IsActive { get; set; }
        public UpdateBrokerProfileRequest? BrokerProfile { get; set; }
    }

    public class CreateBrokerProfileRequest
    {
        public List<string>? OriginCountries { get; set; }
        public List<string>? DestinationCountries { get; set; }
        public List<string>? HsCategories { get; set; }
        public string? LicenseNumber { get; set; }
        public int? YearsOfExperience { get; set; }
        public string? Timezone { get; set; }
        public string? Language { get; set; }
        public bool? IsAvailable { get; set; }
        public int? MaxConcurrentShipments { get; set; }
    }

    public class UpdateBrokerProfileRequest
    {
        public List<string>? OriginCountries { get; set; }
        public List<string>? DestinationCountries { get; set; }
        public List<string>? HsCategories { get; set; }
        public string? LicenseNumber { get; set; }
        public int? YearsOfExperience { get; set; }
        public string? Timezone { get; set; }
        public string? Language { get; set; }
        public bool? IsAvailable { get; set; }
        public int? MaxConcurrentShipments { get; set; }
    }
}
