import { useState, useEffect } from 'react';
import {
  ArrowLeft,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Package,
  MapPin,
  FileText,
  Zap,
  MessageCircle,
  Upload,
  Shield,
  TrendingUp,
  Eye,
  Loader,
  ZoomIn,
  ZoomOut
} from 'lucide-react';
import { useShipments } from '../../hooks/useShipments';
import { getShipmentById } from '../../api/shipments';
import { listShipmentDocuments, downloadShipmentDocument } from '../../api/documents';
import { getCurrencyByCountry, formatCurrency } from '../../utils/validation';
import { ShipmentChatPanel } from '../ShipmentChatPanel';
import { shipmentsStore } from '../../store/shipmentsStore';
import ShipmentDocumentsPanel from '../shipper/ShipmentDocumentsPanel';

const formatTimeWithAmPm = (timeString) => {
  if (!timeString) return 'N/A';
  const [hours, minutes] = timeString.split(':');
  const hour = parseInt(hours);
  const ampm = hour >= 12 ? 'PM' : 'AM';
  const displayHour = hour % 12 || 12;
  return `${displayHour}:${minutes} ${ampm}`;
};

export function BrokerReviewShipment({ shipment: initialShipment = {}, onNavigate }) {
  const { brokerApprove, brokerDeny, brokerRequestDocuments } = useShipments();
  const [currentShipment, setCurrentShipment] = useState(initialShipment || {});
  const [shipmentLoaded, setShipmentLoaded] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const [showApproveConfirm, setShowApproveConfirm] = useState(false);
  const [showDenyModal, setShowDenyModal] = useState(false);
  const [showDocRequestModal, setShowDocRequestModal] = useState(false);
  const [denyReason, setDenyReason] = useState('');
  const [brokerNotes, setBrokerNotes] = useState(''); // kept for approve handler, UI removed per request
  const [docRequestMessage, setDocRequestMessage] = useState('');
  const [requestedDocNames, setRequestedDocNames] = useState([]);
  const [viewingDocument, setViewingDocument] = useState(null);
  const [viewerUrl, setViewerUrl] = useState(null);
  const [loadingDocPreview, setLoadingDocPreview] = useState(false);
  const [zoomLevel, setZoomLevel] = useState(100);
  const [s3Docs, setS3Docs] = useState([]);
  const [showAllDocs, setShowAllDocs] = useState(false);

  // Auto-open chat panel if openChat parameter is present
  useEffect(() => {
    if (initialShipment?.openChat || currentShipment?.openChat) {
      setChatOpen(true);
    }
  }, [initialShipment?.openChat, currentShipment?.openChat]);

  // Use shipper's currency if provided, otherwise derive from origin country (fallback to US)
  const currency = currentShipment?.currency 
    ? { code: currentShipment.currency, symbol: getCurrencyByCountry(currentShipment.originCountry || 'US').symbol }
    : getCurrencyByCountry(currentShipment?.originCountry || 'US');

  // Subscribe to store updates and merge status-like fields only to avoid losing full details
  useEffect(() => {
    const shipmentId = initialShipment?.id || currentShipment?.id;
    if (!shipmentId) return undefined;

    const unsubscribe = shipmentsStore.subscribe(() => {
      const updated = shipmentsStore.getShipmentById(shipmentId);
      if (updated) {
        setCurrentShipment((prev) => {
          if (!prev) return updated; // fallback
          return {
            ...prev,
            status: updated.status ?? prev.status,
            aiApproval: updated.aiApproval ?? prev.aiApproval,
            brokerApproval: updated.brokerApproval ?? prev.brokerApproval,
            token: updated.token ?? prev.token,
            preclearToken: updated.token ?? prev.preclearToken,
            aiScore: updated.aiScore ?? prev.aiScore,
            assignedBrokerId: updated.assignedBrokerId ?? prev.assignedBrokerId,
          };
        });
      }
    });

    return () => unsubscribe();
  }, [initialShipment?.id]);

  // Fetch full shipment details from backend for source-of-truth
  useEffect(() => {
    const shipmentId = initialShipment?.id;
    if (!shipmentId) {
      setShipmentLoaded(false);
      return;
    }
    console.log('[BrokerReviewShipment] Fetching full details for shipmentId:', shipmentId);
    (async () => {
      try {
        const full = await getShipmentById(shipmentId);
        if (full && full.id) {
          console.log('[BrokerReviewShipment] Loaded shipment with ID:', full.id, 'type:', typeof full.id);
          setCurrentShipment(full);
          setShipmentLoaded(true);
        } else {
          setShipmentLoaded(false);
        }
      } catch (e) {
        // non-fatal, keep initial shipment
        console.warn('Failed to load full shipment detail:', e.message);
        setShipmentLoaded(false);
      }
    })();
  }, [initialShipment?.id]);

  // Load S3 documents for preview mapping
  useEffect(() => {
    if (!currentShipment?.id) {
      setS3Docs([]);
      return;
    }

    (async () => {
      try {
        const docs = await listShipmentDocuments(currentShipment.id);
        setS3Docs(Array.isArray(docs) ? docs : []);
      } catch (e) {
        console.warn('[BrokerReviewShipment] Failed to list shipment documents:', e);
        setS3Docs([]);
      }
    })();
  }, [currentShipment?.id]);

  // Resolve and preview selected document with zoom controls
  useEffect(() => {
    let cancelled = false;
    let objectUrl = null;

    const resolveAndLoad = async () => {
      if (!viewingDocument || !currentShipment?.id) return;
      setLoadingDocPreview(true);
      setViewerUrl(null);

      try {
        const match = (() => {
          if (!Array.isArray(s3Docs) || s3Docs.length === 0) return null;
          if (viewingDocument.id) return s3Docs.find((d) => d.id === viewingDocument.id) || null;
          if (viewingDocument.fileName) return s3Docs.find((d) => d.fileName === viewingDocument.fileName) || null;
          if (viewingDocument.name) return s3Docs.find((d) => d.fileName === viewingDocument.name || d.documentType === viewingDocument.name) || null;
          if (viewingDocument.documentType) return s3Docs.find((d) => d.documentType === viewingDocument.documentType) || null;
          return null;
        })();

        if (!match?.id) {
          setLoadingDocPreview(false);
          return;
        }

        const { blob } = await downloadShipmentDocument(match.id);
        objectUrl = URL.createObjectURL(blob);
        if (!cancelled) {
          setViewerUrl(objectUrl);
        }
      } catch (e) {
        if (!cancelled) {
          console.error('[BrokerReviewShipment] Failed to load document preview:', e);
          setViewerUrl(null);
        }
      } finally {
        if (!cancelled) {
          setLoadingDocPreview(false);
        }
      }
    };

    resolveAndLoad();

    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
      setViewerUrl(null);
      setZoomLevel(100);
    };
  }, [viewingDocument, s3Docs, currentShipment?.id]);

  // Approve handler
  const handleApprove = async () => {
    const id = currentShipment?.id;
    if (!id) return;
    try {
      await brokerApprove(id, brokerNotes || 'Approved after document review.');
    } finally {
      setShowApproveConfirm(false);
      onNavigate?.('broker-dashboard');
    }
  };

  // Deny handler
  const handleDeny = async () => {
    const id = currentShipment?.id;
    if (!id || !denyReason.trim()) return;
    try {
      await brokerDeny(id, denyReason);
    } finally {
      setShowDenyModal(false);
      onNavigate?.('broker-dashboard');
    }
  };

  // Request additional documents handler
  const handleRequestDocuments = async () => {
    const id = currentShipment?.id;
    if (!id || requestedDocNames.length === 0) return;
    const docs = requestedDocNames.map((name) => ({ name, type: name.toLowerCase().includes('invoice') ? 'invoice' : 'document' }));
    try {
      console.log('[BrokerReviewShipment] Sending request for shipmentId:', id, 'docs:', docs, 'message:', docRequestMessage);
      await brokerRequestDocuments(id, docs, docRequestMessage || '');
      console.log('[BrokerReviewShipment] Request succeeded');
      setShowDocRequestModal(false);
      setRequestedDocNames([]);
      setDocRequestMessage('');
      alert('Document request sent to shipper.');
    } catch (e) {
      console.error('[BrokerReviewShipment] Request failed:', e);
      alert(`Failed to send document request: ${e?.message || 'Unknown error'}`);
    }
  };

  // Safely render fallback if no shipment
  if (!currentShipment || Object.keys(currentShipment).length === 0) {
    return (
      <div style={{ background: '#FBF9F6', minHeight: '100vh', padding: 24 }}>
        <div className="max-w-5xl mx-auto">
          <p className="text-slate-700">No shipment selected.</p>
          <button
            onClick={() => onNavigate?.('broker-dashboard')}
            className="mt-4 px-4 py-2 rounded-lg"
            style={{ background: '#7A5B52', color: '#ffffff', border: '2px solid #5a4038' }}
          >
            Back to Dashboard
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ background: '#FBF9F6', minHeight: '100vh', padding: 24 }}>
      {/* Header: Back + Title */}
      <div className="mb-6">
        <button
          onClick={() => onNavigate?.('broker-dashboard')}
          className="mb-2 flex items-center gap-2 text-slate-600 hover:text-slate-900 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Dashboard
        </button>
        <h1 className="text-slate-900 mb-1">Review Shipment #{currentShipment.id}</h1>
        <p className="text-slate-600">Detailed compliance review and approval</p>
      </div>

    {/* Quick Actions moved into right panel (see below) */}


      {/* Main content grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          {currentShipment?.id && (
            <ShipmentDocumentsPanel
              shipmentId={currentShipment.id}
              allowUpload={false}
              onPreview={(doc) => setViewingDocument(doc)}
            />
          )}
          
          {/* Comprehensive Shipment Details */}
          <div className="bg-white rounded-xl p-6 border border-slate-200">
            <h2 className="text-slate-900 mb-6">Shipment Details</h2>
            
            {/* Basics Section */}
            <div className="mb-8 pb-6 border-b border-slate-200">
              <h3 className="text-slate-900 font-semibold mb-4">Shipment Basics</h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-slate-500 text-sm mb-1">Title</p>
                  <p className="text-slate-900">{currentShipment.title || 'N/A'}</p>
                </div>
                <div>
                  <p className="text-slate-500 text-sm mb-1">Mode</p>
                  <p className="text-slate-900">{currentShipment.mode || 'N/A'}</p>
                </div>
                <div>
                  <p className="text-slate-500 text-sm mb-1">Shipment Type</p>
                  <p className="text-slate-900">{currentShipment.shipmentType || 'N/A'}</p>
                </div>
                <div>
                  <p className="text-slate-500 text-sm mb-1">Service Level</p>
                  <p className="text-slate-900">{currentShipment.serviceLevel || 'N/A'}</p>
                </div>
              
                <div>
                  <p className="text-slate-500 text-sm mb-1">Currency</p>
                  <p className="text-slate-900">{currentShipment.currency || currency.code}</p>
                </div>
                
               

                <div>
                  <p className="text-slate-500 text-sm mb-1">Pickup</p>
                  <p className="text-slate-900">{currentShipment.pickupType || 'N/A'}</p>
                  {currentShipment.pickupType === 'Drop-off' && currentShipment.estimatedDropoffDate && (
                    <p className="text-xs text-slate-500 mt-1">Estimated Drop-off: {new Date(currentShipment.estimatedDropoffDate).toLocaleDateString()}</p>
                  )}
                  {currentShipment.pickupType === 'Scheduled Pickup' && (
                    <div className="text-xs text-slate-500 mt-1">
                      {currentShipment.pickupLocation && <div>Location: {currentShipment.pickupLocation}</div>}
                      {currentShipment.pickupDate && <div>Pickup Date: {new Date(currentShipment.pickupDate).toLocaleDateString()}</div>}
                      {(currentShipment.pickupTimeEarliest || currentShipment.pickupTimeLatest) && (
                        <div>Time: {formatTimeWithAmPm(currentShipment.pickupTimeEarliest)} — {formatTimeWithAmPm(currentShipment.pickupTimeLatest)}</div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Shipper Section */}
            <div className="mb-8 pb-6 border-b border-slate-200">
              <h3 className="text-slate-900 font-semibold mb-4">Shipper Information</h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-slate-500 text-sm mb-1">Company</p>
                  <p className="text-slate-900">{currentShipment.shipper?.company || 'N/A'}</p>
                </div>
                <div>
                  <p className="text-slate-500 text-sm mb-1">Contact Name</p>
                  <p className="text-slate-900">{currentShipment.shipper?.contactName || 'N/A'}</p>
                </div>
                <div>
                  <p className="text-slate-500 text-sm mb-1">Email</p>
                  <p className="text-slate-900">{currentShipment.shipper?.email || 'N/A'}</p>
                </div>
                <div>
                  <p className="text-slate-500 text-sm mb-1">Phone</p>
                  <p className="text-slate-900">{currentShipment.shipper?.phone || 'N/A'}</p>
                </div>
                <div className="col-span-2">
                  <p className="text-slate-500 text-sm mb-1">Address</p>
                  <p className="text-slate-900">
                    {currentShipment.shipper?.address1}{currentShipment.shipper?.address2 ? ` ${currentShipment.shipper.address2}` : ''}, {currentShipment.shipper?.city}, {currentShipment.shipper?.state} {currentShipment.shipper?.postalCode}
                  </p>
                </div>
                <div>
                  <p className="text-slate-500 text-sm mb-1">Country</p>
                  <p className="text-slate-900">{currentShipment.shipper?.country || 'N/A'}</p>
                </div>
                
              </div>
            </div>

            {/* Consignee Section */}
            <div className="mb-8 pb-6 border-b border-slate-200">
              <h3 className="text-slate-900 font-semibold mb-4">Consignee Information</h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-slate-500 text-sm mb-1">Company</p>
                  <p className="text-slate-900">{currentShipment.consignee?.company || 'N/A'}</p>
                </div>
                <div>
                  <p className="text-slate-500 text-sm mb-1">Contact Name</p>
                  <p className="text-slate-900">{currentShipment.consignee?.contactName || 'N/A'}</p>
                </div>
                <div>
                  <p className="text-slate-500 text-sm mb-1">Email</p>
                  <p className="text-slate-900">{currentShipment.consignee?.email || 'N/A'}</p>
                </div>
                <div>
                  <p className="text-slate-500 text-sm mb-1">Phone</p>
                  <p className="text-slate-900">{currentShipment.consignee?.phone || 'N/A'}</p>
                </div>
                <div className="col-span-2">
                  <p className="text-slate-500 text-sm mb-1">Address</p>
                  <p className="text-slate-900">
                    {currentShipment.consignee?.address1}{currentShipment.consignee?.address2 ? ` ${currentShipment.consignee.address2}` : ''}, {currentShipment.consignee?.city}, {currentShipment.consignee?.state} {currentShipment.consignee?.postalCode}
                  </p>
                </div>
                <div>
                  <p className="text-slate-500 text-sm mb-1">Country</p>
                  <p className="text-slate-900">{currentShipment.consignee?.country || 'N/A'}</p>
                </div>
                
              </div>
            </div>

            {/* Packages & Products Section */}
            <div className="mb-8 pb-6 border-b border-slate-200">
              <h3 className="text-slate-900 font-semibold mb-4">Packages & Products</h3>
              {currentShipment.packages && currentShipment.packages.length > 0 ? (
                <div className="space-y-6">
                  {currentShipment.packages.map((pkg, pkgIdx) => (
                    <div key={pkgIdx} className="border border-slate-200 rounded-lg p-4 bg-slate-50">
                      <h4 className="text-slate-900 font-medium mb-4">Package {pkgIdx + 1}</h4>
                      <div className="grid grid-cols-2 gap-4 mb-4 pb-4 border-b border-slate-200">
                        <div>
                          <p className="text-slate-500 text-sm mb-1">Type</p>
                          <p className="text-slate-900">{pkg.type || 'N/A'}</p>
                        </div>
                        <div>
                          <p className="text-slate-500 text-sm mb-1">Dimensions</p>
                          <p className="text-slate-900">{pkg.length} x {pkg.width} x {pkg.height} {pkg.dimUnit || 'cm'}</p>
                        </div>
                        <div>
                          <p className="text-slate-500 text-sm mb-1">Weight</p>
                          <p className="text-slate-900">{pkg.weight} {pkg.weightUnit || 'kg'}</p>
                        </div>
                        <div>
                          <p className="text-slate-500 text-sm mb-1">Stackable</p>
                          <p className="text-slate-900">{pkg.stackable ? 'Yes' : 'No'}</p>
                        </div>
                      </div>
                      
                      {/* Products in Package */}
                      {pkg.products && pkg.products.length > 0 && (
                        <div>
                          <h5 className="text-slate-900 font-medium text-sm mb-3">Products</h5>
                          <div className="space-y-3">
                            {pkg.products.map((product, prodIdx) => (
                              <div key={prodIdx} className="bg-white p-3 rounded border border-slate-200">
                                <div className="grid grid-cols-2 gap-3">
                                  <div>
                                    <p className="text-slate-500 text-xs mb-1">Name</p>
                                    <p className="text-slate-900 text-sm">{product.name || 'N/A'}</p>
                                  </div>
                                  <div>
                                    <p className="text-slate-500 text-xs mb-1">HS Code</p>
                                    <p className="text-slate-900 text-sm">{product.hsCode || 'N/A'}</p>
                                  </div>
                                  <div>
                                    <p className="text-slate-500 text-xs mb-1">Category</p>
                                    <p className="text-slate-900 text-sm">{product.category || 'N/A'}</p>
                                  </div>
                                  <div>
                                    <p className="text-slate-500 text-xs mb-1">UOM</p>
                                    <p className="text-slate-900 text-sm">{product.uom || 'N/A'}</p>
                                  </div>
                                  <div>
                                    <p className="text-slate-500 text-xs mb-1">Quantity</p>
                                    <p className="text-slate-900 text-sm">{product.qty || product.quantity || 'N/A'}</p>
                                  </div>
                                  <div>
                                    <p className="text-slate-500 text-xs mb-1">Unit Price</p>
                                    <p className="text-slate-900 text-sm">{formatCurrency(parseFloat(product.unitPrice || product.unit_price || 0), currency.code)}</p>
                                  </div>
                                  <div className="col-span-2">
                                    <p className="text-slate-500 text-xs mb-1">Total Value</p>
                                    <p className="text-slate-900 text-sm">{formatCurrency(product.totalValue || 0, currency.code)}</p>
                                  </div>
                                  <div className="col-span-2">
                                    <p className="text-slate-500 text-xs mb-1">Description</p>
                                    <p className="text-slate-900 text-sm">{product.description || 'N/A'}</p>
                                  </div>
                                  <div>
                                    <p className="text-slate-500 text-xs mb-1">Origin Country</p>
                                    <p className="text-slate-900 text-sm">{product.originCountry || 'N/A'}</p>
                                  </div>
                                  <div>
                                    <p className="text-slate-500 text-xs mb-1">Reason for Export</p>
                                    <p className="text-slate-900 text-sm">{product.reasonForExport || 'N/A'}</p>
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-slate-600">No packages available</p>
              )}
            </div>
          </div>

          {/* AI Compliance Flags */}
          {currentShipment.aiResults && currentShipment.aiResults.length > 0 && (
            <div className="bg-white rounded-xl p-6 border border-slate-200">
              <h2 className="text-slate-900 mb-4">AI Compliance Flags</h2>
              <div className="space-y-3">
                {currentShipment.aiResults.map((result, i) => (
                  <div key={i} className={`p-4 rounded-lg border ${result.status === 'passed' ? 'bg-green-50 border-green-200' : result.status === 'warning' ? 'bg-amber-50 border-amber-200' : 'bg-red-50 border-red-200'}`}>
                    <div className="flex items-start gap-3">
                      {result.status === 'passed' && <CheckCircle className="w-5 h-5 text-green-600" />}
                      {result.status === 'warning' && <AlertTriangle className="w-5 h-5 text-amber-600" />}
                      {result.status === 'failed' && <XCircle className="w-5 h-5 text-red-600" />}
                      <div className="flex-1">
                        <p className={`text-sm mb-1 ${result.status === 'passed' ? 'text-green-900' : result.status === 'warning' ? 'text-amber-900' : 'text-red-900'}`}>{result.title}</p>
                        <p className="text-xs text-slate-600">{result.description}</p>
                        {result.suggestion && <p className="text-xs text-slate-500 mt-1">💡 {result.suggestion}</p>}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}



          {/* NOTE: "Notes to Shipper" section removed as requested */}
        </div>

        {/* Right column: Shipment Summary */}
        <div className="space-y-4">
          <div className="bg-white rounded-xl p-6 border border-slate-200">
            <h3 className="text-slate-900 mb-4">Shipment Summary</h3>
            <div className="space-y-3 text-sm">
              <div className="flex justify-between"><span className="text-slate-600">Shipment ID:</span><span className="text-slate-900">{currentShipment.id}</span></div>
              <div className="flex justify-between"><span className="text-slate-600">Title:</span><span className="text-slate-900">{currentShipment.title || 'N/A'}</span></div>
              <div className="flex justify-between"><span className="text-slate-600">Mode:</span><span className="text-slate-900">{currentShipment.mode || 'N/A'}</span></div>
              <div className="flex justify-between"><span className="text-slate-600">Weight:</span><span className="text-slate-900">{currentShipment.weight ? `${currentShipment.weight} ${currentShipment.weightUnit || 'kg'}` : 'N/A'}</span></div>
              <div className="flex justify-between"><span className="text-slate-600">Status:</span><span className="text-slate-900">{currentShipment.status}</span></div>
              <div className="flex justify-between"><span className="text-slate-600">AI Approval:</span><span className={currentShipment.aiApproval === 'approved' ? 'text-green-600' : currentShipment.aiApproval === 'rejected' ? 'text-red-600' : 'text-amber-600'}>{currentShipment.aiApproval || 'pending'}</span></div>
              <div className="flex justify-between"><span className="text-slate-600">Broker Approval:</span><span className={currentShipment.brokerApproval === 'approved' ? 'text-green-600' : currentShipment.brokerApproval === 'rejected' ? 'text-red-600' : 'text-amber-600'}>{currentShipment.brokerApproval || 'pending'}</span></div>
              <div className="flex justify-between"><span className="text-slate-600">AI Score:</span><span className={currentShipment.aiComplianceScore >= 80 ? 'text-green-600' : currentShipment.aiComplianceScore >= 60 ? 'text-amber-600' : 'text-red-600'}>{currentShipment.aiComplianceScore ? `${currentShipment.aiComplianceScore}%` : 'N/A'}</span></div>
              {currentShipment.preclearToken && (
                <div className="flex justify-between"><span className="text-slate-600">Token:</span><span className="text-slate-900 font-mono text-xs">{currentShipment.preclearToken}</span></div>
              )}
              <div className="flex justify-between"><span className="text-slate-600">Created:</span><span className="text-slate-900">{currentShipment.createdAt ? new Date(currentShipment.createdAt).toLocaleDateString() : ''}</span></div>
              {currentShipment.aiReviewedAt && (
                <div className="flex justify-between"><span className="text-slate-600">AI Reviewed:</span><span className="text-slate-900">{new Date(currentShipment.aiReviewedAt).toLocaleDateString()}</span></div>
              )}
              {currentShipment.brokerReviewedAt && (
                <div className="flex justify-between"><span className="text-slate-600">Broker Reviewed:</span><span className="text-slate-900">{new Date(currentShipment.brokerReviewedAt).toLocaleDateString()}</span></div>
              )}
            </div>
          </div>
          {/* Quick Actions (moved to right panel) */}
          <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-sm">
            <h3 className="text-slate-900 mb-3">Quick Actions</h3>
            <div className="flex flex-col gap-3">
              <button
                onClick={() => setShowApproveConfirm(true)}
                className="w-full px-3 py-2 rounded-lg text-white font-medium flex items-center justify-center gap-2"
                style={{ background: '#16A34A', border: '2px solid #12733A' }}
              >
                <CheckCircle className="w-4 h-4" />
                <span className="text-sm">Approve</span>
              </button>

              <button
                onClick={() => setShowDocRequestModal(true)}
                className="w-full px-3 py-2 rounded-lg text-white font-medium flex items-center justify-center gap-2"
                style={{ background: '#2563EB', border: '2px solid #1E40AF' }}
              >
                <Upload className="w-4 h-4" />
                <span className="text-sm">Request Documents</span>
              </button>

              <button
                onClick={() => setShowDenyModal(true)}
                className="w-full px-3 py-2 rounded-lg text-white font-medium flex items-center justify-center gap-2"
                style={{ background: '#EF4444', border: '2px solid #B91C1C' }}
              >
                <XCircle className="w-4 h-4" />
                <span className="text-sm">Deny</span>
              </button>

              <button
                onClick={() => setChatOpen(true)}
                className="w-full px-3 py-2 rounded-lg text-[#2F1B17] font-medium border-2 border-[#2F1B17] bg-[#FBF9F6] flex items-center justify-center gap-2"
              >
                <MessageCircle className="w-4 h-4" />
                <span className="text-sm">Message</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Approve Confirmation Modal */}
      {showApproveConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-md w-full p-6">
            <div className="flex items-start gap-4 mb-6">
              <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center"><CheckCircle className="w-6 h-6 text-green-600" /></div>
              <div>
                <h3 className="text-slate-900 mb-2">Approve Shipment?</h3>
                <p className="text-slate-600 text-sm">This will generate a token for shipment #{currentShipment.id} and notify the shipper.</p>
              </div>
            </div>
            <div className="flex gap-3">
              <button onClick={() => setShowApproveConfirm(false)} className="flex-1 px-4 py-3 border border-slate-300 text-slate-700 rounded-lg">Cancel</button>
              <button onClick={handleApprove} className="flex-1 px-4 py-3 rounded-lg" style={{ background: '#16A34A', color: '#ffffff', border: '2px solid #12733A' }}>Confirm Approval</button>
            </div>
          </div>
        </div>
      )}

      {/* Deny Modal */}
      {showDenyModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-md w-full p-6">
            <h3 className="text-slate-900 mb-4">Deny Shipment</h3>
            <p className="text-slate-600 text-sm mb-4">Please provide a reason for denying this shipment:</p>
            <textarea value={denyReason} onChange={(e) => setDenyReason(e.target.value)} className="w-full px-4 py-3 border border-slate-300 rounded-lg mb-4" rows={4} />
            <div className="flex gap-3">
              <button onClick={() => setShowDenyModal(false)} className="flex-1 px-4 py-3 border border-slate-300 text-slate-700 rounded-lg">Cancel</button>
              <button onClick={handleDeny} disabled={!denyReason.trim()} className="flex-1 px-4 py-3 rounded-lg" style={{ background: '#EF4444', color: '#ffffff', border: '2px solid #B91C1C' }}>Confirm Denial</button>
            </div>
          </div>
        </div>
      )}

      {/* Request Documents Modal */}
      {showDocRequestModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" aria-hidden="false">
          <div className="bg-white rounded-xl max-w-2xl w-full p-6" role="dialog" aria-modal="true" aria-labelledby="requestDocumentsTitle">
            <h3 id="requestDocumentsTitle" className="text-slate-900 mb-4">Request Additional Documents</h3>
            <div className="mb-4">
              <label htmlFor="requestedDocNames" className="block text-slate-700 mb-2">Document Names (one per line)</label>
              <textarea id="requestedDocNames" aria-label="Requested document names" value={requestedDocNames.join('\n')} onChange={(e) => setRequestedDocNames(e.target.value.split('\n').filter(Boolean))} className="w-full p-3 border border-slate-300 rounded-lg h-32" placeholder="Safety Certificate\nTechnical Specifications\nISO Certification" />
            </div>
            <div className="mb-6">
              <label htmlFor="docRequestMessage" className="block text-slate-700 mb-2">Message to Shipper</label>
              <textarea id="docRequestMessage" aria-label="Message to shipper" value={docRequestMessage} onChange={(e) => setDocRequestMessage(e.target.value)} className="w-full p-3 border border-slate-300 rounded-lg h-24" placeholder="Please provide the following additional documents for customs clearance..." />
            </div>
            <div className="flex gap-3 justify-end">
              <button aria-label="Cancel document request" onClick={() => setShowDocRequestModal(false)} className="px-4 py-2 border border-slate-300 text-slate-700 rounded-lg">Cancel</button>
              <button aria-label="Send document request" onClick={handleRequestDocuments} disabled={requestedDocNames.length === 0} className="px-4 py-2 rounded-lg" style={{ background: '#2563EB', color: '#ffffff', border: '2px solid #1E40AF' }}>Send Request</button>
            </div>
          </div>
        </div>
      )}

      {/* Chat Panel */}
      <ShipmentChatPanel shipmentId={currentShipment.id} isOpen={chatOpen} onClose={() => setChatOpen(false)} userRole="broker" userName="Customs Broker" />

      {/* Document Viewer Modal */}
      {viewingDocument && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-4xl w-full p-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-slate-900 text-lg font-semibold">{viewingDocument.name || viewingDocument.fileName || 'Document Preview'}</h3>
                {viewingDocument.documentType && <p className="text-slate-500 text-sm">{viewingDocument.documentType}</p>}
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setZoomLevel((prev) => Math.min(prev + 25, 200))}
                  disabled={zoomLevel >= 200}
                  className="p-2 rounded-lg bg-slate-100 hover:bg-slate-200 transition-colors disabled:opacity-50"
                  title="Zoom In"
                >
                  <ZoomIn className="w-4 h-4 text-slate-700" />
                </button>
                <span className="text-xs text-slate-600 min-w-[3rem] text-center">{zoomLevel}%</span>
                <button
                  onClick={() => setZoomLevel((prev) => Math.max(prev - 25, 50))}
                  disabled={zoomLevel <= 50}
                  className="p-2 rounded-lg bg-slate-100 hover:bg-slate-200 transition-colors disabled:opacity-50"
                  title="Zoom Out"
                >
                  <ZoomOut className="w-4 h-4 text-slate-700" />
                </button>
                <button
                  onClick={() => {
                    setViewingDocument(null);
                    setZoomLevel(100);
                  }}
                  className="text-slate-500 hover:text-slate-700 text-2xl ml-2"
                  title="Close preview"
                >
                  ✕
                </button>
              </div>
            </div>

            <div className="bg-slate-50 rounded-lg overflow-auto" style={{ height: '75vh' }}>
              {loadingDocPreview && (
                <div className="flex items-center justify-center h-full">
                  <div className="text-center text-slate-600">
                    <Loader className="w-6 h-6 animate-spin mx-auto mb-2" />
                    <p>Loading preview...</p>
                  </div>
                </div>
              )}

              {!loadingDocPreview && !viewerUrl && (
                <div className="flex items-center justify-center h-full">
                  <p className="text-slate-600 text-sm">Preview not available. Please download the document.</p>
                </div>
              )}

              {!loadingDocPreview && viewerUrl && (
                <div className="flex items-start justify-center p-4">
                  <div
                    style={{
                      transform: `scale(${zoomLevel / 100})`,
                      transformOrigin: 'top center',
                      transition: 'transform 0.2s'
                    }}
                  >
                    <iframe
                      src={viewerUrl}
                      className="rounded border border-slate-200 bg-white"
                      style={{ width: '700px', height: '900px' }}
                      title="Document Preview"
                    />
                  </div>
                </div>
              )}
            </div>

            <div className="mt-4 flex justify-end gap-2">
              <button
                onClick={() => {
                  if (viewerUrl) window.open(viewerUrl, '_blank');
                }}
                className="px-4 py-2 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200"
              >
                Open in new tab
              </button>
              <button
                onClick={() => {
                  setViewingDocument(null);
                  setZoomLevel(100);
                }}
                className="px-4 py-2 bg-slate-600 text-white rounded-lg hover:bg-slate-700"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* All Documents Modal */}
      {showAllDocs && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-2xl w-full p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-slate-900">All Uploaded Documents</h3>
              <button onClick={() => setShowAllDocs(false)} className="text-slate-500">Close</button>
            </div>
            <div className="space-y-3">
              {(currentShipment.documents || []).filter(d => d.uploaded).length > 0 ? (
                (currentShipment.documents || []).filter(d => d.uploaded).map((doc, i) => (
                  <div key={i} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                    <div>
                      <p className="text-sm text-slate-900">{doc.name}</p>
                      {doc.uploadedAt && <p className="text-xs text-slate-500">Uploaded {new Date(doc.uploadedAt).toLocaleDateString()}</p>}
                    </div>
                    <div className="flex items-center gap-2">
                      <button onClick={() => { setViewingDocument({ ...doc, shipmentId: currentShipment.id }); setShowAllDocs(false); }} className="px-3 py-1 rounded-lg text-sm" style={{ background: '#2563EB', color: '#ffffff', border: '2px solid #1E40AF' }}>View</button>
                      <a href="#" onClick={(e) => { e.preventDefault(); alert(`Downloading ${doc.name} for shipment ${currentShipment.id}`); }} className="px-3 py-1 rounded-lg text-sm" style={{ background: '#F3F4F6', border: '1px solid #E5E7EB' }}>Download</a>
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-sm text-slate-500">No uploaded documents available</p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default BrokerReviewShipment;
