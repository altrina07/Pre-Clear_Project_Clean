using System.Collections.Generic;
using System.Threading.Tasks;

namespace PreClear.Api.Interfaces
{
    /// <summary>
    /// AI-powered analyzer that parses unstructured document text into structured fields.
    /// Implementations may use Azure OpenAI, OpenAI, or other LLM providers.
    /// </summary>
    public interface IAiDocumentAnalyzer
    {
        Task<Dictionary<string, string>> ExtractFieldsAsync(string content, string documentType);
    }
}
