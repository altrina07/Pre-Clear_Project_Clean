import { useState, useEffect } from 'react';
import { CheckCircle, AlertCircle, XCircle, Loader, Info } from 'lucide-react';
import { validateShipmentDocuments, getValidationStatus } from '../../api/documents';

/**
 * ValidationStatusPanel Component
 * Displays document validation status and issues
 * Gates the "Request for Broker Review" button until validation passes
 */
export function ValidationStatusPanel({ shipmentId, onValidationComplete, allowRequestBrokerReview = false }) {
  const [validationStatus, setValidationStatus] = useState('not_validated');
  const [validationScore, setValidationScore] = useState(null);
  const [validationMessage, setValidationMessage] = useState('');
  const [issues, setIssues] = useState([]);
  const [isValidating, setIsValidating] = useState(false);
  const [expandedIssue, setExpandedIssue] = useState(null);

  // Fetch validation status on component mount
  useEffect(() => {
    if (shipmentId) {
      fetchValidationStatus();
    }
  }, [shipmentId]);

  const fetchValidationStatus = async () => {
    try {
      const result = await getValidationStatus(shipmentId);
      setValidationStatus(result.status || 'not_validated');
      setValidationScore(result.validationScore || 0);
      setValidationMessage(result.message || '');
      setIssues(result.issues || []);
    } catch (err) {
      console.error('Error fetching validation status:', err);
      setValidationStatus('error');
      setValidationMessage('Could not fetch validation status');
    }
  };

  const handleValidate = async () => {
    setIsValidating(true);
    try {
      const result = await validateShipmentDocuments(shipmentId);
      
      setValidationStatus(result.status);
      setValidationScore(result.validationScore);
      setValidationMessage(result.message);
      setIssues(result.issues || []);
      
      // Notify parent component
      if (onValidationComplete) {
        onValidationComplete(result.status === 'approved', result);
      }
    } catch (err) {
      console.error('Validation error:', err);
      setValidationStatus('error');
      setValidationMessage('Validation failed: ' + (err?.message || 'Unknown error'));
      setIssues([
        {
          severity: 'error',
          category: 'system',
          message: 'Validation System Error',
          details: err?.message || 'An unexpected error occurred during validation'
        }
      ]);
    } finally {
      setIsValidating(false);
    }
  };

  const getStatusIcon = () => {
    switch (validationStatus) {
      case 'approved':
        return <CheckCircle className="w-6 h-6 text-green-600" />;
      case 'failed':
        return <XCircle className="w-6 h-6 text-red-600" />;
      case 'error':
        return <AlertCircle className="w-6 h-6 text-red-600" />;
      case 'not_validated':
        return <Info className="w-6 h-6 text-blue-600" />;
      default:
        return <Loader className="w-6 h-6 text-yellow-600 animate-spin" />;
    }
  };

  const getStatusColor = () => {
    switch (validationStatus) {
      case 'approved':
        return 'bg-green-50 border-green-200';
      case 'failed':
        return 'bg-red-50 border-red-200';
      case 'error':
        return 'bg-red-50 border-red-200';
      case 'not_validated':
        return 'bg-blue-50 border-blue-200';
      default:
        return 'bg-yellow-50 border-yellow-200';
    }
  };

  const getStatusTextColor = () => {
    switch (validationStatus) {
      case 'approved':
        return 'text-green-800';
      case 'failed':
        return 'text-red-800';
      case 'error':
        return 'text-red-800';
      case 'not_validated':
        return 'text-blue-800';
      default:
        return 'text-yellow-800';
    }
  };

  const getSeverityBgColor = (severity) => {
    switch (severity) {
      case 'error':
        return 'bg-red-100 border-red-300';
      case 'warning':
        return 'bg-yellow-100 border-yellow-300';
      case 'info':
        return 'bg-blue-100 border-blue-300';
      default:
        return 'bg-gray-100 border-gray-300';
    }
  };

  const getSeverityTextColor = (severity) => {
    switch (severity) {
      case 'error':
        return 'text-red-800';
      case 'warning':
        return 'text-yellow-800';
      case 'info':
        return 'text-blue-800';
      default:
        return 'text-gray-800';
    }
  };

  const getSeverityIcon = (severity) => {
    switch (severity) {
      case 'error':
        return <XCircle className="w-5 h-5" />;
      case 'warning':
        return <AlertCircle className="w-5 h-5" />;
      case 'info':
        return <Info className="w-5 h-5" />;
      default:
        return <Info className="w-5 h-5" />;
    }
  };

  const errorCount = issues.filter(i => i.severity === 'error').length;
  const warningCount = issues.filter(i => i.severity === 'warning').length;
  const infoCount = issues.filter(i => i.severity === 'info').length;

  return (
    <div className="w-full space-y-4">
      {/* Main Status Panel */}
      <div className={`border-2 rounded-lg p-6 ${getStatusColor()}`}>
        <div className="flex items-start gap-4">
          <div className="flex-shrink-0 mt-1">
            {getStatusIcon()}
          </div>
          
          <div className="flex-grow">
            <div className="flex items-center justify-between mb-2">
              <h3 className={`text-lg font-semibold ${getStatusTextColor()}`}>
                {validationStatus === 'not_validated' && 'Validation Required'}
                {validationStatus === 'approved' && 'Documents Approved'}
                {validationStatus === 'failed' && 'Validation Failed'}
                {validationStatus === 'error' && 'Validation Error'}
              </h3>
              {validationScore !== null && (
                <div className="text-sm font-medium">
                  Score: <span className={validationScore >= 80 ? 'text-green-600' : validationScore >= 50 ? 'text-yellow-600' : 'text-red-600'}>
                    {validationScore.toFixed(1)}%
                  </span>
                </div>
              )}
            </div>
            
            <p className={`text-sm ${getStatusTextColor()}`}>
              {validationMessage}
            </p>

            {/* Status Summary */}
            {issues.length > 0 && (
              <div className="mt-3 text-sm flex gap-4">
                {errorCount > 0 && <span className="text-red-700 font-medium">{errorCount} Error{errorCount !== 1 ? 's' : ''}</span>}
                {warningCount > 0 && <span className="text-yellow-700 font-medium">{warningCount} Warning{warningCount !== 1 ? 's' : ''}</span>}
                {infoCount > 0 && <span className="text-blue-700 font-medium">{infoCount} Info</span>}
              </div>
            )}
          </div>
        </div>

        {/* Action Buttons */}
        <div className="mt-4 flex gap-3">
          {validationStatus === 'not_validated' && (
            <button
              onClick={handleValidate}
              disabled={isValidating}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 flex items-center gap-2 transition-colors"
            >
              {isValidating && <Loader className="w-4 h-4 animate-spin" />}
              Validate Documents
            </button>
          )}
          
          {validationStatus === 'failed' && (
            <button
              onClick={handleValidate}
              disabled={isValidating}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 flex items-center gap-2 transition-colors"
            >
              {isValidating && <Loader className="w-4 h-4 animate-spin" />}
              Revalidate Documents
            </button>
          )}

          {validationStatus === 'approved' && allowRequestBrokerReview && (
            <button
              className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
            >
              ✓ Request for Broker Review
            </button>
          )}

          {validationStatus === 'error' && (
            <button
              onClick={handleValidate}
              disabled={isValidating}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 flex items-center gap-2 transition-colors"
            >
              {isValidating && <Loader className="w-4 h-4 animate-spin" />}
              Retry Validation
            </button>
          )}
        </div>
      </div>

      {/* Issues List */}
      {issues.length > 0 && (
        <div className="space-y-2">
          <h4 className="font-semibold text-gray-900">Validation Issues</h4>
          {issues.map((issue, index) => (
            <div
              key={index}
              className={`border rounded-lg p-3 cursor-pointer transition-colors ${getSeverityBgColor(issue.severity)}`}
              onClick={() => setExpandedIssue(expandedIssue === index ? null : index)}
            >
              <div className="flex items-start gap-3">
                <div className={`flex-shrink-0 mt-0.5 ${getSeverityTextColor(issue.severity)}`}>
                  {getSeverityIcon(issue.severity)}
                </div>
                
                <div className="flex-grow">
                  <div className="flex items-center justify-between">
                    <p className={`font-medium ${getSeverityTextColor(issue.severity)}`}>
                      {issue.message}
                    </p>
                    <span className={`text-xs font-semibold px-2 py-1 rounded ${getSeverityTextColor(issue.severity)} bg-white bg-opacity-50`}>
                      {issue.severity.toUpperCase()}
                    </span>
                  </div>
                  
                  {issue.category && (
                    <p className="text-xs text-gray-600 mt-1">
                      Category: {issue.category.replace('_', ' ').toUpperCase()}
                    </p>
                  )}

                  {expandedIssue === index && issue.details && (
                    <p className={`text-sm mt-2 ${getSeverityTextColor(issue.severity)}`}>
                      {issue.details}
                    </p>
                  )}

                  {issue.suggestedAction && (
                    <p className="text-sm mt-2 text-gray-700">
                      <strong>Suggested Action:</strong> {issue.suggestedAction}
                    </p>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Info Message */}
      {validationStatus === 'not_validated' && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 flex gap-3">
          <Info className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
          <div className="text-sm text-blue-800">
            <p className="font-medium mb-1">Validation Information</p>
            <ul className="list-disc list-inside space-y-1 text-xs">
              <li>Documents will be checked against shipment form data</li>
              <li>Compliance rules from your route will be verified</li>
              <li>Data consistency between documents will be validated</li>
              <li>Only after validation passes can you request broker review</li>
            </ul>
          </div>
        </div>
      )}

      {validationStatus === 'approved' && !allowRequestBrokerReview && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4 flex gap-3">
          <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
          <div className="text-sm text-green-800">
            <p className="font-medium">Ready for Broker Review</p>
            <p className="text-xs mt-1">Your documents have passed validation. You can now request a broker to review your shipment.</p>
          </div>
        </div>
      )}

      {validationStatus === 'failed' && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex gap-3">
          <XCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
          <div className="text-sm text-red-800">
            <p className="font-medium mb-1">Please Fix the Following Issues</p>
            <p className="text-xs">
              Review the issues above and upload corrected documents. Then click "Revalidate Documents" to try again.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
