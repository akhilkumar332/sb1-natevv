import { AdminUsersPage } from './Users';

function AdminDonorsPage() {
  return (
    <AdminUsersPage
      roleFilter="donor"
      title="Donor Management"
      description="Manage donor accounts, verification, and donor status lifecycle."
    />
  );
}

export default AdminDonorsPage;
