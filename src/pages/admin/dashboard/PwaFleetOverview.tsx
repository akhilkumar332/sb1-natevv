import { Navigate } from 'react-router-dom';
import { ROUTES } from '../../../constants/routes';

export default function PwaFleetOverviewRedirect() {
  return <Navigate to={`${ROUTES.portal.admin.dashboard.pwaDiagnostics}?tab=fleet`} replace />;
}
