import { useMemo } from 'react';
import { useOutletContext } from 'react-router-dom';
import { Users } from 'lucide-react';
import type { BloodBankDashboardContext } from '../BloodBankDashboard';

function BloodBankDonors() {
  const { donations } = useOutletContext<BloodBankDashboardContext>();

  const donors = useMemo(() => {
    const map = new Map<string, { name: string; totalUnits: number; lastDonation?: Date; bloodType?: string }>();
    donations.forEach((donation) => {
      const existing = map.get(donation.donorId);
      const lastDonation = donation.donationDate;
      if (!existing) {
        map.set(donation.donorId, {
          name: donation.donorName || 'Donor',
          totalUnits: donation.units || 0,
          lastDonation,
          bloodType: donation.bloodType,
        });
      } else {
        existing.totalUnits += donation.units || 0;
        if (!existing.lastDonation || lastDonation > existing.lastDonation) {
          existing.lastDonation = lastDonation;
          existing.bloodType = donation.bloodType || existing.bloodType;
        }
      }
    });
    return Array.from(map.values()).sort((a, b) => (b.lastDonation?.getTime() || 0) - (a.lastDonation?.getTime() || 0));
  }, [donations]);

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs uppercase tracking-[0.3em] text-red-600">Donors</p>
        <h2 className="text-2xl font-bold text-gray-900">Recent donors</h2>
      </div>

      <div className="bg-white rounded-2xl shadow-xl p-6">
        {donors.length === 0 ? (
          <div className="text-center py-10 text-gray-500">
            <Users className="w-10 h-10 text-red-200 mx-auto mb-2" />
            <p>No donor activity yet.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {donors.map((donor, index) => (
              <div key={`${donor.name}-${index}`} className="rounded-2xl border border-gray-100 p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900">{donor.name}</h3>
                    <p className="text-xs text-gray-500">{donor.bloodType || 'Blood type unknown'}</p>
                  </div>
                  <div className="text-right text-xs text-gray-500">
                    <p>Total units: {donor.totalUnits}</p>
                    {donor.lastDonation && <p>Last donation: {donor.lastDonation.toLocaleDateString()}</p>}
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

export default BloodBankDonors;
