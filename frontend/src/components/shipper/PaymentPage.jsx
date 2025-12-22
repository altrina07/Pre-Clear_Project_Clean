import { CreditCard, CheckCircle, DollarSign, TrendingUp, Package, FileText, Shield, Truck, X } from 'lucide-react';
import { useState, useEffect } from 'react';
import { shipmentsStore } from '../../store/shipmentsStore';
import { getCurrencyByCountry, formatCurrency } from '../../utils/validation';
import { updateShipmentStatus } from '../../api/shipments';

// Customs clearance configuration by destination country
const CLEARANCE_CONFIG = {
  'IN': { base: 50, threshold: 10000, formalFee: 2000, extraLineItemFee: 100, specialCommodityFee: 1500 },
  'US': { base: 0, threshold: 800, formalFee: 35, extraLineItemFee: 5, specialCommodityFee: 25 },
  'GB': { base: 20, threshold: 150, formalFee: 40, extraLineItemFee: 5, specialCommodityFee: 30 },
  'FR': { base: 20, threshold: 150, formalFee: 40, extraLineItemFee: 5, specialCommodityFee: 30 },
  'DE': { base: 20, threshold: 150, formalFee: 40, extraLineItemFee: 5, specialCommodityFee: 30 },
  'IT': { base: 20, threshold: 150, formalFee: 40, extraLineItemFee: 5, specialCommodityFee: 30 },
  'ES': { base: 20, threshold: 150, formalFee: 40, extraLineItemFee: 5, specialCommodityFee: 30 },
  'NL': { base: 20, threshold: 150, formalFee: 40, extraLineItemFee: 5, specialCommodityFee: 30 },
  'BE': { base: 20, threshold: 150, formalFee: 40, extraLineItemFee: 5, specialCommodityFee: 30 },
  'default': { base: 30, threshold: 100, formalFee: 50, extraLineItemFee: 5, specialCommodityFee: 30 }
};

// Pickup charge configuration by origin country
const PICKUP_CONFIG = {
  'IN': 250,
  'US': 35,
  'GB': 25,
  'FR': 28,
  'DE': 30,
  'IT': 27,
  'ES': 26,
  'NL': 32,
  'BE': 29,
  'CN': 40,
  'JP': 50,
  'SG': 45,
  'AU': 55,
  'CA': 40,
  'MX': 38,
  'BR': 42,
  'default': 50
};

// Helper function to calculate customs clearance
const calculateClearance = (destCountry, customsValue, lineItemCount, isSpecialCommodity) => {
  const country = destCountry?.toUpperCase() || '';
  const config = CLEARANCE_CONFIG[country] || CLEARANCE_CONFIG['default'];
  
  let clearance = config.base;
  
  // Add formal clearance fee if customs value exceeds threshold
  if (customsValue > config.threshold) {
    clearance += config.formalFee;
  }
  
  // Add extra line item fee if line items > 5
  if (lineItemCount > 5) {
    clearance += (lineItemCount - 5) * config.extraLineItemFee;
  }
  
  // Add special commodity surcharge if applicable
  if (isSpecialCommodity) {
    clearance += config.specialCommodityFee;
  }
  
  return Math.round(clearance);
};

// Helper function to calculate pickup charge
const calculatePickupCharge = (originCountry) => {
  const country = originCountry?.toUpperCase() || '';
  return PICKUP_CONFIG[country] || PICKUP_CONFIG['default'];
};

export function PaymentPage({ shipment, onNavigate }) {
  const [processing, setProcessing] = useState(false);
  const [paymentSuccess, setPaymentSuccess] = useState(false);
  const [showCardModal, setShowCardModal] = useState(false);
  const [cardDetails, setCardDetails] = useState({
    cardNumber: '',
    cardName: '',
    expiryDate: '',
    cvv: ''
  });

  // Get origin currency (all amounts shown in origin country currency)
  const originCurrency = getCurrencyByCountry(shipment?.shipper?.country || 'US');

  // Prefer explicit pricing if present on the shipment (saved from form/mock data)
  const pricing = shipment?.pricing || {};
  const shipmentValue = parseFloat(shipment?.value || '0');
  const weight = parseFloat(shipment?.weight || '0');
  const customsValue = parseFloat(shipment?.customsValue || shipmentValue || '0');
  const originCountry = shipment?.shipper?.country || shipment?.originCountry || 'US';
  const destCountry = shipment?.consignee?.country || shipment?.destCountry || 'US';

  // Count line items from packages
  const lineItemCount = shipment?.packages?.reduce((acc, pkg) => acc + (pkg.products?.length || 0), 0) || 0;
  const isSpecialCommodity = shipment?.packages?.some(pkg => pkg.products?.some(p => p.reasonForExport === 'Special')) || false;

  // Calculate pricing using same formula as ShipmentForm
  const serviceLevelMultiplier = {
    'Standard': 1.0,
    'Express': 1.5,
    'Economy': 0.8,
    'Freight': 0.7,
  };

  // Use shipment.pricing if available, otherwise calculate
  const basePrice = parseFloat(pricing.basePrice || (customsValue * 0.05) || 0);
  const serviceCharge = parseFloat(pricing.serviceCharge || (basePrice * (serviceLevelMultiplier[shipment?.serviceLevel] || 1.0)) || 0);
  const calculatedCustomsClearance = calculateClearance(destCountry, customsValue, lineItemCount, isSpecialCommodity);
  const customsClearance = parseFloat(pricing.customsClearance || calculatedCustomsClearance);
  const calculatedPickupCharge = shipment?.pickupType === 'Scheduled Pickup' ? calculatePickupCharge(originCountry) : 0;
  const pickupCharge = parseFloat(pricing.pickupCharge || calculatedPickupCharge);
  const subtotal = parseFloat(pricing.subtotal || (basePrice + serviceCharge + customsClearance + pickupCharge) || 0);
  const tax = parseFloat(pricing.tax || subtotal * 0.18 || 0);
  const total = parseFloat(shipment?.pricingTotal || pricing.total || subtotal + tax || 0);

  const handlePayment = () => {
    setShowCardModal(true);
  };

  const handleCardSubmit = async (e) => {
    e.preventDefault();
    
    // Basic validation
    if (!cardDetails.cardNumber || !cardDetails.cardName || !cardDetails.expiryDate || !cardDetails.cvv) {
      alert('Please fill in all card details');
      return;
    }
    
    setProcessing(true);
    setShowCardModal(false);
    
    try {
      // Simulate payment processing
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Update shipment status to paid
      await updateShipmentStatus(shipment.id, 'paid');
      
      // Update local store
      shipmentsStore.completePayment(shipment.id);
      const updated = shipmentsStore.getShipmentById(shipment.id);
      if (updated) {
        updated.status = 'paid';
        updated.paymentStatus = 'completed';
        const now = new Date().toISOString();
        updated.paymentDate = now;
        updated.bookingDate = now;  // Use payment date as booking date
        shipmentsStore.saveShipment(updated);
      }
      
      setPaymentSuccess(true);
      setTimeout(() => {
        onNavigate('booked-paid');
      }, 3000);
    } catch (error) {
      console.error('Payment error:', error);
      alert('Payment failed. Please try again.');
      setProcessing(false);
    }
  };

  if (paymentSuccess) {
    return (
      <div className="max-w-2xl mx-auto">
        <div className="bg-gradient-to-br from-green-50 to-emerald-50 border-2 border-green-200 rounded-xl p-12 text-center">
          <div className="w-20 h-20 bg-green-500 rounded-full flex items-center justify-center mx-auto mb-6">
            <CheckCircle className="w-10 h-10 text-white" />
          </div>
          <h2 className="text-green-900 text-3xl mb-4">Payment Successful!</h2>
          <p className="text-green-700 text-lg mb-8">
            Your shipment has been booked and payment processed successfully.
          </p>
          <div className="bg-white rounded-lg p-6 border border-green-200 mb-6">
            <p className="text-slate-600 text-sm mb-1">Shipment ID</p>
            <p className="text-slate-900 text-xl">{shipment?.id}</p>
            <p className="text-slate-600 text-sm mt-4 mb-1">Booking Reference</p>
            <p className="text-slate-900 text-xl">BK-{Math.random().toString(36).substr(2, 9).toUpperCase()}</p>
          </div>
          <p className="text-slate-600 text-sm">Redirecting to dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-slate-900 mb-2">Payment & Booking</h1>
        <p className="text-slate-600">Complete payment to confirm your shipment booking</p>
      </div>

      <div className="max-w-4xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Shipment Summary */}
        <div className="lg:col-span-2 space-y-6">
          {/* Shipment Details */}
          <div className="bg-white rounded-xl p-6 border border-slate-200 shadow-sm">
            <h3 className="text-slate-900 mb-4">Shipment Details</h3>
            <div className="space-y-3">
              <div className="flex justify-between py-2 border-b border-slate-100">
                <span className="text-slate-600 text-sm">Shipment ID</span>
                <span className="text-slate-900">{shipment?.id}</span>
              </div>
              <div className="flex justify-between py-2 border-b border-slate-100">
                <span className="text-slate-600 text-sm">Title</span>
                <span className="text-slate-900">{shipment?.title || shipment?.productName}</span>
              </div>
              <div className="flex justify-between py-2 border-b border-slate-100">
                <span className="text-slate-600 text-sm">Route</span>
                <span className="text-slate-900">{shipment?.shipper?.city || shipment?.shipperName || 'N/A'}, {shipment?.shipper?.country || ''} → {shipment?.consignee?.city || 'N/A'}, {shipment?.consignee?.country || ''}</span>
              </div>
              <div className="flex justify-between py-2 border-b border-slate-100">
                <span className="text-slate-600 text-sm">Weight</span>
                <span className="text-slate-900">{shipment?.weight} kg</span>
              </div>
              <div className="flex justify-between py-2 border-b border-slate-100">
                <span className="text-slate-600 text-sm">Declared Value</span>
                <span className="text-slate-900">{formatCurrency(shipment?.value || 0, shipment?.currency || originCurrency.code)}</span>
              </div>
              <div className="flex justify-between py-2">
                <span className="text-slate-600 text-sm">Pre-Clear Token</span>
                <span className="text-green-700 font-mono text-sm">{shipment?.token}</span>
              </div>
            </div>
          </div>

          {/* Cost Breakdown */}
          <div className="bg-white rounded-xl p-6 border border-slate-200 shadow-sm">
            <h3 className="text-slate-900 mb-4">Cost Summary</h3>

            <div className="space-y-3 mb-6 text-sm">
              <div className="flex items-center justify-between py-2 border-b border-slate-100">
                <span className="text-slate-600">Customs Value:</span>
                <span className="text-slate-900">{formatCurrency(shipmentValue, shipment?.currency || originCurrency.code)}</span>
              </div>

              <div className="flex items-center justify-between py-2 border-b border-slate-100">
                <span className="text-slate-600">Base Price:</span>
                <span className="text-slate-900">{formatCurrency(basePrice, shipment?.currency || originCurrency.code)}</span>
              </div>

              <div className="flex items-center justify-between py-2 border-b border-slate-100">
                <span className="text-slate-600">Service Charge:</span>
                <span className="text-slate-900">{formatCurrency(serviceCharge, shipment?.currency || originCurrency.code)}</span>
              </div>

              <div className="flex items-center justify-between py-2 border-b border-slate-100">
                <span className="text-slate-600">Estimated Clearance:</span>
                <span className="text-slate-900">{formatCurrency(customsClearance, shipment?.currency || originCurrency.code)}</span>
              </div>

              {shipment?.pickupType === 'Scheduled Pickup' && (
                <div className="flex items-center justify-between py-2 border-b border-slate-100">
                  <span className="text-slate-600">Pickup Charge:</span>
                  <span className="text-slate-900">{formatCurrency(pickupCharge, shipment?.currency || originCurrency.code)}</span>
                </div>
              )}

              <div className="flex items-center justify-between py-2 border-b border-slate-100">
                <span className="text-slate-600">Subtotal:</span>
                <span className="text-slate-900">{formatCurrency(subtotal, shipment?.currency || originCurrency.code)}</span>
              </div>

              <div className="flex items-center justify-between py-2 border-b border-slate-100">
                <span className="text-slate-600">Tax (18%):</span>
                <span className="text-slate-900">{formatCurrency(tax, shipment?.currency || originCurrency.code)}</span>
              </div>

              <div className="flex items-center justify-between pt-3 border-t-2 border-slate-200 text-base font-semibold">
                <span className="text-slate-900">Total:</span>
                <span className="text-blue-600">{formatCurrency(total, shipment?.currency || originCurrency.code)}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Payment Section */}
        <div className="space-y-6">
          <div className="bg-white rounded-xl p-6 border border-slate-200 shadow-sm sticky top-6">
            <h3 className="text-slate-900 mb-6">Payment Summary</h3>
            
            <div className="mb-6">
              <div className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-lg p-4 border border-green-200 mb-4">
                <p className="text-green-700 text-sm mb-2">Amount to Pay</p>
                <p className="text-green-900 text-3xl mb-1">{originCurrency.symbol}{total.toFixed(2)}</p>
                <p className="text-green-600 text-xs">{originCurrency.code} - {originCurrency.name}</p>
              </div>

              <div className="space-y-3 mb-6">
                <div className="flex items-center gap-2 text-sm text-slate-600">
                  <CheckCircle className="w-4 h-4 text-green-600" />
                  <span>AI validation completed</span>
                </div>
                <div className="flex items-center gap-2 text-sm text-slate-600">
                  <CheckCircle className="w-4 h-4 text-green-600" />
                  <span>Broker approved</span>
                </div>
                <div className="flex items-center gap-2 text-sm text-slate-600">
                  <CheckCircle className="w-4 h-4 text-green-600" />
                  <span>Pre-Clear token issued</span>
                </div>
              </div>

              <button
                onClick={handlePayment}
                disabled={processing}
                className="w-full px-6 py-4 bg-green-600 text-white rounded-xl hover:bg-green-700 transition-all flex items-center justify-center gap-2 shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {processing ? (
                  <>
                    <span className="animate-spin">⏳</span>
                    <span>Processing Payment...</span>
                  </>
                ) : (
                  <>
                    <CreditCard className="w-5 h-5" />
                    <span>Pay & Book Shipment</span>
                  </>
                )}
              </button>
            </div>

            <div className="pt-4 border-t border-slate-200">
              <p className="text-xs text-slate-500 leading-relaxed">
                By proceeding with payment, you agree to UPS Pre-Clear terms and conditions. Payment is processed securely.
              </p>
            </div>
          </div>

          {/* Info Card */}
          <div className="bg-blue-50 rounded-xl p-4 border border-blue-200">
            <h4 className="text-blue-900 text-sm mb-2">💡 What happens next?</h4>
            <ul className="text-blue-800 text-xs space-y-2">
              <li>• Booking confirmation email</li>
              <li>• Shipment tracking number</li>
              <li>• Estimated delivery date</li>
              <li>• Digital invoice & receipt</li>
            </ul>
          </div>
        </div>
      </div>

      {/* Card Details Modal */}
      {showCardModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-md w-full p-6 relative">
            <button
              onClick={() => setShowCardModal(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-600"
            >
              <X className="w-5 h-5" />
            </button>
            
            <h3 className="text-slate-900 text-xl mb-4 flex items-center gap-2">
              <CreditCard className="w-5 h-5" />
              Enter Card Details
            </h3>
            
            <form onSubmit={handleCardSubmit} className="space-y-4">
              <div>
                <label className="block text-slate-700 text-sm mb-2">Card Number</label>
                <input
                  type="text"
                  placeholder="1234 5678 9012 3456"
                  value={cardDetails.cardNumber}
                  onChange={(e) => {
                    const value = e.target.value.replace(/\s/g, '').replace(/\D/g, '').slice(0, 16);
                    const formatted = value.match(/.{1,4}/g)?.join(' ') || value;
                    setCardDetails({...cardDetails, cardNumber: formatted});
                  }}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>
              
              <div>
                <label className="block text-slate-700 text-sm mb-2">Cardholder Name</label>
                <input
                  type="text"
                  placeholder="JOHN DOE"
                  value={cardDetails.cardName}
                  onChange={(e) => setCardDetails({...cardDetails, cardName: e.target.value.toUpperCase()})}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-slate-700 text-sm mb-2">Expiry Date</label>
                  <input
                    type="text"
                    placeholder="MM/YY"
                    value={cardDetails.expiryDate}
                    onChange={(e) => {
                      let value = e.target.value.replace(/\D/g, '').slice(0, 4);
                      if (value.length >= 2) {
                        value = value.slice(0, 2) + '/' + value.slice(2);
                      }
                      setCardDetails({...cardDetails, expiryDate: value});
                    }}
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required
                  />
                </div>
                
                <div>
                  <label className="block text-slate-700 text-sm mb-2">CVV</label>
                  <input
                    type="text"
                    placeholder="123"
                    value={cardDetails.cvv}
                    onChange={(e) => setCardDetails({...cardDetails, cvv: e.target.value.replace(/\D/g, '').slice(0, 3)})}
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required
                  />
                </div>
              </div>
              
              <div className="bg-blue-50 rounded-lg p-3 border border-blue-200 text-xs text-blue-800">
                <p className="flex items-center gap-1">
                  <Shield className="w-3 h-3" />
                  Your payment information is secure and encrypted
                </p>
              </div>
              
              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowCardModal(false)}
                  className="flex-1 px-4 py-3 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 flex items-center justify-center gap-2"
                >
                  <CreditCard className="w-4 h-4" />
                  Pay {formatCurrency(total, shipment?.currency || originCurrency.code)}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}