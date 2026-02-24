import { AdminUsersPage } from './Users';

function AdminBloodBanksPage() {
  return (
    <AdminUsersPage
      roleFilter="bloodbank"
      title="BloodBank Management"
      description="Manage blood bank and hospital accounts, access, and account status."
    />
  );
}

export default AdminBloodBanksPage;
