// src/components/Navbar.tsx
import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Menu, X, Droplet, LogOut } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

interface NavLinkProps {
  to: string;
  children: React.ReactNode;
}

function DesktopNavLink({ to, children }: NavLinkProps) {
  const location = useLocation();
  const isActive = location.pathname === to;
  
  return (
    <Link
      to={to}
      className={`text-gray-600 hover:text-gray-900 px-3 py-2 rounded-md text-sm font-medium ${
        isActive ? 'text-red-600 hover:text-red-700' : ''
      }`}
    >
      {children}
    </Link>
  );
}

function MobileNavLink({ to, children }: NavLinkProps) {
  const location = useLocation();
  const isActive = location.pathname === to;
  
  return (
    <Link
      to={to}
      className={`block px-3 py-2 rounded-md text-base font-medium ${
        isActive 
          ? 'text-red-600 hover:text-red-700 bg-red-50' 
          : 'text-gray-600 hover:text-gray-900'
      }`}
    >
      {children}
    </Link>
  );
}

function UserMenu() {
  const { user, logout } = useAuth();
  const [isOpen, setIsOpen] = useState(false);

  const handleLogout = async () => {
    try {
      await logout();
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  console.log('User object:', user); // Log user object for debugging

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center space-x-2 focus:outline-none"
      >
        {user?.photoURL ? (
          <img
            src={user.photoURL}
            alt={user?.displayName || 'User'}
            className="w-8 h-8 rounded-full object-cover border-2 border-red-500"
            onError={(e) => {
              console.error('Error loading profile image:', e);
              e.currentTarget.src = `https://ui-avatars.com/api/?background=dc2626&color=fff&name=${encodeURIComponent(user?.displayName || user?.email || 'User')}`;
            }}
          />
        ) : (
          <div className="w-8 h-8 rounded-full bg-red-500 flex items-center justify-center text-white font-bold">
            {(user?.displayName || user?.email || 'U')[0].toUpperCase()}
          </div>
        )}
        <span className="hidden md:inline text-gray-700">
          {user?.displayName || user?.email?.split('@')[0] || 'User'}
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

function MobileUserMenu() {
  const { user, logout } = useAuth();

  const handleLogout = async () => {
    try {
      await logout();
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  console.log('User object:', user); // Log user object for debugging

  return (
    <div className="space-y-2 border-t border-gray-200 pt-4">
      <div className="flex items-center space-x-2 px-3 py-2">
        {user?.photoURL ? (
          <img
            src={user.photoURL}
            alt={user?.displayName || 'User'}
            className="w-8 h-8 rounded-full object-cover border-2 border-red-500"
            onError={(e) => {
              console.error('Error loading profile image:', e);
              e.currentTarget.src = `https://ui-avatars.com/api/?background=dc2626&color=fff&name=${encodeURIComponent(user?.displayName || user?.email || 'User')}`;
            }}
          />
        ) : (
          <div className="w-8 h-8 rounded-full bg-red-500 flex items-center justify-center text-white font-bold">
            {(user?.displayName || user?.email || 'U')[0].toUpperCase()}
          </div>
        )}
        <span className="text-gray-700">
          {user?.displayName || user?.email?.split('@')[0] || 'User'}
        </span>
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

const Navbar: React.FC = () => {
  const [isOpen, setIsOpen] = useState<boolean>(false);
  const { user } = useAuth();

  return (
    <nav className="bg-white shadow-sm border-b border-gray-100">
      <div className="container mx-auto px-4">
        <div className="flex justify-between h-16">
          <div className="flex items-center">
            <Link to="/" className="flex items-center space-x-2">
              <Droplet className="w-8 h-8 text-red-500" />
              <span className="font-bold text-xl text-gray-900">LifeFlow</span>
            </Link>
          </div>

          {/* Desktop Menu */}
          <div className="hidden md:flex items-center space-x-8">
            <DesktopNavLink to="/donors">Find Donors</DesktopNavLink>
            <DesktopNavLink to="/request-blood">Request Blood</DesktopNavLink>
            <DesktopNavLink to="/about">About</DesktopNavLink>
            <DesktopNavLink to="/contact">Contact</DesktopNavLink>
            
            {!user ? (
              <div className="flex items-center space-x-4">
                <Link
                  to="/donor/login"
                  className="text-red-600 hover:text-red-700 font-medium"
                >
                  Login
                </Link>
                <Link
                  to="/donor/register"
                  className="bg-red-600 text-white px-4 py-2 rounded-full hover:bg-red-700 transition"
                >
                  Register
                </Link>
              </div>
            ) : (
              <UserMenu />
            )}
          </div>

           {/* Mobile Menu */}
          <div className="md:hidden flex items-center">
            <button
              onClick={() => setIsOpen(!isOpen)}
              className="flex items-center justify-center w-8 h-8 bg-gray-100 hover:bg-gray-200 rounded-full"
            >
              {isOpen ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
            </button>
          </div>
        </div>

        {/* Mobile Menu Content */}
        {isOpen && (
          <div className="md:hidden bg-white shadow-md rounded-md py-2">
            <MobileNavLink to="/donors">Find Donors</MobileNavLink>
            <MobileNavLink to="/request-blood">Request Blood</MobileNavLink>
            <MobileNavLink to="/about">About</MobileNavLink>
            <MobileNavLink to="/contact">Contact</MobileNavLink>
            
            {!user ? (
              <div className="flex flex-col space-y-2">
                <Link
                  to="/donor/login"
                  className="block w-full text-left px-3 py-2 text-gray-600 hover:text-gray-900 hover:bg-gray-50"
                >
                  Login
                </Link>
                <Link
                  to="/donor/register"
                  className="block w-full text-left px-3 py-2 text-gray-600 hover:text-gray-900 hover:bg-gray-50"
                >
                  Register
                </Link>
              </div>
            ) : (
              <MobileUserMenu />
            )}
          </div>
        )}
      </div>
    </nav>
  );
};

export default Navbar;