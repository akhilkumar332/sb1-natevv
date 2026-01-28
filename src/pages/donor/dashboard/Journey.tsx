import { useOutletContext } from 'react-router-dom';
import { Activity, Droplet, Download, Edit3, MessageCircle, Save, Star, Trophy, XCircle } from 'lucide-react';

const DonorJourney = () => {
  const dashboard = useOutletContext<any>();

  const {
    isLoading,
    donationHistory,
    donationFeedbackMap,
    feedbackOpenId,
    editingDonationId,
    editingDonationData,
    setEditingDonationData,
    donationEditSaving,
    handleStartDonationEdit,
    handleDonationEditSave,
    handleCancelDonationEdit,
    handleOpenFeedback,
    handleDownloadCertificate,
    formatDate,
    formatDateTime,
    feedbackForm,
    setFeedbackForm,
    feedbackSaving,
    handleSaveFeedback,
    handleCancelFeedback,
    handleBookDonation,
    badges,
    handleViewAllBadges,
  } = dashboard;

  return (
    <>
      <div className="mb-6">
        <p className="text-xs uppercase tracking-[0.3em] text-red-600">Your Journey</p>
        <h2 className="text-xl font-bold text-gray-900">Donations and achievements</h2>
      </div>
      <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
        <div className="bg-white rounded-2xl shadow-xl p-6">
          <h2 className="text-xl font-bold text-gray-800 mb-6 flex items-center">
            <Activity className="w-6 h-6 mr-2 text-red-600" />
            Donation History
          </h2>
          {isLoading ? (
            <div className="space-y-4">
              {Array.from({ length: 3 }).map((_, index) => (
                <div
                  key={`donation-skeleton-${index}`}
                  className="p-4 bg-gray-50 rounded-xl border border-gray-100"
                >
                  <div className="flex items-center space-x-4">
                    <div className="h-12 w-12 rounded-xl bg-gray-100 animate-pulse" />
                    <div className="flex-1 space-y-2">
                      <div className="h-4 w-40 rounded-full bg-gray-100 animate-pulse" />
                      <div className="h-3 w-32 rounded-full bg-gray-100 animate-pulse" />
                      <div className="h-3 w-24 rounded-full bg-gray-100 animate-pulse" />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : donationHistory.length > 0 ? (
            <div className="space-y-4">
              {donationHistory.map((donation: any) => {
                const isSelfReported = donation.source === 'manual';
                const feedbackEntry = donationFeedbackMap[donation.id];
                const isFeedbackOpen = feedbackOpenId === donation.id;
                const displayCertificateUrl = donation.certificateUrl || feedbackEntry?.certificateUrl;
                const hasFeedback = Boolean(
                  feedbackEntry?.rating || feedbackEntry?.notes || feedbackEntry?.certificateUrl
                );
                return (
                  <div
                    key={donation.id}
                    className="rounded-xl border border-gray-100 bg-gray-50 p-4 transition-all duration-300 hover:bg-gray-100"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex items-start space-x-4">
                        <div className="p-3 bg-red-100 rounded-xl">
                          <Droplet className="w-6 h-6 text-red-600" />
                        </div>
                        <div className="flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <h3 className="font-semibold text-gray-800">
                              {donation.bloodBank || 'Donation'}
                            </h3>
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wide bg-white border border-red-200 text-red-600">
                              {isSelfReported ? 'Self Reported' : 'Verified'}
                            </span>
                          </div>
                          <p className="text-sm text-gray-600">{donation.location || 'Location not set'}</p>
                          <p className="text-xs text-gray-500">
                            {formatDate(donation.date)} • {donation.units} unit{donation.units === 1 ? '' : 's'}
                          </p>
                          {donation.notes && (
                            <p className="text-xs text-gray-500 mt-1">{donation.notes}</p>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => handleStartDonationEdit(donation)}
                          className="p-2 hover:bg-white rounded-lg transition-all duration-300"
                          title="Edit donation"
                        >
                          <Edit3 className="w-4 h-4 text-gray-600" />
                        </button>
                        {displayCertificateUrl && (
                          <button
                            onClick={() => handleDownloadCertificate(displayCertificateUrl || '')}
                            className="p-2 hover:bg-white rounded-lg transition-all duration-300"
                            title="Download certificate"
                          >
                            <Download className="w-5 h-5 text-gray-600" />
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => handleOpenFeedback(donation.id)}
                          className="p-2 hover:bg-white rounded-lg transition-all duration-300"
                          title={hasFeedback ? 'Edit feedback' : 'Add feedback'}
                        >
                          <MessageCircle className="w-4 h-4 text-gray-600" />
                        </button>
                      </div>
                    </div>
                    {editingDonationId === donation.id && (
                      <div className="mt-4 grid gap-3 sm:grid-cols-3">
                        <div className="sm:col-span-2">
                          <label className="text-xs font-semibold text-gray-600">Location</label>
                          <input
                            type="text"
                            value={editingDonationData.location}
                            onChange={(event) => setEditingDonationData((prev: any) => ({
                              ...prev,
                              location: event.target.value,
                            }))}
                            className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2 text-sm text-gray-800 focus:border-red-500 focus:outline-none focus:ring-2 focus:ring-red-100"
                          />
                        </div>
                        <div>
                          <label className="text-xs font-semibold text-gray-600">Units</label>
                          <input
                            type="number"
                            min="1"
                            value={editingDonationData.units}
                            onChange={(event) => setEditingDonationData((prev: any) => ({
                              ...prev,
                              units: Number(event.target.value),
                            }))}
                            className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2 text-sm text-gray-800 focus:border-red-500 focus:outline-none focus:ring-2 focus:ring-red-100"
                          />
                        </div>
                        <div className="sm:col-span-3">
                          <label className="text-xs font-semibold text-gray-600">Notes</label>
                          <textarea
                            value={editingDonationData.notes}
                            onChange={(event) => setEditingDonationData((prev: any) => ({
                              ...prev,
                              notes: event.target.value,
                            }))}
                            rows={2}
                            className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2 text-sm text-gray-800 focus:border-red-500 focus:outline-none focus:ring-2 focus:ring-red-100"
                          />
                        </div>
                        <div className="flex flex-col sm:flex-row gap-2 sm:col-span-3">
                          <button
                            type="button"
                            onClick={handleDonationEditSave}
                            disabled={donationEditSaving}
                            className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 transition-all duration-300 disabled:opacity-50"
                          >
                            <Save className="w-4 h-4" />
                            {donationEditSaving ? 'Saving...' : 'Save Changes'}
                          </button>
                          <button
                            type="button"
                            onClick={handleCancelDonationEdit}
                            className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl border border-gray-200 px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-100 transition-all duration-300"
                          >
                            <XCircle className="w-4 h-4" />
                            Cancel
                          </button>
                        </div>
                      </div>
                    )}
                    {!isFeedbackOpen && hasFeedback && (
                      <div className="mt-4 rounded-xl border border-red-100 bg-white/80 px-4 py-3">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-[10px] uppercase tracking-wide text-gray-500">Feedback</p>
                            <div className="mt-1 flex items-center gap-1">
                              {[1, 2, 3, 4, 5].map((value) => (
                                <Star
                                  key={`feedback-star-${donation.id}-${value}`}
                                  className={`h-4 w-4 ${
                                    (feedbackEntry?.rating || 0) >= value
                                      ? 'text-yellow-400 fill-yellow-400'
                                      : 'text-gray-300'
                                  }`}
                                />
                              ))}
                            </div>
                            {feedbackEntry?.notes && (
                              <p className="text-xs text-gray-600 mt-1">{feedbackEntry.notes}</p>
                            )}
                          </div>
                          {displayCertificateUrl && (
                            <button
                              type="button"
                              onClick={() => handleDownloadCertificate(displayCertificateUrl || '')}
                              className="inline-flex items-center gap-2 rounded-full border border-red-200 bg-white px-3 py-1 text-[11px] font-semibold text-red-600 hover:bg-red-50 transition-all duration-300"
                            >
                              <Download className="h-3 w-3" />
                              Certificate
                            </button>
                          )}
                        </div>
                        {feedbackEntry?.updatedAt && (
                          <p className="mt-2 text-[11px] text-gray-500">
                            Updated {formatDateTime(feedbackEntry.updatedAt)}
                          </p>
                        )}
                      </div>
                    )}
                    {isFeedbackOpen && (
                      <div className="mt-4 rounded-xl border border-red-100 bg-white px-4 py-4">
                        <p className="text-[11px] uppercase tracking-wide text-red-600">Post-donation feedback</p>
                        <div className="mt-3 flex items-center justify-between">
                          <span className="text-sm font-semibold text-gray-800">Rating</span>
                          <div className="flex items-center gap-1">
                            {[1, 2, 3, 4, 5].map((value) => (
                              <button
                                key={`rating-${donation.id}-${value}`}
                                type="button"
                                onClick={() => setFeedbackForm((prev: any) => ({ ...prev, rating: value }))}
                                className="rounded-full p-1"
                              >
                                <Star
                                  className={`h-5 w-5 ${
                                    feedbackForm.rating >= value
                                      ? 'text-yellow-400 fill-yellow-400'
                                      : 'text-gray-300'
                                  }`}
                                />
                              </button>
                            ))}
                          </div>
                        </div>
                        <div className="mt-3">
                          <label className="text-xs font-semibold text-gray-600">Notes</label>
                          <textarea
                            value={feedbackForm.notes}
                            onChange={(event) => setFeedbackForm((prev: any) => ({
                              ...prev,
                              notes: event.target.value,
                            }))}
                            rows={3}
                            className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2 text-sm text-gray-800 focus:border-red-500 focus:outline-none focus:ring-2 focus:ring-red-100"
                            placeholder="Share your experience"
                          />
                        </div>
                        <div className="mt-3">
                          <label className="text-xs font-semibold text-gray-600">Certificate URL</label>
                          <input
                            type="url"
                            value={feedbackForm.certificateUrl}
                            onChange={(event) => setFeedbackForm((prev: any) => ({
                              ...prev,
                              certificateUrl: event.target.value,
                            }))}
                            className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2 text-sm text-gray-800 focus:border-red-500 focus:outline-none focus:ring-2 focus:ring-red-100"
                            placeholder="https://"
                          />
                        </div>
                        <div className="mt-4 flex flex-col gap-2 sm:flex-row">
                          <button
                            type="button"
                            onClick={() => handleSaveFeedback(donation.id)}
                            disabled={feedbackSaving}
                            className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 transition-all duration-300 disabled:opacity-50"
                          >
                            <MessageCircle className="h-4 w-4" />
                            {feedbackSaving ? 'Saving...' : 'Save Feedback'}
                          </button>
                          <button
                            type="button"
                            onClick={handleCancelFeedback}
                            className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl border border-gray-200 px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-100 transition-all duration-300"
                          >
                            <XCircle className="h-4 w-4" />
                            Cancel
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-12">
              <div className="p-4 bg-gray-100 rounded-full w-20 h-20 mx-auto mb-4 flex items-center justify-center">
                <Activity className="w-10 h-10 text-gray-400" />
              </div>
              <h3 className="text-lg font-semibold text-gray-800 mb-2">No Donations Yet</h3>
              <p className="text-gray-600 mb-4">Start your journey as a lifesaver today!</p>
              <button
                onClick={handleBookDonation}
                className="px-6 py-3 bg-gradient-to-r from-red-600 to-red-700 text-white rounded-xl font-semibold hover:from-red-700 hover:to-red-800 transition-all duration-300"
              >
                Book Your First Donation
              </button>
            </div>
          )}
        </div>

        <div className="space-y-6">
          <div className="bg-white rounded-2xl shadow-xl p-6">
            <h2 className="text-lg font-bold text-gray-800 mb-4 flex items-center">
              <Trophy className="w-5 h-5 mr-2 text-red-600" />
              Achievements
            </h2>
            {isLoading ? (
              <div className="grid grid-cols-3 gap-3">
                {Array.from({ length: 6 }).map((_, index) => (
                  <div key={`badge-skeleton-${index}`} className="h-16 rounded-xl bg-gray-100 animate-pulse" />
                ))}
              </div>
            ) : (
              <>
                <div className="grid grid-cols-3 gap-3">
                  {badges.map((badge: any) => (
                    <div
                      key={badge.id}
                      className={`p-4 rounded-xl text-center transition-all duration-300 ${
                        badge.earned
                          ? 'bg-gradient-to-br from-red-50 to-red-100 border-2 border-red-200 hover:scale-110'
                          : 'bg-gray-50 opacity-50'
                      }`}
                      title={badge.description}
                    >
                      <div className="text-3xl mb-2">{badge.icon}</div>
                      <p className="text-xs font-semibold text-gray-700">{badge.name}</p>
                    </div>
                  ))}
                </div>
                <button
                  onClick={handleViewAllBadges}
                  className="w-full mt-4 py-2 text-sm text-red-600 font-semibold hover:bg-red-50 rounded-xl transition-all duration-300"
                >
                  View All Badges →
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </>
  );
};

export default DonorJourney;
