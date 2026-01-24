import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

type BhIdBannerProps = {
  className?: string;
};

const BhIdBanner = ({ className }: BhIdBannerProps) => {
  const { user } = useAuth();

  if (!user || user.bhId) {
    return null;
  }

  const hasDob = Boolean(user.dateOfBirth);
  const postalDigits = (user.postalCode || '').replace(/\D/g, '');
  const hasPostal = postalDigits.length >= 2;

  if (hasDob && hasPostal) {
    return null;
  }

  if (!user.role) {
    return null;
  }

  return (
    <div className={`rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-amber-900 shadow-sm ${className || ''}`}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-semibold">Complete your profile to generate your BH ID.</p>
          <p className="text-sm text-amber-800">
            Add your date of birth and postal code to receive your unique BH ID.
          </p>
        </div>
        <Link
          to={`/${user.role}/onboarding`}
          className="inline-flex items-center justify-center rounded-lg bg-amber-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-amber-700"
        >
          Complete Profile
        </Link>
      </div>
    </div>
  );
};

export default BhIdBanner;
