import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Menu, X, Droplet } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

interface NavLinkProps {
  to: string;
  children: React.ReactNode;
}

// Move interfaces to the top for better organization
interface UserMenuProps {
  // Add any props needed for UserMenu
}

interface MobileUserMenuProps {
  // Add any props needed for MobileUserMenu
}

function NavLink({ to, children }: NavLinkProps) {
  return (
    <Link
      to={to}
      className="text-gray-600 hover:text-gray-900 px-3 py-2 rounded-md text-sm font-medium"
    >
      {children}
    </Link>
  );
}

function MobileNavLink({ to, children }: NavLinkProps) {
  return (
    <Link
      to={to}
      className="text-gray-600 hover:text-gray-900 block px-3 py-2 rounded-md text-base font-medium"
    >
      {children}
    </Link>
  );
}

function UserMenu({}: UserMenuProps) {
  const { logout } = useAuth();
  return (
    <div>
      {/* Add user menu implementation */}
      <button 
        onClick={logout}
        className="text-gray-600 hover:text-gray-900 px-3 py-2 rounded-md text-sm font-medium"
      >
        Logout
      </button>
    </div>
  );
}

function MobileUserMenu({}: MobileUserMenuProps) {
  const { logout } = useAuth();
  return (
    <div>
      {/* Add mobile user menu implementation */}
      <button 
        onClick={logout}
        className="text-gray-600 hover:text-gray-900 block px-3 py-2 rounded-md text-base font-medium"
      >
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
            <NavLink to="/donors">Find Donors</NavLink>
            <NavLink to="/request-blood">Request Blood</NavLink>
            <NavLink to="/about">About</NavLink>
            <NavLink to="/contact">Contact</NavLink>
            
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
                  Register as Donor
                </Link>
              </div>
            ) : (
              <UserMenu />
            )}
          </div>

          {/* Mobile menu button */}
          <div className="md:hidden flex items-center">
            <button
              onClick={() => setIsOpen(!isOpen)}
              className="text-gray-500 hover:text-gray-600"
            >
              {isOpen ? (
                <X className="w-6 h-6" />
              ) : (
                <Menu className="w-6 h-6" />
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Menu */}
      {isOpen && (
        <div className="md:hidden">
          <div className="px-2 pt-2 pb-3 space-y-1">
            <MobileNavLink to="/donors">Find Donors</MobileNavLink>
            <MobileNavLink to="/request-blood">Request Blood</MobileNavLink>
            <MobileNavLink to="/about">About</MobileNavLink>
            <MobileNavLink to="/contact">Contact</MobileNavLink>
            {!user ? (
              <>
                <MobileNavLink to="/donor/login">Login</MobileNavLink>
                <MobileNavLink to="/donor/register">Register as Donor</MobileNavLink>
              </>
            ) : (
              <MobileUserMenu />
            )}
          </div>
        </div>
      )}
    </nav>
  );
};

export default Navbar;