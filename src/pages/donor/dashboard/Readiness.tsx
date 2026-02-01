import { useMemo } from 'react';
import { useNavigate, useOutletContext } from 'react-router-dom';
import { BookOpen, CheckCircle, Clock } from 'lucide-react';

const DonorReadiness = () => {
  const dashboard = useOutletContext<any>();
  const navigate = useNavigate();

  const {
    isLoading,
    eligibleToDonate,
    lastDonationDate,
    nextEligibleDate,
    lastDonationInput,
    setLastDonationInput,
    handleSaveLastDonation,
    lastDonationSaving,
    lastDonationSaved,
    normalizedLastDonation,
    daysUntilEligible,
    eligibilityChecklist,
    handleChecklistToggle,
    checklistSaving,
    checklistUpdatedAt,
    checklistCompleted,
    handleChecklistReset,
    formatDate,
    formatDateTime,
    handleLearnMore,
    donationHistory,
  } = dashboard;

  const recoveryWindowDays = 90;
  const todayMidnight = useMemo(() => {
    const today = new Date();
    return new Date(today.getFullYear(), today.getMonth(), today.getDate());
  }, []);

  const lastDonationMidnight = useMemo(() => {
    if (!lastDonationDate) return null;
    const date = lastDonationDate instanceof Date ? lastDonationDate : new Date(lastDonationDate);
    if (Number.isNaN(date.getTime())) return null;
    return new Date(date.getFullYear(), date.getMonth(), date.getDate());
  }, [lastDonationDate]);

  const daysSinceDonation = lastDonationMidnight
    ? Math.max(0, Math.floor((todayMidnight.getTime() - lastDonationMidnight.getTime()) / 86400000))
    : 0;
  const cappedDaysSince = Math.min(daysSinceDonation, recoveryWindowDays);
  const recoveryProgress = lastDonationMidnight
    ? Math.min(100, Math.round((cappedDaysSince / recoveryWindowDays) * 100))
    : 0;

  const latestDonationType = useMemo(() => {
    if (!Array.isArray(donationHistory) || donationHistory.length === 0) return null;
    const sorted = [...donationHistory]
      .filter((entry) => entry?.date)
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    return sorted[0]?.donationType || null;
  }, [donationHistory]);

  const latestDonationTypeLabel = latestDonationType
    ? latestDonationType === 'whole'
      ? 'Whole Blood'
      : latestDonationType === 'platelets'
        ? 'Platelets'
        : 'Plasma'
    : 'Not set';

  const niceToHaveCompleted = ['rested', 'ateMeal']
    .filter((key) => eligibilityChecklist?.[key])
    .length;
  const checklistStale = checklistUpdatedAt
    ? (Date.now() - new Date(checklistUpdatedAt).getTime()) > 7 * 86400000
    : false;

  return (
    <>
      <div className="mb-4">
        <p className="text-xs uppercase tracking-[0.3em] text-red-600">Readiness</p>
        <h2 className="text-xl font-bold text-gray-900">Eligibility and preparation</h2>
      </div>
      <div className="grid gap-6 md:grid-cols-2 items-stretch">
        <div className="rounded-2xl border border-red-200 bg-white p-5 shadow-sm h-full">
          {isLoading ? (
            <div className="space-y-4">
              <div className="h-4 w-32 rounded-full bg-gray-100 animate-pulse" />
              <div className="h-6 w-64 rounded-full bg-gray-100 animate-pulse" />
              <div className="h-4 w-72 rounded-full bg-gray-100 animate-pulse" />
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="h-10 rounded-xl bg-gray-100 animate-pulse" />
                <div className="h-10 rounded-xl bg-gray-100 animate-pulse" />
              </div>
              <div className="grid gap-3 sm:grid-cols-3">
                <div className="h-12 rounded-xl bg-gray-100 animate-pulse" />
                <div className="h-12 rounded-xl bg-gray-100 animate-pulse" />
                <div className="h-12 rounded-xl bg-gray-100 animate-pulse" />
              </div>
            </div>
          ) : (
            <>
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div className="flex items-start gap-3">
                  <div className="p-3 rounded-2xl bg-red-600">
                    {eligibleToDonate ? (
                      <CheckCircle className="w-6 h-6 text-white" />
                    ) : (
                      <Clock className="w-6 h-6 text-white" />
                    )}
                  </div>
                  <div>
                    <p className="text-[11px] uppercase tracking-wide text-red-600">Eligibility</p>
                    <h3 className="text-lg font-bold text-gray-900">
                      {eligibleToDonate ? "You're Eligible to Donate!" : 'Not Eligible to Donate'}
                    </h3>
                    <p className="text-sm text-gray-600">
                      {lastDonationDate
                        ? eligibleToDonate
                          ? 'You can donate now. Thank you for staying ready!'
                          : nextEligibleDate
                            ? `Next eligible on ${formatDate(nextEligibleDate)}`
                            : 'Record your last donation date to track eligibility.'
                        : 'Record your last donation date to track eligibility.'}
                    </p>
                    {!eligibleToDonate && (
                      <p className="text-xs text-gray-500 mt-1">Minimum recovery window is 90 days.</p>
                    )}
                  </div>
                </div>
                <div className="rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-center">
                  <p className="text-[10px] uppercase tracking-wide text-red-600">Next Eligible In</p>
                  <p className="text-2xl font-bold text-red-700">
                    {eligibleToDonate ? 0 : daysUntilEligible}
                  </p>
                  <p className="text-[11px] text-red-600/80">
                    {eligibleToDonate ? 'days' : 'days remaining'}
                  </p>
                </div>
              </div>
              <div className="mt-4 rounded-xl border border-red-100 bg-white px-4 py-3">
                <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] font-semibold text-gray-600">
                  <span>Recovery progress</span>
                  <span>{lastDonationMidnight ? `${cappedDaysSince}/${recoveryWindowDays} days` : 'Add a date to track'}</span>
                </div>
                <div className="mt-2 h-2 rounded-full bg-red-100">
                  <div
                    className="h-2 rounded-full bg-red-600 transition-all duration-300"
                    style={{ width: `${recoveryProgress}%` }}
                  />
                </div>
                <p className="mt-2 text-[11px] text-gray-500">
                  Next eligible date:{' '}
                  {nextEligibleDate ? formatDate(nextEligibleDate) : eligibleToDonate ? 'Now' : 'Not set'}
                </p>
                <p className="text-[11px] text-gray-500">
                  Why 90 days? Standard recovery window for whole-blood donations.
                </p>
              </div>
              <div className="mt-4 grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
                <div>
                  <label className="text-xs font-semibold text-gray-600">Last Donation Date</label>
                  <input
                    type="date"
                    value={lastDonationInput}
                    onChange={(event) => setLastDonationInput(event.target.value)}
                    className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2 text-sm text-gray-800 focus:border-red-500 focus:outline-none focus:ring-2 focus:ring-red-100"
                  />
                </div>
                <div className="flex flex-col items-center gap-2 sm:items-end">
                  <button
                    type="button"
                    onClick={handleSaveLastDonation}
                    disabled={lastDonationSaving}
                    className="w-full sm:w-auto px-4 py-2 rounded-xl bg-red-600 text-white text-sm font-semibold hover:bg-red-700 transition-all duration-300 disabled:opacity-50"
                  >
                    {lastDonationSaving ? 'Saving...' : 'Save'}
                  </button>
                  {lastDonationSaved && (
                    <span className="text-[11px] font-semibold text-red-600">Saved</span>
                  )}
                  {!lastDonationDate && (
                    <button
                      type="button"
                      onClick={() => navigate('/donor/dashboard/journey')}
                      className="text-[11px] font-semibold text-red-600 hover:text-red-700"
                    >
                      Log a donation in Journey
                    </button>
                  )}
                </div>
              </div>
              <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
                <div className="rounded-xl border border-gray-100 bg-gray-50 px-4 py-3">
                  <p className="text-[10px] uppercase tracking-wide text-gray-500">Last Donation</p>
                  <p className="text-sm font-semibold text-gray-800">
                    {normalizedLastDonation ? formatDate(normalizedLastDonation) : 'Not set'}
                  </p>
                  <p className="mt-1 text-xs text-gray-500">Type: {latestDonationTypeLabel}</p>
                </div>
                <div className="rounded-xl border border-gray-100 bg-gray-50 px-4 py-3">
                  <p className="text-[10px] uppercase tracking-wide text-gray-500">Recovery Window</p>
                  <p className="text-sm font-semibold text-gray-800">90 days</p>
                </div>
                <div className="rounded-xl border border-gray-100 bg-gray-50 px-4 py-3">
                  <p className="text-[10px] uppercase tracking-wide text-gray-500">Eligible On</p>
                  <p className="text-sm font-semibold text-gray-800">
                    {nextEligibleDate ? formatDate(nextEligibleDate) : 'Now'}
                  </p>
                </div>
              </div>
            </>
          )}
        </div>

        <div className="bg-white rounded-2xl shadow-xl p-6 h-full">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-lg font-bold text-gray-800">Eligibility Checklist</h2>
              <p className="text-xs text-gray-500">Quick self-check before donating.</p>
            </div>
            <div className="text-right text-xs font-semibold text-red-600">
              <div>{checklistCompleted}/3 required</div>
              <div className="text-[10px] font-medium text-gray-400">{niceToHaveCompleted}/2 nice-to-have</div>
            </div>
          </div>
          <div className="mt-4">
            <p className="text-[10px] uppercase tracking-wide text-gray-500">Required</p>
            <div className="mt-2 space-y-3">
            <button
              type="button"
              onClick={() => handleChecklistToggle('hydrated')}
              disabled={checklistSaving}
              className="w-full flex items-center justify-between rounded-xl border border-gray-100 bg-gray-50 px-4 py-3 text-left transition-all duration-300 hover:bg-gray-100"
            >
              <div>
                <p className="text-sm font-semibold text-gray-800">Hydrated</p>
                <p className="text-xs text-gray-500">Had 6–8 glasses of water in the last 24 hours.</p>
              </div>
              <CheckCircle className={`w-5 h-5 ${eligibilityChecklist.hydrated ? 'text-red-600' : 'text-gray-300'}`} />
            </button>
            <button
              type="button"
              onClick={() => handleChecklistToggle('weightOk')}
              disabled={checklistSaving}
              className="w-full flex items-center justify-between rounded-xl border border-gray-100 bg-gray-50 px-4 py-3 text-left transition-all duration-300 hover:bg-gray-100"
            >
              <div>
                <p className="text-sm font-semibold text-gray-800">Weight Check</p>
                <p className="text-xs text-gray-500">Above 50 kg and feeling well today.</p>
              </div>
              <CheckCircle className={`w-5 h-5 ${eligibilityChecklist.weightOk ? 'text-red-600' : 'text-gray-300'}`} />
            </button>
            <button
              type="button"
              onClick={() => handleChecklistToggle('hemoglobinOk')}
              disabled={checklistSaving}
              className="w-full flex items-center justify-between rounded-xl border border-gray-100 bg-gray-50 px-4 py-3 text-left transition-all duration-300 hover:bg-gray-100"
            >
              <div>
                <p className="text-sm font-semibold text-gray-800">Hemoglobin Ready</p>
                <p className="text-xs text-gray-500">Hemoglobin within your local eligibility range.</p>
              </div>
              <CheckCircle className={`w-5 h-5 ${eligibilityChecklist.hemoglobinOk ? 'text-red-600' : 'text-gray-300'}`} />
            </button>
            </div>
          </div>
          <div className="mt-4">
            <p className="text-[10px] uppercase tracking-wide text-gray-500">Nice-to-have</p>
            <div className="mt-2 space-y-3">
              <button
                type="button"
                onClick={() => handleChecklistToggle('rested')}
                disabled={checklistSaving}
                className="w-full flex items-center justify-between rounded-xl border border-gray-100 bg-gray-50 px-4 py-3 text-left transition-all duration-300 hover:bg-gray-100"
              >
                <div>
                  <p className="text-sm font-semibold text-gray-800">Well Rested</p>
                  <p className="text-xs text-gray-500">Slept 6–8 hours for a smoother donation.</p>
                </div>
                <CheckCircle className={`w-5 h-5 ${eligibilityChecklist.rested ? 'text-red-600' : 'text-gray-300'}`} />
              </button>
              <button
                type="button"
                onClick={() => handleChecklistToggle('ateMeal')}
                disabled={checklistSaving}
                className="w-full flex items-center justify-between rounded-xl border border-gray-100 bg-gray-50 px-4 py-3 text-left transition-all duration-300 hover:bg-gray-100"
              >
                <div>
                  <p className="text-sm font-semibold text-gray-800">Ate a Light Meal</p>
                  <p className="text-xs text-gray-500">Avoids dizziness; keep it light and balanced.</p>
                </div>
                <CheckCircle className={`w-5 h-5 ${eligibilityChecklist.ateMeal ? 'text-red-600' : 'text-gray-300'}`} />
              </button>
            </div>
          </div>
          <div className="mt-4 flex items-center justify-between text-[11px] text-gray-500">
            <div className="space-y-1">
              <span>
                {checklistUpdatedAt ? `Updated ${formatDateTime(checklistUpdatedAt)}` : 'Not updated yet'}
              </span>
              {checklistStale && (
                <p className="text-[10px] text-red-600">It’s been over a week since your last check-in.</p>
              )}
            </div>
            <div className="flex items-center gap-3">
              {checklistSaving && <span className="text-red-600">Saving...</span>}
              <button
                type="button"
                onClick={handleChecklistReset}
                disabled={checklistSaving}
                className="text-[11px] font-semibold text-red-600 hover:text-red-700 disabled:opacity-50"
              >
                Reset
              </button>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-xl p-6 border-2 border-red-100 h-full">
          <h2 className="text-lg font-bold text-gray-800 mb-3 flex items-center">
            <BookOpen className="w-5 h-5 mr-2 text-red-600" />
            Today's Health Tip
          </h2>
          {isLoading ? (
            <div className="space-y-3">
              <div className="h-4 w-full rounded-full bg-gray-100 animate-pulse" />
              <div className="h-4 w-3/4 rounded-full bg-gray-100 animate-pulse" />
              <div className="h-10 rounded-xl bg-gray-100 animate-pulse" />
            </div>
          ) : (
            <>
              <p className="text-sm text-gray-700 mb-4">
                💧 Drink plenty of water before and after donation to help your body replenish fluids quickly. Aim for 8-10 glasses of water daily!
              </p>
              <button
                onClick={handleLearnMore}
                className="w-full py-2 bg-red-600 text-white text-sm font-semibold rounded-xl hover:bg-red-700 transition-all duration-300"
              >
                Learn More
              </button>
            </>
          )}
        </div>
      </div>
    </>
  );
};

export default DonorReadiness;
