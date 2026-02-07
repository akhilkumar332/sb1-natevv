import { useEffect, useMemo, useState } from 'react';
import { Link, useOutletContext, useSearchParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { Handshake, Plus, X } from 'lucide-react';
import { Timestamp } from 'firebase/firestore';
import type { NgoDashboardContext } from '../NgoDashboard';
import { createPartnership, updatePartnership, archivePartnership, deletePartnership } from '../../../services/ngo.service';

const emptyForm = {
  partnerName: '',
  partnerType: 'corporate',
  status: 'active',
  startDate: '',
  endDate: '',
  contactPerson: '',
  contactEmail: '',
  contactPhone: '',
  terms: '',
};

function makePartnerId(name: string) {
  const slug = name.trim().toLowerCase().replace(/\s+/g, '-');
  return slug ? `partner_${slug}_${Date.now()}` : `partner_${Date.now()}`;
}

function NgoPartnerships() {
  const { partnerships, getPartnershipIcon, getStatusColor, user, refreshData } = useOutletContext<NgoDashboardContext>();
  const [searchParams, setSearchParams] = useSearchParams();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingPartnershipId, setEditingPartnershipId] = useState<string | null>(null);
  const [form, setForm] = useState({ ...emptyForm });
  const [saving, setSaving] = useState(false);
  const [deleteCandidate, setDeleteCandidate] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [statusTab, setStatusTab] = useState<'active' | 'archived' | 'all'>('active');

  const activeCount = useMemo(
    () => partnerships.filter((partner) => partner.status !== 'inactive').length,
    [partnerships]
  );
  const archivedCount = useMemo(
    () => partnerships.filter((partner) => partner.status === 'inactive').length,
    [partnerships]
  );
  const filteredPartnerships = useMemo(() => {
    if (statusTab === 'archived') {
      return partnerships.filter((partner) => partner.status === 'inactive');
    }
    if (statusTab === 'active') {
      return partnerships.filter((partner) => partner.status !== 'inactive');
    }
    return partnerships;
  }, [partnerships, statusTab]);

  const openCreate = () => {
    setEditingPartnershipId(null);
    setForm({ ...emptyForm });
    setIsModalOpen(true);
  };

  useEffect(() => {
    const editId = searchParams.get('edit');
    if (editId && !isModalOpen) {
      const found = partnerships.some((partner) => partner.id === editId);
      if (found) {
        openEdit(editId);
        setSearchParams({});
      }
    }
  }, [searchParams, partnerships, isModalOpen, setSearchParams]);

  const openEdit = (partnershipId: string) => {
    const partnership = partnerships.find((item) => item.id === partnershipId);
    if (!partnership) return;
    setEditingPartnershipId(partnershipId);
    setForm({
      partnerName: partnership.organization,
      partnerType: partnership.type,
      status: partnership.status,
      startDate: partnership.since ? partnership.since.toISOString().split('T')[0] : '',
      endDate: '',
      contactPerson: partnership.contactPerson || '',
      contactEmail: partnership.contactEmail || '',
      contactPhone: partnership.contactPhone || '',
      terms: '',
    });
    setIsModalOpen(true);
  };

  const closeModal = () => {
    if (saving) return;
    setIsModalOpen(false);
    setEditingPartnershipId(null);
    setForm({ ...emptyForm });
  };

  const handleChange = (event: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = event.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };


  const handleArchive = async (partnershipId: string) => {
    try {
      await archivePartnership(partnershipId);
      toast.success('Partnership archived.');
      await refreshData();
    } catch (error: any) {
      toast.error(error?.message || 'Failed to archive partnership.');
    }
  };

  const handleDelete = async (partnershipId: string) => {
    setDeletingId(partnershipId);
    try {
      await deletePartnership(partnershipId);
      toast.success('Partnership deleted.');
      await refreshData();
      setDeleteCandidate(null);
    } catch (error: any) {
      toast.error(error?.message || 'Failed to delete partnership.');
    } finally {
      setDeletingId(null);
    }
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!user) {
      toast.error('You must be logged in to manage partnerships.');
      return;
    }

    if (!form.partnerName || !form.startDate) {
      toast.error('Please fill out the required fields.');
      return;
    }

    setSaving(true);
    try {
      const payload = {
        ngoId: user.uid,
        ngoName: user.organizationName || user.displayName || 'NGO',
        partnerId: makePartnerId(form.partnerName),
        partnerName: form.partnerName,
        partnerType: form.partnerType as any,
        status: form.status as any,
        startDate: Timestamp.fromDate(new Date(form.startDate)),
        endDate: form.endDate ? Timestamp.fromDate(new Date(form.endDate)) : undefined,
        termsOfAgreement: form.terms,
        totalDonations: 0,
        totalCampaigns: 0,
        totalFundsContributed: 0,
        contactPerson: form.contactPerson,
        contactEmail: form.contactEmail,
        contactPhone: form.contactPhone,
      };

      if (editingPartnershipId) {
        const { totalDonations, totalCampaigns, totalFundsContributed, partnerId, ...updatePayload } = payload;
        await updatePartnership(editingPartnershipId, updatePayload);
        toast.success('Partnership updated successfully.');
        await refreshData();
      } else {
        await createPartnership(payload);
        toast.success('Partnership created successfully.');
        await refreshData();
      }

      closeModal();
    } catch (error: any) {
      toast.error(error?.message || 'Failed to save partnership.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <div className="space-y-6">
      <div className="bg-white rounded-2xl shadow-xl p-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-red-600">Partnerships</p>
            <h2 className="text-2xl font-bold text-gray-900">Partner organizations</h2>
            <p className="text-sm text-gray-500 mt-1">Grow your collaboration network.</p>
          </div>
          <button
            className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-red-600 to-amber-600 px-5 py-3 text-sm font-semibold text-white shadow-lg hover:from-red-700 hover:to-amber-700"
            onClick={openCreate}
          >
            <Plus className="w-5 h-5" />
            Add Partner
          </button>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-xl p-6">
        <div className="flex flex-wrap items-center gap-2 mb-4">
          {[
            { id: 'active', label: `Active (${activeCount})` },
            { id: 'archived', label: `Archived (${archivedCount})` },
            { id: 'all', label: `All (${partnerships.length})` },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setStatusTab(tab.id as 'active' | 'archived' | 'all')}
              className={`rounded-full px-4 py-1.5 text-xs font-semibold border ${
                statusTab === tab.id
                  ? 'bg-red-600 text-white border-red-600'
                  : 'border-gray-200 text-gray-600 hover:bg-gray-50'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {filteredPartnerships.length === 0 ? (
        <div className="bg-white rounded-2xl shadow-xl p-10 text-center">
          <Handshake className="w-12 h-12 text-red-200 mx-auto mb-3" />
          <h3 className="text-xl font-semibold text-gray-900 mb-2">No partners found</h3>
          <p className="text-gray-600">Try a different filter or add a new partner.</p>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {filteredPartnerships.map((partner) => (
            <div key={partner.id} className="bg-white rounded-2xl shadow-xl p-6">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-2xl bg-red-100 text-red-600 flex items-center justify-center">
                    {getPartnershipIcon(partner.type)}
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900">{partner.organization}</h3>
                    <p className="text-xs text-gray-500 capitalize">{partner.type}</p>
                  </div>
                </div>
                <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${getStatusColor(partner.status)}`}>
                  {partner.status}
                </span>
              </div>

              <div className="mt-4 space-y-2 text-sm text-gray-600">
                <div className="flex items-center justify-between">
                  <span>Partner since</span>
                  <span className="font-semibold text-gray-900">{partner.since.toLocaleDateString()}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span>Total donations</span>
                  <span className="font-semibold text-amber-600">{partner.donations} units</span>
                </div>
              </div>

              <div className="mt-5 flex flex-wrap gap-2">
                <Link
                  to={`/ngo/dashboard/partnerships/${partner.id}`}
                  className="flex-1 rounded-xl bg-red-600 text-white py-2 text-sm font-semibold hover:bg-red-700 text-center"
                >
                  View
                </Link>
                <button
                  className="flex-1 rounded-xl border border-amber-200 text-amber-700 py-2 text-sm font-semibold hover:bg-amber-50"
                  onClick={() => openEdit(partner.id)}
                >
                  Edit
                </button>
                {partner.status === 'inactive' ? (
                  <span className="flex-1 rounded-xl border border-gray-200 text-gray-400 py-2 text-sm font-semibold text-center">
                    Archived
                  </span>
                ) : (
                  <button
                    className="flex-1 rounded-xl border border-gray-200 text-gray-600 py-2 text-sm font-semibold hover:bg-gray-50"
                    onClick={() => handleArchive(partner.id)}
                  >
                    Archive
                  </button>
                )}
                <button
                  className="flex-1 rounded-xl border border-red-200 text-red-600 py-2 text-sm font-semibold hover:bg-red-50"
                  onClick={() => setDeleteCandidate(partner.id)}
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white w-full max-w-2xl rounded-2xl shadow-2xl">
            <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4">
              <h3 className="text-lg font-bold text-gray-900">
                {editingPartnershipId ? 'Edit Partnership' : 'Add Partnership'}
              </h3>
              <button
                type="button"
                onClick={closeModal}
                className="rounded-full p-2 hover:bg-gray-100"
                aria-label="Close"
              >
                <X className="w-5 h-5 text-gray-600" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="text-sm font-semibold text-gray-700">Partner name *</label>
                  <input
                    name="partnerName"
                    value={form.partnerName}
                    onChange={handleChange}
                    className="mt-2 w-full rounded-xl border border-gray-200 px-3 py-2.5 focus:ring-2 focus:ring-amber-500 focus:border-transparent"
                    required
                  />
                </div>
                <div>
                  <label className="text-sm font-semibold text-gray-700">Partner type</label>
                  <select
                    name="partnerType"
                    value={form.partnerType}
                    onChange={handleChange}
                    className="mt-2 w-full rounded-xl border border-gray-200 px-3 py-2.5 focus:ring-2 focus:ring-amber-500 focus:border-transparent"
                  >
                    <option value="hospital">Hospital</option>
                    <option value="corporate">Corporate</option>
                    <option value="community">Community</option>
                    <option value="government">Government</option>
                  </select>
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-3">
                <div>
                  <label className="text-sm font-semibold text-gray-700">Status</label>
                  <select
                    name="status"
                    value={form.status}
                    onChange={handleChange}
                    className="mt-2 w-full rounded-xl border border-gray-200 px-3 py-2.5 focus:ring-2 focus:ring-amber-500 focus:border-transparent"
                  >
                    <option value="active">Active</option>
                    <option value="pending">Pending</option>
                    <option value="inactive">Inactive</option>
                  </select>
                </div>
                <div>
                  <label className="text-sm font-semibold text-gray-700">Start date *</label>
                  <input
                    name="startDate"
                    type="date"
                    value={form.startDate}
                    onChange={handleChange}
                    className="mt-2 w-full rounded-xl border border-gray-200 px-3 py-2.5 focus:ring-2 focus:ring-amber-500 focus:border-transparent"
                    required
                  />
                </div>
                <div>
                  <label className="text-sm font-semibold text-gray-700">End date</label>
                  <input
                    name="endDate"
                    type="date"
                    value={form.endDate}
                    onChange={handleChange}
                    className="mt-2 w-full rounded-xl border border-gray-200 px-3 py-2.5 focus:ring-2 focus:ring-amber-500 focus:border-transparent"
                  />
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="text-sm font-semibold text-gray-700">Contact person</label>
                  <input
                    name="contactPerson"
                    value={form.contactPerson}
                    onChange={handleChange}
                    className="mt-2 w-full rounded-xl border border-gray-200 px-3 py-2.5 focus:ring-2 focus:ring-amber-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="text-sm font-semibold text-gray-700">Contact email</label>
                  <input
                    name="contactEmail"
                    type="email"
                    value={form.contactEmail}
                    onChange={handleChange}
                    className="mt-2 w-full rounded-xl border border-gray-200 px-3 py-2.5 focus:ring-2 focus:ring-amber-500 focus:border-transparent"
                  />
                </div>
              </div>

              <div>
                <label className="text-sm font-semibold text-gray-700">Contact phone</label>
                <input
                  name="contactPhone"
                  value={form.contactPhone}
                  onChange={handleChange}
                  className="mt-2 w-full rounded-xl border border-gray-200 px-3 py-2.5 focus:ring-2 focus:ring-amber-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="text-sm font-semibold text-gray-700">Terms of agreement</label>
                <textarea
                  name="terms"
                  value={form.terms}
                  onChange={handleChange}
                  rows={3}
                  className="mt-2 w-full rounded-xl border border-gray-200 px-3 py-2.5 focus:ring-2 focus:ring-amber-500 focus:border-transparent"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-100">
                <button
                  type="button"
                  onClick={closeModal}
                  className="rounded-xl border border-gray-200 px-4 py-2 text-sm font-semibold text-gray-600 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="rounded-xl bg-gradient-to-r from-red-600 to-amber-600 px-5 py-2 text-sm font-semibold text-white disabled:opacity-60"
                >
                  {saving ? 'Saving...' : 'Save Partnership'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      </div>

      {deleteCandidate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
            <h3 className="text-lg font-bold text-gray-900">Delete partnership?</h3>
            <p className="mt-2 text-sm text-gray-600">
              This will permanently remove the partnership record.
            </p>
            <div className="mt-4 flex flex-col gap-2 sm:flex-row">
              <button
                type="button"
                onClick={() => handleDelete(deleteCandidate!)}
                disabled={deletingId === deleteCandidate}
                className="flex-1 rounded-xl bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-60"
              >
                {deletingId === deleteCandidate ? 'Deleting...' : 'Delete'}
              </button>
              <button
                type="button"
                onClick={() => setDeleteCandidate(null)}
                className="flex-1 rounded-xl border border-gray-200 px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export default NgoPartnerships;
