using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Text.Json;
using System.Threading.Tasks;
using Microsoft.Extensions.Logging;

namespace PreClear.Api.AI.Services.DocumentValidator
{
    /// <summary>
    /// Loads and manages the cross_border_shipping_restrictions.csv dataset
    /// Maps compliance rules by origin/destination countries, mode, and product type
    /// </summary>
    public class ComplianceDatasetLoader
    {
        private readonly ILogger<ComplianceDatasetLoader> _logger;
        private List<ComplianceRule> _rules = new();
        private bool _loaded = false;

        public ComplianceDatasetLoader(ILogger<ComplianceDatasetLoader> logger)
        {
            _logger = logger;
        }

        public async Task LoadDatasetAsync(string datasetPath)
        {
            if (_loaded && _rules.Count > 0)
            {
                _logger.LogInformation("Dataset already loaded with {Count} rules", _rules.Count);
                return;
            }

            try
            {
                if (!File.Exists(datasetPath))
                {
                    _logger.LogWarning("Dataset file not found at {Path}. Initializing with empty rules.", datasetPath);
                    _rules = new List<ComplianceRule>();
                    _loaded = true;
                    return;
                }

                var lines = await File.ReadAllLinesAsync(datasetPath);
                _rules = ParseCsvLines(lines);
                _loaded = true;

                _logger.LogInformation("Loaded {Count} compliance rules from dataset", _rules.Count);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error loading compliance dataset from {Path}", datasetPath);
                _rules = new List<ComplianceRule>();
                _loaded = true;
            }
        }

        private List<ComplianceRule> ParseCsvLines(string[] lines)
        {
            var rules = new List<ComplianceRule>();

            if (lines.Length < 2)
            {
                _logger.LogWarning("CSV file has no data rows");
                return rules;
            }

            // Expected headers (adjust based on your CSV structure):
            // origin_country, origin_country_iso, country, country_iso, mode, package_type, 
            // product_description, hs_code, max_weight_kg_per_package, max_total_weight_kg,
            // restricted, restricted_details, banned, banned_details, packing_notes

            var headerLine = lines[0];
            var headers = headerLine.Split(',');
            
            var headerDict = new Dictionary<string, int>();
            for (int i = 0; i < headers.Length; i++)
            {
                headerDict[headers[i].Trim()] = i;
            }

            for (int i = 1; i < lines.Length; i++)
            {
                try
                {
                    var line = lines[i].Trim();
                    if (string.IsNullOrWhiteSpace(line)) continue;

                    var values = ParseCsvLine(line);
                    if (values.Length < 2) continue;

                    var rule = new ComplianceRule
                    {
                        OriginCountry = GetValue(values, headerDict, "origin_country"),
                        OriginCountryIso = GetValue(values, headerDict, "origin_country_iso"),
                        DestinationCountry = GetValue(values, headerDict, "country"),
                        DestinationCountryIso = GetValue(values, headerDict, "country_iso"),
                        Mode = GetValue(values, headerDict, "mode"),
                        PackageType = GetValue(values, headerDict, "package_type"),
                        ProductDescription = GetValue(values, headerDict, "product_description"),
                        HsCode = GetValue(values, headerDict, "hs_code"),
                        MaxWeightKgPerPackage = TryParseDecimal(GetValue(values, headerDict, "max_weight_kg_per_package")),
                        MaxTotalWeightKg = TryParseDecimal(GetValue(values, headerDict, "max_total_weight_kg")),
                        Restricted = ParseBool(GetValue(values, headerDict, "restricted")),
                        RestrictedDetails = GetValue(values, headerDict, "restricted_details"),
                        Banned = ParseBool(GetValue(values, headerDict, "banned")),
                        BannedDetails = GetValue(values, headerDict, "banned_details"),
                        PackingNotes = GetValue(values, headerDict, "packing_notes"),
                    };

                    rules.Add(rule);
                }
                catch (Exception ex)
                {
                    _logger.LogWarning(ex, "Error parsing rule at line {LineNumber}", i + 1);
                }
            }

            return rules;
        }

        private string[] ParseCsvLine(string line)
        {
            // Simple CSV parser that handles quoted fields
            var values = new List<string>();
            var currentValue = "";
            var inQuotes = false;

            for (int i = 0; i < line.Length; i++)
            {
                var c = line[i];

                if (c == '"')
                {
                    inQuotes = !inQuotes;
                }
                else if (c == ',' && !inQuotes)
                {
                    values.Add(currentValue.Trim().Trim('"'));
                    currentValue = "";
                }
                else
                {
                    currentValue += c;
                }
            }

            values.Add(currentValue.Trim().Trim('"'));
            return values.ToArray();
        }

        private string GetValue(string[] values, Dictionary<string, int> headerDict, string headerName)
        {
            if (headerDict.TryGetValue(headerName, out var index) && index < values.Length)
            {
                return values[index].Trim();
            }
            return string.Empty;
        }

        private decimal? TryParseDecimal(string value)
        {
            if (string.IsNullOrWhiteSpace(value)) return null;
            if (decimal.TryParse(value, out var result)) return result;
            return null;
        }

        private bool ParseBool(string value)
        {
            if (string.IsNullOrWhiteSpace(value)) return false;
            var lower = value.ToLowerInvariant();
            return lower == "yes" || lower == "true" || lower == "1";
        }

        public List<ComplianceRule> GetRules() => _rules;

        public List<ComplianceRule> FindMatchingRules(string originCountry, string destinationCountry, 
            string mode, string packageType, string hsCode)
        {
            return _rules.Where(r =>
                (string.IsNullOrEmpty(r.OriginCountry) || r.OriginCountry.Equals(originCountry, StringComparison.OrdinalIgnoreCase)) &&
                (string.IsNullOrEmpty(r.DestinationCountry) || r.DestinationCountry.Equals(destinationCountry, StringComparison.OrdinalIgnoreCase)) &&
                (string.IsNullOrEmpty(r.Mode) || r.Mode.Equals(mode, StringComparison.OrdinalIgnoreCase)) &&
                (string.IsNullOrEmpty(r.PackageType) || r.PackageType.Equals(packageType, StringComparison.OrdinalIgnoreCase)) &&
                (string.IsNullOrEmpty(r.HsCode) || hsCode.StartsWith(r.HsCode))
            ).ToList();
        }
    }

    public class ComplianceRule
    {
        public string OriginCountry { get; set; } = string.Empty;
        public string OriginCountryIso { get; set; } = string.Empty;
        public string DestinationCountry { get; set; } = string.Empty;
        public string DestinationCountryIso { get; set; } = string.Empty;
        public string Mode { get; set; } = string.Empty; // air, sea, road, rail, multimodal, courier
        public string PackageType { get; set; } = string.Empty; // box, pallet, crate, envelope, case
        public string ProductDescription { get; set; } = string.Empty;
        public string HsCode { get; set; } = string.Empty;
        public decimal? MaxWeightKgPerPackage { get; set; }
        public decimal? MaxTotalWeightKg { get; set; }
        public bool Restricted { get; set; }
        public string RestrictedDetails { get; set; } = string.Empty;
        public bool Banned { get; set; }
        public string BannedDetails { get; set; } = string.Empty;
        public string PackingNotes { get; set; } = string.Empty;
    }
}
