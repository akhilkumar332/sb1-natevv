import { Navigate } from 'react-router-dom';
import { ROUTES } from '../../constants/routes';

const HospitalRegister = () => <Navigate to={ROUTES.portal.bloodbank.register} replace />;

export default HospitalRegister;
