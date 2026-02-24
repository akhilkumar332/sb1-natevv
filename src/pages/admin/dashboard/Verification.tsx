import { useCallback, useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import type { VerificationRequest } from '../../../types/database.types';
import { useAuth } from '../../../contexts/AuthContext';
import {
  approveVerificationRequest,
  getVerificationRequests,
  markVerificationUnderReview,
  rejectVerificationRequest,
} from '../../../services/admin.service';
import VerificationCard from '../../../components/admin/VerificationCard';
import DocumentViewer from '../../../components/admin/DocumentViewer';
import AdminListToolbar from '../../../components/admin/AdminListToolbar';
import AdminPagination from '../../../components/admin/AdminPagination';

type StatusFilter = 'all' | 'pending' | 'under_review' | 'approved' | 'rejected';
type TypeFilter = 'all' | 'bloodbank' | 'hospital' | 'ngo';

function VerificationPage() {
  const { user } = useAuth();
  const [requests, setRequests] = useState<VerificationRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('all');
  const [activeDocRequest, setActiveDocRequest] = useState<VerificationRequest | null>(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  const loadRequests = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getVerificationRequests(undefined, 500);
      const sorted = [...data].sort((a, b) => {
        const dateA = a.submittedAt instanceof Date ? a.submittedAt.getTime() : 0;
        const dateB = b.submittedAt instanceof Date ? b.submittedAt.getTime() : 0;
        return dateB - dateA;
      });
      setRequests(sorted);
    } catch (fetchError: any) {
      setError(fetchError?.message || 'Unable to load verification requests.');
      setRequests([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadRequests();
  }, [loadRequests]);

  useEffect(() => {
    setPage(1);
  }, [searchTerm, statusFilter, typeFilter, pageSize]);

  const filtered = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    return requests.filter((request) => {
      if (statusFilter !== 'all' && request.status !== statusFilter) return false;
      if (typeFilter !== 'all' && request.organizationType !== typeFilter) return false;
      if (!term) return true;
      const haystack = [
        request.organizationName,
        request.organizationType,
        request.contactPerson,
        request.contactEmail,
        request.contactPhone,
        request.location?.city,
        request.location?.state,
        request.userId,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return haystack.includes(term);
    });
  }, [requests, searchTerm, statusFilter, typeFilter]);

  const paged = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filtered.slice(start, start + pageSize);
  }, [filtered, page, pageSize]);

  const hasNextPage = page * pageSize < filtered.length;

  const withAdminGuard = (action: () => Promise<void>) => {
    if (!user?.uid) {
      toast.error('Admin session unavailable.');
      return;
    }
    void action();
  };

  const handleApprove = async (requestId: string, notes?: string) => {
    withAdminGuard(async () => {
      try {
        await approveVerificationRequest(requestId, user!.uid, notes);
        toast.success('Verification approved');
        await loadRequests();
      } catch (approveError: any) {
        toast.error(approveError?.message || 'Failed to approve request.');
      }
    });
  };

  const handleReject = async (requestId: string, reason: string) => {
    withAdminGuard(async () => {
      try {
        await rejectVerificationRequest(requestId, user!.uid, reason);
        toast.success('Verification rejected');
        await loadRequests();
      } catch (rejectError: any) {
        toast.error(rejectError?.message || 'Failed to reject request.');
      }
    });
  };

  const handleMarkUnderReview = async (requestId: string) => {
    withAdminGuard(async () => {
      try {
        await markVerificationUnderReview(requestId, user!.uid);
        toast.success('Request moved to under review');
        await loadRequests();
      } catch (reviewError: any) {
        toast.error(reviewError?.message || 'Failed to update request status.');
      }
    });
  };

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-red-100 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Verification Queue</h2>
            <p className="text-sm text-gray-600">Review and process BloodBank/NGO verification requests.</p>
          </div>
          <button
            type="button"
            onClick={loadRequests}
            className="rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm font-semibold text-red-700 hover:bg-red-100"
          >
            Refresh
          </button>
        </div>
      </div>

      <AdminListToolbar
        searchTerm={searchTerm}
        onSearchTermChange={setSearchTerm}
        searchPlaceholder="Search by org name, contact, city, state, or user id"
        leftContent={
          <>
            <select
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value as StatusFilter)}
              className="rounded-xl border border-gray-300 px-3 py-2 text-sm text-gray-700"
            >
              <option value="all">All statuses</option>
              <option value="pending">Pending</option>
              <option value="under_review">Under review</option>
              <option value="approved">Approved</option>
              <option value="rejected">Rejected</option>
            </select>
            <select
              value={typeFilter}
              onChange={(event) => setTypeFilter(event.target.value as TypeFilter)}
              className="rounded-xl border border-gray-300 px-3 py-2 text-sm text-gray-700"
            >
              <option value="all">All org types</option>
              <option value="bloodbank">BloodBank</option>
              <option value="hospital">Hospital</option>
              <option value="ngo">NGO</option>
            </select>
          </>
        }
        rightContent={<span className="text-xs font-semibold text-gray-500">{filtered.length} requests</span>}
      />

      {loading ? (
        <div className="rounded-2xl border border-red-100 bg-white p-8 text-center text-gray-500 shadow-sm">
          Loading verification requests...
        </div>
      ) : error ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-center text-red-700">{error}</div>
      ) : paged.length === 0 ? (
        <div className="rounded-2xl border border-red-100 bg-white p-8 text-center text-gray-500 shadow-sm">
          No verification requests found for selected filters.
        </div>
      ) : (
        <div className="space-y-3">
          {paged.map((request) => (
            <div key={request.id} className="rounded-2xl border border-red-100 bg-white p-4 shadow-sm">
              {request.status === 'pending' && (
                <div className="mb-3 flex justify-end">
                  <button
                    type="button"
                    onClick={() => void handleMarkUnderReview(request.id!)}
                    className="rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-100"
                  >
                    Mark Under Review
                  </button>
                </div>
              )}
              <VerificationCard
                request={request}
                onApprove={handleApprove}
                onReject={handleReject}
                onViewDocuments={(selected) => setActiveDocRequest(selected)}
              />
            </div>
          ))}
        </div>
      )}

      <AdminPagination
        page={page}
        pageSize={pageSize}
        itemCount={paged.length}
        hasNextPage={hasNextPage}
        loading={loading}
        onPageChange={setPage}
        onPageSizeChange={setPageSize}
      />

      {activeDocRequest && (
        <DocumentViewer request={activeDocRequest} onClose={() => setActiveDocRequest(null)} />
      )}
    </div>
  );
}

export default VerificationPage;
