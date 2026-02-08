import { useMemo, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { Calendar, Users } from 'lucide-react';
import type { BloodBankDashboardContext } from '../BloodBankDashboard';

function BloodBankAppointments() {
  const { appointments, getStatusColor } = useOutletContext<BloodBankDashboardContext>();
  const [filter, setFilter] = useState<'all' | 'scheduled' | 'completed' | 'cancelled'>('all');

  const filteredAppointments = useMemo(() => {
    if (filter === 'all') return appointments;
    if (filter === 'scheduled') {
      return appointments.filter((appt) => appt.status === 'scheduled' || appt.status === 'confirmed');
    }
    if (filter === 'completed') {
      return appointments.filter((appt) => appt.status === 'completed');
    }
    return appointments.filter((appt) => appt.status === 'cancelled' || appt.status === 'no-show');
  }, [appointments, filter]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.3em] text-red-600">Appointments</p>
          <h2 className="text-2xl font-bold text-gray-900">Donor appointments</h2>
        </div>
        <div className="flex flex-wrap gap-2 text-xs font-semibold">
          {[
            { id: 'all', label: 'All' },
            { id: 'scheduled', label: 'Scheduled' },
            { id: 'completed', label: 'Completed' },
            { id: 'cancelled', label: 'Cancelled' },
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

      <div className="bg-white rounded-2xl shadow-xl p-6">
        {filteredAppointments.length === 0 ? (
          <div className="text-center py-10 text-gray-500">
            <Calendar className="w-10 h-10 text-red-200 mx-auto mb-2" />
            <p>No appointments match this filter.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredAppointments.map((appt) => (
              <div key={appt.id} className="rounded-2xl border border-gray-100 p-4">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900">{appt.donorName || 'Donor'}</h3>
                    <p className="text-xs text-gray-500">{appt.bloodType} • {appt.type}</p>
                    <p className="text-sm text-gray-600 mt-2">{appt.scheduledDate.toLocaleString()}</p>
                  </div>
                  <span className={`px-3 py-1 rounded-full text-xs font-semibold ${getStatusColor(appt.status)}`}>
                    {appt.status}
                  </span>
                </div>
                {appt.notes && (
                  <p className="text-xs text-gray-500 mt-3">Notes: {appt.notes}</p>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="bg-gradient-to-br from-red-600 to-yellow-500 rounded-2xl p-6 text-white shadow-xl">
        <div className="flex items-center gap-3">
          <Users className="w-6 h-6" />
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-white/70">Tip</p>
            <p className="text-sm">Use confirmations to reduce no-shows and maintain inventory health.</p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default BloodBankAppointments;
