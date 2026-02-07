import { useOutletContext } from 'react-router-dom';
import ReferralsPanel from '../../../components/referrals/ReferralsPanel';
import type { NgoDashboardContext } from '../NgoDashboard';

const NgoReferrals = () => {
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
  } = useOutletContext<NgoDashboardContext>();

  const formatDate = (date?: Date | string) => {
    if (!date) return 'N/A';
    const d = typeof date === 'string' ? new Date(date) : date;
    return d.toLocaleDateString();
  };

  return (
    <ReferralsPanel
      variant="ngo"
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

export default NgoReferrals;
