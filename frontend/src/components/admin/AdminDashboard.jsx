import { Users, Settings, BarChart3, Shield, TrendingUp, Activity, MapPin, Package, CheckCircle, Clock, AlertTriangle } from 'lucide-react';
import { useEffect, useState } from 'react';
import http from '../../api/http';

export function AdminDashboard({ onNavigate }) {
  const [stats, setStats] = useState({
    totalShipments: 0,
    completedShipments: 0,
    pendingShipments: 0,
    aiApprovedShipments: 0,
    brokerApprovedShipments: 0,
    paidShipments: 0,
    documentsRequested: 0,
    topRoutes: []
  });

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const resp = await http.get('/dashboard/stats');
        if (mounted) setStats(resp.data || {});
      } catch (e) { /* show zeroes on failure */ }
    })();
    return () => { mounted = false; };
  }, []);

  // Status badge helper removed; stats are server-derived

  return (
    <div style={{ background: '#FBF9F6', minHeight: '100vh', padding: 24 }}>
      <div className="mb-8">
        <h1 className="text-slate-900 mb-2">Admin Dashboard</h1>
        <p className="text-slate-600">System overview and management</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <div className="bg-white rounded-xl p-6 border border-slate-200 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center">
              <Package className="w-6 h-6 text-blue-600" />
            </div>
            <div>
              <p className="text-slate-600 text-sm">Total Shipments</p>
              <p className="text-slate-900 text-2xl">{stats.totalShipments}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl p-6 border border-slate-200 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center">
              <CheckCircle className="w-6 h-6 text-green-600" />
            </div>
            <div>
              <p className="text-slate-600 text-sm">Completed</p>
              <p className="text-slate-900 text-2xl">{stats.completedShipments}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl p-6 border border-slate-200 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-amber-100 rounded-xl flex items-center justify-center">
              <Clock className="w-6 h-6 text-amber-600" />
            </div>
            <div>
              <p className="text-slate-600 text-sm">Pending Review</p>
              <p className="text-slate-900 text-2xl">{stats.pendingShipments}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl p-6 border border-slate-200 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-purple-100 rounded-xl flex items-center justify-center">
              <TrendingUp className="w-6 h-6 text-purple-600" />
            </div>
            <div>
              <p className="text-slate-600 text-sm">AI Approvals</p>
              <p className="text-slate-900 text-2xl">{stats.aiApprovedShipments}</p>
            </div>
          </div>
        </div>
      </div>        
       


      {/* Shipping Insights */}
      <div className="mt-8 grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white rounded-xl p-6 border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-slate-900 text-lg">Shipping Insights</h3>
            <p className="text-slate-500 text-sm">Overview of recent shipment activity</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="col-span-1">
              <p className="text-slate-500 text-sm">Total Shipments</p>
              <p className="text-slate-900 text-2xl">{stats.totalShipments}</p>
            </div>

            <div className="col-span-1">
              <p className="text-slate-500 text-sm">Completed</p>
              <p className="text-slate-900 text-2xl">{stats.completedShipments}</p>
              <p className="text-sm text-slate-500">{stats.totalShipments ? Math.round((stats.completedShipments / stats.totalShipments) * 100) : 0}% completion rate</p>
            </div>

            <div className="col-span-1">
              <p className="text-slate-500 text-sm">Avg Daily</p>
              <p className="text-slate-900 text-2xl">{Math.round((stats.totalShipments || 0) / 30)}</p>
              <p className="text-sm text-slate-500">Estimated</p>
            </div>
          </div>

          <div className="mt-6">
            <h4 className="text-slate-800 mb-2">Top Routes</h4>
            <div className="space-y-2">
              {(stats.topRoutes || []).map((r) => (
                <div key={r.route} className="flex items-center justify-between p-3 rounded-lg bg-slate-50">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-white rounded-full flex items-center justify-center shadow-sm">
                      <MapPin className="w-4 h-4 text-slate-700" />
                    </div>
                    <div>
                      <div className="text-slate-900">{r.route}</div>
                      <div className="text-slate-500 text-sm">{r.count} shipments</div>
                    </div>
                  </div>
                  <div className="text-slate-700 font-medium">{stats.totalShipments ? Math.round((r.count / stats.totalShipments) * 100) : 0}%</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl p-6 border border-slate-200 shadow-sm">
          <h4 className="text-slate-900 mb-3">Recent Activity</h4>
          <ul className="text-sm text-slate-600 space-y-2">
            <li>AI approvals — {stats.aiApprovedShipments} total</li>
            <li>Broker approvals — {stats.brokerApprovedShipments} total</li>
            <li>Payments completed — {stats.paidShipments} total</li>
            <li>Documents requested — {stats.documentsRequested} pending</li>
          </ul>
        </div>
      </div>
    </div>
  );
}

