/**
 * VerificationCard Component
 *
 * Displays a verification request card for admin review
 */

import React, { useState } from 'react';
import { VerificationRequest } from '../../types/database.types';
import {
  VERIFICATION_STATUS_LABELS,
  ORGANIZATION_TYPE_LABELS,
} from '../../constants/app.constants';
import { formatDateTime } from '../../utils/dataTransform';
import { captureHandledError } from '../../services/errorLog.service';

interface VerificationCardProps {
  request: VerificationRequest;
  onApprove?: (requestId: string, notes?: string) => Promise<void>;
  onReject?: (requestId: string, reason: string) => Promise<void>;
  onViewDocuments?: (request: VerificationRequest) => void;
}

/**
 * VerificationCard component for displaying verification requests
 */
export const VerificationCard: React.FC<VerificationCardProps> = ({
  request,
  onApprove,
  onReject,
  onViewDocuments,
}) => {
  const [isProcessing, setIsProcessing] = useState(false);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [rejectionReason, setRejectionReason] = useState('');
  const [reviewNotes, setReviewNotes] = useState('');

  const handleApprove = async () => {
    if (!onApprove || !request.id) return;

    setIsProcessing(true);
    try {
      await onApprove(request.id, reviewNotes || undefined);
    } catch (error) {
      void captureHandledError(error, {
        source: 'frontend',
        scope: 'admin',
        metadata: { kind: 'verification.approve', component: 'VerificationCard' },
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleReject = async () => {
    if (!onReject || !rejectionReason.trim() || !request.id) return;

    setIsProcessing(true);
    try {
      await onReject(request.id, rejectionReason);
      setShowRejectModal(false);
      setRejectionReason('');
    } catch (error) {
      void captureHandledError(error, {
        source: 'frontend',
        scope: 'admin',
        metadata: { kind: 'verification.reject', component: 'VerificationCard' },
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const getStatusColor = (status: typeof request.status) => {
    const colorMap = {
      pending: 'bg-yellow-100 text-yellow-800',
      under_review: 'bg-red-100 text-red-800',
      approved: 'bg-green-100 text-green-800',
      rejected: 'bg-red-100 text-red-800',
    };
    return colorMap[status] || 'bg-gray-100 text-gray-800';
  };

  return (
    <>
      <div className="bg-white rounded-lg shadow-md p-6 hover:shadow-lg transition-shadow">
        {/* Header */}
        <div className="flex justify-between items-start mb-4">
          <div className="flex-1">
            <h3 className="text-xl font-semibold text-gray-900">
              {request.organizationName}
            </h3>
            <p className="text-sm text-gray-600">
              {ORGANIZATION_TYPE_LABELS[request.organizationType]}
            </p>
          </div>
          <span
            className={`px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(
              request.status
            )}`}
          >
            {VERIFICATION_STATUS_LABELS[request.status]}
          </span>
        </div>

        {/* Organization Details */}
        <div className="space-y-2 mb-4">
          <div className="flex items-center text-sm">
            <span className="font-medium text-gray-700 w-32">Contact Person:</span>
            <span className="text-gray-600">{request.contactPerson}</span>
          </div>
          <div className="flex items-center text-sm">
            <span className="font-medium text-gray-700 w-32">Email:</span>
            <span className="text-gray-600">{request.contactEmail}</span>
          </div>
          <div className="flex items-center text-sm">
            <span className="font-medium text-gray-700 w-32">Phone:</span>
            <span className="text-gray-600">{request.contactPhone}</span>
          </div>
          <div className="flex items-start text-sm">
            <span className="font-medium text-gray-700 w-32">Address:</span>
            <span className="text-gray-600">
              {request.location.address}, {request.location.city},{' '}
              {request.location.state} - {request.location.postalCode}
            </span>
          </div>
        </div>

        {/* Documents */}
        <div className="mb-4">
          <h4 className="text-sm font-medium text-gray-700 mb-2">
            Documents ({request.documents.length})
          </h4>
          <div className="flex flex-wrap gap-2">
            {request.documents.map((doc, index) => (
              <span
                key={index}
                className="px-2 py-1 bg-gray-100 text-gray-700 rounded text-xs"
              >
                {doc.type}
              </span>
            ))}
          </div>
        </div>

        {/* Submission Date */}
        <div className="text-sm text-gray-500 mb-4">
          Submitted: {formatDateTime(request.submittedAt)}
        </div>

        {/* Review Information (if reviewed) */}
        {request.status !== 'pending' && (
          <div className="bg-gray-50 rounded p-3 mb-4">
            {request.reviewedAt && (
              <p className="text-sm text-gray-600">
                Reviewed: {formatDateTime(request.reviewedAt)}
              </p>
            )}
            {request.reviewNotes && (
              <p className="text-sm text-gray-700 mt-1">
                <span className="font-medium">Notes:</span> {request.reviewNotes}
              </p>
            )}
            {request.rejectionReason && (
              <p className="text-sm text-red-600 mt-1">
                <span className="font-medium">Rejection Reason:</span>{' '}
                {request.rejectionReason}
              </p>
            )}
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex flex-wrap gap-2">
          {onViewDocuments && (
            <button
              onClick={() => onViewDocuments(request)}
              className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 transition-colors"
            >
              View Documents
            </button>
          )}

          {request.status === 'pending' && (
            <>
              {onApprove && (
                <button
                  onClick={handleApprove}
                  disabled={isProcessing}
                  className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isProcessing ? 'Processing...' : 'Approve'}
                </button>
              )}

              {onReject && (
                <button
                  onClick={() => setShowRejectModal(true)}
                  disabled={isProcessing}
                  className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Reject
                </button>
              )}
            </>
          )}
        </div>

        {/* Optional Review Notes Input (for pending requests) */}
        {request.status === 'pending' && onApprove && (
          <div className="mt-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Review Notes (Optional)
            </label>
            <textarea
              value={reviewNotes}
              onChange={e => setReviewNotes(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-red-500"
              rows={2}
              placeholder="Add any notes about this verification..."
            />
          </div>
        )}
      </div>

      {/* Reject Modal */}
      {showRejectModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-md w-full p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              Reject Verification Request
            </h3>

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Rejection Reason *
              </label>
              <textarea
                value={rejectionReason}
                onChange={e => setRejectionReason(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-red-500"
                rows={4}
                placeholder="Please provide a reason for rejection..."
                required
              />
            </div>

            <div className="flex gap-2 justify-end">
              <button
                onClick={() => {
                  setShowRejectModal(false);
                  setRejectionReason('');
                }}
                disabled={isProcessing}
                className="px-4 py-2 bg-gray-300 text-gray-700 rounded hover:bg-gray-400 transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleReject}
                disabled={isProcessing || !rejectionReason.trim()}
                className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isProcessing ? 'Processing...' : 'Reject Request'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default VerificationCard;
