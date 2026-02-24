import { useCallback, useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { doc, updateDoc, collection, getDocs, limit, query, orderBy } from 'firebase/firestore';
import { db } from '../../../firebase';
import { getServerTimestamp, timestampToDate } from '../../../utils/firestore.utils';
import AdminListToolbar from '../../../components/admin/AdminListToolbar';
import AdminPagination from '../../../components/admin/AdminPagination';

type VolunteerRow = {
  id: string;
  ngoId: string;
  userId?: string;
  name: string;
  role: string;
  status: string;
  hours: number;
  joinedAt?: Date;
};

type PartnershipRow = {
  id: string;
  ngoId: string;
  partnerId?: string;
  organization: string;
  type: string;
  status: string;
  since?: Date;
};

const toDate = (value: any): Date | undefined => {
  if (!value) return undefined;
  if (value instanceof Date) return value;
  if (typeof value?.toDate === 'function') return value.toDate();
  if (typeof value?.seconds === 'number') return new Date(value.seconds * 1000);
  return timestampToDate(value as any);
};

function VolunteersPartnershipsPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [volunteers, setVolunteers] = useState<VolunteerRow[]>([]);
  const [partnerships, setPartnerships] = useState<PartnershipRow[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [processingId, setProcessingId] = useState<string | null>(null);

  const [volunteerPage, setVolunteerPage] = useState(1);
  const [partnershipPage, setPartnershipPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [volunteerSnapshot, partnershipSnapshot] = await Promise.all([
        getDocs(query(collection(db, 'volunteers'), orderBy('createdAt', 'desc'), limit(1000))),
        getDocs(query(collection(db, 'partnerships'), orderBy('createdAt', 'desc'), limit(1000))),
      ]);

      const volunteerRows = volunteerSnapshot.docs.map((docSnap) => {
        const data = docSnap.data() as Record<string, any>;
        return {
          id: docSnap.id,
          ngoId: data.ngoId || '-',
          userId: data.userId,
          name: data.name || data.displayName || 'Volunteer',
          role: data.role || 'Volunteer',
          status: data.status || 'active',
          hours: Number(data.hoursContributed || 0),
          joinedAt: toDate(data.joinDate || data.joinedAt || data.createdAt),
        } as VolunteerRow;
      });

      const partnershipRows = partnershipSnapshot.docs.map((docSnap) => {
        const data = docSnap.data() as Record<string, any>;
        return {
          id: docSnap.id,
          ngoId: data.ngoId || '-',
          partnerId: data.partnerId,
          organization: data.partnerName || data.organization || data.name || 'Partner',
          type: data.partnerType || data.type || 'community',
          status: data.status || 'active',
          since: toDate(data.startDate || data.since || data.createdAt),
        } as PartnershipRow;
      });

      setVolunteers(volunteerRows);
      setPartnerships(partnershipRows);
    } catch (fetchError: any) {
      console.error('Failed to load volunteers/partnerships', fetchError);
      setError(fetchError?.message || 'Unable to load volunteers and partnerships.');
      setVolunteers([]);
      setPartnerships([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  useEffect(() => {
    setVolunteerPage(1);
    setPartnershipPage(1);
  }, [searchTerm, pageSize]);

  const volunteerFiltered = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    if (!term) return volunteers;
    return volunteers.filter((entry) => (
      `${entry.name} ${entry.role} ${entry.status} ${entry.ngoId} ${entry.userId || ''}`.toLowerCase().includes(term)
    ));
  }, [searchTerm, volunteers]);

  const partnershipFiltered = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    if (!term) return partnerships;
    return partnerships.filter((entry) => (
      `${entry.organization} ${entry.type} ${entry.status} ${entry.ngoId} ${entry.partnerId || ''}`.toLowerCase().includes(term)
    ));
  }, [searchTerm, partnerships]);

  const volunteerPaged = useMemo(() => {
    const start = (volunteerPage - 1) * pageSize;
    return volunteerFiltered.slice(start, start + pageSize);
  }, [volunteerFiltered, volunteerPage, pageSize]);

  const partnershipPaged = useMemo(() => {
    const start = (partnershipPage - 1) * pageSize;
    return partnershipFiltered.slice(start, start + pageSize);
  }, [partnershipFiltered, partnershipPage, pageSize]);

  const volunteerHasNext = volunteerPage * pageSize < volunteerFiltered.length;
  const partnershipHasNext = partnershipPage * pageSize < partnershipFiltered.length;

  const updateVolunteerStatus = async (id: string, status: 'active' | 'inactive') => {
    setProcessingId(id);
    try {
      await updateDoc(doc(db, 'volunteers', id), { status, updatedAt: getServerTimestamp() });
      toast.success(`Volunteer marked ${status}`);
      await loadData();
    } catch (updateError: any) {
      toast.error(updateError?.message || 'Failed to update volunteer status.');
    } finally {
      setProcessingId(null);
    }
  };

  const updatePartnershipStatus = async (id: string, status: 'active' | 'pending' | 'inactive') => {
    setProcessingId(id);
    try {
      await updateDoc(doc(db, 'partnerships', id), { status, updatedAt: getServerTimestamp() });
      toast.success(`Partnership marked ${status}`);
      await loadData();
    } catch (updateError: any) {
      toast.error(updateError?.message || 'Failed to update partnership status.');
    } finally {
      setProcessingId(null);
    }
  };

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-red-100 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Volunteers & Partnerships</h2>
            <p className="text-sm text-gray-600">Manage volunteer workforce and NGO partnership lifecycle.</p>
          </div>
          <button
            type="button"
            onClick={loadData}
            className="rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm font-semibold text-red-700 hover:bg-red-100"
          >
            Refresh
          </button>
        </div>
      </div>

      <AdminListToolbar
        searchTerm={searchTerm}
        onSearchTermChange={setSearchTerm}
        searchPlaceholder="Search volunteers and partnerships"
        rightContent={<span className="text-xs font-semibold text-gray-500">Volunteers {volunteerFiltered.length} • Partnerships {partnershipFiltered.length}</span>}
      />

      {loading ? (
        <div className="rounded-2xl border border-red-100 bg-white p-8 text-center text-gray-500 shadow-sm">Loading volunteers and partnerships...</div>
      ) : error ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-center text-red-700">{error}</div>
      ) : (
        <>
          <section className="space-y-3">
            <h3 className="text-lg font-bold text-gray-900">Volunteers</h3>
            {volunteerPaged.length === 0 ? (
              <div className="rounded-2xl border border-red-100 bg-white p-8 text-center text-gray-500 shadow-sm">No volunteers found.</div>
            ) : (
              <>
                <div className="space-y-3 lg:hidden">
                  {volunteerPaged.map((entry) => (
                    <article key={`mobile-vol-${entry.id}`} className="rounded-2xl border border-red-100 bg-white p-4 shadow-sm">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="font-semibold text-gray-900">{entry.name}</p>
                          <p className="text-xs text-gray-500">{entry.userId || 'No linked user'}</p>
                        </div>
                        <span className="rounded-full bg-gray-100 px-2 py-1 text-xs font-semibold capitalize text-gray-700">{entry.status}</span>
                      </div>
                      <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-gray-600">
                        <p>NGO: <span className="font-semibold text-gray-800">{entry.ngoId}</span></p>
                        <p>Role: <span className="font-semibold text-gray-800">{entry.role}</span></p>
                        <p>Hours: <span className="font-semibold text-gray-800">{entry.hours}</span></p>
                        <p>Joined: <span className="font-semibold text-gray-800">{entry.joinedAt ? entry.joinedAt.toLocaleDateString() : 'N/A'}</span></p>
                      </div>
                      <div className="mt-3 grid grid-cols-2 gap-2">
                        <button
                          type="button"
                          onClick={() => void updateVolunteerStatus(entry.id, 'active')}
                          disabled={processingId === entry.id || entry.status === 'active'}
                          className="rounded-md border border-emerald-200 px-2 py-2 text-xs font-semibold text-emerald-700 hover:bg-emerald-50 disabled:opacity-50"
                        >
                          Activate
                        </button>
                        <button
                          type="button"
                          onClick={() => void updateVolunteerStatus(entry.id, 'inactive')}
                          disabled={processingId === entry.id || entry.status === 'inactive'}
                          className="rounded-md border border-red-200 px-2 py-2 text-xs font-semibold text-red-700 hover:bg-red-50 disabled:opacity-50"
                        >
                          Inactivate
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
                          <th className="px-4 py-3">Volunteer</th>
                          <th className="px-4 py-3">NGO</th>
                          <th className="px-4 py-3">Role</th>
                          <th className="px-4 py-3">Hours</th>
                          <th className="px-4 py-3">Status</th>
                          <th className="px-4 py-3">Joined</th>
                          <th className="px-4 py-3 text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {volunteerPaged.map((entry) => (
                          <tr key={entry.id} className="hover:bg-red-50/40">
                            <td className="px-4 py-3">
                              <p className="font-semibold text-gray-900">{entry.name}</p>
                              <p className="text-xs text-gray-500">{entry.userId || 'No linked user'}</p>
                            </td>
                            <td className="px-4 py-3 text-gray-700">{entry.ngoId}</td>
                            <td className="px-4 py-3 text-gray-700">{entry.role}</td>
                            <td className="px-4 py-3 text-gray-700">{entry.hours}</td>
                            <td className="px-4 py-3 text-gray-700 capitalize">{entry.status}</td>
                            <td className="px-4 py-3 text-gray-600">{entry.joinedAt ? entry.joinedAt.toLocaleDateString() : 'N/A'}</td>
                            <td className="px-4 py-3">
                              <div className="flex items-center justify-end gap-1">
                                <button
                                  type="button"
                                  onClick={() => void updateVolunteerStatus(entry.id, 'active')}
                                  disabled={processingId === entry.id || entry.status === 'active'}
                                  className="rounded-md border border-emerald-200 px-2 py-1 text-xs font-semibold text-emerald-700 hover:bg-emerald-50 disabled:opacity-50"
                                >
                                  Activate
                                </button>
                                <button
                                  type="button"
                                  onClick={() => void updateVolunteerStatus(entry.id, 'inactive')}
                                  disabled={processingId === entry.id || entry.status === 'inactive'}
                                  className="rounded-md border border-red-200 px-2 py-1 text-xs font-semibold text-red-700 hover:bg-red-50 disabled:opacity-50"
                                >
                                  Inactivate
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
              page={volunteerPage}
              pageSize={pageSize}
              itemCount={volunteerPaged.length}
              hasNextPage={volunteerHasNext}
              loading={loading}
              onPageChange={setVolunteerPage}
              onPageSizeChange={setPageSize}
            />
          </section>

          <section className="space-y-3">
            <h3 className="text-lg font-bold text-gray-900">Partnerships</h3>
            {partnershipPaged.length === 0 ? (
              <div className="rounded-2xl border border-red-100 bg-white p-8 text-center text-gray-500 shadow-sm">No partnerships found.</div>
            ) : (
              <>
                <div className="space-y-3 lg:hidden">
                  {partnershipPaged.map((entry) => (
                    <article key={`mobile-partner-${entry.id}`} className="rounded-2xl border border-red-100 bg-white p-4 shadow-sm">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="font-semibold text-gray-900">{entry.organization}</p>
                          <p className="text-xs text-gray-500">{entry.partnerId || 'No partner id'}</p>
                        </div>
                        <span className="rounded-full bg-gray-100 px-2 py-1 text-xs font-semibold capitalize text-gray-700">{entry.status}</span>
                      </div>
                      <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-gray-600">
                        <p>NGO: <span className="font-semibold text-gray-800">{entry.ngoId}</span></p>
                        <p>Type: <span className="font-semibold text-gray-800 capitalize">{entry.type}</span></p>
                        <p className="col-span-2">Since: <span className="font-semibold text-gray-800">{entry.since ? entry.since.toLocaleDateString() : 'N/A'}</span></p>
                      </div>
                      <div className="mt-3 grid grid-cols-3 gap-2">
                        <button
                          type="button"
                          onClick={() => void updatePartnershipStatus(entry.id, 'active')}
                          disabled={processingId === entry.id || entry.status === 'active'}
                          className="rounded-md border border-emerald-200 px-2 py-2 text-xs font-semibold text-emerald-700 hover:bg-emerald-50 disabled:opacity-50"
                        >
                          Active
                        </button>
                        <button
                          type="button"
                          onClick={() => void updatePartnershipStatus(entry.id, 'pending')}
                          disabled={processingId === entry.id || entry.status === 'pending'}
                          className="rounded-md border border-amber-200 px-2 py-2 text-xs font-semibold text-amber-700 hover:bg-amber-50 disabled:opacity-50"
                        >
                          Pending
                        </button>
                        <button
                          type="button"
                          onClick={() => void updatePartnershipStatus(entry.id, 'inactive')}
                          disabled={processingId === entry.id || entry.status === 'inactive'}
                          className="rounded-md border border-red-200 px-2 py-2 text-xs font-semibold text-red-700 hover:bg-red-50 disabled:opacity-50"
                        >
                          Inactive
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
                          <th className="px-4 py-3">Organization</th>
                          <th className="px-4 py-3">NGO</th>
                          <th className="px-4 py-3">Type</th>
                          <th className="px-4 py-3">Status</th>
                          <th className="px-4 py-3">Since</th>
                          <th className="px-4 py-3 text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {partnershipPaged.map((entry) => (
                          <tr key={entry.id} className="hover:bg-red-50/40">
                            <td className="px-4 py-3">
                              <p className="font-semibold text-gray-900">{entry.organization}</p>
                              <p className="text-xs text-gray-500">{entry.partnerId || 'No partner id'}</p>
                            </td>
                            <td className="px-4 py-3 text-gray-700">{entry.ngoId}</td>
                            <td className="px-4 py-3 text-gray-700 capitalize">{entry.type}</td>
                            <td className="px-4 py-3 text-gray-700 capitalize">{entry.status}</td>
                            <td className="px-4 py-3 text-gray-600">{entry.since ? entry.since.toLocaleDateString() : 'N/A'}</td>
                            <td className="px-4 py-3">
                              <div className="flex items-center justify-end gap-1">
                                <button
                                  type="button"
                                  onClick={() => void updatePartnershipStatus(entry.id, 'active')}
                                  disabled={processingId === entry.id || entry.status === 'active'}
                                  className="rounded-md border border-emerald-200 px-2 py-1 text-xs font-semibold text-emerald-700 hover:bg-emerald-50 disabled:opacity-50"
                                >
                                  Active
                                </button>
                                <button
                                  type="button"
                                  onClick={() => void updatePartnershipStatus(entry.id, 'pending')}
                                  disabled={processingId === entry.id || entry.status === 'pending'}
                                  className="rounded-md border border-amber-200 px-2 py-1 text-xs font-semibold text-amber-700 hover:bg-amber-50 disabled:opacity-50"
                                >
                                  Pending
                                </button>
                                <button
                                  type="button"
                                  onClick={() => void updatePartnershipStatus(entry.id, 'inactive')}
                                  disabled={processingId === entry.id || entry.status === 'inactive'}
                                  className="rounded-md border border-red-200 px-2 py-1 text-xs font-semibold text-red-700 hover:bg-red-50 disabled:opacity-50"
                                >
                                  Inactive
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
              page={partnershipPage}
              pageSize={pageSize}
              itemCount={partnershipPaged.length}
              hasNextPage={partnershipHasNext}
              loading={loading}
              onPageChange={setPartnershipPage}
              onPageSizeChange={setPageSize}
            />
          </section>
        </>
      )}
    </div>
  );
}

export default VolunteersPartnershipsPage;
