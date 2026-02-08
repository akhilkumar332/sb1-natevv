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
  Calendar,
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

  return (
    <div className="bg-white rounded-lg shadow-md overflow-hidden hover:shadow-lg transition-shadow">
      {/* Banner Image */}
      {campaign.bannerImage && (
        <div className="h-48 overflow-hidden bg-gray-200">
          <img
            src={campaign.bannerImage}
            alt={campaign.title}
            className="w-full h-full object-cover"
          />
        </div>
      )}

      <div className="p-6">
        {/* Header */}
        <div className="flex justify-between items-start mb-3">
          <div className="flex items-center gap-2">
            {getTypeIcon(campaign.type)}
            <span className="text-sm font-medium text-gray-600">
              {getTypeLabel(campaign.type)}
            </span>
          </div>
          <span
            className={`px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(
              campaign.status
            )}`}
          >
            {getStatusLabel(campaign.status)}
          </span>
        </div>

        <h3 className="text-xl font-semibold text-gray-900 mb-2">
          {campaign.title}
        </h3>

        <p className="text-sm text-gray-600 mb-4 line-clamp-2">
          {campaign.description}
        </p>

        {/* Organization */}
        <div className="flex items-center gap-2 mb-4">
          <Users className="w-4 h-4 text-gray-600" />
          <span className="text-sm text-gray-700">{campaign.ngoName}</span>
        </div>

        {/* Location */}
        <div className="flex items-start gap-2 mb-4">
          <MapPin className="w-4 h-4 text-gray-600 mt-0.5" />
          <div className="flex-1">
            <p className="text-sm text-gray-700">
              {campaign.location.venue && `${campaign.location.venue}, `}
              {campaign.location.city}, {campaign.location.state}
            </p>
            {campaign.location.address && (
              <p className="text-xs text-gray-500">{campaign.location.address}</p>
            )}
          </div>
        </div>

        {/* Dates */}
        <div className="flex items-center gap-2 mb-4">
          <Calendar className="w-4 h-4 text-gray-600" />
          <span className="text-sm text-gray-700">
            {formatDate(campaign.startDate)} - {formatDate(campaign.endDate)}
          </span>
        </div>

        {/* Progress */}
        <div className="mb-4">
          <ProgressBar
            current={campaign.achieved}
            target={campaign.target}
            label={`Target: ${campaign.target} ${getTargetTypeLabel(campaign.targetType)}`}
            color="red"
            showPercentage
            showValues
          />
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-4 mb-4 pb-4 border-b">
          <div>
            <p className="text-xs text-gray-600">Registered</p>
            <p className="text-lg font-semibold text-gray-900">
              {campaign.registeredDonors?.length || 0}
            </p>
          </div>
          <div>
            <p className="text-xs text-gray-600">Confirmed</p>
            <p className="text-lg font-semibold text-gray-900">
              {campaign.confirmedDonors?.length || 0}
            </p>
          </div>
          <div>
            <p className="text-xs text-gray-600">Volunteers</p>
            <p className="text-lg font-semibold text-gray-900">
              {campaign.volunteers?.length || 0}
            </p>
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-2">
          {canRegister && campaign.id && (
            <button
              onClick={() => onRegister(campaign.id!)}
              className="flex-1 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 transition-colors font-medium"
            >
              Register
            </button>
          )}

          {isRegistered && (
            <div className="flex-1 px-4 py-2 bg-green-100 text-green-800 rounded font-medium text-center">
              Registered ✓
            </div>
          )}

          {onViewDetails && campaign.id && (
            <button
              onClick={() => onViewDetails(campaign.id!)}
              className={`${
                canRegister || isRegistered ? 'flex-shrink-0' : 'flex-1'
              } px-4 py-2 bg-gray-200 text-gray-700 rounded hover:bg-gray-300 transition-colors font-medium`}
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
