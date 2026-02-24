import { AdminUsersPage } from './Users';

function AdminNgosPage() {
  return (
    <AdminUsersPage
      roleFilter="ngo"
      title="NGO Management"
      description="Manage NGO accounts, verification status, and operational access."
    />
  );
}

export default AdminNgosPage;
