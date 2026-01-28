import { useOutletContext } from 'react-router-dom';
import { AlertCircle, CheckCircle, Droplet, Loader2, MapPin, MapPinned } from 'lucide-react';

const DonorRequests = () => {
  const dashboard = useOutletContext<any>();

  const {
    isLoading,
    emergencyRequests,
    responding,
    handleRespondToRequest,
    handleViewAllRequests,
    bloodCamps,
    handleViewAllCamps,
    formatDate,
    formatTime,
  } = dashboard;

  return (
    <>
      <div className="mb-10">
        <div className="mb-4">
          <p className="text-xs uppercase tracking-[0.3em] text-red-600">Urgent Nearby</p>
          <h2 className="text-xl font-bold text-gray-900">Emergency requests</h2>
        </div>
        <div className="bg-white rounded-2xl shadow-xl p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-bold text-gray-800 flex items-center">
              <AlertCircle className="w-6 h-6 mr-2 text-red-500" />
              Nearby Emergency Requests
            </h2>
            <span className="px-3 py-1 bg-red-100 text-red-600 rounded-full text-sm font-semibold">
              {emergencyRequests.length} Active
            </span>
          </div>
          <div className="space-y-4">
            {isLoading ? (
              Array.from({ length: 3 }).map((_, index) => (
                <div
                  key={`request-skeleton-${index}`}
                  className="p-4 border-2 border-gray-100 rounded-xl bg-gray-50"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-4">
                      <div className="p-3 rounded-xl bg-gray-100 animate-pulse w-12 h-12" />
                      <div className="space-y-2">
                        <div className="h-4 w-48 rounded-full bg-gray-100 animate-pulse" />
                        <div className="h-3 w-40 rounded-full bg-gray-100 animate-pulse" />
                        <div className="h-3 w-24 rounded-full bg-gray-100 animate-pulse" />
                      </div>
                    </div>
                    <div className="h-8 w-20 rounded-xl bg-gray-100 animate-pulse" />
                  </div>
                </div>
              ))
            ) : emergencyRequests.length > 0 ? (
              emergencyRequests.map((request: any) => (
                <div
                  key={request.id}
                  className={`p-4 border-2 rounded-xl transition-all duration-300 cursor-pointer ${
                    request.urgency === 'critical'
                      ? 'border-red-300 bg-red-50 hover:bg-red-100'
                      : request.urgency === 'high'
                      ? 'border-red-200 bg-red-50/70 hover:bg-red-100/80'
                      : 'border-red-100 bg-white hover:bg-red-50'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-4">
                      <div className={`p-3 rounded-xl ${
                        request.urgency === 'critical' ? 'bg-red-600' :
                        request.urgency === 'high' ? 'bg-red-500' : 'bg-red-400'
                      }`}>
                        <Droplet className="w-6 h-6 text-white" />
                      </div>
                      <div>
                        <h3 className="font-bold text-gray-800 mb-1">
                          Urgent: {request.bloodType} - {request.units} Units needed
                        </h3>
                        <p className="text-sm text-gray-600 flex items-center">
                          <MapPin className="w-4 h-4 mr-1" />
                          {request.hospitalName}, {request.city}
                          {request.distance && ` - ${request.distance.toFixed(1)} km away`}
                        </p>
                        <p className="text-xs text-gray-500 mt-1">
                          Posted {formatTime(request.requestedAt)}
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={() => handleRespondToRequest(request.id)}
                      disabled={responding}
                      className="px-4 py-2 bg-red-600 text-white rounded-xl hover:bg-red-700 transition-all duration-300 font-semibold disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
                    >
                      {responding ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          <span>Sending...</span>
                        </>
                      ) : (
                        <span>Respond</span>
                      )}
                    </button>
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center py-8">
                <CheckCircle className="w-12 h-12 text-red-500 mx-auto mb-3" />
                <p className="text-gray-600">No emergency requests matching your blood type at the moment.</p>
              </div>
            )}
          </div>
          {emergencyRequests.length > 0 && (
            <button
              onClick={handleViewAllRequests}
              className="w-full mt-4 py-3 text-red-600 font-semibold hover:bg-red-50 rounded-xl transition-all duration-300"
            >
              View All Requests →
            </button>
          )}
        </div>
      </div>

      <div className="mb-10">
        <div className="bg-white rounded-2xl shadow-xl p-6">
          <h2 className="text-lg font-bold text-gray-800 mb-4 flex items-center">
            <MapPinned className="w-5 h-5 mr-2 text-red-600" />
            Nearby Blood Camps
          </h2>
          {isLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 3 }).map((_, index) => (
                <div key={`camp-skeleton-${index}`} className="h-16 rounded-xl bg-gray-100 animate-pulse" />
              ))}
            </div>
          ) : (
            <>
              <div className="space-y-3">
                {bloodCamps.length > 0 ? (
                  bloodCamps.map((camp: any) => (
                    <div key={camp.id} className="p-3 bg-red-50 rounded-xl border-2 border-red-200 hover:bg-red-100 transition-all duration-300 cursor-pointer">
                      <h3 className="font-semibold text-gray-800 text-sm mb-1">{camp.name}</h3>
                      <p className="text-xs text-gray-600 flex items-center mb-1">
                        <MapPin className="w-3 h-3 mr-1" />
                        {camp.location}
                      </p>
                      <p className="text-xs text-gray-500">
                        {formatDate(camp.date)}, {camp.startTime} - {camp.endTime}
                      </p>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-gray-500 text-center py-4">No upcoming blood camps in your area</p>
                )}
              </div>
              {bloodCamps.length > 0 && (
                <button
                  onClick={handleViewAllCamps}
                  className="w-full mt-4 py-2 text-sm text-red-600 font-semibold hover:bg-red-50 rounded-xl transition-all duration-300"
                >
                  View All Camps →
                </button>
              )}
            </>
          )}
        </div>
      </div>
    </>
  );
};

export default DonorRequests;
