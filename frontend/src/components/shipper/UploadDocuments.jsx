import { useState, useEffect } from 'react';
import { Upload, CheckCircle, FileText, AlertCircle, ArrowLeft, Send, Sparkles, Loader, Zap, XCircle, AlertTriangle } from 'lucide-react';
import { shipmentsStore } from '../../store/shipmentsStore';
import { useShipments } from '../../hooks/useShipments';
import { uploadShipmentDocument, markShipmentDocument } from '../../api/documents';

export function UploadDocuments({ shipment, onNavigate }) {
  const { importExportRules, updateAIApproval, requestBrokerApproval } = useShipments();
  const [documents, setDocuments] = useState(
    shipment.requiredDocuments || [
      { name: 'Commercial Invoice', status: 'pending', required: true },
      { name: 'Packing List', status: 'pending', required: true },
      { name: 'Certificate of Origin', status: 'pending', required: true },
      { name: 'Bill of Lading', status: 'pending', required: false }
    ]
  );

  const [uploadingDoc, setUploadingDoc] = useState(null);
  const [aiProcessing, setAiProcessing] = useState(false);
  const [aiCompleted, setAiCompleted] = useState(false);
  const [aiApproved, setAiApproved] = useState(false);
  const [aiResults, setAiResults] = useState(null);
  const [aiScore, setAiScore] = useState(0);

  // Real upload function
  const handleUpload = async (docName, file) => {
    if (!file || !shipment?.id) return;
    setUploadingDoc(docName);
    try {
      await uploadShipmentDocument(shipment.id, file, docName);
      await markShipmentDocument(shipment.id, file.name);

      setDocuments(prev => prev.map(doc => 
        doc.name === docName 
          ? { ...doc, status: 'uploaded', uploadedAt: new Date().toISOString(), fileName: file.name }
          : doc
      ));

      shipmentsStore.uploadDocument(shipment.id, docName, 'document');
    } catch (err) {
      console.error('Upload failed', err);
      alert('Upload failed: ' + (err?.message || 'unknown error'));
    } finally {
      setUploadingDoc(null);
    }
  };

  // Check if all required documents are uploaded and trigger AI automatically
  useEffect(() => {
    const allRequiredUploaded = documents.filter(d => d.required).every(d => d.status === 'uploaded');
    
    if (allRequiredUploaded && !aiProcessing && !aiCompleted) {
      // Automatically trigger AI check when all required docs are uploaded
      handleAutoAICheck();
    }
  }, [documents]);

  const handleAutoAICheck = () => {
    setAiProcessing(true);
    
    // Simulate AI evaluation with comprehensive checks
    setTimeout(() => {
      const validationResults = [];
      
      // 1. Import/Export Rules Validation
      const relevantRules = importExportRules.filter(rule => 
        rule.countryCode === shipment.destCountry
      );
      
      let rulesPassed = true;
      let rulesDetails = [];
      
      if (relevantRules.length > 0) {
        const productRule = relevantRules.find(r => 
          shipment.hsCode.startsWith(r.hsCodeRange?.split('-')[0])
        );
        
        if (productRule) {
          rulesDetails.push(`Matched ${productRule.productCategory} rules for ${productRule.country}`);
          
          if (productRule.maxValue && parseFloat(shipment.value) > productRule.maxValue) {
            rulesPassed = false;
            rulesDetails.push(`⚠️ Value exceeds maximum: $${productRule.maxValue}`);
          }
          
          if (productRule.maxWeight && parseFloat(shipment.weight) > productRule.maxWeight) {
            rulesPassed = false;
            rulesDetails.push(`⚠️ Weight exceeds maximum: ${productRule.maxWeight}kg`);
          }
        }
      }
      
      validationResults.push({
        category: 'rules',
        status: rulesPassed ? 'passed' : 'warning',
        title: 'Import/Export Rules Validation',
        description: rulesDetails.length > 0 
          ? rulesDetails.join(' • ')
          : 'All import/export regulations verified and compliant',
        suggestion: !rulesPassed ? 'Review shipment value and weight constraints' : undefined,
        details: relevantRules
      });

      // 2. Banned/Blocked Products Detection
      let productBanned = false;
      let bannedDetails = '';
      
      const matchingRule = relevantRules.find(r => 
        shipment.hsCode.startsWith(r.hsCodeRange?.split('-')[0])
      );
      
      if (matchingRule && matchingRule.bannedProducts.length > 0) {
        const description = shipment.productDescription.toLowerCase();
        const isBanned = matchingRule.bannedProducts.some(banned => 
          description.includes(banned.toLowerCase().split(' ')[0])
        );
        
        if (isBanned) {
          productBanned = true;
          bannedDetails = 'Product matches banned items list';
        } else {
          bannedDetails = 'No banned or restricted products detected';
        }
      } else {
        bannedDetails = 'No banned product restrictions for this category';
      }
      
      validationResults.push({
        category: 'product',
        status: productBanned ? 'failed' : 'passed',
        title: 'Banned/Blocked Product Detection',
        description: bannedDetails,
        suggestion: productBanned ? 'This product cannot be shipped to the destination country' : undefined
      });

      // 3. HS/HTS Code Validation
      const hsCodeValid = /^\d{4}\.\d{2}\.\d{2}$/.test(shipment.hsCode);
      const hsCodeDetails = hsCodeValid
        ? `HS Code ${shipment.hsCode} is correctly formatted and matches product category`
        : 'HS Code format appears incorrect';
      
      validationResults.push({
        category: 'hscode',
        status: hsCodeValid ? 'passed' : 'failed',
        title: 'HS/HTS Code Validation',
        description: hsCodeDetails,
        suggestion: !hsCodeValid ? `Suggested format: XXXX.XX.XX` : `Verified: ${shipment.hsCode}`
      });

      // 4. Documentation Completeness
      const uploadedDocs = documents.filter(d => d.status === 'uploaded').map(d => d.name);
      const requiredDocs = documents.filter(d => d.required).map(d => d.name);
      const docsComplete = requiredDocs.every(doc => uploadedDocs.includes(doc));
      
      validationResults.push({
        category: 'documentation',
        status: docsComplete ? 'passed' : 'failed',
        title: 'Documentation Completeness',
        description: docsComplete 
          ? `All ${requiredDocs.length} required documents are uploaded and verified`
          : `Missing required documents`,
        suggestion: !docsComplete ? `Please upload all required documents` : undefined,
        details: { required: requiredDocs, uploaded: uploadedDocs }
      });

      // Calculate overall score
      const passedChecks = validationResults.filter(r => r.status === 'passed').length;
      const warningChecks = validationResults.filter(r => r.status === 'warning').length;
      const failedChecks = validationResults.filter(r => r.status === 'failed').length;
      
      const overallScore = Math.round(
        (passedChecks * 100 + warningChecks * 70) / validationResults.length
      );
      
      const overallApproval = failedChecks === 0 && overallScore >= 85;
      
      setAiResults(validationResults);
      setAiScore(overallScore);
      setAiApproved(overallApproval);
      setAiCompleted(true);
      setAiProcessing(false);
      
      // Update store
      updateAIApproval(
        shipment.id,
        overallApproval ? 'approved' : 'rejected',
        validationResults,
        overallScore
      );
    }, 4000);
  };

  const handleSendToBroker = () => {
    // Send to broker for manual review
    requestBrokerApproval(shipment.id);
    
    // Add notification for broker
    shipmentsStore.addNotification({
      id: `notif-${Date.now()}`,
      type: 'broker-approval-request',
      title: 'New Broker Approval Request',
      message: `${shipment.id}: ${shipment.productName} - Ready for review`,
      shipmentId: shipment.id,
      timestamp: new Date().toISOString(),
      read: false,
      recipientRole: 'broker'
    });
    
    // Navigate back to shipment details
    onNavigate('shipment-details', { ...shipment, aiApproval: 'approved' });
  };

  const allUploaded = documents.filter(d => d.required).every(d => d.status === 'uploaded');
  const uploadedCount = documents.filter(d => d.status === 'uploaded').length;

  return (
    <div>
      {/* Header */}
      <div className="mb-8">
        <button
          onClick={() => onNavigate('shipment-details', shipment)}
          className="mb-4 flex items-center gap-2 text-slate-600 hover:text-slate-900 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Shipment Details
        </button>
        
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-slate-900 mb-2">Upload Documents</h1>
            <p className="text-slate-600">Shipment #{shipment.id} - {shipment.productName}</p>
          </div>
          
          <div className="text-right">
            <p className="text-sm text-slate-500 mb-1">Upload Progress</p>
            <div className="flex items-center gap-2">
              <div className="w-32 h-2 bg-slate-200 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-blue-600 transition-all duration-500"
                  style={{ width: `${(uploadedCount / documents.filter(d => d.required).length) * 100}%` }}
                />
              </div>
              <span className="text-sm text-slate-700">
                {uploadedCount}/{documents.filter(d => d.required).length}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Info Alert */}
      <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
        <div className="flex gap-3">
          <AlertCircle className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm text-blue-900 mb-1">Document Upload Instructions</p>
            <ul className="text-sm text-blue-700 space-y-1">
              <li>• Click "Upload Document" to mark each document as uploaded (simulated)</li>
              <li>• All required documents must be uploaded before proceeding</li>
              <li>• After uploading, you can run AI check again or send back to broker</li>
            </ul>
          </div>
        </div>
      </div>

      {/* Documents List */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden mb-6">
        <div className="p-6 border-b border-slate-200 bg-slate-50">
          <h2 className="text-slate-900">Required Documents</h2>
          <p className="text-sm text-slate-600">Upload all required documents to proceed with compliance check</p>
        </div>

        <div className="divide-y divide-slate-200">
          {documents.map((doc, index) => (
            <div key={index} className="p-5 hover:bg-slate-50 transition-colors">
              <div className="flex items-center justify-between">
                <div className="flex items-start gap-4 flex-1">
                  <div className={`w-12 h-12 rounded-lg flex items-center justify-center flex-shrink-0 ${
                    doc.status === 'uploaded' ? 'bg-green-100' :
                    uploadingDoc === doc.name ? 'bg-blue-100' :
                    'bg-slate-100'
                  }`}>
                    {doc.status === 'uploaded' ? (
                      <CheckCircle className="w-6 h-6 text-green-600" />
                    ) : (
                      <FileText className={`w-6 h-6 ${
                        uploadingDoc === doc.name ? 'text-blue-600' : 'text-slate-400'
                      }`} />
                    )}
                  </div>
                  
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="text-slate-900">{doc.name}</h3>
                      {doc.required && (
                        <span className="px-2 py-0.5 bg-red-100 text-red-700 text-xs rounded-full">
                          Required
                        </span>
                      )}
                      {doc.status === 'uploaded' && (
                        <span className="px-2 py-0.5 bg-green-100 text-green-700 text-xs rounded-full flex items-center gap-1">
                          <CheckCircle className="w-3 h-3" />
                          Uploaded Successfully
                        </span>
                      )}
                      {uploadingDoc === doc.name && (
                        <span className="px-2 py-0.5 bg-blue-100 text-blue-700 text-xs rounded-full">
                          Uploading...
                        </span>
                      )}
                    </div>
                    
                    {doc.status === 'uploaded' && doc.uploadedAt && (
                      <p className="text-sm text-slate-500">
                        Uploaded on {new Date(doc.uploadedAt).toLocaleString()}
                      </p>
                    )}
                    
                    {doc.status === 'pending' && (
                      <p className="text-sm text-slate-500">
                        Click upload button to mark this document as uploaded
                      </p>
                    )}
                  </div>
                </div>

                <div className="ml-4">
                  {(doc.status === 'pending' || doc.status === 'uploaded') && (
                    <label className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer">
                      <Upload className="w-4 h-4" />
                      {uploadingDoc === doc.name ? 'Uploading...' : doc.status === 'uploaded' ? 'Re-upload' : 'Upload Document'}
                      <input
                        type="file"
                        className="hidden"
                        accept=".pdf,.doc,.docx,.xlsx,.csv,.jpg,.jpeg,.png,.gif"
                        disabled={uploadingDoc === doc.name}
                        onChange={(e) => handleUpload(doc.name, e.target.files?.[0])}
                      />
                    </label>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Action Buttons */}
      {aiProcessing && (
        <div className="bg-white rounded-xl border border-slate-200 p-8 text-center">
          <div className="w-20 h-20 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-6 relative">
            <Loader className="w-10 h-10 text-purple-600 animate-spin" />
          </div>
          <h2 className="text-slate-900 text-2xl mb-4">AI Validation in Progress...</h2>
          <p className="text-slate-600 mb-8">
            Performing comprehensive compliance analysis on your documents
          </p>
          <div className="max-w-md mx-auto space-y-3">
            <div className="flex items-center gap-3 text-left p-3 bg-slate-50 rounded-lg">
              <Loader className="w-5 h-5 text-blue-600 animate-spin" />
              <span className="text-slate-700">Validating import/export rules...</span>
            </div>
            <div className="flex items-center gap-3 text-left p-3 bg-slate-50 rounded-lg">
              <Loader className="w-5 h-5 text-blue-600 animate-spin" />
              <span className="text-slate-700">Detecting banned/blocked products...</span>
            </div>
            <div className="flex items-center gap-3 text-left p-3 bg-slate-50 rounded-lg">
              <Loader className="w-5 h-5 text-blue-600 animate-spin" />
              <span className="text-slate-700">Verifying HS/HTS code classification...</span>
            </div>
            <div className="flex items-center gap-3 text-left p-3 bg-slate-50 rounded-lg">
              <Loader className="w-5 h-5 text-blue-600 animate-spin" />
              <span className="text-slate-700">Validating documentation completeness...</span>
            </div>
          </div>
        </div>
      )}

      {aiCompleted && !aiProcessing && (
        <div className="space-y-6">
          {/* AI Results Summary */}
          <div className={`rounded-xl p-8 border-2 ${
            aiApproved 
              ? 'bg-gradient-to-br from-green-50 to-emerald-50 border-green-200' 
              : 'bg-gradient-to-br from-red-50 to-orange-50 border-red-200'
          }`}>
            <div className="flex items-center gap-4 mb-4">
              {aiApproved ? (
                <div className="w-16 h-16 bg-green-500 rounded-full flex items-center justify-center">
                  <CheckCircle className="w-8 h-8 text-white" />
                </div>
              ) : (
                <div className="w-16 h-16 bg-red-500 rounded-full flex items-center justify-center">
                  <XCircle className="w-8 h-8 text-white" />
                </div>
              )}
              <div>
                <h2 className={`text-3xl mb-1 ${aiApproved ? 'text-green-900' : 'text-red-900'}`}>
                  AI {aiApproved ? 'Pre-Clear Approved' : 'Validation Failed'}
                </h2>
                <p className={aiApproved ? 'text-green-700' : 'text-red-700'}>
                  Overall Compliance Score: {aiScore}%
                </p>
              </div>
            </div>

            <div className="h-3 bg-white/50 rounded-full overflow-hidden mb-6">
              <div 
                className={`h-full ${aiApproved ? 'bg-green-600' : 'bg-red-600'} rounded-full transition-all`}
                style={{ width: `${aiScore}%` }}
              />
            </div>

            {aiApproved && (
              <div className="bg-white/70 rounded-lg p-4">
                <p className="text-green-900 mb-4">
                  ✓ Your shipment has passed all AI compliance checks. You can now proceed to request broker approval.
                </p>
                <button
                  onClick={handleSendToBroker}
                  className="w-full px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors flex items-center justify-center gap-2"
                >
                  <Send className="w-5 h-5" />
                  Send to Broker for Approval
                </button>
              </div>
            )}

            {!aiApproved && (
              <div className="bg-white/70 rounded-lg p-4">
                <p className="text-red-900 mb-4">
                  ⚠️ Your shipment did not pass all AI compliance checks. Please review the issues and upload corrected documents.
                </p>
                <button
                  onClick={() => {
                    setAiCompleted(false);
                    setAiProcessing(false);
                  }}
                  className="w-full px-6 py-3 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors"
                >
                  Update Documents & Retry
                </button>
              </div>
            )}
          </div>

          {/* Detailed Results */}
          {aiResults && (
            <div className="bg-white rounded-xl p-6 border border-slate-200">
              <h3 className="text-slate-900 text-xl mb-6">Detailed Validation Results</h3>
              <div className="space-y-4">
                {aiResults.map((result, index) => (
                  <div key={index} className={`p-4 rounded-lg border-2 ${
                    result.status === 'passed' 
                      ? 'bg-green-50 border-green-200' 
                      : result.status === 'warning'
                      ? 'bg-amber-50 border-amber-200'
                      : 'bg-red-50 border-red-200'
                  }`}>
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-3">
                        {result.status === 'passed' && <CheckCircle className="w-5 h-5 text-green-600" />}
                        {result.status === 'warning' && <AlertTriangle className="w-5 h-5 text-amber-600" />}
                        {result.status === 'failed' && <XCircle className="w-5 h-5 text-red-600" />}
                        <h4 className="text-slate-900">{result.title}</h4>
                      </div>
                      <span className={`px-3 py-1 rounded-full text-sm ${
                        result.status === 'passed' 
                          ? 'bg-green-100 text-green-700' 
                          : result.status === 'warning'
                          ? 'bg-amber-100 text-amber-700'
                          : 'bg-red-100 text-red-700'
                      }`}>
                        {result.status.toUpperCase()}
                      </span>
                    </div>
                    <p className="text-slate-700 text-sm mb-2">{result.description}</p>
                    {result.suggestion && (
                      <div className={`mt-3 p-3 rounded-lg ${
                        result.status === 'failed' ? 'bg-red-100' : 'bg-amber-100'
                      }`}>
                        <p className={`text-sm ${
                          result.status === 'failed' ? 'text-red-800' : 'text-amber-800'
                        }`}>
                          💡 <strong>Suggestion:</strong> {result.suggestion}
                        </p>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {allUploaded && !aiProcessing && !aiCompleted && (
        <div className="bg-gradient-to-br from-purple-50 to-blue-50 border border-purple-200 rounded-xl p-6 text-center">
          <div className="w-16 h-16 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <Zap className="w-8 h-8 text-purple-600" />
          </div>
          <h3 className="text-slate-900 mb-2">Documents Ready for AI Validation</h3>
          <p className="text-slate-600 text-sm mb-4">
            All required documents are uploaded. AI validation will start automatically.
          </p>
        </div>
      )}

      {!allUploaded && !aiProcessing && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
          <div className="flex gap-3">
            <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm text-amber-900">
                Please upload all required documents to proceed with AI check or broker review.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}