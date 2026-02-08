/**
 * Legacy wrapper for HospitalAnalyticsDashboard
 *
 * Use BloodBankAnalyticsDashboard instead.
 */

import React from 'react';
import {
  BloodBankAnalyticsDashboard,
} from './BloodBankAnalyticsDashboard';

interface HospitalAnalyticsDashboardProps {
  hospitalId: string;
}

export const HospitalAnalyticsDashboard: React.FC<HospitalAnalyticsDashboardProps> = ({
  hospitalId,
}) => {
  return <BloodBankAnalyticsDashboard bloodBankId={hospitalId} />;
};

export default HospitalAnalyticsDashboard;
