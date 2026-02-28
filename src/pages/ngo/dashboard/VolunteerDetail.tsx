import { useMemo, useState } from 'react';
import { Link, useOutletContext, useParams } from 'react-router-dom';
import { notify } from 'services/notify.service';
import {
  ArrowLeft,
  Archive,
  Edit3,
  Mail,
  Phone,
  Shield,
  Trash2,
  User,
  X,
} from 'lucide-react';
import { Timestamp } from 'firebase/firestore';
import type { NgoDashboardContext } from '../NgoDashboard';
import { archiveVolunteer, deleteVolunteer, updateVolunteer } from '../../../services/ngo.service';

const emptyForm = {
  name: '',
  email: '',
  phone: '',
  role: 'general',
  status: 'active',
  joinedAt: '',
  skills: '',
  availability: '',
};

function NgoVolunteerDetail() {
  const { volunteerId } = useParams();
  const { volunteers, getStatusColor, refreshData } = useOutletContext<NgoDashboardContext>();
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ ...emptyForm });

  const notifyNgoVolunteerDetailError = (
    error: unknown,
    fallbackMessage: string,
    toastId: string,
    kind: string
  ) => notify.fromError(
    error,
    fallbackMessage,
    { id: toastId },
    {
      source: 'frontend',
      scope: 'ngo',
      metadata: { page: 'NgoVolunteerDetail', kind },
    }
  );

  const volunteer = useMemo(
    () => volunteers.find((item) => item.id === volunteerId),
    [volunteers, volunteerId]
  );

  if (!volunteer) {
    return (
      <div className="bg-white rounded-2xl shadow-xl p-6">
        <h2 className="text-2xl font-bold text-gray-900">Volunteer not found</h2>
        <p className="text-gray-500 mt-2">Return to the volunteer list.</p>
        <Link
          to="/ngo/dashboard/volunteers"
          className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-red-600"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to volunteers
        </Link>
      </div>
    );
  }

  const handleArchive = async () => {
    try {
      await archiveVolunteer(volunteer.id);
      notify.success('Volunteer archived.');
      await refreshData();
    } catch (error: unknown) {
      notifyNgoVolunteerDetailError(
        error,
        'Failed to archive volunteer.',
        'ngo-volunteer-detail-archive-error',
        'ngo.volunteerDetail.archive'
      );
    }
  };

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await deleteVolunteer(volunteer.id);
      notify.success('Volunteer deleted.');
      await refreshData();
    } catch (error: unknown) {
      notifyNgoVolunteerDetailError(
        error,
        'Failed to delete volunteer.',
        'ngo-volunteer-detail-delete-error',
        'ngo.volunteerDetail.delete'
      );
    } finally {
      setDeleting(false);
      setDeleteOpen(false);
    }
  };

  const openEdit = () => {
    setForm({
      name: volunteer.name,
      email: volunteer.email,
      phone: volunteer.phone || '',
      role: volunteer.role,
      status: volunteer.status,
      joinedAt: volunteer.joinDate ? volunteer.joinDate.toISOString().split('T')[0] : '',
      skills: (volunteer.skills || []).join(', '),
      availability: volunteer.availability || '',
    });
    setIsEditOpen(true);
  };

  const closeEdit = () => {
    if (saving) return;
    setIsEditOpen(false);
    setForm({ ...emptyForm });
  };

  const handleChange = (event: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = event.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleUpdate = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!form.name || !form.email) {
      notify.error('Please enter volunteer name and email.');
      return;
    }

    setSaving(true);
    try {
      const skills = form.skills
        .split(',')
        .map((skill) => skill.trim())
        .filter(Boolean);

      const payload = {
        name: form.name,
        email: form.email,
        phone: form.phone,
        role: form.role as any,
        status: form.status as any,
        joinedAt: Timestamp.fromDate(form.joinedAt ? new Date(form.joinedAt) : new Date()),
        skills,
        availability: form.availability,
        lastActiveAt: Timestamp.fromDate(new Date()),
      };

      await updateVolunteer(volunteer.id, payload);
      notify.success('Volunteer updated successfully.');
      await refreshData();
      closeEdit();
    } catch (error: unknown) {
      notifyNgoVolunteerDetailError(
        error,
        'Failed to update volunteer.',
        'ngo-volunteer-detail-update-error',
        'ngo.volunteerDetail.update'
      );
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
              to="/ngo/dashboard/volunteers"
              className="inline-flex items-center gap-2 text-sm font-semibold text-gray-500 hover:text-gray-700"
            >
              <ArrowLeft className="w-4 h-4" />
              Back to volunteers
            </Link>
            <h2 className="text-2xl font-bold text-gray-900 mt-2">{volunteer.name}</h2>
            <p className="text-sm text-gray-500 mt-1">{volunteer.role}</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className={`px-3 py-1 rounded-full text-xs font-semibold ${getStatusColor(volunteer.status)}`}>
              {volunteer.status}
            </span>
            <button
              type="button"
              onClick={openEdit}
              className="inline-flex items-center gap-2 rounded-xl bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700"
            >
              <Edit3 className="w-4 h-4" />
              Edit
            </button>
            {volunteer.status === 'inactive' ? (
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
              <User className="w-6 h-6 text-red-600" />
            </div>
            <div>
              <p className="text-sm font-semibold text-gray-900">{volunteer.name}</p>
              <p className="text-xs text-gray-500">Joined {volunteer.joinDate.toLocaleDateString()}</p>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="border border-gray-100 rounded-xl p-4">
              <p className="text-xs text-gray-500">Hours contributed</p>
              <p className="text-lg font-semibold text-gray-900">{volunteer.hoursContributed} hrs</p>
            </div>
            <div className="border border-gray-100 rounded-xl p-4">
              <p className="text-xs text-gray-500">Availability</p>
              <p className="text-lg font-semibold text-gray-900">{volunteer.availability || 'Not set'}</p>
            </div>
          </div>

          <div className="border border-gray-100 rounded-xl p-4">
            <p className="text-xs text-gray-500">Skills</p>
            <p className="text-sm font-semibold text-gray-900">
              {volunteer.skills && volunteer.skills.length > 0 ? volunteer.skills.join(', ') : 'Not listed'}
            </p>
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-xl p-6 space-y-4">
          <div className="flex items-center gap-2 text-sm font-semibold text-gray-900">
            <Shield className="w-5 h-5 text-amber-500" />
            Contact details
          </div>
          <div className="space-y-3 text-sm text-gray-600">
            <div className="flex items-center gap-2">
              <Mail className="w-4 h-4 text-amber-500" />
              {volunteer.email}
            </div>
            <div className="flex items-center gap-2">
              <Phone className="w-4 h-4 text-amber-500" />
              {volunteer.phone || 'Phone not provided'}
            </div>
          </div>
        </div>
      </div>

      {deleteOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
            <h3 className="text-lg font-bold text-gray-900">Delete volunteer?</h3>
            <p className="mt-2 text-sm text-gray-600">
              This will permanently remove the volunteer record.
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
          <div className="bg-white w-full max-w-xl rounded-2xl shadow-2xl max-h-[90vh] flex flex-col overflow-hidden">
            <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4 bg-white">
              <h3 className="text-lg font-bold text-gray-900">Edit Volunteer</h3>
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
                  <label className="text-sm font-semibold text-gray-700">Name *</label>
                  <input
                    name="name"
                    value={form.name}
                    onChange={handleChange}
                    className="mt-2 w-full rounded-xl border border-gray-200 px-3 py-2.5 focus:ring-2 focus:ring-amber-500 focus:border-transparent"
                    required
                  />
                </div>
                <div>
                  <label className="text-sm font-semibold text-gray-700">Email *</label>
                  <input
                    name="email"
                    type="email"
                    value={form.email}
                    onChange={handleChange}
                    className="mt-2 w-full rounded-xl border border-gray-200 px-3 py-2.5 focus:ring-2 focus:ring-amber-500 focus:border-transparent"
                    required
                  />
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="text-sm font-semibold text-gray-700">Phone</label>
                  <input
                    name="phone"
                    value={form.phone}
                    onChange={handleChange}
                    className="mt-2 w-full rounded-xl border border-gray-200 px-3 py-2.5 focus:ring-2 focus:ring-amber-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="text-sm font-semibold text-gray-700">Role</label>
                  <select
                    name="role"
                    value={form.role}
                    onChange={handleChange}
                    className="mt-2 w-full rounded-xl border border-gray-200 px-3 py-2.5 focus:ring-2 focus:ring-amber-500 focus:border-transparent"
                  >
                    <option value="coordinator">Coordinator</option>
                    <option value="event_manager">Event Manager</option>
                    <option value="donor_relations">Donor Relations</option>
                    <option value="general">General</option>
                  </select>
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="text-sm font-semibold text-gray-700">Status</label>
                  <select
                    name="status"
                    value={form.status}
                    onChange={handleChange}
                    className="mt-2 w-full rounded-xl border border-gray-200 px-3 py-2.5 focus:ring-2 focus:ring-amber-500 focus:border-transparent"
                  >
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                  </select>
                </div>
                <div>
                  <label className="text-sm font-semibold text-gray-700">Join date</label>
                  <input
                    name="joinedAt"
                    type="date"
                    value={form.joinedAt}
                    onChange={handleChange}
                    className="mt-2 w-full rounded-xl border border-gray-200 px-3 py-2.5 focus:ring-2 focus:ring-amber-500 focus:border-transparent"
                  />
                </div>
              </div>

              <div>
                <label className="text-sm font-semibold text-gray-700">Skills</label>
                <input
                  name="skills"
                  value={form.skills}
                  onChange={handleChange}
                  placeholder="e.g. Donor outreach, Event ops"
                  className="mt-2 w-full rounded-xl border border-gray-200 px-3 py-2.5 focus:ring-2 focus:ring-amber-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="text-sm font-semibold text-gray-700">Availability</label>
                <input
                  name="availability"
                  value={form.availability}
                  onChange={handleChange}
                  placeholder="e.g. Weekends, Evenings"
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

export default NgoVolunteerDetail;
