/**
 * CampaignCard Component
 *
 * Displays campaign information with registration and progress
 */

import React from 'react';
import { Campaign } from '../../types/database.types';
import { formatDate } from '../../utils/dataTransform';
import { ProgressBar } from './ProgressBar';
import {
  MapPin,
  Users,
  Target,
  Heart,
  AlertCircle,
  DollarSign,
} from 'lucide-react';

interface CampaignCardProps {
  campaign: Campaign;
  onRegister?: (campaignId: string) => void;
  onViewDetails?: (campaignId: string) => void;
  isRegistered?: boolean;
  userRole?: 'donor' | 'bloodbank' | 'hospital' | 'ngo' | 'admin';
}

/**
 * CampaignCard component
 */
export const CampaignCard: React.FC<CampaignCardProps> = ({
  campaign,
  onRegister,
  onViewDetails,
  isRegistered = false,
  userRole,
}) => {
  const getStatusColor = (status: Campaign['status']) => {
    const colorMap = {
      draft: 'bg-gray-100 text-gray-800',
      active: 'bg-green-100 text-green-800',
      upcoming: 'bg-blue-100 text-blue-800',
      completed: 'bg-gray-100 text-gray-800',
      cancelled: 'bg-red-100 text-red-800',
    };
    return colorMap[status] || 'bg-gray-100 text-gray-800';
  };

  const getStatusLabel = (status: Campaign['status']) => {
    const labelMap = {
      draft: 'Draft',
      active: 'Active',
      upcoming: 'Upcoming',
      completed: 'Completed',
      cancelled: 'Cancelled',
    };
    return labelMap[status] || status;
  };

  const getTypeIcon = (type: Campaign['type']) => {
    const iconClass = 'w-5 h-5';
    switch (type) {
      case 'blood-drive':
        return <Heart className={`${iconClass} text-red-600`} />;
      case 'awareness':
        return <AlertCircle className={`${iconClass} text-blue-600`} />;
      case 'fundraising':
        return <DollarSign className={`${iconClass} text-green-600`} />;
      case 'volunteer':
        return <Users className={`${iconClass} text-purple-600`} />;
      default:
        return <Target className={`${iconClass} text-gray-600`} />;
    }
  };

  const getTypeLabel = (type: Campaign['type']) => {
    const labelMap = {
      'blood-drive': 'Blood Drive',
      'awareness': 'Awareness Campaign',
      'fundraising': 'Fundraising',
      'volunteer': 'Volunteer Drive',
    };
    return labelMap[type] || type;
  };

  const getTargetTypeLabel = (targetType: Campaign['targetType']) => {
    const labelMap = {
      units: 'Units',
      donors: 'Donors',
      funds: 'Funds',
      volunteers: 'Volunteers',
    };
    return labelMap[targetType] || targetType;
  };

  const canRegister =
    campaign.status === 'active' &&
    !isRegistered &&
    userRole === 'donor' &&
    onRegister;

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const toDateValue = (value: any) => {
    if (!value) return null;
    if (value instanceof Date) return value;
    if (typeof value?.toDate === 'function') return value.toDate();
    if (typeof value === 'string' || typeof value === 'number') {
      const parsed = new Date(value);
      return Number.isNaN(parsed.getTime()) ? null : parsed;
    }
    return null;
  };
  const startDate = toDateValue(campaign.startDate) || new Date();
  const endDate = toDateValue(campaign.endDate) || new Date();
  const daysUntilStart = Math.ceil((startDate.getTime() - today.getTime()) / 86400000);
  const daysToEnd = Math.ceil((endDate.getTime() - today.getTime()) / 86400000);
  const scheduleLabel = daysUntilStart > 0
    ? `Starts in ${daysUntilStart}d`
    : daysToEnd > 0
      ? `${daysToEnd}d left`
      : 'Ended';

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-lg hover:shadow-xl transition-shadow">
      {campaign.bannerImage && (
        <div className="h-44 overflow-hidden bg-gray-100 rounded-t-2xl">
          <img
            src={campaign.bannerImage}
            alt={campaign.title}
            className="w-full h-full object-cover"
          />
        </div>
      )}

      <div className="p-6">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-red-50 flex items-center justify-center">
              {getTypeIcon(campaign.type)}
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-2 rounded-full border border-red-100 bg-red-50 px-3 py-1 text-xs font-semibold text-red-600">
                  {getTypeLabel(campaign.type)}
                </span>
                <span className={`px-3 py-1 rounded-full text-xs font-semibold ${getStatusColor(campaign.status)}`}>
                  {getStatusLabel(campaign.status)}
                </span>
                <span className="px-3 py-1 rounded-full text-xs font-semibold border border-gray-200 text-gray-500">
                  {scheduleLabel}
                </span>
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mt-3">{campaign.title}</h3>
              <p className="text-sm text-gray-500 mt-1 line-clamp-2">{campaign.description}</p>
            </div>
          </div>
          <div className="text-right text-xs text-gray-500">
            <div className="font-semibold text-gray-700">
              {formatDate(campaign.startDate)} • {formatDate(campaign.endDate)}
            </div>
            <div className="mt-1">
              {campaign.location?.city}, {campaign.location?.state}
            </div>
          </div>
        </div>

        <div className="mt-4 flex items-center gap-2 text-xs text-gray-500">
          <Users className="w-4 h-4" />
          <span>{campaign.ngoName}</span>
          <span className="text-gray-300">•</span>
          <MapPin className="w-4 h-4" />
          <span>
            {campaign.location?.venue && `${campaign.location.venue}, `}
            {campaign.location?.city}
          </span>
        </div>

        <div className="mt-5">
          <ProgressBar
            current={campaign.achieved}
            target={campaign.target}
            label={`Target: ${campaign.target} ${getTargetTypeLabel(campaign.targetType)}`}
            color="red"
            showPercentage
            showValues
          />
        </div>

        <div className="mt-4 grid grid-cols-3 gap-4 border-t border-gray-100 pt-4 text-center">
          <div>
            <p className="text-xs text-gray-500">Registered</p>
            <p className="text-lg font-semibold text-gray-900">{campaign.registeredDonors?.length || 0}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500">Confirmed</p>
            <p className="text-lg font-semibold text-gray-900">{campaign.confirmedDonors?.length || 0}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500">Volunteers</p>
            <p className="text-lg font-semibold text-gray-900">{campaign.volunteers?.length || 0}</p>
          </div>
        </div>

        <div className="mt-5 flex flex-wrap gap-2">
          {canRegister && campaign.id && (
            <button
              onClick={() => onRegister(campaign.id!)}
              className="flex-1 px-4 py-2 bg-red-600 text-white rounded-xl hover:bg-red-700 transition-colors font-semibold"
            >
              Register
            </button>
          )}

          {isRegistered && (
            <div className="flex-1 px-4 py-2 bg-emerald-100 text-emerald-800 rounded-xl font-semibold text-center">
              Registered ✓
            </div>
          )}

          {onViewDetails && campaign.id && (
            <button
              onClick={() => onViewDetails(campaign.id!)}
              className={`${
                canRegister || isRegistered ? 'flex-shrink-0' : 'flex-1'
              } px-4 py-2 bg-gray-100 text-gray-700 rounded-xl hover:bg-gray-200 transition-colors font-semibold`}
            >
              View Details
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default CampaignCard;
