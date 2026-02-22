import React from 'react';
import { Shield } from 'lucide-react';

type PortalRole = 'donor' | 'ngo' | 'bloodbank' | 'admin';

interface SuperAdminPortalModalProps {
  isOpen: boolean;
  currentPortal: PortalRole;
  onSelect: (role: PortalRole) => void;
}

const portalLabels: Record<PortalRole, string> = {
  donor: 'Donor',
  ngo: 'NGO',
  bloodbank: 'Blood Bank',
  admin: 'Admin',
};

const portalOrder: PortalRole[] = ['donor', 'ngo', 'bloodbank', 'admin'];

const SuperAdminPortalModal: React.FC<SuperAdminPortalModalProps> = ({
  isOpen,
  currentPortal,
  onSelect,
}) => {
  if (!isOpen) return null;

  const otherPortals = portalOrder.filter((role) => role !== currentPortal);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm px-4">
      <div className="w-full max-w-lg rounded-2xl border border-red-100 bg-white shadow-2xl">
        <div className="flex items-center justify-between rounded-t-2xl bg-gradient-to-r from-red-600 to-red-700 px-6 py-4 text-white">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white/15">
              <Shield className="h-5 w-5 text-white" />
            </div>
            <div>
              <p className="text-xs uppercase tracking-[0.3em] text-white/70">SuperAdmin</p>
              <h3 className="text-lg font-semibold">Choose Your Portal</h3>
            </div>
          </div>
        </div>
        <div className="px-6 py-6">
          <p className="text-sm text-gray-700">
            Select the portal you want to access for this session.
          </p>
          <div className="mt-5 grid gap-3">
            <button
              onClick={() => onSelect(currentPortal)}
              className="w-full rounded-xl bg-red-600 px-4 py-3 text-sm font-semibold text-white transition-all duration-300 hover:bg-red-700"
            >
              Continue to {portalLabels[currentPortal]} Portal
            </button>
            {otherPortals.map((role) => (
              <button
                key={role}
                onClick={() => onSelect(role)}
                className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm font-semibold text-gray-700 transition-all duration-300 hover:border-red-200 hover:bg-red-50"
              >
                Go to {portalLabels[role]} Dashboard
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default SuperAdminPortalModal;
