import { Navigate } from 'react-router-dom';
import { ROUTES } from '../../constants/routes';

const HospitalOnboarding = () => <Navigate to={ROUTES.portal.bloodbank.onboarding} replace />;

export default HospitalOnboarding;
