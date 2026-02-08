import { useMemo, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { AlertTriangle, Package, RefreshCw } from 'lucide-react';
import type { BloodBankDashboardContext } from '../BloodBankDashboard';

function BloodBankInventory() {
  const { inventory, getInventoryStatusColor, refreshData } = useOutletContext<BloodBankDashboardContext>();
  const [filter, setFilter] = useState<'all' | 'critical' | 'low' | 'adequate' | 'surplus'>('all');

  const filteredInventory = useMemo(() => {
    if (filter === 'all') return inventory;
    return inventory.filter((item) => item.status === filter);
  }, [inventory, filter]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.3em] text-red-600">Inventory</p>
          <h2 className="text-2xl font-bold text-gray-900">Blood inventory</h2>
        </div>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={refreshData}
            className="inline-flex items-center gap-2 rounded-xl border border-red-100 bg-white px-4 py-2 text-sm font-semibold text-red-600 hover:bg-red-50"
          >
            <RefreshCw className="w-4 h-4" />
            Refresh
          </button>
          <div className="flex flex-wrap gap-2 text-xs font-semibold">
            {[
              { id: 'all', label: 'All' },
              { id: 'critical', label: 'Critical' },
              { id: 'low', label: 'Low' },
              { id: 'adequate', label: 'Adequate' },
              { id: 'surplus', label: 'Surplus' },
            ].map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setFilter(item.id as typeof filter)}
                className={`rounded-full border px-3 py-1 transition-all ${
                  filter === item.id
                    ? 'border-red-200 bg-red-50 text-red-600'
                    : 'border-gray-200 bg-white text-gray-500 hover:bg-gray-50'
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {filteredInventory.length === 0 ? (
        <div className="bg-white rounded-2xl shadow-xl p-10 text-center text-gray-500">
          <Package className="w-10 h-10 text-red-200 mx-auto mb-2" />
          <p>No inventory items match this filter.</p>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {filteredInventory.map((item) => (
            <div key={item.id} className="bg-white rounded-2xl shadow-xl p-5 border border-gray-100">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">{item.bloodType}</h3>
                  <p className="text-xs text-gray-500">{item.units} units available</p>
                </div>
                <span className={`px-3 py-1 rounded-full text-xs font-semibold ${getInventoryStatusColor(item.status)}`}>
                  {item.status}
                </span>
              </div>
              <div className="mt-4 text-xs text-gray-500">
                <p>Low level: {item.lowLevel} units</p>
                <p>Critical level: {item.criticalLevel} units</p>
              </div>
              {item.status === 'critical' && (
                <div className="mt-3 flex items-center gap-2 text-xs text-rose-600">
                  <AlertTriangle className="w-4 h-4" />
                  Immediate restock required
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default BloodBankInventory;
