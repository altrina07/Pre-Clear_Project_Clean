import { useState } from 'react';
import { CheckCircle, FileText, Eye } from 'lucide-react';
import { useShipments } from '../../hooks/useShipments';
import { MapPin, DollarSign, Zap, XCircle, Package, Calendar, ArrowLeft, MessageCircle, Upload } from 'lucide-react';
import { getCurrencyByCountry, formatCurrency } from '../../utils/validation';

// Helper function to format time to 12-hour format with AM/PM
const formatTimeWithAmPm = (timeString) => {
  if (!timeString) return 'N/A';
  const [hours, minutes] = timeString.split(':');
  const hour = parseInt(hours);
  const ampm = hour >= 12 ? 'PM' : 'AM';
  const displayHour = hour % 12 || 12;
  return `${displayHour}:${minutes} ${ampm}`;
};

export function ApprovedShipments({ onNavigate }) {
  const { shipments } = useShipments();
  const approved = shipments.filter(s => s.status !== 'draft' && s.brokerApproval === 'approved');
  const [expandedShipmentId, setExpandedShipmentId] = useState(null);
  const [viewingDocument, setViewingDocument] = useState(null);

  const getCurrency = (originCountry) => {
    return getCurrencyByCountry(originCountry || 'US');
  };

  const getCurrencyCode = (shipment) => shipment?.currency || getCurrency(shipment?.originCountry).code;

  const getRoute = (shipment) => {
    const originCity = shipment?.shipper?.city || shipment?.originCountry || 'N/A';
    const originCountry = shipment?.shipper?.country || shipment?.originCountry || '';
    const destCity = shipment?.consignee?.city || shipment?.destCountry || 'N/A';
    const destCountry = shipment?.consignee?.country || shipment?.destCountry || '';
    return `${originCity}${originCountry ? `, ${originCountry}` : ''} → ${destCity}${destCountry ? `, ${destCountry}` : ''}`;
  };

  const getPackageCount = (shipment) => shipment?.packages?.length || 0;

  const getProductSummary = (shipment) => {
    const productCountFromPackages = shipment?.packages?.reduce((sum, pkg) => sum + (pkg?.products?.length || 0), 0) || 0;
    const explicitProducts = shipment?.products?.length || 0;
    const count = explicitProducts || productCountFromPackages;
    const first = shipment?.products?.[0]?.name
      || shipment?.packages?.[0]?.products?.[0]?.name
      || shipment?.productName
      || null;
    return { count, first };
  };

  const getTotalWeight = (shipment) => {
    if (shipment?.totalWeight) return shipment.totalWeight;
    if (shipment?.weight) return shipment.weight;
    return shipment?.packages?.reduce((sum, pkg) => sum + (parseFloat(pkg?.weight) || 0), 0) || 0;
  };

  const getTotalQuantity = (shipment) => {
    if (shipment?.totalQuantity) return shipment.totalQuantity;
    if (shipment?.quantity) return shipment.quantity;
    return shipment?.packages?.reduce((sum, pkg) => {
      if (Array.isArray(pkg?.products)) {
        return sum + pkg.products.reduce((inner, prod) => inner + (parseFloat(prod?.qty) || 0), 0);
      }
      return sum;
    }, 0) || 0;
  };

  return (
    <div style={{ background: '#FBF9F6', minHeight: '100vh', padding: 24 }}>
      <div className="mb-8">
        <h1 className="text-slate-900 mb-2">Approved Shipments</h1>
        <p className="text-slate-600">All shipments you have approved</p>
      </div>

      {approved.length === 0 ? (
        <div className="bg-white rounded-xl p-12 border border-slate-200 text-center">
          <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <CheckCircle className="w-8 h-8 text-slate-400" />
          </div>
          <h3 className="text-slate-900 mb-2">No Approved Shipments</h3>
          <p className="text-slate-600">You haven't approved any shipments yet.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6">
          {approved.map((s) => (
            <div key={s.id} className="bg-white rounded-xl border border-slate-200 overflow-hidden">
              <div className="p-6 border-b">
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="text-slate-900 text-xl">Shipment {s.referenceId || s.id}</h3>
                      <span className="px-3 py-1 bg-green-100 text-green-700 rounded-full text-sm flex items-center gap-1">
                        <CheckCircle className="w-3 h-3" />
                        Approved
                      </span>
                    </div>
                  </div>
                  <button
                    onClick={() => onNavigate('approved-shipview', s)}
                    className="px-4 py-2 rounded-lg transition-colors flex items-center gap-2"
                    style={{ background: '#E6B800', color: '#2F1B17', border: '2px solid #2F1B17' }}
                  >
                    <Eye className="w-4 h-4" />
                    View Details
                  </button>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div>
                    <p className="text-slate-500 text-sm mb-1">Title</p>
                    <p className="text-slate-900">{s.title || 'N/A'}</p>
                  </div>
                    <div>
                      <p className="text-slate-500 text-sm mb-1">Route</p>
                      <p className="text-slate-900">{getRoute(s)}</p>
                    </div>
                   <div>
                     <p className="text-slate-500 text-sm mb-1">Assigned Broker</p>
                     <p className="text-slate-900">{s.assignedBrokerId ? `You (#${s.assignedBrokerId})` : 'Not assigned'}</p>
                   </div>
                   <div>
                     <p className="text-slate-500 text-sm mb-1">Quantity</p>
                     <p className="text-slate-900">{getTotalQuantity(s)} units</p>
                   </div>
                   <div>
                     <p className="text-slate-500 text-sm mb-1">Weight</p>
                     <p className="text-slate-900">{getTotalWeight(s)} kg</p>
                   </div>
                   <div>
                     <p className="text-slate-500 text-sm mb-1">Product Value</p>
                     <p className="text-slate-900">{formatCurrency(parseFloat(s.value ?? s.customsValue ?? 0), getCurrencyCode(s))}</p>
                   </div>
                   <div>
                     <p className="text-slate-500 text-sm mb-1">Packages</p>
                     <p className="text-slate-900">{getPackageCount(s)} total</p>
                   </div>
                </div>
              </div>

              {/* Details view moved to the broker review page via navigation */}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
