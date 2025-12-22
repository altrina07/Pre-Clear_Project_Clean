using System.Text;
using System.Text.Json;
using Amazon.BedrockRuntime;
using Amazon.BedrockRuntime.Model;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using PreClear.Api.Interfaces;
using PreClear.Api.Models;

namespace PreClear.Api.AI.Services.DocumentValidator
{
    public class AiDocumentAnalyzerBedrock : IAiDocumentAnalyzer
    {
        private readonly IAmazonBedrockRuntime _bedrock;
        private readonly ILogger<AiDocumentAnalyzerBedrock> _logger;
        private readonly BedrockSettings _settings;

        public AiDocumentAnalyzerBedrock(
            IAmazonBedrockRuntime bedrock,
            IOptions<BedrockSettings> settings,
            ILogger<AiDocumentAnalyzerBedrock> logger)
        {
            _bedrock = bedrock;
            _logger = logger;
            _settings = settings.Value ?? new BedrockSettings();
        }

        public async Task<Dictionary<string, string>> ExtractFieldsAsync(string content, string documentType)
        {
            var result = new Dictionary<string, string>();
            if (string.IsNullOrWhiteSpace(content) || string.IsNullOrWhiteSpace(_settings.ModelId))
                return result;

            try
            {
                var prompt = BuildPrompt(content, documentType);
                _logger.LogDebug("Invoking Bedrock model {ModelId} for {DocType}. Content length={ContentLength}. Prompt preview={PromptPreview}",
                    _settings.ModelId, documentType, content?.Length ?? 0, prompt.Substring(0, Math.Min(1000, prompt.Length)));
                
                // Use Mistral request format for Mistral models on Bedrock
                var requestPayload = new
                {
                    prompt = prompt,
                    max_tokens = 1024,
                    temperature = 0.1 // Low temperature for consistent JSON output
                };

                var json = JsonSerializer.Serialize(requestPayload);
                var request = new InvokeModelRequest
                {
                    ModelId = _settings.ModelId,
                    ContentType = "application/json",
                    Accept = "application/json",
                    Body = new MemoryStream(Encoding.UTF8.GetBytes(json))
                };

                var response = await _bedrock.InvokeModelAsync(request);
                using var reader = new StreamReader(response.Body);
                var body = await reader.ReadToEndAsync();
                _logger.LogDebug("Bedrock response contentType={ContentType} length={Length} preview={Preview}",
                    response.ContentType, body?.Length ?? 0, body is { Length: > 0 } ? body.Substring(0, Math.Min(1000, body.Length)) : "");

                var extracted = ParseMistralResponse(body);
                _logger.LogDebug("Extracted fields: {Keys}", string.Join(",", extracted.Keys));
                foreach (var kv in extracted)
                {
                    if (!string.IsNullOrWhiteSpace(kv.Value))
                        result[kv.Key] = kv.Value;
                }
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Bedrock analysis failed; returning empty parse");
            }

            return result;
        }

        private static string BuildPrompt(string content, string documentType)
        {
            var schema = @"{
  ""invoice_number"": ""string or empty"",
  ""tracking_number"": ""string or empty"",
  ""weight_kg"": ""number or 0"",
  ""total_value"": ""number or 0"",
  ""hs_code"": ""string or empty"",
  ""origin_country"": ""string or empty"",
  ""destination_country"": ""string or empty""
}";
            var instructions = $@"You are an expert document parser for {documentType} documents.
Extract the following fields from the provided text. Return ONLY a valid JSON object matching this schema, with no additional text or explanation.

Schema:
{schema}

Rules:
- Return empty string "" for missing string values
- Return 0 for missing numeric values
- Extract exact values from the document
- Respond with ONLY the JSON object

Document text:
{content}

JSON Response:";
            return instructions;
        }

        private static Dictionary<string, string> ParseMistralResponse(string body)
        {
            var dict = new Dictionary<string, string>();
            try
            {
                using var doc = JsonDocument.Parse(body);
                
                // Mistral response format: { "outputs": [ { "text": "..." } ] }
                if (doc.RootElement.TryGetProperty("outputs", out var outputsArr) && outputsArr.ValueKind == JsonValueKind.Array)
                {
                    var outputs = outputsArr.EnumerateArray().ToList();
                    if (outputs.Count > 0 && outputs[0].TryGetProperty("text", out var textEl))
                    {
                        var jsonText = textEl.GetString() ?? string.Empty;
                        var parsed = TryParseJsonObject(jsonText);
                        foreach (var kv in parsed)
                            dict[kv.Key] = kv.Value;
                    }
                }
                else
                {
                    // Fallback: try to parse the entire body as JSON
                    var parsed = TryParseJsonObject(body);
                    foreach (var kv in parsed)
                        dict[kv.Key] = kv.Value;
                }
            }
            catch (Exception ex)
            {
                // Last resort: try to extract JSON from raw text if parsing fails
                var jsonMatch = System.Text.RegularExpressions.Regex.Match(body, @"\{[^{}]*\}");
                if (jsonMatch.Success)
                {
                    var parsed = TryParseJsonObject(jsonMatch.Value);
                    foreach (var kv in parsed)
                        dict[kv.Key] = kv.Value;
                }
            }

            return dict;
        }

        private static Dictionary<string, string> TryParseJsonObject(string json)
        {
            var dict = new Dictionary<string, string>();
            if (string.IsNullOrWhiteSpace(json)) return dict;
            
            try
            {
                using var doc = JsonDocument.Parse(json);
                if (doc.RootElement.ValueKind == JsonValueKind.Object)
                {
                    void AddIfExists(string key)
                    {
                        if (doc.RootElement.TryGetProperty(key, out var el))
                        {
                            dict[key] = el.ValueKind switch
                            {
                                JsonValueKind.String => el.GetString() ?? string.Empty,
                                JsonValueKind.Number => el.TryGetDecimal(out var d) ? d.ToString() : el.GetRawText(),
                                JsonValueKind.Null => string.Empty,
                                _ => el.GetRawText()
                            };
                        }
                    }
                    AddIfExists("invoice_number");
                    AddIfExists("tracking_number");
                    AddIfExists("weight_kg");
                    AddIfExists("total_value");
                    AddIfExists("hs_code");
                    AddIfExists("origin_country");
                    AddIfExists("destination_country");
                }
            }
            catch { }
            
            return dict;
        }
    }
}
