import { useEffect, useMemo, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../../../firebase';
import { getServerTimestamp } from '../../../utils/firestore.utils';
import { toDateValue } from '../../../utils/dateValue';
import AdminListToolbar from '../../../components/admin/AdminListToolbar';
import AdminPagination from '../../../components/admin/AdminPagination';
import AdminRefreshButton from '../../../components/admin/AdminRefreshButton';
import { AdminEmptyStateCard, AdminErrorCard, AdminRefreshingBanner } from '../../../components/admin/AdminAsyncState';
import { useAdminAppointments, useAdminDonations } from '../../../hooks/admin/useAdminQueries';
import { invalidateAdminRecipe } from '../../../utils/adminQueryInvalidation';
import { refetchQueries } from '../../../utils/queryRefetch';
import { runWithFeedback } from '../../../utils/runWithFeedback';

type AppointmentRow = {
  id: string;
  donorName: string;
  donorId?: string;
  hospitalId: string;
  bloodType: string;
  status: string;
  scheduledDate?: Date;
};

type DonationRow = {
  id: string;
  donorName: string;
  donorId?: string;
  hospitalId: string;
  bloodType: string;
  units: number;
  status: string;
  donationDate?: Date;
};

function AppointmentsDonationsPage() {
  const queryClient = useQueryClient();
  const [appointments, setAppointments] = useState<AppointmentRow[]>([]);
  const [donations, setDonations] = useState<DonationRow[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [appointmentPage, setAppointmentPage] = useState(1);
  const [donationPage, setDonationPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const appointmentsQuery = useAdminAppointments(1000);
  const donationsQuery = useAdminDonations(1000);
  const loading = appointmentsQuery.isLoading || donationsQuery.isLoading;
  const error = (appointmentsQuery.error || donationsQuery.error) instanceof Error
    ? ((appointmentsQuery.error || donationsQuery.error) as Error).message
    : null;

  useEffect(() => {
    const appointmentRows = (appointmentsQuery.data || []).map((entry) => ({
      id: entry.id || '',
      donorName: entry.donorName || 'Donor',
      donorId: entry.donorId,
      hospitalId: entry.hospitalId || '-',
      bloodType: entry.bloodType || '-',
      status: entry.status || 'scheduled',
      scheduledDate: toDateValue(entry.scheduledDate),
    })) as AppointmentRow[];
    setAppointments(appointmentRows.filter((entry) => Boolean(entry.id)));
  }, [appointmentsQuery.data]);

  useEffect(() => {
    const donationRows = (donationsQuery.data || []).map((entry) => ({
      id: entry.id || '',
      donorName: entry.donorName || 'Donor',
      donorId: entry.donorId,
      hospitalId: entry.hospitalId || '-',
      bloodType: entry.bloodType || '-',
      units: Number(entry.units || 0),
      status: entry.status || 'pending',
      donationDate: toDateValue(entry.donationDate),
    })) as DonationRow[];
    setDonations(donationRows.filter((entry) => Boolean(entry.id)));
  }, [donationsQuery.data]);

  useEffect(() => {
    setAppointmentPage(1);
    setDonationPage(1);
  }, [searchTerm, pageSize]);

  const appointmentFiltered = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    if (!term) return appointments;
    return appointments.filter((entry) => (
      `${entry.donorName} ${entry.donorId || ''} ${entry.hospitalId} ${entry.bloodType} ${entry.status}`.toLowerCase().includes(term)
    ));
  }, [appointments, searchTerm]);

  const donationFiltered = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    if (!term) return donations;
    return donations.filter((entry) => (
      `${entry.donorName} ${entry.donorId || ''} ${entry.hospitalId} ${entry.bloodType} ${entry.status}`.toLowerCase().includes(term)
    ));
  }, [donations, searchTerm]);

  const appointmentPaged = useMemo(() => {
    const start = (appointmentPage - 1) * pageSize;
    return appointmentFiltered.slice(start, start + pageSize);
  }, [appointmentFiltered, appointmentPage, pageSize]);

  const donationPaged = useMemo(() => {
    const start = (donationPage - 1) * pageSize;
    return donationFiltered.slice(start, start + pageSize);
  }, [donationFiltered, donationPage, pageSize]);

  const appointmentHasNext = appointmentPage * pageSize < appointmentFiltered.length;
  const donationHasNext = donationPage * pageSize < donationFiltered.length;

  const updateAppointmentStatus = async (id: string, status: 'confirmed' | 'completed' | 'cancelled') => {
    setProcessingId(id);
    await runWithFeedback({
      action: () => updateDoc(doc(db, 'appointments', id), { status, updatedAt: getServerTimestamp() }),
      successMessage: `Appointment marked ${status}`,
      errorMessage: 'Failed to update appointment status.',
      capture: { scope: 'admin', metadata: { kind: 'admin.appointment.status.update', status } },
      invalidate: () => invalidateAdminRecipe(queryClient, 'appointmentStatusUpdated'),
    });
    setProcessingId(null);
  };

  const updateDonationStatus = async (id: string, status: 'completed' | 'rejected' | 'pending') => {
    setProcessingId(id);
    await runWithFeedback({
      action: () => updateDoc(doc(db, 'donations', id), { status, updatedAt: getServerTimestamp() }),
      successMessage: `Donation marked ${status}`,
      errorMessage: 'Failed to update donation status.',
      capture: { scope: 'admin', metadata: { kind: 'admin.donation.status.update', status } },
      invalidate: () => invalidateAdminRecipe(queryClient, 'donationStatusUpdated'),
    });
    setProcessingId(null);
  };

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-red-100 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Appointments & Donations</h2>
            <p className="text-sm text-gray-600">Track operational donor appointments and donation outcomes.</p>
          </div>
          <AdminRefreshButton
            onClick={() => refetchQueries(appointmentsQuery, donationsQuery)}
            isRefreshing={appointmentsQuery.isFetching || donationsQuery.isFetching}
            label="Refresh appointments and donations"
          />
        </div>
      </div>

      <AdminListToolbar
        searchTerm={searchTerm}
        onSearchTermChange={setSearchTerm}
        searchPlaceholder="Search donor, hospital, blood type, or status"
        rightContent={<span className="text-xs font-semibold text-gray-500">Appointments {appointmentFiltered.length} • Donations {donationFiltered.length}</span>}
      />

      <AdminRefreshingBanner show={loading} message="Refreshing appointments and donations..." />
      <AdminErrorCard
        message={error}
        onRetry={() => refetchQueries(appointmentsQuery, donationsQuery)}
      />

      <>
          <section className="space-y-3">
            <h3 className="text-lg font-bold text-gray-900">Appointments</h3>
            {appointmentPaged.length === 0 ? (
              <AdminEmptyStateCard message="No appointments found." />
            ) : (
              <>
                <div className="space-y-3 lg:hidden">
                  {appointmentPaged.map((entry) => (
                    <article key={`mobile-appointment-${entry.id}`} className="rounded-2xl border border-red-100 bg-white p-4 shadow-sm">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="font-semibold text-gray-900">{entry.donorName}</p>
                          <p className="text-xs text-gray-500">{entry.donorId || 'No donor id'}</p>
                        </div>
                        <span className="rounded-full bg-gray-100 px-2 py-1 text-xs font-semibold capitalize text-gray-700">{entry.status}</span>
                      </div>
                      <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-gray-600">
                        <p>Hospital: <span className="font-semibold text-gray-800">{entry.hospitalId}</span></p>
                        <p>Blood: <span className="font-semibold text-red-700">{entry.bloodType}</span></p>
                        <p className="col-span-2">Scheduled: <span className="font-semibold text-gray-800">{entry.scheduledDate ? entry.scheduledDate.toLocaleString() : 'N/A'}</span></p>
                      </div>
                      <div className="mt-3 grid grid-cols-3 gap-2">
                        <button
                          type="button"
                          onClick={() => void updateAppointmentStatus(entry.id, 'confirmed')}
                          disabled={processingId === entry.id || entry.status === 'confirmed'}
                          className="rounded-md border border-red-200 px-2 py-2 text-xs font-semibold text-red-700 hover:bg-red-50 disabled:opacity-50"
                        >
                          Confirm
                        </button>
                        <button
                          type="button"
                          onClick={() => void updateAppointmentStatus(entry.id, 'completed')}
                          disabled={processingId === entry.id || entry.status === 'completed'}
                          className="rounded-md border border-emerald-200 px-2 py-2 text-xs font-semibold text-emerald-700 hover:bg-emerald-50 disabled:opacity-50"
                        >
                          Complete
                        </button>
                        <button
                          type="button"
                          onClick={() => void updateAppointmentStatus(entry.id, 'cancelled')}
                          disabled={processingId === entry.id || entry.status === 'cancelled'}
                          className="rounded-md border border-red-200 px-2 py-2 text-xs font-semibold text-red-700 hover:bg-red-50 disabled:opacity-50"
                        >
                          Cancel
                        </button>
                      </div>
                    </article>
                  ))}
                </div>

                <div className="hidden overflow-hidden rounded-2xl border border-red-100 bg-white shadow-sm lg:block">
                  <div className="overflow-x-auto">
                    <table className="min-w-full text-sm">
                      <thead className="bg-red-50 text-left text-xs uppercase tracking-[0.12em] text-red-800">
                        <tr>
                          <th className="px-4 py-3">Donor</th>
                          <th className="px-4 py-3">Hospital</th>
                          <th className="px-4 py-3">Blood</th>
                          <th className="px-4 py-3">Status</th>
                          <th className="px-4 py-3">Scheduled</th>
                          <th className="px-4 py-3 text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {appointmentPaged.map((entry) => (
                          <tr key={entry.id} className="hover:bg-red-50/40">
                            <td className="px-4 py-3">
                              <p className="font-semibold text-gray-900">{entry.donorName}</p>
                              <p className="text-xs text-gray-500">{entry.donorId || 'No donor id'}</p>
                            </td>
                            <td className="px-4 py-3 text-gray-700">{entry.hospitalId}</td>
                            <td className="px-4 py-3 text-red-700 font-semibold">{entry.bloodType}</td>
                            <td className="px-4 py-3 text-gray-700 capitalize">{entry.status}</td>
                            <td className="px-4 py-3 text-gray-600">{entry.scheduledDate ? entry.scheduledDate.toLocaleString() : 'N/A'}</td>
                            <td className="px-4 py-3">
                              <div className="flex items-center justify-end gap-1">
                                <button
                                  type="button"
                                  onClick={() => void updateAppointmentStatus(entry.id, 'confirmed')}
                                  disabled={processingId === entry.id || entry.status === 'confirmed'}
                                  className="rounded-md border border-red-200 px-2 py-1 text-xs font-semibold text-red-700 hover:bg-red-50 disabled:opacity-50"
                                >
                                  Confirm
                                </button>
                                <button
                                  type="button"
                                  onClick={() => void updateAppointmentStatus(entry.id, 'completed')}
                                  disabled={processingId === entry.id || entry.status === 'completed'}
                                  className="rounded-md border border-emerald-200 px-2 py-1 text-xs font-semibold text-emerald-700 hover:bg-emerald-50 disabled:opacity-50"
                                >
                                  Complete
                                </button>
                                <button
                                  type="button"
                                  onClick={() => void updateAppointmentStatus(entry.id, 'cancelled')}
                                  disabled={processingId === entry.id || entry.status === 'cancelled'}
                                  className="rounded-md border border-red-200 px-2 py-1 text-xs font-semibold text-red-700 hover:bg-red-50 disabled:opacity-50"
                                >
                                  Cancel
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </>
            )}

            <AdminPagination
              page={appointmentPage}
              pageSize={pageSize}
              itemCount={appointmentPaged.length}
              hasNextPage={appointmentHasNext}
              loading={loading}
              onPageChange={setAppointmentPage}
              onPageSizeChange={setPageSize}
            />
          </section>

          <section className="space-y-3">
            <h3 className="text-lg font-bold text-gray-900">Donations</h3>
            {donationPaged.length === 0 ? (
              <AdminEmptyStateCard message="No donations found." />
            ) : (
              <>
                <div className="space-y-3 lg:hidden">
                  {donationPaged.map((entry) => (
                    <article key={`mobile-donation-${entry.id}`} className="rounded-2xl border border-red-100 bg-white p-4 shadow-sm">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="font-semibold text-gray-900">{entry.donorName}</p>
                          <p className="text-xs text-gray-500">{entry.donorId || 'No donor id'}</p>
                        </div>
                        <span className="rounded-full bg-gray-100 px-2 py-1 text-xs font-semibold capitalize text-gray-700">{entry.status}</span>
                      </div>
                      <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-gray-600">
                        <p>Hospital: <span className="font-semibold text-gray-800">{entry.hospitalId}</span></p>
                        <p>Blood: <span className="font-semibold text-red-700">{entry.bloodType}</span></p>
                        <p>Units: <span className="font-semibold text-gray-800">{entry.units}</span></p>
                        <p>Date: <span className="font-semibold text-gray-800">{entry.donationDate ? entry.donationDate.toLocaleDateString() : 'N/A'}</span></p>
                      </div>
                      <div className="mt-3 grid grid-cols-3 gap-2">
                        <button
                          type="button"
                          onClick={() => void updateDonationStatus(entry.id, 'completed')}
                          disabled={processingId === entry.id || entry.status === 'completed'}
                          className="rounded-md border border-emerald-200 px-2 py-2 text-xs font-semibold text-emerald-700 hover:bg-emerald-50 disabled:opacity-50"
                        >
                          Complete
                        </button>
                        <button
                          type="button"
                          onClick={() => void updateDonationStatus(entry.id, 'pending')}
                          disabled={processingId === entry.id || entry.status === 'pending'}
                          className="rounded-md border border-red-200 px-2 py-2 text-xs font-semibold text-red-700 hover:bg-red-50 disabled:opacity-50"
                        >
                          Pending
                        </button>
                        <button
                          type="button"
                          onClick={() => void updateDonationStatus(entry.id, 'rejected')}
                          disabled={processingId === entry.id || entry.status === 'rejected'}
                          className="rounded-md border border-red-200 px-2 py-2 text-xs font-semibold text-red-700 hover:bg-red-50 disabled:opacity-50"
                        >
                          Reject
                        </button>
                      </div>
                    </article>
                  ))}
                </div>

                <div className="hidden overflow-hidden rounded-2xl border border-red-100 bg-white shadow-sm lg:block">
                  <div className="overflow-x-auto">
                    <table className="min-w-full text-sm">
                      <thead className="bg-red-50 text-left text-xs uppercase tracking-[0.12em] text-red-800">
                        <tr>
                          <th className="px-4 py-3">Donor</th>
                          <th className="px-4 py-3">Hospital</th>
                          <th className="px-4 py-3">Blood</th>
                          <th className="px-4 py-3">Units</th>
                          <th className="px-4 py-3">Status</th>
                          <th className="px-4 py-3">Date</th>
                          <th className="px-4 py-3 text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {donationPaged.map((entry) => (
                          <tr key={entry.id} className="hover:bg-red-50/40">
                            <td className="px-4 py-3">
                              <p className="font-semibold text-gray-900">{entry.donorName}</p>
                              <p className="text-xs text-gray-500">{entry.donorId || 'No donor id'}</p>
                            </td>
                            <td className="px-4 py-3 text-gray-700">{entry.hospitalId}</td>
                            <td className="px-4 py-3 text-red-700 font-semibold">{entry.bloodType}</td>
                            <td className="px-4 py-3 text-gray-700">{entry.units}</td>
                            <td className="px-4 py-3 text-gray-700 capitalize">{entry.status}</td>
                            <td className="px-4 py-3 text-gray-600">{entry.donationDate ? entry.donationDate.toLocaleDateString() : 'N/A'}</td>
                            <td className="px-4 py-3">
                              <div className="flex items-center justify-end gap-1">
                                <button
                                  type="button"
                                  onClick={() => void updateDonationStatus(entry.id, 'completed')}
                                  disabled={processingId === entry.id || entry.status === 'completed'}
                                  className="rounded-md border border-emerald-200 px-2 py-1 text-xs font-semibold text-emerald-700 hover:bg-emerald-50 disabled:opacity-50"
                                >
                                  Complete
                                </button>
                                <button
                                  type="button"
                                  onClick={() => void updateDonationStatus(entry.id, 'pending')}
                                  disabled={processingId === entry.id || entry.status === 'pending'}
                                  className="rounded-md border border-red-200 px-2 py-1 text-xs font-semibold text-red-700 hover:bg-red-50 disabled:opacity-50"
                                >
                                  Pending
                                </button>
                                <button
                                  type="button"
                                  onClick={() => void updateDonationStatus(entry.id, 'rejected')}
                                  disabled={processingId === entry.id || entry.status === 'rejected'}
                                  className="rounded-md border border-red-200 px-2 py-1 text-xs font-semibold text-red-700 hover:bg-red-50 disabled:opacity-50"
                                >
                                  Reject
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </>
            )}

            <AdminPagination
              page={donationPage}
              pageSize={pageSize}
              itemCount={donationPaged.length}
              hasNextPage={donationHasNext}
              loading={loading}
              onPageChange={setDonationPage}
              onPageSizeChange={setPageSize}
            />
          </section>
      </>
    </div>
  );
}

export default AppointmentsDonationsPage;
