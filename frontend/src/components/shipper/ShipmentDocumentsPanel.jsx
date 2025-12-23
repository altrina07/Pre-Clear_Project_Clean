import { useEffect, useMemo, useState } from 'react';
import { AlertCircle, Download, FileText, RefreshCw, Upload } from 'lucide-react';
import {
  downloadShipmentDocument,
  listShipmentDocuments,
  saveBlobToFile,
  uploadShipmentDocument,
} from '../../api/documents';

export function ShipmentDocumentsPanel({ shipmentId, allowUpload = true, onPreview = null }) {
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [downloadingId, setDownloadingId] = useState(null);
  const [docType, setDocType] = useState('Other');
  const [error, setError] = useState(null);

  const sortedDocuments = useMemo(
    () =>
      [...documents].sort(
        (a, b) => new Date(b.uploadedAt || b.uploaded_at || 0) - new Date(a.uploadedAt || a.uploaded_at || 0)
      ),
    [documents]
  );

  useEffect(() => {
    if (!shipmentId) {
      console.log('[ShipmentDocumentsPanel] No shipmentId provided');
      return;
    }
    console.log('[ShipmentDocumentsPanel] Refreshing documents for shipmentId:', shipmentId);
    refresh();
  }, [shipmentId]);

  const refresh = async () => {
    if (!shipmentId) return;
    setLoading(true);
    setError(null);
    try {
      console.log('[ShipmentDocumentsPanel] Fetching documents for shipmentId:', shipmentId);
      const data = await listShipmentDocuments(shipmentId);
      console.log('[ShipmentDocumentsPanel] Received documents:', data);
      setDocuments(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('[ShipmentDocumentsPanel] Error loading documents:', err);
      setError(err?.message || 'Failed to load documents');
      setDocuments([]);
    } finally {
      setLoading(false);
    }
  };

  const handleUpload = async (event) => {
    const file = event?.target?.files?.[0];
    if (!file || !shipmentId) return;

    setUploading(true);
    setError(null);
    try {
      await uploadShipmentDocument(shipmentId, file, docType || 'Other');
      await refresh();
    } catch (err) {
      setError(err?.message || 'Upload failed');
    } finally {
      setUploading(false);
      if (event?.target) event.target.value = '';
    }
  };

  const handleDownload = async (doc) => {
    if (!doc?.id) return;
    setDownloadingId(doc.id);
    setError(null);
    try {
      const { blob, fileName } = await downloadShipmentDocument(doc.id);
      saveBlobToFile(blob, fileName || doc.fileName || `document-${doc.id}`);
    } catch (err) {
      setError(err?.message || 'Download failed');
    } finally {
      setDownloadingId(null);
    }
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <p className="text-slate-900 font-semibold">Shipment Documents</p>
          <p className="text-slate-600 text-sm">Stored in S3 and fetched from the API</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={refresh}
            disabled={loading}
            aria-label="Refresh documents"
            className="px-3 py-2 rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-50 disabled:opacity-60 flex items-center gap-2"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
          {allowUpload && (
            <label className="px-3 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 cursor-pointer flex items-center gap-2" aria-label="Upload document">
              <Upload className="w-4 h-4" />
              {uploading ? 'Uploading…' : 'Upload'}
              <input
                type="file"
                onChange={handleUpload}
                className="hidden"
                accept=".pdf,.jpg,.jpeg,.png,.doc,.docx,.xls,.xlsx,.csv,.txt"
                disabled={uploading}
              />
            </label>
          )}
        </div>
      </div>

      {allowUpload && (
        <div className="mb-4 grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="sm:col-span-1">
            <label className="text-xs text-slate-600 block mb-1">Document Type</label>
            <input
              value={docType}
              onChange={(e) => setDocType(e.target.value)}
              placeholder="Commercial Invoice, Packing List, etc."
              className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div className="sm:col-span-2 text-sm text-slate-500 flex items-center">
            Uploads are saved under shippers/shipperId/shipments/shipmentId/{docType || 'type'}/ in S3.
          </div>
        </div>
      )}

      {error && (
        <div className="mb-4 p-3 border border-red-200 bg-red-50 rounded flex items-center gap-2 text-red-700">
          <AlertCircle className="w-4 h-4" />
          <span>{error}</span>
        </div>
      )}

      <div className="rounded-lg border border-slate-100 divide-y divide-slate-100">
          <div className="px-4 py-3 flex items-center justify-between bg-slate-50">
          <span className="text-slate-700 text-sm">Documents ({sortedDocuments.length})</span>
          {loading && <span className="text-xs text-slate-500">Loading…</span>}
        </div>

        {sortedDocuments.length === 0 && !loading && (
          <div className="p-6 text-center text-slate-500">No documents uploaded yet.</div>
        )}

        {sortedDocuments.map((doc) => (
          <div
            key={doc.id}
            className="px-4 py-3 flex items-center justify-between hover:bg-slate-50 cursor-pointer"
            onClick={() => onPreview?.(doc)}
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
                <FileText className="w-5 h-5" />
              </div>
              <div>
                <p className="text-slate-900 text-sm font-semibold break-all">{doc.fileName}</p>
                <p className="text-slate-600 text-xs">
                  {doc.documentType || 'Document'} · Uploaded {doc.uploadedAt ? new Date(doc.uploadedAt).toLocaleString() : '—'}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleDownload(doc);
                }}
                disabled={downloadingId === doc.id}
                className="p-2 border border-slate-200 rounded-lg text-slate-700 hover:bg-slate-50 disabled:opacity-60 flex items-center justify-center"
                aria-label="Download document"
                title="Download"
              >
                <Download className={`w-4 h-4 ${downloadingId === doc.id ? 'animate-pulse' : ''}`} />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default ShipmentDocumentsPanel;
