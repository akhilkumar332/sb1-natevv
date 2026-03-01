import { Navigate } from 'react-router-dom';
import { ROUTES } from '../../constants/routes';

const HospitalLogin = () => <Navigate to={ROUTES.portal.bloodbank.login} replace />;

export default HospitalLogin;
