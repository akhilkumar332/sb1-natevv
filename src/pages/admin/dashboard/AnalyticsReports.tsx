import { useState } from 'react';
import { FileDown, Gauge } from 'lucide-react';
import { AdminAnalyticsDashboard } from '../../../components/analytics/AdminAnalyticsDashboard';
import MemoryDiagnosticsCard from '../../../components/admin/MemoryDiagnosticsCard';
import { generateDailyAnalytics } from '../../../services/admin.service';
import { type DateRange, getAnalyticsHealthReport } from '../../../services/analytics.service';
import { runWithFeedback } from '../../../utils/runWithFeedback';

function AnalyticsReportsPage() {
  const [generating, setGenerating] = useState(false);
  const [checkingHealth, setCheckingHealth] = useState(false);
  const [refreshNonce, setRefreshNonce] = useState(0);
  const [dateRange, setDateRange] = useState<DateRange>(() => {
    const endDate = new Date();
    const startDate = new Date();
    startDate.setFullYear(endDate.getFullYear() - 1);
    return { startDate, endDate };
  });

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
    const report = await runWithFeedback({
      action: () => getAnalyticsHealthReport(dateRange),
      successMessage: (result) => {
        const issueSummary = result.issues.length > 0 ? ` Issues: ${result.issues.join(' ')}` : ' All visible analytics datasets responded with live data.';
        return `Analytics ${result.status}: ${result.datasets.growthPoints} growth points, ${result.datasets.geoLocations} geo locations, source ${result.datasets.rangeSource}.${issueSummary}`;
      },
      errorMessage: 'Failed to check analytics health.',
      capture: { scope: 'admin', metadata: { kind: 'admin.analytics.health.check.live' } },
    });
    if (report) {
      setRefreshNonce((value) => value + 1);
    }
    setCheckingHealth(false);
  };

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-red-100 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-slate-100">Analytics & Reports</h2>
            <p className="text-sm text-gray-600 dark:text-slate-300">Platform analytics, growth trends, and system reporting.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => void handleGenerateSnapshot()}
              disabled={generating}
              className="inline-flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm font-semibold text-red-700 hover:bg-red-100 disabled:opacity-50 dark:border-red-900/40 dark:bg-red-950/40 dark:text-red-300 dark:hover:bg-red-950/60"
            >
              <FileDown className="h-4 w-4" />
              {generating ? 'Generating...' : 'Generate Daily Snapshot'}
            </button>
            <button
              type="button"
              onClick={() => void handleSystemHealth()}
              disabled={checkingHealth}
              className="inline-flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm font-semibold text-emerald-700 hover:bg-emerald-100 disabled:opacity-50 dark:border-emerald-900/40 dark:bg-emerald-950/40 dark:text-emerald-300 dark:hover:bg-emerald-950/60"
            >
              <Gauge className="h-4 w-4" />
              {checkingHealth ? 'Checking...' : 'Check Live Analytics'}
            </button>
          </div>
        </div>
      </div>

      <AdminAnalyticsDashboard
        dateRange={{ start: dateRange.startDate, end: dateRange.endDate }}
        onDateRangeChange={(range) => setDateRange({ startDate: range.start, endDate: range.end })}
        refreshNonce={refreshNonce}
      />
      <MemoryDiagnosticsCard />
    </div>
  );
}

export default AnalyticsReportsPage;
