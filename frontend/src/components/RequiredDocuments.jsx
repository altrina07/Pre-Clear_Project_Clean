import React, { useState } from 'react';
import useRequiredDocuments from '../hooks/useRequiredDocuments';
import { uploadShipmentDocument } from '../api/documents';

/**
 * RequiredDocuments Component
 * Displays predicted required documents with confidence scores
 * Allows file uploads for each document
 * Shows provenance (ML/API/Rule) for each prediction
 */
const RequiredDocuments = ({
  shipmentData,
  onDocumentChange,
  debounceMs = 500,
  enabled = true,
  showMetadata = true,
  confidenceThreshold = 0.5,
}) => {
  // State for file uploads
  const [uploadedFiles, setUploadedFiles] = useState({});
  const [expandedDocs, setExpandedDocs] = useState(new Set());
  const [uploadingDocs, setUploadingDocs] = useState({});
  const [uploadErrors, setUploadErrors] = useState({});

  // Fetch predictions
  const { documents, loading, error, metadata, refresh } = useRequiredDocuments(
    shipmentData,
    debounceMs,
    enabled
  );

  /**
   * Filter documents by confidence threshold
   */
  const filteredDocuments = documents.filter(
    (doc) => (doc.confidence || 0) >= confidenceThreshold
  );

  /**
   * Handle file selection for a document
   */
  const handleFileSelect = async (documentName, event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Store file locally for immediate UI feedback
    setUploadedFiles((prev) => ({
      ...prev,
      [documentName]: {
        name: file.name,
        file,
        uploadedAt: new Date().toISOString(),
      },
    }));

    // Notify parent component
    if (onDocumentChange) {
      onDocumentChange({
        documentName,
        fileName: file.name,
        file,
        action: 'uploaded',
      });
    }

    // If shipmentData has an ID, upload to backend S3
    if (shipmentData?.id) {
      setUploadingDocs((prev) => ({ ...prev, [documentName]: true }));
      setUploadErrors((prev) => ({ ...prev, [documentName]: null }));

      try {
        await uploadShipmentDocument(shipmentData.id, file, documentName);
        console.log(`[RequiredDocuments] Successfully uploaded ${documentName} to S3`);
      } catch (err) {
        console.error(`[RequiredDocuments] Failed to upload ${documentName}:`, err);
        setUploadErrors((prev) => ({
          ...prev,
          [documentName]: err.message || 'Upload failed',
        }));
      } finally {
        setUploadingDocs((prev) => ({ ...prev, [documentName]: false }));
      }
    }
  };

  /**
   * Remove uploaded file for a document
   */
  const handleRemoveFile = (documentName) => {
    setUploadedFiles((prev) => {
      const updated = { ...prev };
      delete updated[documentName];
      return updated;
    });

    if (onDocumentChange) {
      onDocumentChange({
        documentName,
        action: 'removed',
      });
    }
  };

  /**
   * Toggle document details expansion
   */
  const toggleExpand = (documentName) => {
    setExpandedDocs((prev) => {
      const updated = new Set(prev);
      if (updated.has(documentName)) {
        updated.delete(documentName);
      } else {
        updated.add(documentName);
      }
      return updated;
    });
  };

  /**
   * Get confidence badge styling
   */
  const getConfidenceBadgeClass = (confidence) => {
    if (confidence >= 0.85) return 'bg-green-100 text-green-800 border-green-300';
    if (confidence >= 0.7) return 'bg-blue-100 text-blue-800 border-blue-300';
    if (confidence >= 0.5) return 'bg-yellow-100 text-yellow-800 border-yellow-300';
    return 'bg-orange-100 text-orange-800 border-orange-300';
  };

  /**
   * Get provenance badge
   */
  const getProvenanceBadge = (provenance) => {
    const badges = {
      ml: { label: 'ML Model', color: 'bg-purple-100 text-purple-700 border-purple-300' },
      api: { label: 'Compliance API', color: 'bg-indigo-100 text-indigo-700 border-indigo-300' },
      rule: { label: 'Rule-Based', color: 'bg-gray-100 text-gray-700 border-gray-300' },
      hybrid: { label: 'Hybrid', color: 'bg-pink-100 text-pink-700 border-pink-300' },
    };

    const badge = badges[provenance?.toLowerCase()] || badges.rule;
    return badge;
  };

  return (
    <div className="w-full bg-white rounded-lg border border-gray-200 p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">Required Documents</h3>
          <p className="text-sm text-gray-600 mt-1">
            AI-predicted shipping documents for this shipment
          </p>
        </div>
        <button
          onClick={refresh}
          disabled={loading}
          className="px-4 py-2 text-sm font-medium text-blue-600 hover:text-blue-700 disabled:text-gray-400 disabled:cursor-not-allowed"
        >
          {loading ? 'Refreshing...' : 'Refresh'}
        </button>
      </div>

      {/* Error Message */}
      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      {/* Loading State */}
      {loading && !documents.length && (
        <div className="flex items-center justify-center py-8">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
          <span className="ml-3 text-gray-600">Analyzing required documents...</span>
        </div>
      )}

      {/* No Documents */}
      {!loading && !error && filteredDocuments.length === 0 && (
        <div className="py-8 text-center">
          <p className="text-gray-600">
            No documents predicted. Check shipment details and try again.
          </p>
        </div>
      )}

      {/* Documents List */}
      {filteredDocuments.length > 0 && (
        <div className="space-y-3">
          {filteredDocuments.map((doc) => {
            const isExpanded = expandedDocs.has(doc.name);
            const isUploaded = uploadedFiles[doc.name];
            const provenanceBadge = getProvenanceBadge(doc.provenance);

            return (
              <div
                key={doc.name}
                className="border border-gray-200 rounded-lg hover:border-gray-300 transition-colors"
              >
                {/* Document Header */}
                <div className="p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3">
                        <input
                          type="checkbox"
                          defaultChecked={isUploaded}
                          onChange={(e) => {
                            if (onDocumentChange) {
                              onDocumentChange({
                                documentName: doc.name,
                                checked: e.target.checked,
                                action: 'toggled',
                              });
                            }
                          }}
                          className="w-5 h-5 text-blue-600 rounded border-gray-300 cursor-pointer"
                        />
                        <h4 className="text-base font-semibold text-gray-900">
                          {doc.name}
                        </h4>
                      </div>

                      {/* Badges Row */}
                      <div className="mt-2 flex items-center gap-2 ml-8">
                        {/* Confidence Badge */}
                        <span
                          className={`inline-block px-2 py-1 text-xs font-medium border rounded ${getConfidenceBadgeClass(
                            doc.confidence
                          )}`}
                        >
                          {(doc.confidence * 100).toFixed(0)}% confidence
                        </span>

                        {/* Provenance Badge */}
                        <span
                          className={`inline-block px-2 py-1 text-xs font-medium border rounded ${provenanceBadge.color}`}
                        >
                          {provenanceBadge.label}
                        </span>
                      </div>

                      {/* Description */}
                      {doc.description && (
                        <p className="mt-2 text-sm text-gray-600 ml-8">
                          {doc.description}
                        </p>
                      )}
                    </div>

                    {/* Expand/Collapse Button */}
                    {(doc.regulatory_basis || doc.description) && (
                      <button
                        onClick={() => toggleExpand(doc.name)}
                        className="ml-4 p-2 hover:bg-gray-100 rounded transition-colors"
                      >
                        <svg
                          className={`w-5 h-5 text-gray-600 transition-transform ${
                            isExpanded ? 'rotate-180' : ''
                          }`}
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M19 14l-7 7m0 0l-7-7m7 7V3"
                          />
                        </svg>
                      </button>
                    )}
                  </div>

                  {/* Expanded Details */}
                  {isExpanded && (doc.regulatory_basis || doc.description) && (
                    <div className="mt-3 ml-8 p-3 bg-gray-50 rounded border border-gray-200">
                      {doc.regulatory_basis && (
                        <p className="text-sm text-gray-700">
                          <span className="font-semibold">Regulatory Basis: </span>
                          {doc.regulatory_basis}
                        </p>
                      )}
                    </div>
                  )}
                </div>

                {/* File Upload Section */}
                <div className="px-4 pb-4 border-t border-gray-100">
                  {!isUploaded ? (
                    <div>
                      <label className="flex items-center justify-center p-4 border-2 border-dashed border-gray-300 rounded-lg cursor-pointer hover:border-blue-400 hover:bg-blue-50 transition-colors">
                        <input
                          type="file"
                          onChange={(e) => handleFileSelect(doc.name, e)}
                          className="hidden"
                          accept=".pdf,.doc,.docx,.xlsx,.csv,.jpg,.jpeg,.png,.gif"
                          disabled={uploadingDocs[doc.name]}
                        />
                        <div className="text-center">
                          {uploadingDocs[doc.name] ? (
                            <>
                              <div className="mx-auto h-6 w-6 animate-spin rounded-full border-2 border-blue-400 border-t-blue-600 mb-2"></div>
                              <p className="mt-2 text-sm text-gray-700">
                                <span className="font-semibold">Uploading to S3...</span>
                              </p>
                            </>
                          ) : (
                            <>
                              <svg
                                className="mx-auto h-6 w-6 text-gray-400"
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth={2}
                                  d="M12 4v16m8-8H4"
                                />
                              </svg>
                              <p className="mt-2 text-sm text-gray-700">
                                <span className="font-semibold">Click to upload</span> or drag and
                                drop
                              </p>
                              <p className="text-xs text-gray-500 mt-1">
                                PDF, Word, Excel, Images up to 10MB
                              </p>
                            </>
                          )}
                        </div>
                      </label>
                      {uploadErrors[doc.name] && (
                        <div className="mt-2 p-2 bg-red-50 border border-red-200 rounded text-sm text-red-700">
                          {uploadErrors[doc.name]}
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="p-3 bg-green-50 border border-green-200 rounded-lg flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <svg
                          className="w-5 h-5 text-green-600"
                          fill="currentColor"
                          viewBox="0 0 20 20"
                        >
                          <path
                            fillRule="evenodd"
                            d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                            clipRule="evenodd"
                          />
                        </svg>
                        <div>
                          <p className="text-sm font-semibold text-green-800">
                            {isUploaded.name}
                          </p>
                          <p className="text-xs text-green-700">
                            Uploaded to S3 {new Date(isUploaded.uploadedAt).toLocaleDateString()}
                          </p>
                        </div>
                      </div>
                      <button
                        onClick={() => handleRemoveFile(doc.name)}
                        className="text-green-600 hover:text-green-700 font-semibold text-sm"
                      >
                        Change
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Metadata Footer */}
      {showMetadata && metadata && (
        <div className="mt-6 pt-4 border-t border-gray-200">
          <div className="grid grid-cols-4 gap-4 text-xs text-gray-600">
            <div>
              <span className="font-semibold block">Mode</span>
              <span>{metadata.mode || 'N/A'}</span>
            </div>
            <div>
              <span className="font-semibold block">Model Version</span>
              <span>{metadata.modelVersion || 'N/A'}</span>
            </div>
            <div>
              <span className="font-semibold block">Threshold</span>
              <span>{(metadata.confidenceThreshold * 100).toFixed(0)}%</span>
            </div>
            <div>
              <span className="font-semibold block">Updated</span>
              <span>
                {metadata.timestamp
                  ? new Date(metadata.timestamp).toLocaleTimeString()
                  : 'N/A'}
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default RequiredDocuments;
