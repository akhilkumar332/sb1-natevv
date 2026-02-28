// src/pages/auth/NgoLogin.tsx
import { useEffect, useRef, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import type { ImpersonationUser } from '../../services/admin.service';
import { notify } from 'services/notify.service';
import { Heart, Users, Calendar, TrendingUp, Shield } from 'lucide-react';
import LogoMark from '../../components/LogoMark';
import PwaInstallCta from '../../components/PwaInstallCta';
import { authStorage } from '../../utils/authStorage';
import { auth } from '../../firebase';
import SuperAdminPortalModal from '../../components/auth/SuperAdminPortalModal';

export function NgoLogin() {
  const navigate = useNavigate();
  const {
    user,
    loginWithGoogle,
    logout,
    isSuperAdmin,
    setPortalRole,
    startImpersonation,
    impersonationSession,
    isImpersonating,
    impersonationTransition,
    effectiveRole,
    profileResolved,
  } = useAuth();
  const [googleLoading, setGoogleLoading] = useState(false);
  const [showPortalModal, setShowPortalModal] = useState(false);
  const hasRedirected = useRef(false);

  const resolvePortalRole = (role?: string | null) => {
    if (!role) return null;
    if (role === 'hospital') return 'bloodbank';
    if (role === 'bloodbank' || role === 'ngo' || role === 'admin' || role === 'donor') {
      return role;
    }
    return 'ngo';
  };

  useEffect(() => {
    if (!user || hasRedirected.current) {
      return;
    }

    if (!profileResolved && !isImpersonating && impersonationTransition !== 'stopping') {
      return;
    }

    if (isImpersonating) {
      const role = resolvePortalRole(impersonationSession?.targetRole ?? user.role ?? null);
      if (role) {
        hasRedirected.current = true;
        setShowPortalModal(false);
        navigate(role === 'admin' ? '/admin/dashboard' : `/${role}/dashboard`);
        return;
      }
    }

    if (isSuperAdmin) {
      setShowPortalModal(true);
      return;
    }

    if (user.role !== 'ngo') {
      notify.error("You're not an NGO", { id: 'role-mismatch-ngo' });
      return;
    }

    const targetPath = user.onboardingCompleted ? '/ngo/dashboard' : '/ngo/onboarding';
    hasRedirected.current = true;
    navigate(targetPath);
  }, [
    effectiveRole,
    impersonationSession?.targetRole,
    impersonationTransition,
    isImpersonating,
    isSuperAdmin,
    navigate,
    profileResolved,
    user,
  ]);

  const handleGoogleLogin = async () => {
    setGoogleLoading(true);
    try {
      const response = await loginWithGoogle();
      if (response.user.role === 'superadmin') {
        const token = response?.token ?? (await auth.currentUser?.getIdToken());
        if (token) {
          authStorage.setAuthToken(token);
        }
        setShowPortalModal(true);
        return;
      }
      if (response.user.role !== 'ngo') {
        notify.error("You're not an NGO", { id: 'role-mismatch-ngo' });
        await logout(navigate, { redirectTo: '/ngo/login', showToast: false });
        return;
      }
      const token = response?.token ?? (await auth.currentUser?.getIdToken());
      if (token) {
        authStorage.setAuthToken(token);
      }
      notify.success('Successfully logged in as NGO!');

      if (response.user.onboardingCompleted === true) {
        navigate('/ngo/dashboard');
      } else {
        navigate('/ngo/onboarding');
      }
    } catch (error) {
      notify.error('Failed to sign in with Google. Please try again.');
    } finally {
      setGoogleLoading(false);
    }
  };

  if (user && !profileResolved) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="flex items-center gap-3 text-gray-600">
          <div className="w-5 h-5 border-2 border-red-500 border-t-transparent rounded-full animate-spin" />
          <span className="text-sm font-medium">Checking account…</span>
        </div>
      </div>
    );
  }

  if (user && user.role === 'ngo' && !isSuperAdmin) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="flex items-center gap-3 text-gray-600">
          <div className="w-5 h-5 border-2 border-red-500 border-t-transparent rounded-full animate-spin" />
          <span className="text-sm font-medium">Signing you in…</span>
        </div>
      </div>
    );
  }

  const handlePortalSelect = (role: 'donor' | 'ngo' | 'bloodbank' | 'admin') => {
    setPortalRole(role);
    hasRedirected.current = true;
    navigate(role === 'admin' ? '/admin/dashboard' : `/${role}/dashboard`);
  };

  const handleImpersonate = async (target: ImpersonationUser, reason?: string) => {
    const resolved = await startImpersonation(target, { ...(reason ? { reason } : {}) });
    if (!resolved) return;
    const role =
      resolved.role === 'hospital'
        ? 'bloodbank'
        : resolved.role === 'ngo'
          ? 'ngo'
          : resolved.role === 'bloodbank'
            ? 'bloodbank'
            : resolved.role === 'admin'
              ? 'admin'
              : 'donor';
    hasRedirected.current = true;
    setShowPortalModal(false);
    navigate(role === 'admin' ? '/admin/dashboard' : `/${role}/dashboard`);
  };

  return (
    <div className="min-h-screen flex">
      <SuperAdminPortalModal
        isOpen={showPortalModal && Boolean(user) && isSuperAdmin}
        currentPortal="ngo"
        onSelect={handlePortalSelect}
        onImpersonate={handleImpersonate}
        impersonationUser={impersonationSession
          ? {
              displayName: impersonationSession.targetDisplayName,
              email: impersonationSession.targetEmail,
              role: impersonationSession.targetRole ?? null,
            }
          : null}
        impersonationLoading={impersonationTransition === 'starting'}
      />
      {/* Left Side - Gradient Background with Info */}
      <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-red-600 via-red-700 to-amber-600 relative overflow-hidden">
        {/* Animated Background Elements */}
        <div className="absolute top-0 right-0 w-96 h-96 bg-red-500 rounded-full mix-blend-multiply filter blur-3xl opacity-30 animate-blob"></div>
        <div className="absolute bottom-0 left-0 w-96 h-96 bg-amber-500 rounded-full mix-blend-multiply filter blur-3xl opacity-30 animate-blob animation-delay-2000"></div>

        <div className="relative z-10 flex flex-col justify-center px-12 py-12 text-white">
          <div className="mb-12">
            <div className="flex items-center space-x-3 mb-6">
              <LogoMark className="w-12 h-12" />
              <div>
                <h1 className="text-3xl font-extrabold">BloodHub</h1>
                <p className="text-sm tracking-wider opacity-90">INDIA</p>
              </div>
            </div>
            <h2 className="text-4xl font-bold mb-4">NGO Portal</h2>
            <p className="text-xl opacity-90 leading-relaxed">
              Organize donation drives, coordinate with volunteers, and amplify your impact.
            </p>
          </div>

          <div className="space-y-6">
            <div className="flex items-start space-x-4">
              <div className="flex-shrink-0 w-12 h-12 bg-white/10 backdrop-blur-lg rounded-xl flex items-center justify-center">
                <Calendar className="w-6 h-6" />
              </div>
              <div>
                <h3 className="font-bold text-lg mb-1">Campaign Operations</h3>
                <p className="opacity-90 text-sm">Plan and manage donation drives with clear timelines</p>
              </div>
            </div>

            <div className="flex items-start space-x-4">
              <div className="flex-shrink-0 w-12 h-12 bg-white/10 backdrop-blur-lg rounded-xl flex items-center justify-center">
                <Users className="w-6 h-6" />
              </div>
              <div>
                <h3 className="font-bold text-lg mb-1">Volunteer Network</h3>
                <p className="opacity-90 text-sm">Coordinate donor outreach and on-ground teams</p>
              </div>
            </div>

            <div className="flex items-start space-x-4">
              <div className="flex-shrink-0 w-12 h-12 bg-white/10 backdrop-blur-lg rounded-xl flex items-center justify-center">
                <TrendingUp className="w-6 h-6" />
              </div>
              <div>
                <h3 className="font-bold text-lg mb-1">Impact Reporting</h3>
                <p className="opacity-90 text-sm">Track outcomes and campaign performance</p>
              </div>
            </div>

            <div className="flex items-start space-x-4">
              <div className="flex-shrink-0 w-12 h-12 bg-white/10 backdrop-blur-lg rounded-xl flex items-center justify-center">
                <Shield className="w-6 h-6" />
              </div>
              <div>
                <h3 className="font-bold text-lg mb-1">Verified Organization</h3>
                <p className="opacity-90 text-sm">Build trust with verified NGO credentials</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Right Side - Login Form */}
      <div className="w-full lg:w-1/2 flex items-center justify-center px-4 py-12 bg-gray-50">
        <div className="max-w-md w-full">
          <div className="bg-white rounded-3xl shadow-2xl p-8 md:p-10 border border-gray-100">
            {/* Mobile Logo */}
            <div className="lg:hidden text-center mb-8">
              <div className="inline-flex items-center space-x-2">
                <LogoMark className="w-10 h-10" />
                <div>
                  <span className="font-extrabold text-2xl bg-gradient-to-r from-red-600 to-amber-600 bg-clip-text text-transparent">
                    BloodHub
                  </span>
                </div>
              </div>
            </div>

            <div className="text-center mb-8">
              <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-r from-red-600 to-amber-600 rounded-2xl mb-4">
                <Heart className="w-8 h-8 text-white" />
              </div>
              <h2 className="text-3xl font-bold text-gray-900 mb-2">NGO Login</h2>
              <p className="text-gray-600">Welcome back, change-maker.</p>
            </div>

            <div className="space-y-6">
              <div className="bg-gradient-to-r from-amber-50 to-red-50 rounded-2xl p-6 border border-amber-100">
                <div className="flex items-start space-x-3">
                  <Shield className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <h3 className="font-semibold text-gray-900 mb-1">Secure NGO Access</h3>
                    <p className="text-sm text-gray-600">
                      Sign in with your organization's Google account to access campaign management tools.
                    </p>
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={handleGoogleLogin}
                disabled={googleLoading}
                className="w-full flex items-center justify-center px-6 py-4 border-2 border-gray-200 rounded-xl shadow-sm text-sm font-semibold text-gray-700 bg-white hover:bg-gray-50 hover:border-amber-300 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-amber-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
              >
                {googleLoading ? (
                  <span className="flex items-center space-x-2">
                    <div className="w-5 h-5 border-2 border-amber-500 border-t-transparent rounded-full animate-spin"></div>
                    <span>Signing in...</span>
                  </span>
                ) : (
                  <>
                    <img
                      className="h-5 w-5 mr-3"
                      src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg"
                      alt="Google logo"
                    />
                    Sign in with Google
                  </>
                )}
              </button>

              <PwaInstallCta
                label="Install NGO App"
                buttonClassName="bg-amber-600 text-white hover:bg-amber-700 focus:ring-amber-500"
              />

              <div className="pt-4 border-t border-gray-100">
                <p className="text-center text-sm text-gray-600">
                  Don't have an account?{' '}
                  <Link
                    to="/ngo/register"
                    className="font-semibold text-red-600 hover:text-red-700 transition-colors"
                  >
                    Register now
                  </Link>
                </p>
              </div>
            </div>
          </div>

          {/* Additional Info */}
          <div className="mt-6 text-center text-sm text-gray-500">
            <p>By signing in, you agree to our Terms of Service and Privacy Policy</p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default NgoLogin;
