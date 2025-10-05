// src/components/Navbar.tsx
import React, { useState, Suspense } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Menu, X, Droplet, LogOut, LayoutDashboard, Heart, ChevronDown } from 'lucide-react';
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

function MobileNavLink({ to, children, onClick }: NavLinkProps & { onClick?: () => void }) {
  const location = useLocation();
  const isActive = location.pathname === to;

  return (
    <Link
      to={to}
      onClick={onClick}
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

function LoginDropdown() {
  const [isOpen, setIsOpen] = useState(false);

  const loginOptions = [
    { label: 'Donor Login', path: '/donor/login', color: 'red' },
    { label: 'NGO Login', path: '/ngo/login', color: 'blue' },
    { label: 'Hospital Login', path: '/hospital/login', color: 'green' },
  ];

  return (
    <div
      className="relative"
      onMouseEnter={() => setIsOpen(true)}
      onMouseLeave={() => setIsOpen(false)}
    >
      <button className="px-5 py-2 text-red-600 font-semibold hover:text-red-700 transition-colors flex items-center space-x-1">
        <span>Login</span>
        <ChevronDown className={`w-4 h-4 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div className="absolute right-0 top-full pt-1 z-50">
          <div className="w-48 bg-white/95 backdrop-blur-xl rounded-xl shadow-2xl py-2 border border-gray-100 animate-fadeIn">
            {loginOptions.map((option) => (
              <Link
                key={option.path}
                to={option.path}
                className="block px-4 py-2.5 text-sm text-gray-700 hover:bg-gradient-to-r hover:from-red-50 hover:to-pink-50 transition-all"
              >
                {option.label}
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function RegisterDropdown() {
  const [isOpen, setIsOpen] = useState(false);

  const registerOptions = [
    { label: 'Donor Register', path: '/donor/register', color: 'red' },
    { label: 'NGO Register', path: '/ngo/register', color: 'blue' },
    { label: 'Hospital Register', path: '/hospital/register', color: 'green' },
  ];

  return (
    <div
      className="relative"
      onMouseEnter={() => setIsOpen(true)}
      onMouseLeave={() => setIsOpen(false)}
    >
      <button className="px-6 py-2.5 bg-gradient-to-r from-red-600 to-red-700 text-white rounded-full font-semibold hover:shadow-lg transform hover:scale-105 transition-all duration-300 flex items-center space-x-1">
        <span>Register</span>
        <ChevronDown className={`w-4 h-4 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div className="absolute right-0 top-full pt-1 z-50">
          <div className="w-52 bg-white/95 backdrop-blur-xl rounded-xl shadow-2xl py-2 border border-gray-100 animate-fadeIn">
            {registerOptions.map((option) => (
              <Link
                key={option.path}
                to={option.path}
                className="block px-4 py-2.5 text-sm text-gray-700 hover:bg-gradient-to-r hover:from-red-50 hover:to-pink-50 transition-all"
              >
                {option.label}
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
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
        <div className="absolute right-0 mt-3 w-56 bg-white/95 backdrop-blur-xl rounded-2xl shadow-2xl py-2 z-50 border border-white/50 overflow-hidden animate-fadeIn">
          {/* Decorative gradient orb */}
          <div className="absolute -top-10 -right-10 w-32 h-32 bg-gradient-to-r from-red-500 to-pink-500 rounded-full blur-3xl opacity-10 pointer-events-none"></div>

          <div className="relative z-10">
            <Link
              to={getDashboardPath()}
              className="flex items-center px-4 py-3 text-sm text-gray-700 hover:bg-gradient-to-r hover:from-red-50 hover:to-pink-50 transition-all duration-300 group"
              onClick={() => setIsOpen(false)}
            >
              <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-gradient-to-r from-red-600 to-red-700 mr-3 shadow-md transform group-hover:scale-110 group-hover:rotate-6 transition-all duration-300">
                <LayoutDashboard className="w-4 h-4 text-white" style={{ filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.2))' }} />
              </div>
              <span className="font-semibold">Dashboard</span>
            </Link>
            <div className="h-px bg-gradient-to-r from-transparent via-red-200 to-transparent my-1"></div>
            <button
              onClick={handleLogout}
              className="flex items-center w-full text-left px-4 py-3 text-sm text-gray-700 hover:bg-gradient-to-r hover:from-red-50 hover:to-pink-50 transition-all duration-300 group"
            >
              <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-gradient-to-r from-red-600 to-red-700 mr-3 shadow-md transform group-hover:scale-110 group-hover:rotate-6 transition-all duration-300">
                <LogOut className="w-4 h-4 text-white" style={{ filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.2))' }} />
              </div>
              <span className="font-semibold">Logout</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function MobileAuthMenu({ onClose }: { onClose?: () => void }) {
  const [loginExpanded, setLoginExpanded] = useState(false);
  const [registerExpanded, setRegisterExpanded] = useState(false);

  const loginOptions = [
    { label: 'Donor Login', path: '/donor/login' },
    { label: 'NGO Login', path: '/ngo/login' },
    { label: 'Hospital Login', path: '/hospital/login' },
  ];

  const registerOptions = [
    { label: 'Donor Register', path: '/donor/register' },
    { label: 'NGO Register', path: '/ngo/register' },
    { label: 'Hospital Register', path: '/hospital/register' },
  ];

  return (
    <div className="flex flex-col space-y-2 mt-6 pt-6 border-t border-gray-200 animate-slideInRight" style={{ animationDelay: '0.3s', animationFillMode: 'both' }}>
      {/* Login Dropdown */}
      <div>
        <button
          onClick={() => setLoginExpanded(!loginExpanded)}
          className="flex items-center justify-between w-full px-5 py-3 text-red-600 font-semibold hover:bg-red-50 rounded-xl transition-all duration-300"
        >
          <span>Login</span>
          <ChevronDown className={`w-4 h-4 transition-transform ${loginExpanded ? 'rotate-180' : ''}`} />
        </button>
        {loginExpanded && (
          <div className="mt-2 ml-4 space-y-1">
            {loginOptions.map((option) => (
              <Link
                key={option.path}
                to={option.path}
                onClick={onClose}
                className="block px-4 py-2 text-sm text-gray-600 hover:bg-red-50 hover:text-red-600 rounded-lg transition-all"
              >
                {option.label}
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* Register Dropdown */}
      <div>
        <button
          onClick={() => setRegisterExpanded(!registerExpanded)}
          className="flex items-center justify-between w-full px-5 py-3 bg-gradient-to-r from-red-600 to-red-700 text-white rounded-xl font-semibold hover:shadow-lg transition-all duration-300"
        >
          <span>Register</span>
          <ChevronDown className={`w-4 h-4 transition-transform ${registerExpanded ? 'rotate-180' : ''}`} />
        </button>
        {registerExpanded && (
          <div className="mt-2 ml-4 space-y-1">
            {registerOptions.map((option) => (
              <Link
                key={option.path}
                to={option.path}
                onClick={onClose}
                className="block px-4 py-2 text-sm text-gray-600 hover:bg-red-50 hover:text-red-600 rounded-lg transition-all"
              >
                {option.label}
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function MobileUserMenu({ onClose }: { onClose?: () => void }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout(navigate);
    if (onClose) onClose();
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
        onClick={onClose}
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
    <>
      <nav className="relative bg-white/95 backdrop-blur-xl shadow-lg border-b border-white/50 sticky top-0 z-40">
        {/* Decorative gradient line */}
        <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r from-transparent via-red-600 to-transparent opacity-50"></div>

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
                    <LoginDropdown />
                    <RegisterDropdown />
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
        </div>
      </nav>

      {/* Mobile Menu - Modern Drawer Style - Outside navbar for proper positioning */}
      {isOpen && (
        <>
          {/* Backdrop Overlay */}
          <div
            className="md:hidden fixed inset-0 bg-black/50 backdrop-blur-sm z-50 animate-fadeIn"
            onClick={() => setIsOpen(false)}
          />

          {/* Drawer Menu */}
          <div className="md:hidden fixed top-0 right-0 bottom-0 w-[85%] max-w-sm bg-white z-50 shadow-2xl animate-slideInRight">
            {/* Decorative gradient background */}
            <div className="absolute inset-0 bg-gradient-to-br from-red-50 via-white to-pink-50">
              <div className="absolute -top-20 -right-20 w-64 h-64 bg-gradient-to-r from-red-400 to-pink-400 rounded-full mix-blend-multiply filter blur-3xl opacity-20"></div>
              <div className="absolute bottom-0 left-0 w-64 h-64 bg-gradient-to-r from-pink-500 to-red-500 rounded-full mix-blend-multiply filter blur-3xl opacity-10"></div>
            </div>

            {/* Content */}
            <div className="relative z-10 h-full flex flex-col">
              {/* Header */}
              <div className="flex items-center justify-between p-6 border-b border-gray-200">
                <div className="flex items-center space-x-2">
                  <div className="relative">
                    <Droplet className="w-8 h-8 text-red-600" />
                    <Heart className="w-3 h-3 text-red-600 absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 animate-pulse" />
                  </div>
                  <div>
                    <h2 className="text-xl font-extrabold bg-gradient-to-r from-red-600 to-red-800 bg-clip-text text-transparent">
                      BloodHub
                    </h2>
                    <p className="text-[10px] text-gray-500 -mt-1 tracking-wider">INDIA</p>
                  </div>
                </div>
                <button
                  onClick={() => setIsOpen(false)}
                  className="w-10 h-10 flex items-center justify-center rounded-xl bg-red-50 hover:bg-red-100 transition-colors"
                >
                  <X className="w-5 h-5 text-red-600" />
                </button>
              </div>

              {/* Menu Items with staggered animation */}
              <div className="flex-1 overflow-y-auto p-6 space-y-2">
                <div className="animate-slideInRight" style={{ animationDelay: '0.1s', animationFillMode: 'both' }}>
                  <MobileNavLink to="/donors" onClick={() => setIsOpen(false)}>Find Donors</MobileNavLink>
                </div>
                <div className="animate-slideInRight" style={{ animationDelay: '0.15s', animationFillMode: 'both' }}>
                  <MobileNavLink to="/request-blood" onClick={() => setIsOpen(false)}>Request Blood</MobileNavLink>
                </div>
                <div className="animate-slideInRight" style={{ animationDelay: '0.2s', animationFillMode: 'both' }}>
                  <MobileNavLink to="/about" onClick={() => setIsOpen(false)}>About</MobileNavLink>
                </div>
                <div className="animate-slideInRight" style={{ animationDelay: '0.25s', animationFillMode: 'both' }}>
                  <MobileNavLink to="/contact" onClick={() => setIsOpen(false)}>Contact</MobileNavLink>
                </div>

                {authLoading ? (
                  <LoadingFallback />
                ) : !user ? (
                  <MobileAuthMenu onClose={() => setIsOpen(false)} />
                ) : (
                  <div className="animate-slideInRight" style={{ animationDelay: '0.3s', animationFillMode: 'both' }}>
                    <Suspense fallback={<LoadingFallback />}>
                      <MobileUserMenu onClose={() => setIsOpen(false)} />
                    </Suspense>
                  </div>
                )}
              </div>

              {/* Footer */}
              <div className="p-6 border-t border-gray-200 bg-gradient-to-r from-red-50 to-pink-50">
                <div className="flex items-center text-red-600 font-semibold justify-center">
                  <Heart className="w-4 h-4 mr-2 animate-pulse" />
                  <span className="text-sm">Saving Lives Together</span>
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </>
  );
};

export default Navbar;
