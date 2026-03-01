import { Navigate } from 'react-router-dom';
import { ROUTES } from '../../constants/routes';

const HospitalDashboard = () => <Navigate to={ROUTES.portal.bloodbank.dashboard.root} replace />;

export default HospitalDashboard;
