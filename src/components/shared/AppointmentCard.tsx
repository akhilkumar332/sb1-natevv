/**
 * AppointmentCard Component
 *
 * Displays appointment information for donors and hospitals
 */

import React from 'react';
import { Appointment } from '../../types/database.types';
import { formatDate } from '../../utils/dataTransform';
import {
  Calendar,
  Clock,
  MapPin,
  Phone,
  User,
  Droplet,
  XCircle,
  CheckCircle,
} from 'lucide-react';

interface AppointmentCardProps {
  appointment: Appointment;
  userRole: 'donor' | 'bloodbank' | 'hospital';
  onCancel?: (appointmentId: string, reason?: string) => void;
  onReschedule?: (appointmentId: string) => void;
  onConfirm?: (appointmentId: string) => void;
  onComplete?: (appointmentId: string) => void;
}

/**
 * AppointmentCard component
 */
export const AppointmentCard: React.FC<AppointmentCardProps> = ({
  appointment,
  userRole,
  onCancel,
  onReschedule,
  onConfirm,
  onComplete,
}) => {
  const [showCancelModal, setShowCancelModal] = React.useState(false);
  const [cancellationReason, setCancellationReason] = React.useState('');

  const getStatusColor = (status: Appointment['status']) => {
    const colorMap = {
      scheduled: 'bg-blue-100 text-blue-800',
      confirmed: 'bg-green-100 text-green-800',
      completed: 'bg-gray-100 text-gray-800',
      cancelled: 'bg-red-100 text-red-800',
      'no-show': 'bg-orange-100 text-orange-800',
    };
    return colorMap[status] || 'bg-gray-100 text-gray-800';
  };

  const getStatusLabel = (status: Appointment['status']) => {
    const labelMap = {
      scheduled: 'Scheduled',
      confirmed: 'Confirmed',
      completed: 'Completed',
      cancelled: 'Cancelled',
      'no-show': 'No Show',
    };
    return labelMap[status] || status;
  };

  const handleCancelClick = () => {
    setShowCancelModal(true);
  };

  const handleCancelConfirm = () => {
    if (onCancel && appointment.id) {
      onCancel(appointment.id, cancellationReason || undefined);
      setShowCancelModal(false);
      setCancellationReason('');
    }
  };

  const canCancel =
    (appointment.status === 'scheduled' || appointment.status === 'confirmed') &&
    onCancel;

  const canReschedule =
    (appointment.status === 'scheduled' || appointment.status === 'confirmed') &&
    userRole === 'donor' &&
    onReschedule;

  const canConfirm =
    appointment.status === 'scheduled' && (userRole === 'bloodbank' || userRole === 'hospital') && onConfirm;

  const canComplete =
    appointment.status === 'confirmed' && (userRole === 'bloodbank' || userRole === 'hospital') && onComplete;

  return (
    <>
      <div className="bg-white rounded-lg shadow-md p-6 hover:shadow-lg transition-shadow">
        {/* Header */}
        <div className="flex justify-between items-start mb-4">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-2">
              <Calendar className="w-5 h-5 text-gray-600" />
              <span className="text-lg font-semibold text-gray-900">
                {formatDate(appointment.scheduledDate)}
              </span>
            </div>
            <div className="flex items-center gap-2 text-gray-600">
              <Clock className="w-4 h-4" />
              <span className="text-sm">{appointment.scheduledTime}</span>
              <span className="text-sm text-gray-400">
                ({appointment.duration} minutes)
              </span>
            </div>
          </div>
          <span
            className={`px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(
              appointment.status
            )}`}
          >
            {getStatusLabel(appointment.status)}
          </span>
        </div>

        {/* Details */}
        <div className="space-y-3 mb-4">
          {userRole === 'donor' ? (
            <>
              {/* Hospital Info for Donor */}
              <div className="flex items-start gap-2">
                <MapPin className="w-4 h-4 text-gray-600 mt-0.5" />
                <div className="flex-1">
                  <p className="text-sm font-medium text-gray-900">
                    {appointment.hospitalName}
                  </p>
                  <p className="text-sm text-gray-600">{appointment.hospitalAddress}</p>
                </div>
              </div>
            </>
          ) : (
            <>
              {/* Donor Info for Hospital */}
              <div className="flex items-center gap-2">
                <User className="w-4 h-4 text-gray-600" />
                <span className="text-sm text-gray-900">{appointment.donorName}</span>
              </div>
              <div className="flex items-center gap-2">
                <Droplet className="w-4 h-4 text-red-600" />
                <span className="text-sm text-gray-900">
                  {appointment.donorBloodType}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <Phone className="w-4 h-4 text-gray-600" />
                <a
                  href={`tel:${appointment.donorPhone}`}
                  className="text-sm text-blue-600 hover:text-blue-700"
                >
                  {appointment.donorPhone}
                </a>
              </div>
            </>
          )}

          {/* Purpose */}
          <div className="pt-2 border-t">
            <p className="text-sm text-gray-600">
              <span className="font-medium">Purpose:</span>{' '}
              {appointment.purpose.replace(/_/g, ' ')}
            </p>
          </div>

          {/* Notes */}
          {appointment.notes && (
            <div className="pt-2 border-t">
              <p className="text-sm text-gray-600">
                <span className="font-medium">Notes:</span> {appointment.notes}
              </p>
            </div>
          )}

          {/* Cancellation Reason */}
          {appointment.status === 'cancelled' && appointment.cancellationReason && (
            <div className="pt-2 border-t">
              <p className="text-sm text-red-600">
                <span className="font-medium">Cancellation Reason:</span>{' '}
                {appointment.cancellationReason}
              </p>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex flex-wrap gap-2">
          {canConfirm && appointment.id && (
            <button
              onClick={() => onConfirm(appointment.id!)}
              className="flex items-center gap-1 px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 transition-colors text-sm"
            >
              <CheckCircle className="w-4 h-4" />
              Confirm
            </button>
          )}

          {canComplete && appointment.id && (
            <button
              onClick={() => onComplete(appointment.id!)}
              className="flex items-center gap-1 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors text-sm"
            >
              <CheckCircle className="w-4 h-4" />
              Mark Complete
            </button>
          )}

          {canReschedule && appointment.id && (
            <button
              onClick={() => onReschedule(appointment.id!)}
              className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors text-sm"
            >
              Reschedule
            </button>
          )}

          {canCancel && (
            <button
              onClick={handleCancelClick}
              className="flex items-center gap-1 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 transition-colors text-sm"
            >
              <XCircle className="w-4 h-4" />
              Cancel
            </button>
          )}
        </div>
      </div>

      {/* Cancel Modal */}
      {showCancelModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-md w-full p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              Cancel Appointment
            </h3>

            <p className="text-sm text-gray-600 mb-4">
              Are you sure you want to cancel this appointment? This action cannot be
              undone.
            </p>

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Reason for Cancellation (Optional)
              </label>
              <textarea
                value={cancellationReason}
                onChange={e => setCancellationReason(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-red-500"
                rows={3}
                placeholder="Please provide a reason..."
              />
            </div>

            <div className="flex gap-2 justify-end">
              <button
                onClick={() => {
                  setShowCancelModal(false);
                  setCancellationReason('');
                }}
                className="px-4 py-2 bg-gray-300 text-gray-700 rounded hover:bg-gray-400 transition-colors"
              >
                Keep Appointment
              </button>
              <button
                onClick={handleCancelConfirm}
                className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 transition-colors"
              >
                Cancel Appointment
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default AppointmentCard;
