// src/components/Navbar.tsx
import React, { useState, Suspense } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Menu, X, Droplet, LogOut, LayoutDashboard, Heart } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';


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
      className={`relative px-4 py-2 text-sm font-semibold transition-all duration-300 ${
        isActive
          ? 'text-red-600'
          : 'text-gray-700 hover:text-red-600'
      }`}
    >
      {children}
      {isActive && (
        <span className="absolute bottom-0 left-0 w-full h-0.5 bg-gradient-to-r from-red-600 to-red-800"></span>
      )}
    </Link>
  );
}

function MobileNavLink({ to, children }: NavLinkProps) {
  const location = useLocation();
  const isActive = location.pathname === to;

  return (
    <Link
      to={to}
      className={`block px-4 py-3 rounded-xl text-base font-medium transition-all ${
        isActive
          ? 'bg-gradient-to-r from-red-600 to-red-700 text-white shadow-lg'
          : 'text-gray-700 hover:bg-red-50'
      }`}
    >
      {children}
    </Link>
  );
}

function UserMenu() {
  const { user, logout } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout(navigate);
  };

  // Get dashboard path based on user role
  const getDashboardPath = () => {
    switch (user?.role) {
      case 'donor':
        return '/donor/dashboard';
      case 'hospital':
        return '/hospital/dashboard';
      case 'ngo':
        return '/ngo/dashboard';
      case 'admin':
        return '/admin/dashboard';
      default:
        return '/donor/dashboard';
    }
  };

  console.log('User object:', user); // Log user object for debugging

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center space-x-3 px-4 py-2 rounded-full bg-gradient-to-r from-red-50 to-pink-50 hover:from-red-100 hover:to-pink-100 transition-all duration-300 border border-red-200"
      >
        {user?.photoURL ? (
          <img
            src={user.photoURL}
            alt={user?.displayName || 'User'}
            className="w-8 h-8 rounded-full object-cover ring-2 ring-red-600"
            onError={(e) => {
              console.error('Error loading profile image:', e);
              e.currentTarget.src = `https://ui-avatars.com/api/?background=dc2626&color=fff&name=${encodeURIComponent(user?.displayName || user?.email || 'User')}`;
            }}
          />
        ) : (
          <div className="w-8 h-8 rounded-full bg-gradient-to-r from-red-600 to-red-700 flex items-center justify-center text-white font-bold shadow-lg">
            {(user?.displayName || user?.email || 'U')[0].toUpperCase()}
          </div>
        )}
        <span className="hidden md:inline text-gray-800 font-semibold">
          {user?.displayName || user?.email?.split('@')[0] || 'User'}
        </span>
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-3 w-56 bg-white rounded-2xl shadow-2xl py-2 z-50 border border-gray-100 overflow-hidden">
          <Link
            to={getDashboardPath()}
            className="flex items-center px-4 py-3 text-sm text-gray-700 hover:bg-gradient-to-r hover:from-red-50 hover:to-pink-50 transition-all group"
            onClick={() => setIsOpen(false)}
          >
            <LayoutDashboard className="w-5 h-5 mr-3 text-red-600 group-hover:scale-110 transition-transform" />
            <span className="font-medium">Dashboard</span>
          </Link>
          <div className="h-px bg-gradient-to-r from-transparent via-gray-200 to-transparent my-1"></div>
          <button
            onClick={handleLogout}
            className="flex items-center w-full text-left px-4 py-3 text-sm text-gray-700 hover:bg-gradient-to-r hover:from-red-50 hover:to-pink-50 transition-all group"
          >
            <LogOut className="w-5 h-5 mr-3 text-red-600 group-hover:scale-110 transition-transform" />
            <span className="font-medium">Logout</span>
          </button>
        </div>
      )}
    </div>
  );
}

function MobileUserMenu() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout(navigate);
  };

  // Get dashboard path based on user role
  const getDashboardPath = () => {
    switch (user?.role) {
      case 'donor':
        return '/donor/dashboard';
      case 'hospital':
        return '/hospital/dashboard';
      case 'ngo':
        return '/ngo/dashboard';
      case 'admin':
        return '/admin/dashboard';
      default:
        return '/donor/dashboard';
    }
  };

  console.log('User object:', user); // Log user object for debugging

  return (
    <div className="space-y-3 border-t border-gray-200 pt-4 mt-4">
      <div className="flex items-center space-x-3 px-4 py-3 bg-gradient-to-r from-red-50 to-pink-50 rounded-xl">
        {user?.photoURL ? (
          <img
            src={user.photoURL}
            alt={user?.displayName || 'User'}
            className="w-10 h-10 rounded-full object-cover ring-2 ring-red-600"
            onError={(e) => {
              console.error('Error loading profile image:', e);
              e.currentTarget.src = `https://ui-avatars.com/api/?background=dc2626&color=fff&name=${encodeURIComponent(user?.displayName || user?.email || 'User')}`;
            }}
          />
        ) : (
          <div className="w-10 h-10 rounded-full bg-gradient-to-r from-red-600 to-red-700 flex items-center justify-center text-white font-bold shadow-lg">
            {(user?.displayName || user?.email || 'U')[0].toUpperCase()}
          </div>
        )}
        <div>
          <p className="text-gray-800 font-semibold">{user?.displayName || user?.email?.split('@')[0] || 'User'}</p>
          <p className="text-xs text-gray-500">{user?.email}</p>
        </div>
      </div>
      <Link
        to={getDashboardPath()}
        className="flex items-center px-4 py-3 text-gray-700 hover:bg-red-50 rounded-xl transition-all group"
      >
        <LayoutDashboard className="w-5 h-5 mr-3 text-red-600 group-hover:scale-110 transition-transform" />
        <span className="font-medium">Dashboard</span>
      </Link>
      <button
        onClick={handleLogout}
        className="flex items-center w-full px-4 py-3 text-gray-700 hover:bg-red-50 rounded-xl transition-all group"
      >
        <LogOut className="w-5 h-5 mr-3 text-red-600 group-hover:scale-110 transition-transform" />
        <span className="font-medium">Logout</span>
      </button>
    </div>
  );
}

const Navbar: React.FC = () => {
  const [isOpen, setIsOpen] = useState<boolean>(false);
  const { user, authLoading } = useAuth();

  const LoadingFallback = () => (
    <div className="flex items-center space-x-2">
      <div className="w-8 h-8 rounded-full bg-gray-200 animate-pulse"></div>
      <div className="h-4 w-24 bg-gray-200 rounded animate-pulse"></div>
    </div>
  );


  return (
    <nav className="bg-white/90 backdrop-blur-lg shadow-sm border-b border-gray-100 sticky top-0 z-40">
      <div className="container mx-auto px-4">
        <div className="flex justify-between items-center h-16">
          {/* Logo */}
          <div className="flex items-center">
            <Link to="/" className="flex items-center space-x-2 group">
              <div className="relative">
                <Droplet className="w-9 h-9 text-red-600 group-hover:scale-110 transition-transform duration-300" />
                <Heart className="w-4 h-4 text-red-600 absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 animate-pulse" />
              </div>
              <div>
                <span className="font-extrabold text-2xl bg-gradient-to-r from-red-600 via-red-700 to-red-800 bg-clip-text text-transparent">
                  BloodHub
                </span>
                <p className="text-[10px] text-gray-500 -mt-1 tracking-wider">INDIA</p>
              </div>
            </Link>
          </div>

          {/* Desktop Menu */}
          <div className="hidden md:flex items-center space-x-1">
            <DesktopNavLink to="/donors">Find Donors</DesktopNavLink>
            <DesktopNavLink to="/request-blood">Request Blood</DesktopNavLink>
            <DesktopNavLink to="/about">About</DesktopNavLink>
            <DesktopNavLink to="/contact">Contact</DesktopNavLink>

            <div className="ml-4 pl-4 border-l border-gray-200">
              {authLoading ? (
                <LoadingFallback />
              ) : !user ? (
                <div className="flex items-center space-x-3">
                  <Link
                    to="/donor/login"
                    className="px-5 py-2 text-red-600 font-semibold hover:text-red-700 transition-colors"
                  >
                    Login
                  </Link>
                  <Link
                    to="/donor/register"
                    className="px-6 py-2.5 bg-gradient-to-r from-red-600 to-red-700 text-white rounded-full font-semibold hover:shadow-lg transform hover:scale-105 transition-all duration-300"
                  >
                    Register
                  </Link>
                </div>
              ) : (
                <Suspense fallback={<LoadingFallback />}>
                  <UserMenu />
                </Suspense>
              )}
            </div>
          </div>

           {/* Mobile Menu Button */}
          <div className="md:hidden flex items-center">
            <button
              onClick={() => setIsOpen(!isOpen)}
              className="flex items-center justify-center w-10 h-10 rounded-xl bg-gradient-to-r from-red-50 to-pink-50 hover:from-red-100 hover:to-pink-100 transition-all border border-red-200"
            >
              {isOpen ? (
                <X className="w-5 h-5 text-red-600" />
              ) : (
                <Menu className="w-5 h-5 text-red-600" />
              )}
            </button>
          </div>
        </div>

        {/* Mobile Menu Content */}
        {isOpen && (
          <div className="md:hidden bg-white rounded-2xl shadow-2xl my-4 p-4 border border-gray-100">
            <div className="space-y-2">
              <MobileNavLink to="/donors">Find Donors</MobileNavLink>
              <MobileNavLink to="/request-blood">Request Blood</MobileNavLink>
              <MobileNavLink to="/about">About</MobileNavLink>
              <MobileNavLink to="/contact">Contact</MobileNavLink>
            </div>

            {authLoading ? (
              <LoadingFallback />
            ) : !user ? (
              <div className="flex flex-col space-y-2 mt-4 pt-4 border-t border-gray-200">
                <Link
                  to="/donor/login"
                  className="block w-full text-center px-5 py-3 text-red-600 font-semibold hover:bg-red-50 rounded-xl transition-all"
                >
                  Login
                </Link>
                <Link
                  to="/donor/register"
                  className="block w-full text-center px-5 py-3 bg-gradient-to-r from-red-600 to-red-700 text-white rounded-xl font-semibold hover:shadow-lg transition-all"
                >
                  Register
                </Link>
              </div>
            ) : (
              <Suspense fallback={<LoadingFallback />}>
                <MobileUserMenu />
              </Suspense>
            )}
          </div>
        )}
      </div>
    </nav>
  );
};

export default Navbar;
