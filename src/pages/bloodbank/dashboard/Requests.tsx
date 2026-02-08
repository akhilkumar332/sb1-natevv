import { useMemo, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { Heart, Plus } from 'lucide-react';
import type { BloodBankDashboardContext } from '../BloodBankDashboard';

function BloodBankRequests() {
  const { bloodRequests, getStatusColor } = useOutletContext<BloodBankDashboardContext>();
  const [filter, setFilter] = useState<'all' | 'active' | 'fulfilled' | 'expired'>('all');

  const filteredRequests = useMemo(() => {
    if (filter === 'all') return bloodRequests;
    if (filter === 'active') {
      return bloodRequests.filter((request) => request.status === 'active' || request.status === 'partially_fulfilled');
    }
    if (filter === 'fulfilled') {
      return bloodRequests.filter((request) => request.status === 'fulfilled');
    }
    return bloodRequests.filter((request) => request.status === 'expired' || request.status === 'cancelled');
  }, [bloodRequests, filter]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.3em] text-red-600">Requests</p>
          <h2 className="text-2xl font-bold text-gray-900">Blood requests</h2>
        </div>
        <div className="flex items-center gap-3">
          <button
            type="button"
            className="inline-flex items-center gap-2 rounded-xl border border-red-100 bg-white px-4 py-2 text-sm font-semibold text-red-600 hover:bg-red-50"
          >
            <Plus className="w-4 h-4" />
            New Request
          </button>
          <div className="flex items-center gap-2 text-xs font-semibold">
            {[
              { id: 'all', label: 'All' },
              { id: 'active', label: 'Active' },
              { id: 'fulfilled', label: 'Fulfilled' },
              { id: 'expired', label: 'Closed' },
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

      <div className="bg-white rounded-2xl shadow-xl p-6">
        {filteredRequests.length === 0 ? (
          <div className="text-center py-10 text-gray-500">
            <Heart className="w-10 h-10 text-red-200 mx-auto mb-2" />
            <p>No requests match this filter.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredRequests.map((request) => (
              <div key={request.id} className="rounded-2xl border border-gray-100 p-4">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900">{request.bloodType}</h3>
                    <p className="text-xs text-gray-500">{request.units} units • {request.urgency}</p>
                    <p className="text-sm text-gray-600 mt-2">{request.reason}</p>
                    <p className="text-xs text-gray-500 mt-2">Needed by {request.neededBy.toLocaleDateString()}</p>
                  </div>
                  <div className="text-right">
                    <span className={`inline-block rounded-full px-3 py-1 text-xs font-semibold ${getStatusColor(request.status)}`}>
                      {request.status}
                    </span>
                    <div className="mt-3 text-xs text-gray-500">Received {request.unitsReceived}/{request.units}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default BloodBankRequests;
