import { useMemo, useState } from 'react';
import { Link, useOutletContext, useParams } from 'react-router-dom';
import { notify } from 'services/notify.service';
import {
  ArrowLeft,
  Archive,
  Edit3,
  Handshake,
  Mail,
  Phone,
  Trash2,
  X,
} from 'lucide-react';
import { Timestamp } from 'firebase/firestore';
import type { NgoDashboardContext } from '../NgoDashboard';
import { archivePartnership, deletePartnership, updatePartnership } from '../../../services/ngo.service';

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

function NgoPartnershipDetail() {
  const { partnershipId } = useParams();
  const { partnerships, getStatusColor, refreshData, user } = useOutletContext<NgoDashboardContext>();
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ ...emptyForm });

  const partnership = useMemo(
    () => partnerships.find((item) => item.id === partnershipId),
    [partnerships, partnershipId]
  );

  if (!partnership) {
    return (
      <div className="bg-white rounded-2xl shadow-xl p-6">
        <h2 className="text-2xl font-bold text-gray-900">Partnership not found</h2>
        <p className="text-gray-500 mt-2">Return to the partnerships list.</p>
        <Link
          to="/ngo/dashboard/partnerships"
          className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-red-600"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to partnerships
        </Link>
      </div>
    );
  }

  const handleArchive = async () => {
    try {
      await archivePartnership(partnership.id);
      notify.success('Partnership archived.');
      await refreshData();
    } catch (error: any) {
      notify.error(error?.message || 'Failed to archive partnership.');
    }
  };

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await deletePartnership(partnership.id);
      notify.success('Partnership deleted.');
      await refreshData();
    } catch (error: any) {
      notify.error(error?.message || 'Failed to delete partnership.');
    } finally {
      setDeleting(false);
      setDeleteOpen(false);
    }
  };

  const openEdit = () => {
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
    setIsEditOpen(true);
  };

  const closeEdit = () => {
    if (saving) return;
    setIsEditOpen(false);
    setForm({ ...emptyForm });
  };

  const handleChange = (event: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = event.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleUpdate = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!form.partnerName || !form.startDate) {
      notify.error('Please fill out the required fields.');
      return;
    }

    setSaving(true);
    try {
      const payload: Record<string, any> = {
        partnerName: form.partnerName,
        partnerType: form.partnerType as any,
        status: form.status as any,
        startDate: Timestamp.fromDate(new Date(form.startDate)),
        endDate: form.endDate ? Timestamp.fromDate(new Date(form.endDate)) : undefined,
        termsOfAgreement: form.terms,
        contactPerson: form.contactPerson,
        contactEmail: form.contactEmail,
        contactPhone: form.contactPhone,
      };
      if (user?.uid) {
        payload.ngoId = user.uid;
        payload.ngoName = user.organizationName || user.displayName || 'NGO';
      }

      await updatePartnership(partnership.id, payload);
      notify.success('Partnership updated successfully.');
      await refreshData();
      closeEdit();
    } catch (error: any) {
      notify.error(error?.message || 'Failed to update partnership.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-2xl shadow-xl p-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <Link
              to="/ngo/dashboard/partnerships"
              className="inline-flex items-center gap-2 text-sm font-semibold text-gray-500 hover:text-gray-700"
            >
              <ArrowLeft className="w-4 h-4" />
              Back to partnerships
            </Link>
            <h2 className="text-2xl font-bold text-gray-900 mt-2">{partnership.organization}</h2>
            <p className="text-sm text-gray-500 mt-1 capitalize">{partnership.type} partner</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className={`px-3 py-1 rounded-full text-xs font-semibold ${getStatusColor(partnership.status)}`}>
              {partnership.status}
            </span>
            <button
              type="button"
              onClick={openEdit}
              className="inline-flex items-center gap-2 rounded-xl bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700"
            >
              <Edit3 className="w-4 h-4" />
              Edit
            </button>
            {partnership.status === 'inactive' ? (
              <span className="inline-flex items-center gap-2 rounded-xl border border-gray-200 px-4 py-2 text-sm font-semibold text-gray-400">
                <Archive className="w-4 h-4" />
                Archived
              </span>
            ) : (
              <button
                type="button"
                onClick={handleArchive}
                className="inline-flex items-center gap-2 rounded-xl border border-gray-200 px-4 py-2 text-sm font-semibold text-gray-600 hover:bg-gray-50"
              >
                <Archive className="w-4 h-4" />
                Archive
              </button>
            )}
            <button
              type="button"
              onClick={() => setDeleteOpen(true)}
              className="inline-flex items-center gap-2 rounded-xl border border-red-200 px-4 py-2 text-sm font-semibold text-red-600 hover:bg-red-50"
            >
              <Trash2 className="w-4 h-4" />
              Delete
            </button>
          </div>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <div className="bg-white rounded-2xl shadow-xl p-6 space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-red-100 flex items-center justify-center">
              <Handshake className="w-6 h-6 text-red-600" />
            </div>
            <div>
              <p className="text-sm font-semibold text-gray-900">{partnership.organization}</p>
              <p className="text-xs text-gray-500">Partner since {partnership.since.toLocaleDateString()}</p>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="border border-gray-100 rounded-xl p-4">
              <p className="text-xs text-gray-500">Total donations</p>
              <p className="text-lg font-semibold text-gray-900">{partnership.donations} units</p>
            </div>
            <div className="border border-gray-100 rounded-xl p-4">
              <p className="text-xs text-gray-500">Partner type</p>
              <p className="text-lg font-semibold text-gray-900 capitalize">{partnership.type}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-xl p-6 space-y-4">
          <div className="flex items-center gap-2 text-sm font-semibold text-gray-900">
            <Handshake className="w-5 h-5 text-amber-500" />
            Contact details
          </div>
          <div className="space-y-3 text-sm text-gray-600">
            <div className="flex items-center gap-2">
              <Mail className="w-4 h-4 text-amber-500" />
              {partnership.contactEmail || 'Email not provided'}
            </div>
            <div className="flex items-center gap-2">
              <Phone className="w-4 h-4 text-amber-500" />
              {partnership.contactPhone || 'Phone not provided'}
            </div>
          </div>
        </div>
      </div>

      {deleteOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
            <h3 className="text-lg font-bold text-gray-900">Delete partnership?</h3>
            <p className="mt-2 text-sm text-gray-600">
              This will permanently remove the partnership record.
            </p>
            <div className="mt-4 flex flex-col gap-2 sm:flex-row">
              <button
                type="button"
                onClick={handleDelete}
                disabled={deleting}
                className="flex-1 rounded-xl bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-60"
              >
                {deleting ? 'Deleting...' : 'Delete'}
              </button>
              <button
                type="button"
                onClick={() => setDeleteOpen(false)}
                className="flex-1 rounded-xl border border-gray-200 px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {isEditOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white w-full max-w-2xl rounded-2xl shadow-2xl max-h-[90vh] flex flex-col overflow-hidden">
            <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4 bg-white">
              <h3 className="text-lg font-bold text-gray-900">Edit Partnership</h3>
              <button
                type="button"
                onClick={closeEdit}
                className="rounded-full p-2 hover:bg-gray-100"
                aria-label="Close"
              >
                <X className="w-5 h-5 text-gray-600" />
              </button>
            </div>

            <form onSubmit={handleUpdate} className="p-6 space-y-4 overflow-y-auto min-h-0 flex-1">
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
                    <option value="bloodbank">BloodBank</option>
                    <option value="hospital">Hospital (Legacy)</option>
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
                  onClick={closeEdit}
                  className="rounded-xl border border-gray-200 px-4 py-2 text-sm font-semibold text-gray-600 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="rounded-xl bg-gradient-to-r from-red-600 to-amber-600 px-5 py-2 text-sm font-semibold text-white disabled:opacity-60"
                >
                  {saving ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default NgoPartnershipDetail;
