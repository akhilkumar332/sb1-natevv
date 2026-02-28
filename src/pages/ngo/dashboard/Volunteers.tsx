import { useEffect, useMemo, useState } from 'react';
import { Link, useOutletContext, useSearchParams } from 'react-router-dom';
import { notify } from 'services/notify.service';
import { UserPlus, Users, X } from 'lucide-react';
import { Timestamp } from 'firebase/firestore';
import type { NgoDashboardContext } from '../NgoDashboard';
import { addVolunteer, updateVolunteer, archiveVolunteer, deleteVolunteer } from '../../../services/ngo.service';

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

function NgoVolunteers() {
  const { volunteers, getStatusColor, user, refreshData } = useOutletContext<NgoDashboardContext>();
  const [searchParams, setSearchParams] = useSearchParams();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingVolunteerId, setEditingVolunteerId] = useState<string | null>(null);
  const [form, setForm] = useState({ ...emptyForm });
  const [saving, setSaving] = useState(false);
  const [deleteCandidate, setDeleteCandidate] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [statusTab, setStatusTab] = useState<'active' | 'archived' | 'all'>('active');

  const notifyNgoVolunteersError = (
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
      metadata: { page: 'NgoVolunteers', kind },
    }
  );

  const activeCount = useMemo(
    () => volunteers.filter((volunteer) => volunteer.status === 'active').length,
    [volunteers]
  );
  const archivedCount = useMemo(
    () => volunteers.filter((volunteer) => volunteer.status === 'inactive').length,
    [volunteers]
  );
  const filteredVolunteers = useMemo(() => {
    if (statusTab === 'archived') {
      return volunteers.filter((volunteer) => volunteer.status === 'inactive');
    }
    if (statusTab === 'active') {
      return volunteers.filter((volunteer) => volunteer.status === 'active');
    }
    return volunteers;
  }, [volunteers, statusTab]);

  const openCreate = () => {
    setEditingVolunteerId(null);
    setForm({ ...emptyForm });
    setIsModalOpen(true);
  };

  useEffect(() => {
    const editId = searchParams.get('edit');
    if (editId && !isModalOpen) {
      const found = volunteers.some((volunteer) => volunteer.id === editId);
      if (found) {
        openEdit(editId);
        setSearchParams({});
      }
    }
  }, [searchParams, volunteers, isModalOpen, setSearchParams]);

  const openEdit = (volunteerId: string) => {
    const volunteer = volunteers.find((item) => item.id === volunteerId);
    if (!volunteer) return;
    setEditingVolunteerId(volunteerId);
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
    setIsModalOpen(true);
  };

  const closeModal = () => {
    if (saving) return;
    setIsModalOpen(false);
    setEditingVolunteerId(null);
    setForm({ ...emptyForm });
  };

  const handleChange = (event: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = event.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };


  const handleArchive = async (volunteerId: string) => {
    try {
      await archiveVolunteer(volunteerId);
      notify.success('Volunteer archived.');
      await refreshData();
    } catch (error: unknown) {
      notifyNgoVolunteersError(
        error,
        'Failed to archive volunteer.',
        'ngo-volunteer-archive-error',
        'ngo.volunteers.archive'
      );
    }
  };

  const handleDelete = async (volunteerId: string) => {
    setDeletingId(volunteerId);
    try {
      await deleteVolunteer(volunteerId);
      notify.success('Volunteer deleted.');
      await refreshData();
      setDeleteCandidate(null);
    } catch (error: unknown) {
      notifyNgoVolunteersError(
        error,
        'Failed to delete volunteer.',
        'ngo-volunteer-delete-error',
        'ngo.volunteers.delete'
      );
    } finally {
      setDeletingId(null);
    }
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!user) {
      notify.error('You must be logged in to manage volunteers.');
      return;
    }

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
        userId: form.email.toLowerCase() || `vol_${Date.now()}`,
        ngoId: user.uid,
        ngoName: user.organizationName || user.displayName || 'NGO',
        name: form.name,
        email: form.email,
        phone: form.phone,
        role: form.role as any,
        status: form.status as any,
        joinedAt: Timestamp.fromDate(form.joinedAt ? new Date(form.joinedAt) : new Date()),
        skills,
        availability: form.availability,
        lastActiveAt: Timestamp.fromDate(new Date()),
        hoursContributed: 0,
        campaignsParticipated: 0,
        eventsOrganized: 0,
      };

      if (editingVolunteerId) {
        const { hoursContributed, campaignsParticipated, eventsOrganized, ...updatePayload } = payload;
        await updateVolunteer(editingVolunteerId, updatePayload);
        notify.success('Volunteer updated successfully.');
        await refreshData();
      } else {
        await addVolunteer(payload);
        notify.success('Volunteer added successfully.');
        await refreshData();
      }

      closeModal();
    } catch (error: unknown) {
      notifyNgoVolunteersError(
        error,
        'Failed to save volunteer.',
        'ngo-volunteer-save-error',
        editingVolunteerId ? 'ngo.volunteers.update' : 'ngo.volunteers.create'
      );
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
            <p className="text-xs uppercase tracking-[0.3em] text-amber-600">Volunteers</p>
            <h2 className="text-2xl font-bold text-gray-900">Volunteer team</h2>
            <p className="text-sm text-gray-500 mt-1">Coordinate assignments and track engagement.</p>
          </div>
          <button
            className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-red-600 to-amber-600 px-5 py-3 text-sm font-semibold text-white shadow-lg hover:from-red-700 hover:to-amber-700"
            onClick={openCreate}
          >
            <UserPlus className="w-5 h-5" />
            Add Volunteer
          </button>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-xl p-6">
        <div className="mb-4 flex flex-wrap items-center gap-2">
          {[
            { id: 'active', label: `Active (${activeCount})` },
            { id: 'archived', label: `Archived (${archivedCount})` },
            { id: 'all', label: `All (${volunteers.length})` },
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
        {filteredVolunteers.length === 0 ? (
          <div className="text-center py-10">
            <Users className="w-12 h-12 text-amber-200 mx-auto mb-3" />
            <h3 className="text-xl font-semibold text-gray-900 mb-2">No volunteers found</h3>
            <p className="text-gray-600">Try a different filter or add new volunteers.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200 text-left text-xs uppercase tracking-wide text-gray-500">
                  <th className="py-3 px-4 font-semibold">Volunteer</th>
                  <th className="py-3 px-4 font-semibold">Role</th>
                  <th className="py-3 px-4 font-semibold">Join date</th>
                  <th className="py-3 px-4 font-semibold">Hours</th>
                  <th className="py-3 px-4 font-semibold">Status</th>
                  <th className="py-3 px-4 font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredVolunteers.map((volunteer) => (
                  <tr key={volunteer.id} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="py-4 px-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-gradient-to-r from-red-600 to-amber-500 flex items-center justify-center text-white font-semibold">
                          {volunteer.name.charAt(0)}
                        </div>
                        <div>
                          <p className="font-semibold text-gray-900">{volunteer.name}</p>
                          <p className="text-xs text-gray-500">{volunteer.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="py-4 px-4 text-sm text-gray-600">{volunteer.role}</td>
                    <td className="py-4 px-4 text-sm text-gray-600">{volunteer.joinDate.toLocaleDateString()}</td>
                    <td className="py-4 px-4 text-sm font-semibold text-amber-600">{volunteer.hoursContributed} hrs</td>
                    <td className="py-4 px-4">
                      <span className={`px-3 py-1 rounded-full text-xs font-semibold ${getStatusColor(volunteer.status)}`}>
                        {volunteer.status}
                      </span>
                    </td>
                    <td className="py-4 px-4">
                      <div className="flex flex-wrap gap-2">
                        <Link
                          to={`/ngo/dashboard/volunteers/${volunteer.id}`}
                          className="text-sm font-semibold text-red-600 hover:text-red-700"
                        >
                          View
                        </Link>
                        <button
                          className="text-sm font-semibold text-amber-600 hover:text-amber-700"
                          onClick={() => openEdit(volunteer.id)}
                        >
                          Edit
                        </button>
                        {volunteer.status === 'inactive' ? (
                          <span className="text-sm font-semibold text-gray-400">Archived</span>
                        ) : (
                          <button
                            className="text-sm font-semibold text-gray-600 hover:text-gray-700"
                            onClick={() => handleArchive(volunteer.id)}
                          >
                            Archive
                          </button>
                        )}
                        <button
                          className="text-sm font-semibold text-red-600 hover:text-red-700"
                          onClick={() => setDeleteCandidate(volunteer.id)}
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white w-full max-w-xl rounded-2xl shadow-2xl">
            <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4">
              <h3 className="text-lg font-bold text-gray-900">
                {editingVolunteerId ? 'Edit Volunteer' : 'Add Volunteer'}
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
                  {saving ? 'Saving...' : 'Save Volunteer'}
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
            <h3 className="text-lg font-bold text-gray-900">Delete volunteer?</h3>
            <p className="mt-2 text-sm text-gray-600">
              This will permanently remove the volunteer record.
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

export default NgoVolunteers;
