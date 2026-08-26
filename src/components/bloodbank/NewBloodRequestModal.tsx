import { useState } from 'react';
import { Timestamp } from 'firebase/firestore';
import { Loader, Plus, X } from 'lucide-react';
import { notify } from 'services/notify.service';
import { ModalShell } from '../shared/ModalShell';
import { createBloodBankRequest } from '../../services/bloodbank.service';
import { BLOOD_TYPES } from '../../constants/app.constants';

/**
 * Create a blood request from the blood bank portal.
 *
 * `bloodRequests` previously had no producer anywhere in the reachable app: the
 * "New Request" button had no click handler, and `createBloodBankRequest` was an
 * orphaned service function. That left the blood bank Requests page, the donor
 * emergency-request surface and the admin emergency queue permanently empty.
 *
 * firestore.rules only lets a *verified* bloodbank/hospital (or an admin) create
 * these documents, so the caller must be a verified organisation.
 */
type BloodBankUser = {
  uid?: string;
  organizationName?: string;
  displayName?: string;
  city?: string;
  state?: string;
  address?: string;
  phoneNumber?: string;
  latitude?: number;
  longitude?: number;
};

type Props = {
  user: BloodBankUser | null;
  onClose: () => void;
  onCreated: () => void | Promise<void>;
};

const URGENCIES = ['critical', 'high', 'medium', 'low'] as const;

export function NewBloodRequestModal({ user, onClose, onCreated }: Props) {
  const [form, setForm] = useState({
    bloodType: '',
    units: '1',
    urgency: 'medium' as (typeof URGENCIES)[number],
    isEmergency: false,
    neededBy: '',
    patientName: '',
    contactPerson: '',
    contactPhone: user?.phoneNumber || '',
    reason: '',
    city: user?.city || '',
    state: user?.state || '',
  });
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const set = (key: keyof typeof form, value: string | boolean) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const validate = () => {
    const next: Record<string, string> = {};
    if (!form.bloodType) next.bloodType = 'Select a blood type.';
    const units = Number(form.units);
    if (!Number.isFinite(units) || units <= 0) next.units = 'Enter at least 1 unit.';
    if (!form.neededBy) {
      next.neededBy = 'Select when the blood is needed by.';
    } else if (new Date(form.neededBy).getTime() <= Date.now()) {
      // The service rejects a past date too; catch it here so the user gets a
      // field-level message instead of a generic failure toast.
      next.neededBy = 'Needed-by must be in the future.';
    }
    if (!form.reason.trim()) next.reason = 'Add a short reason for the request.';
    if (!form.contactPhone.trim()) next.contactPhone = 'A contact phone is required.';
    if (!form.city.trim()) next.city = 'City is required.';
    if (!form.state.trim()) next.state = 'State is required.';
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!user?.uid) {
      notify.error('No active session found. Please log in again.');
      return;
    }
    if (!validate()) return;

    setSaving(true);
    try {
      const organizationName = user.organizationName || user.displayName || 'Blood bank';
      const units = Number(form.units);
      const neededBy = new Date(form.neededBy);

      // The blood bank list query filters on requesterId, so that field must
      // carry the owning organisation's uid.
      await createBloodBankRequest({
        requesterId: user.uid,
        requesterName: organizationName,
        requesterType: 'bloodbank',
        bloodType: form.bloodType,
        units,
        unitsRequired: units,
        unitsReceived: 0,
        urgency: form.urgency,
        isEmergency: form.isEmergency,
        reason: form.reason.trim(),
        status: 'active',
        requestedAt: Timestamp.now(),
        neededBy: Timestamp.fromDate(neededBy),
        // A request stops being actionable once its needed-by moment passes.
        expiresAt: Timestamp.fromDate(neededBy),
        contactPerson: form.contactPerson.trim() || organizationName,
        contactPhone: form.contactPhone.trim(),
        // Optional keys are omitted rather than sent as undefined.
        ...(form.patientName.trim() ? { patientName: form.patientName.trim() } : {}),
        location: {
          address: user.address || '',
          city: form.city.trim(),
          state: form.state.trim(),
          ...(typeof user.latitude === 'number' ? { latitude: user.latitude } : {}),
          ...(typeof user.longitude === 'number' ? { longitude: user.longitude } : {}),
        },
      });

      notify.success('Blood request created.');
      await onCreated();
      onClose();
    } catch (error) {
      notify.fromError(error, 'Failed to create blood request.', { id: 'bloodbank-create-request' });
    } finally {
      setSaving(false);
    }
  };

  const fieldError = (key: string) =>
    errors[key] ? <p className="mt-1 text-xs font-medium text-red-600">{errors[key]}</p> : null;

  const inputClass = 'w-full rounded-xl border border-gray-200 px-3 py-2 text-sm focus:border-red-400 focus:outline-none';
  const labelClass = 'mb-1 block text-xs font-semibold text-gray-700';

  return (
    <ModalShell containerClassName="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl max-h-[90vh] overflow-y-auto">
      <div className="mb-4 flex items-start justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.3em] text-red-600">Requests</p>
          <h3 className="text-lg font-bold text-gray-900">New blood request</h3>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="rounded-lg p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor="nbr-bloodType" className={labelClass}>Blood type *</label>
            <select
              id="nbr-bloodType"
              value={form.bloodType}
              onChange={(e) => set('bloodType', e.target.value)}
              className={inputClass}
            >
              <option value="">Select</option>
              {BLOOD_TYPES.map((type) => <option key={type} value={type}>{type}</option>)}
            </select>
            {fieldError('bloodType')}
          </div>
          <div>
            <label htmlFor="nbr-units" className={labelClass}>Units *</label>
            <input
              id="nbr-units"
              type="number"
              min={1}
              value={form.units}
              onChange={(e) => set('units', e.target.value)}
              className={inputClass}
            />
            {fieldError('units')}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor="nbr-urgency" className={labelClass}>Urgency</label>
            <select
              id="nbr-urgency"
              value={form.urgency}
              onChange={(e) => set('urgency', e.target.value)}
              className={inputClass}
            >
              {URGENCIES.map((level) => <option key={level} value={level}>{level}</option>)}
            </select>
          </div>
          <div>
            <label htmlFor="nbr-neededBy" className={labelClass}>Needed by *</label>
            <input
              id="nbr-neededBy"
              type="datetime-local"
              value={form.neededBy}
              onChange={(e) => set('neededBy', e.target.value)}
              className={inputClass}
            />
            {fieldError('neededBy')}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor="nbr-city" className={labelClass}>City *</label>
            <input id="nbr-city" value={form.city} onChange={(e) => set('city', e.target.value)} className={inputClass} />
            {fieldError('city')}
          </div>
          <div>
            <label htmlFor="nbr-state" className={labelClass}>State *</label>
            <input id="nbr-state" value={form.state} onChange={(e) => set('state', e.target.value)} className={inputClass} />
            {fieldError('state')}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor="nbr-contactPerson" className={labelClass}>Contact person</label>
            <input
              id="nbr-contactPerson"
              value={form.contactPerson}
              onChange={(e) => set('contactPerson', e.target.value)}
              placeholder={user?.organizationName || 'Blood bank'}
              className={inputClass}
            />
          </div>
          <div>
            <label htmlFor="nbr-contactPhone" className={labelClass}>Contact phone *</label>
            <input
              id="nbr-contactPhone"
              value={form.contactPhone}
              onChange={(e) => set('contactPhone', e.target.value)}
              className={inputClass}
            />
            {fieldError('contactPhone')}
          </div>
        </div>

        <div>
          <label htmlFor="nbr-patient" className={labelClass}>Patient name</label>
          <input id="nbr-patient" value={form.patientName} onChange={(e) => set('patientName', e.target.value)} className={inputClass} />
        </div>

        <div>
          <label htmlFor="nbr-reason" className={labelClass}>Reason *</label>
          <textarea
            id="nbr-reason"
            rows={3}
            value={form.reason}
            onChange={(e) => set('reason', e.target.value)}
            className={inputClass}
          />
          {fieldError('reason')}
        </div>

        <label className="flex items-center gap-2 text-sm text-gray-700">
          <input
            type="checkbox"
            checked={form.isEmergency}
            onChange={(e) => set('isEmergency', e.target.checked)}
            className="h-4 w-4 rounded border-gray-300 text-red-600"
          />
          Mark as emergency (notifies matching donors)
        </label>

        <div className="flex justify-end gap-3 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-gray-200 px-4 py-2 text-sm font-semibold text-gray-600 hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={saving}
            className="inline-flex items-center gap-2 rounded-xl bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-60"
          >
            {saving ? <Loader className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            {saving ? 'Creating…' : 'Create request'}
          </button>
        </div>
      </form>
    </ModalShell>
  );
}
