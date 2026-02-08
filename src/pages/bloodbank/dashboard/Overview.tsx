import { Link, useOutletContext } from 'react-router-dom';
import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, Calendar, ChevronRight, Heart, Package, Users } from 'lucide-react';
import { collection, onSnapshot, orderBy, query, where } from 'firebase/firestore';
import { db } from '../../../firebase';
import type { BloodBankDashboardContext } from '../BloodBankDashboard';

type BloodBankBranch = {
  id: string;
  name: string;
  city?: string;
  state?: string;
};

function BloodBankOverview() {
  const {
    user,
    stats,
    inventory,
    bloodRequests,
    appointments,
    getStatusColor,
    getInventoryStatusColor,
    referralCount,
    eligibleReferralCount,
    referralSummary,
  } = useOutletContext<BloodBankDashboardContext>();

  const baseHospitalId = user?.parentHospitalId || user?.uid || '';
  const [branches, setBranches] = useState<BloodBankBranch[]>([]);

  const criticalInventory = inventory.filter((item) => item.status === 'critical' || item.status === 'low');
  const activeRequests = bloodRequests.filter((request) => request.status === 'active' || request.status === 'partially_fulfilled');
  const upcomingAppointments = appointments
    .filter((appt) => appt.status === 'scheduled' || appt.status === 'confirmed')
    .sort((a, b) => a.scheduledDate.getTime() - b.scheduledDate.getTime())
    .slice(0, 4);

  useEffect(() => {
    if (!baseHospitalId) return;
    const q = query(
      collection(db, 'bloodbankBranches'),
      where('parentHospitalId', '==', baseHospitalId),
      orderBy('createdAt', 'asc')
    );
    return onSnapshot(q, (snapshot) => {
      const rows = snapshot.docs.map((docSnap) => {
        const data = docSnap.data();
        return {
          id: docSnap.id,
          name: data.name || 'Branch',
          city: data.city,
          state: data.state,
        } as BloodBankBranch;
      });
      setBranches(rows);
    });
  }, [baseHospitalId]);

  const branchSummary = useMemo(() => {
    if (!baseHospitalId) return [];
    const branchMap = new Map<string, {
      id: string;
      name: string;
      totalUnits: number;
      availableUnits: number;
      reservedUnits: number;
      criticalTypes: number;
    }>();

    const resolveBranchName = (branchId: string) => {
      if (branchId === baseHospitalId) return 'Main branch';
      return branches.find((branch) => branch.id === branchId)?.name || 'Branch';
    };

    inventory.forEach((item) => {
      const branchId = item.branchId || item.hospitalId || baseHospitalId;
      if (!branchMap.has(branchId)) {
        branchMap.set(branchId, {
          id: branchId,
          name: resolveBranchName(branchId),
          totalUnits: 0,
          availableUnits: 0,
          reservedUnits: 0,
          criticalTypes: 0,
        });
      }
      const entry = branchMap.get(branchId);
      if (!entry) return;
      entry.totalUnits += item.units || 0;
      item.batches.forEach((batch) => {
        if (batch.status === 'available') entry.availableUnits += batch.units;
        if (batch.status === 'reserved') entry.reservedUnits += batch.units;
      });
      if (item.status === 'critical' || item.status === 'low') {
        entry.criticalTypes += 1;
      }
    });

    return Array.from(branchMap.values());
  }, [inventory, branches, baseHospitalId]);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4 sm:gap-6 lg:grid-cols-4">
        <div className="bg-white rounded-2xl shadow-xl p-6 border border-red-100">
          <div className="flex items-center justify-between mb-3">
            <div className="w-12 h-12 rounded-2xl bg-red-100 flex items-center justify-center">
              <Package className="w-6 h-6 text-red-600" />
            </div>
            <span className="text-xs font-semibold text-emerald-600">Total units</span>
          </div>
          <h3 className="text-2xl font-bold text-gray-900">{stats.totalInventory}</h3>
          <p className="text-sm text-gray-500 mt-1">Blood inventory</p>
        </div>

        <div className="bg-white rounded-2xl shadow-xl p-6 border border-yellow-100">
          <div className="flex items-center justify-between mb-3">
            <div className="w-12 h-12 rounded-2xl bg-yellow-100 flex items-center justify-center">
              <AlertTriangle className="w-6 h-6 text-yellow-600" />
            </div>
            <span className="text-xs font-semibold text-rose-600">Alerts {stats.criticalTypes + stats.lowTypes}</span>
          </div>
          <h3 className="text-2xl font-bold text-gray-900">{stats.expiringIn7Days}</h3>
          <p className="text-sm text-gray-500 mt-1">Expiring in 7 days</p>
        </div>

        <div className="bg-white rounded-2xl shadow-xl p-6 border border-red-100">
          <div className="flex items-center justify-between mb-3">
            <div className="w-12 h-12 rounded-2xl bg-red-100 flex items-center justify-center">
              <Heart className="w-6 h-6 text-red-600" />
            </div>
            <span className="text-xs font-semibold text-emerald-600">Active {stats.activeRequests}</span>
          </div>
          <h3 className="text-2xl font-bold text-gray-900">{stats.fulfilledRequests}</h3>
          <p className="text-sm text-gray-500 mt-1">Requests fulfilled</p>
        </div>

        <div className="bg-white rounded-2xl shadow-xl p-6 border border-yellow-100">
          <div className="flex items-center justify-between mb-3">
            <div className="w-12 h-12 rounded-2xl bg-yellow-100 flex items-center justify-center">
              <Calendar className="w-6 h-6 text-yellow-600" />
            </div>
            <span className="text-xs font-semibold text-emerald-600">Today {stats.todayAppointments}</span>
          </div>
          <h3 className="text-2xl font-bold text-gray-900">{stats.todayDonations}</h3>
          <p className="text-sm text-gray-500 mt-1">Donations today</p>
        </div>
      </div>

      {branchSummary.length > 0 && (
        <div className="bg-white rounded-2xl shadow-xl p-6 border border-gray-100">
          <div className="flex items-center justify-between mb-5">
            <div>
              <p className="text-xs uppercase tracking-[0.3em] text-red-600">Branches</p>
              <h2 className="text-2xl font-bold text-gray-900">Branch inventory snapshot</h2>
            </div>
            <Link
              to="/bloodbank/dashboard/inventory"
              className="text-sm font-semibold text-red-600 hover:text-red-700 flex items-center gap-2"
            >
              Manage inventory
              <ChevronRight className="w-4 h-4" />
            </Link>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {branchSummary.map((branch) => (
              <div key={branch.id} className="rounded-2xl border border-gray-100 p-4 bg-gray-50/40">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold text-gray-900">{branch.name}</h3>
                  <span className="text-xs font-semibold text-gray-500">{branch.criticalTypes} alerts</span>
                </div>
                <div className="mt-3 text-sm text-gray-600">
                  Total units: <span className="font-semibold text-gray-900">{branch.totalUnits}</span>
                </div>
                <div className="mt-1 text-xs text-gray-500">
                  Available {branch.availableUnits} • Reserved {branch.reservedUnits}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <div className="bg-white rounded-2xl shadow-xl p-6">
          <div className="flex items-center justify-between mb-5">
            <div>
              <p className="text-xs uppercase tracking-[0.3em] text-red-600">Critical Inventory</p>
              <h2 className="text-2xl font-bold text-gray-900">Stock alerts</h2>
            </div>
            <Link
              to="/bloodbank/dashboard/inventory"
              className="text-sm font-semibold text-red-600 hover:text-red-700 flex items-center gap-2"
            >
              View inventory
              <ChevronRight className="w-4 h-4" />
            </Link>
          </div>

          {criticalInventory.length === 0 ? (
            <div className="text-center py-10 text-gray-500">
              <Package className="w-12 h-12 text-red-200 mx-auto mb-3" />
              <p>No critical inventory alerts right now.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {criticalInventory.slice(0, 4).map((item) => (
                <div key={item.id} className="border border-gray-100 rounded-2xl p-4 bg-gray-50/40">
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900">{item.bloodType}</h3>
                      <p className="text-xs text-gray-500">{item.units} units available</p>
                    </div>
                    <span className={`px-3 py-1 rounded-full text-xs font-semibold ${getInventoryStatusColor(item.status)}`}>
                      {item.status}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="space-y-6">
          <div className="bg-gradient-to-br from-red-600 to-yellow-500 rounded-2xl p-6 text-white shadow-xl">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs uppercase tracking-[0.3em] text-white/70">Appointments</p>
                <h2 className="text-2xl font-bold">Today & upcoming</h2>
              </div>
              <Users className="w-6 h-6" />
            </div>
            <div className="space-y-3 mt-6">
              {upcomingAppointments.length === 0 ? (
                <div className="rounded-xl bg-white/15 p-4 text-sm text-white/80">
                  No upcoming appointments scheduled.
                </div>
              ) : (
                upcomingAppointments.map((appt) => (
                  <div key={appt.id} className="rounded-xl bg-white/15 p-4">
                    <p className="text-sm font-semibold">{appt.donorName || 'Donor'}</p>
                    <p className="text-xs text-white/70 mt-1">
                      {appt.scheduledDate.toLocaleDateString()} • {appt.bloodType}
                    </p>
                    <span className={`mt-2 inline-block rounded-full px-2 py-1 text-[10px] font-semibold ${getStatusColor(appt.status)} bg-white/20 text-white border border-white/20`}>
                      {appt.status}
                    </span>
                  </div>
                ))
              )}
            </div>
            <Link
              to="/bloodbank/dashboard/appointments"
              className="mt-6 inline-flex items-center gap-2 text-sm font-semibold text-white hover:text-white/90"
            >
              View appointments
              <ChevronRight className="w-4 h-4" />
            </Link>
          </div>

          <div className="bg-white rounded-2xl shadow-xl p-6 border border-yellow-100">
            <div className="flex items-center justify-between mb-3">
              <div>
                <p className="text-xs uppercase tracking-[0.3em] text-yellow-600">Referrals</p>
                <h3 className="text-lg font-bold text-gray-900">Referral snapshot</h3>
              </div>
              <Users className="w-5 h-5 text-yellow-500" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-xl border border-yellow-100 bg-yellow-50 px-3 py-3">
                <p className="text-xs text-gray-500">Registered</p>
                <p className="text-xl font-bold text-gray-900">{referralSummary?.registered || 0}</p>
              </div>
              <div className="rounded-xl border border-red-100 bg-red-50 px-3 py-3">
                <p className="text-xs text-gray-500">Eligible</p>
                <p className="text-xl font-bold text-gray-900">{eligibleReferralCount}</p>
              </div>
            </div>
            <div className="mt-3 flex items-center justify-between text-xs text-gray-500">
              <span>{referralCount} total referrals</span>
              <Link to="/bloodbank/dashboard/referrals" className="inline-flex items-center gap-1 font-semibold text-yellow-600 hover:text-yellow-700">
                View details
                <ChevronRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-xl p-6">
        <div className="flex items-center justify-between mb-5">
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-yellow-600">Requests</p>
            <h2 className="text-2xl font-bold text-gray-900">Active blood requests</h2>
          </div>
          <Link
            to="/bloodbank/dashboard/requests"
            className="text-sm font-semibold text-yellow-600 hover:text-yellow-700 flex items-center gap-2"
          >
            View all
            <ChevronRight className="w-4 h-4" />
          </Link>
        </div>

        {activeRequests.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <Heart className="w-10 h-10 text-yellow-200 mx-auto mb-2" />
            <p>No active requests right now.</p>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            {activeRequests.slice(0, 4).map((request) => (
              <div key={request.id} className="rounded-2xl border border-gray-100 p-4">
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900">{request.bloodType}</h3>
                    <p className="text-xs text-gray-500">{request.units} units • {request.urgency}</p>
                  </div>
                  <span className={`px-3 py-1 rounded-full text-xs font-semibold ${getStatusColor(request.status)}`}>
                    {request.status}
                  </span>
                </div>
                <p className="text-sm text-gray-600 mt-3 line-clamp-2">{request.reason}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default BloodBankOverview;
