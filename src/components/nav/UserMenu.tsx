// src/components/nav/UserMenu.tsx
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { User as UserIcon, LogOut } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';

export function UserMenu() {
  const { user, authLoading, logout } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout(navigate);
  };

  if(authLoading) {
    return (
      <div className="relative">
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="flex items-center space-x-2 focus:outline-none"
        >
          {user?.photoURL ? (
            <img
              src={user.photoURL}
              alt={user.displayName || 'User'}
              className="w-8 h-8 rounded-full object-cover border-2 border-red-500"
            />
          ) : (
            <div className="w-8 h-8 rounded-full bg-red-500 flex items-center justify-center">
              <UserIcon className="w-5 h-5 text-white" />
            </div>
          )}
          <span className="hidden md:inline text-gray-700">
            {user?.displayName || 'User'}
          </span>
        </button>
        
        {isOpen && (
          <div className="absolute right-0 mt-2 w-48 bg-white rounded-md shadow-lg py-1 z-10 border border-gray-100">
            <Link
              to="/profile"
              className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
              onClick={() => setIsOpen(false)}
            >
              Profile
            </Link>
            <button
              onClick={handleLogout}
              className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
            >
              <LogOut className="inline-block w-4 h-4 mr-2" />
              Logout
            </button>
          </div>
        )}
      </div>
    );
  }  
}

export function MobileUserMenu() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout(navigate);
  };

  return (
    <div className="space-y-2 border-t border-gray-200 pt-4">
      <div className="flex items-center space-x-2 px-3 py-2">
        {user?.photoURL ? (
          <img
            src={user.photoURL}
            alt={user.displayName || 'User'}
            className="w-8 h-8 rounded-full object-cover border-2 border-red-500"
          />
        ) : (
          <div className="w-8 h-8 rounded-full bg-red-500 flex items-center justify-center">
            <UserIcon className="w-5 h-5 text-white" />
          </div>
        )}
        <span className="text-gray-700">{user?.displayName || 'User'}</span>
      </div>
      <Link
        to="/profile"
        className="block px-3 py-2 text-gray-600 hover:text-gray-900 hover:bg-gray-50"
      >
        Profile
      </Link>
      <button
        onClick={handleLogout}
        className="flex items-center w-full px-3 py-2 text-gray-600 hover:text-gray-900 hover:bg-gray-50"
      >
        <LogOut className="w-4 h-4 mr-2" />
        Logout
      </button>
    </div>
  );
}