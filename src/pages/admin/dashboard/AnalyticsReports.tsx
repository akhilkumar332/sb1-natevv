import { useState } from 'react';
import { FileDown, Gauge } from 'lucide-react';
import { AdminAnalyticsDashboard } from '../../../components/analytics/AdminAnalyticsDashboard';
import { generateDailyAnalytics, getSystemHealthReport } from '../../../services/admin.service';
import { runWithFeedback } from '../../../utils/runWithFeedback';

function AnalyticsReportsPage() {
  const [generating, setGenerating] = useState(false);
  const [checkingHealth, setCheckingHealth] = useState(false);

  const handleGenerateSnapshot = async () => {
    setGenerating(true);
    await runWithFeedback({
      action: () => generateDailyAnalytics(),
      successMessage: (analyticsId) => `Analytics snapshot generated (${analyticsId})`,
      errorMessage: 'Failed to generate analytics snapshot.',
      capture: { scope: 'admin', metadata: { kind: 'admin.analytics.snapshot.generate' } },
    });
    setGenerating(false);
  };

  const handleSystemHealth = async () => {
    setCheckingHealth(true);
    await runWithFeedback({
      action: () => getSystemHealthReport(),
      successMessage: (report) =>
        `System ${report.status}: ${report.alerts.inventoryAlerts} inventory alerts, ${report.alerts.pendingVerifications} pending verifications`,
      errorMessage: 'Failed to get system health report.',
      capture: { scope: 'admin', metadata: { kind: 'admin.analytics.health.check' } },
    });
    setCheckingHealth(false);
  };

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-red-100 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Analytics & Reports</h2>
            <p className="text-sm text-gray-600">Platform analytics, growth trends, and system reporting.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => void handleGenerateSnapshot()}
              disabled={generating}
              className="inline-flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm font-semibold text-red-700 hover:bg-red-100 disabled:opacity-50"
            >
              <FileDown className="h-4 w-4" />
              {generating ? 'Generating...' : 'Generate Daily Snapshot'}
            </button>
            <button
              type="button"
              onClick={() => void handleSystemHealth()}
              disabled={checkingHealth}
              className="inline-flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm font-semibold text-emerald-700 hover:bg-emerald-100 disabled:opacity-50"
            >
              <Gauge className="h-4 w-4" />
              {checkingHealth ? 'Checking...' : 'Check System Health'}
            </button>
          </div>
        </div>
      </div>

      <AdminAnalyticsDashboard />
    </div>
  );
}

export default AnalyticsReportsPage;
