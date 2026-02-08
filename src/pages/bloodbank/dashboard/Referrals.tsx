import { useOutletContext } from 'react-router-dom';
import ReferralsPanel from '../../../components/referrals/ReferralsPanel';
import type { BloodBankDashboardContext } from '../BloodBankDashboard';

const BloodBankReferrals = () => {
  const {
    referralLoading,
    referralUsersLoading,
    referralCount,
    referralMilestone,
    referralDetails,
    eligibleReferralCount,
    referralSummary,
    copyInviteLink,
    shareInviteLink,
    openWhatsAppInvite,
    referralQrDataUrl,
    referralQrLoading,
    loadReferralQr,
  } = useOutletContext<BloodBankDashboardContext>();

  const formatDate = (date?: Date | string) => {
    if (!date) return 'N/A';
    const parsed = typeof date === 'string' ? new Date(date) : date;
    return parsed.toLocaleDateString();
  };

  return (
    <ReferralsPanel
      variant="bloodbank"
      referralLoading={referralLoading}
      referralUsersLoading={referralUsersLoading}
      referralCount={referralCount}
      referralMilestone={referralMilestone}
      referralDetails={referralDetails}
      eligibleReferralCount={eligibleReferralCount}
      referralSummary={referralSummary}
      copyInviteLink={copyInviteLink}
      shareInviteLink={shareInviteLink}
      openWhatsAppInvite={openWhatsAppInvite}
      referralQrDataUrl={referralQrDataUrl}
      referralQrLoading={referralQrLoading}
      loadReferralQr={loadReferralQr}
      formatDate={formatDate}
    />
  );
};

export default BloodBankReferrals;
