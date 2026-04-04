import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Heart, Phone, Mail, MapPin, Facebook, Twitter, Instagram, Linkedin, AlertCircle, ChevronDown } from 'lucide-react';
import LogoMark from './LogoMark';
import { ROUTES } from '../constants/routes';
import { usePublicCmsMenu, usePublicCmsSettings } from '../hooks/useCmsContent';
import { CMS_DEFAULTS, CMS_QUERY_LIMITS } from '../constants/cms';
import { CMS_MENU_LOCATION } from '../constants/cms';
import { getPublishedBlogPosts } from '../services/cms.service';

function Footer() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const settingsQuery = usePublicCmsSettings();
  const footerResourcesQuery = usePublicCmsMenu(CMS_MENU_LOCATION.footerResources);
  const footerLegalQuery = usePublicCmsMenu(CMS_MENU_LOCATION.footerLegal);
  const supportPhone = settingsQuery.data?.supportPhone || CMS_DEFAULTS.supportPhone;
  const supportEmail = settingsQuery.data?.supportEmail || CMS_DEFAULTS.supportEmail;
  const officeCity = settingsQuery.data?.officeCity || CMS_DEFAULTS.officeCity;
  const showBlogInFooter = settingsQuery.data?.showBlogInFooter ?? CMS_DEFAULTS.showBlogInFooter;
  const socialLinks = settingsQuery.data?.socialLinks || {};
  const socialDefaults = {
    facebook: 'https://facebook.com',
    x: 'https://twitter.com',
    instagram: 'https://instagram.com',
    linkedin: 'https://linkedin.com',
  };
  const toSafeExternalUrl = (value?: string | null): string | null => {
    if (!value) return null;
    const trimmed = value.trim();
    if (!trimmed) return null;
    return /^https?:\/\//i.test(trimmed) ? trimmed : null;
  };
  const socialConfig = [
    { key: 'facebook', href: toSafeExternalUrl(socialLinks.facebook) || socialDefaults.facebook, icon: <Facebook className="w-5 h-5 text-red-600 relative z-10" /> },
    { key: 'x', href: toSafeExternalUrl(socialLinks.x || socialLinks.twitter) || socialDefaults.x, icon: <Twitter className="w-5 h-5 text-red-600 relative z-10" /> },
    { key: 'instagram', href: toSafeExternalUrl(socialLinks.instagram) || socialDefaults.instagram, icon: <Instagram className="w-5 h-5 text-red-600 relative z-10" /> },
    { key: 'linkedin', href: toSafeExternalUrl(socialLinks.linkedin) || socialDefaults.linkedin, icon: <Linkedin className="w-5 h-5 text-red-600 relative z-10" /> },
  ] as const;
  const defaultResourceLinks = [
    { id: 'donor-portal', path: ROUTES.portal.donor.login, external: false },
    { id: 'bloodbank-portal', path: ROUTES.portal.bloodbank.login, external: false },
    { id: 'ngo-portal', path: ROUTES.portal.ngo.login, external: false },
    { id: 'faq', path: '/faq', external: false },
    ...(showBlogInFooter ? [{ id: 'blog', path: ROUTES.blog, external: false }] : []),
  ];
  const defaultLegalLinks = [
    { id: 'privacy', path: '/privacy', external: false },
    { id: 'terms', path: '/terms', external: false },
    { id: 'disclaimer', path: '/disclaimer', external: false },
    { id: 'sitemap', path: '/sitemap', external: false },
  ];
  const resourceLinks = footerResourcesQuery.data?.items?.length ? footerResourcesQuery.data.items : defaultResourceLinks;
  const legalLinks = footerLegalQuery.data?.items?.length ? footerLegalQuery.data.items : defaultLegalLinks;

  const [openSections, setOpenSections] = useState({
    quickLinks: true,
    resources: false,
    contact: false,
  });

  const toggleSection = (section: 'quickLinks' | 'resources' | 'contact') => {
    setOpenSections((prev) => ({ ...prev, [section]: !prev[section] }));
  };
  const prefetchBlogList = () => {
    void queryClient.prefetchQuery({
      queryKey: ['cms', 'public', 'blogPosts', { limitCount: CMS_QUERY_LIMITS.publicBlogSummaryList }],
      queryFn: () => getPublishedBlogPosts(CMS_QUERY_LIMITS.publicBlogSummaryList),
      staleTime: 60_000,
    });
  };
  const defaultFooterLabel = (id: string) => {
    const keyById: Record<string, string> = {
      'donor-portal': 'footer.donorPortal',
      'bloodbank-portal': 'footer.bloodbankPortal',
      'ngo-portal': 'footer.ngoPortal',
      faq: 'footer.faq',
      blog: 'nav.blog',
      privacy: 'footer.privacyPolicy',
      terms: 'footer.termsOfService',
      disclaimer: 'footer.disclaimer',
      sitemap: 'footer.sitemap',
    };
    return t(keyById[id] || 'common.overview');
  };
  const getFooterItemLabel = (item: { id: string } | { id: string; label?: string }) => {
    if ('label' in item && item.label) return item.label;
    return defaultFooterLabel(item.id);
  };

  return (
    <footer className="relative bg-gradient-to-br from-gray-50 to-white border-t border-gray-200 overflow-hidden">
      {/* Decorative gradient orbs - PhonePe style */}
      <div className="absolute top-0 right-1/4 w-96 h-96 bg-gradient-to-r from-red-400 to-pink-400 rounded-full mix-blend-multiply filter blur-3xl opacity-10 pointer-events-none"></div>
      <div className="absolute bottom-0 left-1/4 w-96 h-96 bg-gradient-to-r from-pink-500 to-red-500 rounded-full mix-blend-multiply filter blur-3xl opacity-10 pointer-events-none"></div>

      <div className="container mx-auto px-4 py-12 relative z-10">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 lg:gap-12">
          {/* About Section */}
          <div className="lg:col-span-1">
            <div className="flex items-center space-x-2 mb-4">
              <LogoMark className="w-8 h-8" />
              <div>
                <h3 className="text-xl font-extrabold bg-gradient-to-r from-red-600 to-red-800 bg-clip-text text-transparent">
                  BloodHub
                </h3>
                <p className="text-[10px] text-gray-500 -mt-1 tracking-wider">{t('brand.india')}</p>
              </div>
            </div>
            <p className="text-gray-600 mb-4 leading-relaxed text-sm">
              {t('footer.description')}
            </p>
            <div className="flex items-center text-red-600 font-semibold">
              <Heart className="w-5 h-5 mr-2 animate-pulse" />
              <span>{t('footer.savingLivesTogether')}</span>
            </div>

            {/* Social Media - PhonePe-inspired */}
            <div className="mt-6">
              <p className="text-sm font-semibold text-gray-900 mb-3">{t('footer.followUs')}</p>
              <div className="flex space-x-3">
                {socialConfig.map((item) => (
                  <a
                    key={item.key}
                    href={item.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="group relative w-10 h-10 bg-white/80 backdrop-blur-xl hover:bg-white rounded-full flex items-center justify-center transition-all duration-300 transform hover:scale-110 hover:-translate-y-1 shadow-md hover:shadow-lg border border-red-100"
                  >
                    <div className="absolute inset-0 bg-gradient-to-r from-red-500 to-pink-500 rounded-full blur-md opacity-0 group-hover:opacity-30 transition-opacity duration-300"></div>
                    {item.icon}
                  </a>
                ))}
              </div>
            </div>
          </div>

          {/* Quick Links */}
          <div>
            <button
              type="button"
              onClick={() => toggleSection('quickLinks')}
              className="flex w-full items-center justify-between rounded-xl border border-red-100 bg-white/80 px-4 py-3 text-left lg:hidden"
              aria-expanded={openSections.quickLinks}
              aria-controls="footer-quick-links"
            >
              <span className="text-lg font-bold text-gray-900">{t('footer.quickLinks')}</span>
              <ChevronDown className={`h-5 w-5 text-red-600 transition-transform ${openSections.quickLinks ? 'rotate-180' : ''}`} />
            </button>
            <h3 className="hidden text-lg font-bold text-gray-900 mb-4 lg:block">{t('footer.quickLinks')}</h3>
            <div id="footer-quick-links" className={`${openSections.quickLinks ? 'block' : 'hidden'} pt-4 lg:block lg:pt-0`}>
              <ul className="space-y-3">
                <li>
                  <Link
                    to={ROUTES.portal.donor.register}
                    className="text-gray-600 hover:text-red-600 transition-colors flex items-center group"
                  >
                    <span className="w-1.5 h-1.5 bg-red-600 rounded-full mr-2 opacity-0 group-hover:opacity-100 transition-opacity"></span>
                    {t('footer.becomeDonor')}
                  </Link>
                </li>
                <li>
                  <Link
                    to={ROUTES.requestBlood}
                    className="text-gray-600 hover:text-red-600 transition-colors flex items-center group"
                  >
                    <span className="w-1.5 h-1.5 bg-red-600 rounded-full mr-2 opacity-0 group-hover:opacity-100 transition-opacity"></span>
                    {t('nav.requestBlood')}
                  </Link>
                </li>
                <li>
                  <Link
                    to={ROUTES.donors}
                    className="text-gray-600 hover:text-red-600 transition-colors flex items-center group"
                  >
                    <span className="w-1.5 h-1.5 bg-red-600 rounded-full mr-2 opacity-0 group-hover:opacity-100 transition-opacity"></span>
                    {t('nav.findDonors')}
                  </Link>
                </li>
                <li>
                  <Link
                    to={ROUTES.about}
                    className="text-gray-600 hover:text-red-600 transition-colors flex items-center group"
                  >
                    <span className="w-1.5 h-1.5 bg-red-600 rounded-full mr-2 opacity-0 group-hover:opacity-100 transition-opacity"></span>
                    {t('footer.aboutUs')}
                  </Link>
                </li>
                <li>
                  <Link
                    to={ROUTES.contact}
                    className="text-gray-600 hover:text-red-600 transition-colors flex items-center group"
                  >
                    <span className="w-1.5 h-1.5 bg-red-600 rounded-full mr-2 opacity-0 group-hover:opacity-100 transition-opacity"></span>
                    {t('footer.contactUs')}
                  </Link>
                </li>
              </ul>
            </div>
          </div>

          {/* Resources */}
          <div>
            <button
              type="button"
              onClick={() => toggleSection('resources')}
              className="flex w-full items-center justify-between rounded-xl border border-red-100 bg-white/80 px-4 py-3 text-left lg:hidden"
              aria-expanded={openSections.resources}
              aria-controls="footer-resources"
            >
              <span className="text-lg font-bold text-gray-900">{t('footer.resources')}</span>
              <ChevronDown className={`h-5 w-5 text-red-600 transition-transform ${openSections.resources ? 'rotate-180' : ''}`} />
            </button>
            <h3 className="hidden text-lg font-bold text-gray-900 mb-4 lg:block">{t('footer.resources')}</h3>
            <div id="footer-resources" className={`${openSections.resources ? 'block' : 'hidden'} pt-4 lg:block lg:pt-0`}>
              <ul className="space-y-3">
                {resourceLinks.map((item) => (
                  <li key={item.id}>
                    {item.external ? (
                      <a
                        href={item.path}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-gray-600 hover:text-red-600 transition-colors flex items-center group"
                      >
                        <span className="w-1.5 h-1.5 bg-red-600 rounded-full mr-2 opacity-0 group-hover:opacity-100 transition-opacity"></span>
                        {getFooterItemLabel(item)}
                      </a>
                    ) : (
                    <Link
                      to={item.path}
                      className="text-gray-600 hover:text-red-600 transition-colors flex items-center group"
                      onMouseEnter={item.path === ROUTES.blog ? prefetchBlogList : undefined}
                      onFocus={item.path === ROUTES.blog ? prefetchBlogList : undefined}
                      onTouchStart={item.path === ROUTES.blog ? prefetchBlogList : undefined}
                    >
                      <span className="w-1.5 h-1.5 bg-red-600 rounded-full mr-2 opacity-0 group-hover:opacity-100 transition-opacity"></span>
                      {getFooterItemLabel(item)}
                    </Link>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* Contact & Emergency */}
          <div>
            <button
              type="button"
              onClick={() => toggleSection('contact')}
              className="flex w-full items-center justify-between rounded-xl border border-red-100 bg-white/80 px-4 py-3 text-left lg:hidden"
              aria-expanded={openSections.contact}
              aria-controls="footer-contact"
            >
              <span className="text-lg font-bold text-gray-900">{t('footer.getInTouch')}</span>
              <ChevronDown className={`h-5 w-5 text-red-600 transition-transform ${openSections.contact ? 'rotate-180' : ''}`} />
            </button>
            <h3 className="hidden text-lg font-bold text-gray-900 mb-4 lg:block">{t('footer.getInTouch')}</h3>
            <div id="footer-contact" className={`${openSections.contact ? 'block' : 'hidden'} pt-4 lg:block lg:pt-0`}>
              <ul className="space-y-3 mb-6">
                <li className="flex items-start text-gray-600 group">
                  <Phone className="w-5 h-5 mr-3 text-red-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="font-medium text-gray-900">{t('footer.generalInquiries')}</p>
                    <a href={`tel:${supportPhone}`} className="hover:text-red-600 transition-colors">
                      {supportPhone}
                    </a>
                  </div>
                </li>
                <li className="flex items-start text-gray-600 group">
                  <Mail className="w-5 h-5 mr-3 text-red-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="font-medium text-gray-900">{t('footer.emailUs')}</p>
                    <a href={`mailto:${supportEmail}`} className="hover:text-red-600 transition-colors">
                      {supportEmail}
                    </a>
                  </div>
                </li>
                <li className="flex items-start text-gray-600">
                  <MapPin className="w-5 h-5 mr-3 text-red-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="font-medium text-gray-900">{t('footer.headOffice')}</p>
                    <p className="text-sm">{officeCity}</p>
                  </div>
                </li>
              </ul>

              {/* Emergency Box - PhonePe-inspired glassmorphism */}
              <div className="group relative bg-white/80 backdrop-blur-xl p-4 rounded-xl border border-red-200 hover:shadow-xl transition-all duration-500 overflow-hidden">
                {/* Decorative orb */}
                <div className="absolute -top-8 -right-8 w-24 h-24 bg-gradient-to-r from-red-500 to-pink-500 rounded-full blur-3xl opacity-20 group-hover:opacity-30 transition-opacity duration-500"></div>

                <div className="relative z-10">
                  <div className="flex items-center mb-2">
                    <div className="flex items-center justify-center w-6 h-6 rounded-lg bg-gradient-to-r from-red-600 to-red-700 mr-2 shadow-md transform group-hover:scale-110 group-hover:rotate-6 transition-all duration-300">
                      <AlertCircle className="w-4 h-4 text-white" style={{ filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.2))' }} />
                    </div>
                    <p className="text-red-700 font-bold">{t('footer.emergency247')}</p>
                  </div>
                  <a
                    href="tel:+911800999888"
                    className="text-red-600 font-bold text-lg hover:text-red-700 transition-colors block"
                  >
                    +91 1800-999-888
                  </a>
                  <p className="text-xs text-gray-600 mt-1">{t('footer.availableRoundTheClock')}</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="mt-12 pt-8 border-t border-gray-200">
          <div className="flex flex-col md:flex-row justify-between items-center space-y-4 md:space-y-0">
            <div className="flex flex-col md:flex-row items-center space-y-2 md:space-y-0 md:space-x-4">
              <p className="text-gray-600 text-sm">
                © {new Date().getFullYear()} BloodHub India. {t('footer.allRightsReserved')}
              </p>
              <div className="flex items-center text-xs text-gray-500">
                <Heart className="w-3 h-3 text-red-600 mr-1" />
                <span>{t('footer.madeWithLove')}</span>
              </div>
            </div>
            <div className="flex flex-wrap justify-center gap-4 md:gap-6">
              {legalLinks.map((item) => (
                item.external ? (
                  <a
                    key={item.id}
                    href={item.path}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-gray-600 hover:text-red-600 text-sm transition-colors"
                  >
                    {getFooterItemLabel(item)}
                  </a>
                ) : (
                  <Link
                    key={item.id}
                    to={item.path}
                    className="text-gray-600 hover:text-red-600 text-sm transition-colors"
                  >
                    {getFooterItemLabel(item)}
                  </Link>
                )
              ))}
            </div>
          </div>

          {/* Additional Info */}
          <div className="mt-6 pt-6 border-t border-gray-100">
            <p className="text-center text-xs text-gray-500 leading-relaxed">
              {t('footer.bottomDescription')}
            </p>
          </div>
        </div>
      </div>
    </footer>
  );
}

export default Footer;
