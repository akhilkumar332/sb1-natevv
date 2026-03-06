import { ROUTES } from './routes';
import { CMS_FRONTEND_PAGE_SCHEMA_VERSION, type CmsFrontendPageSlug } from './cms';

type HomeContent = {
  schemaVersion: number;
  heroSlides: Array<{
    badge: string;
    titleGradient: string;
    titleNormal: string;
    description: string;
    primaryText: string;
    primaryTo: string;
    secondaryText: string;
    secondaryTo: string;
  }>;
  trustIndicators: string[];
  impactTitle: string;
  impactSubtitle: string;
  impactStats: Array<{ value: string; label: string }>;
  featuresTitle: string;
  featuresSubtitle: string;
  featureCards: Array<{ title: string; description: string }>;
  emergencyBadge: string;
  emergencyTitle: string;
  emergencyDescription: string;
  emergencyPoints: Array<{ title: string; description: string }>;
  emergencyStats: Array<{ value: string; label: string }>;
  ctaBandTitle: string;
  ctaBandSubtitle: string;
  ctaBandPrimaryText: string;
  ctaBandPrimaryTo: string;
  ctaBandTiles: Array<{ value: string; label: string }>;
  finalCtaTitle: string;
  finalCtaDescription: string;
  finalCtaPrimaryText: string;
  finalCtaPrimaryTo: string;
  finalCtaSecondaryText: string;
  finalCtaSecondaryTo: string;
};

type FindDonorsContent = {
  schemaVersion: number;
  heroBadge: string;
  heroTitle: string;
  heroDescription: string;
  searchPlaceholder: string;
  locationBannerTitle: string;
  locationBannerDescription: string;
  locationButtonText: string;
  noLocationTitle: string;
  noLocationDescription: string;
  noDonorsTitle: string;
  noDonorsDescription: string;
  clearFiltersText: string;
  bottomCtaTitle: string;
  bottomCtaDescription: string;
  bottomCtaButton: string;
};

type RequestBloodContent = {
  schemaVersion: number;
  heroBadge: string;
  heroTitleGradient: string;
  heroTitleNormal: string;
  heroDescription: string;
  submitSuccessMessage: string;
  submitErrorMessage: string;
  submitValidationMessage: string;
  patientInfoTitle: string;
  bloodSelectionTitle: string;
  urgencyTitle: string;
  hospitalInfoTitle: string;
  contactInfoTitle: string;
  reasonTitle: string;
  finalCtaTitle: string;
  finalCtaDescription: string;
  finalCtaButtonText: string;
};

type AboutContent = {
  schemaVersion: number;
  heroBadge: string;
  heroTitleGradient: string;
  heroTitleNormal: string;
  heroDescription: string;
  missionTitle: string;
  missionDescription: string;
  visionTitle: string;
  visionDescription: string;
  impactTitle: string;
  impactSubtitle: string;
  valuesTitle: string;
  valuesSubtitle: string;
  faqTitle: string;
  faqItems: Array<{ question: string; answer: string }>;
};

type ContactContent = {
  schemaVersion: number;
  heroBadge: string;
  heroTitle: string;
  heroDescription: string;
  phoneLabel: string;
  phoneSubLabel: string;
  emailLabel: string;
  emailSubLabel: string;
  officeLabel: string;
  officeSubLabel: string;
  formTitle: string;
  submitButton: string;
  sidebarTitle: string;
  sidebarPoints: Array<{ title: string; description: string }>;
  faqTitle: string;
  faqSubtitle: string;
  faqItems: Array<{ q: string; a: string }>;
};

export type CmsFrontendPageContentMap = {
  home: HomeContent;
  'find-donors': FindDonorsContent;
  'request-blood': RequestBloodContent;
  about: AboutContent;
  contact: ContactContent;
};

export const CMS_FRONTEND_PAGE_DEFAULT_CONTENT: CmsFrontendPageContentMap = {
  home: {
    schemaVersion: CMS_FRONTEND_PAGE_SCHEMA_VERSION,
    heroSlides: [
      {
        badge: 'A growing blood donation community in India',
        titleGradient: 'Every Drop Counts,',
        titleNormal: 'Every Life Matters',
        description: 'Join a growing community of donors and supporters. Your contribution can help when it matters most.',
        primaryText: 'Become a Donor',
        primaryTo: ROUTES.portal.donor.register,
        secondaryText: 'Request Blood',
        secondaryTo: ROUTES.requestBlood,
      },
      {
        badge: 'When Blood Is Needed',
        titleGradient: 'Someone Needs Help,',
        titleNormal: 'Right Now',
        description: 'In urgent moments, quick connections can make a real difference.',
        primaryText: 'Find Nearby Requests',
        primaryTo: ROUTES.donors,
        secondaryText: 'Register to Help',
        secondaryTo: ROUTES.portal.donor.register,
      },
      {
        badge: 'Recognition & Gratitude',
        titleGradient: 'Donate Blood,',
        titleNormal: 'Be Recognized',
        description: 'We aim to celebrate donors with community recognition and meaningful milestones.',
        primaryText: 'Explore Recognition',
        primaryTo: ROUTES.portal.donor.register,
        secondaryText: 'Learn More',
        secondaryTo: ROUTES.about,
      },
      {
        badge: 'Community Impact',
        titleGradient: 'Lives Changed,',
        titleNormal: 'Together',
        description: 'Be part of a growing community working to make blood access more reliable.',
        primaryText: 'Join Our Community',
        primaryTo: ROUTES.portal.donor.register,
        secondaryText: 'View Impact',
        secondaryTo: ROUTES.about,
      },
    ],
    trustIndicators: ['Safety-first approach', 'Standards-focused', 'Growing donor community'],
    impactTitle: 'Our Growing Impact',
    impactSubtitle: 'Making a difference together, one donor at a time',
    impactStats: [
      { value: 'Growing', label: 'Lives Touched' },
      { value: 'Thousands', label: 'Active Donors' },
      { value: 'Rising', label: 'Units Shared' },
      { value: 'Across India', label: 'BloodBank Partners' },
    ],
    featuresTitle: 'Why People Choose BloodHub',
    featuresSubtitle: 'A quick look at what makes the experience reliable and helpful.',
    featureCards: [
      { title: 'Smarter Matching', description: 'Connect the right donors to the right requests faster.' },
      { title: 'Safety Focus', description: 'Verification-aware workflows to promote trust and clarity.' },
      { title: 'Track Impact', description: 'See your donation journey and community contribution over time.' },
    ],
    emergencyBadge: 'Emergency Support',
    emergencyTitle: 'Responsive Emergency Support',
    emergencyDescription: 'In emergencies, time matters. We work to connect requests with nearby donors quickly and safely.',
    emergencyPoints: [
      { title: 'Timely Alerts', description: 'Notifications when a request is nearby' },
      { title: 'Nearby Matching', description: 'Prioritize closer donors when possible' },
      { title: 'Verified Profiles', description: 'Helpful checks to build trust' },
    ],
    emergencyStats: [
      { value: 'Fast', label: 'Response Goal' },
      { value: 'Nearby', label: 'Local Focus' },
      { value: 'Always On', label: 'Availability' },
      { value: 'Trusted', label: 'Community Care' },
    ],
    ctaBandTitle: 'Ready to Make a Difference?',
    ctaBandSubtitle: 'Join a growing community of donors and supporters.',
    ctaBandPrimaryText: 'Become a Donor',
    ctaBandPrimaryTo: ROUTES.portal.donor.register,
    ctaBandTiles: [
      { value: 'Always', label: 'Emergency Support' },
      { value: 'Quick', label: 'Response Goal' },
      { value: 'Trusted', label: 'BloodBank Network' },
    ],
    finalCtaTitle: 'Every Moment Counts',
    finalCtaDescription: 'Someone, somewhere, needs blood every day. Be part of the response.',
    finalCtaPrimaryText: 'Become a Donor',
    finalCtaPrimaryTo: ROUTES.portal.donor.register,
    finalCtaSecondaryText: 'Request Blood',
    finalCtaSecondaryTo: ROUTES.requestBlood,
  },
  'find-donors': {
    schemaVersion: CMS_FRONTEND_PAGE_SCHEMA_VERSION,
    heroBadge: 'Find Donors',
    heroTitle: 'Connect with Life-Savers',
    heroDescription: 'Find blood donors near you and save lives. Our community of heroes is ready to help.',
    searchPlaceholder: 'Search by location or donor name...',
    locationBannerTitle: 'Enable location to use Find Donors',
    locationBannerDescription: 'We need your location to show nearby donors and accurate distances.',
    locationButtonText: 'Enable Location',
    noLocationTitle: 'Location required',
    noLocationDescription: 'Enable location services to see nearby donors.',
    noDonorsTitle: 'No donors found',
    noDonorsDescription: 'Try adjusting your search criteria or filters',
    clearFiltersText: 'Clear Filters',
    bottomCtaTitle: 'Want to Become a Donor?',
    bottomCtaDescription: 'Join the donor network and help save lives in your city.',
    bottomCtaButton: 'Register as Donor',
  },
  'request-blood': {
    schemaVersion: CMS_FRONTEND_PAGE_SCHEMA_VERSION,
    heroBadge: 'Emergency Blood Request',
    heroTitleGradient: 'Request Blood',
    heroTitleNormal: 'Save a Life Today',
    heroDescription: "Fill out the form below and we'll connect you with available donors in your area. Every second counts!",
    submitSuccessMessage: 'Blood request submitted successfully! We will connect you with donors soon.',
    submitErrorMessage: 'Failed to submit blood request. Please try again.',
    submitValidationMessage: 'Please correct the errors in the form.',
    patientInfoTitle: 'Patient Information',
    bloodSelectionTitle: 'Blood Requirement',
    urgencyTitle: 'Urgency Level',
    hospitalInfoTitle: 'Hospital Information',
    contactInfoTitle: 'Contact Information',
    reasonTitle: 'Reason for Request',
    finalCtaTitle: 'Find Donors Near You',
    finalCtaDescription: 'Need immediate help? Browse verified donors in your area and send quick requests.',
    finalCtaButtonText: 'Go to Find Donors',
  },
  about: {
    schemaVersion: CMS_FRONTEND_PAGE_SCHEMA_VERSION,
    heroBadge: 'About Us',
    heroTitleGradient: 'Supporting Communities Through',
    heroTitleNormal: 'Blood Donation',
    heroDescription: 'BloodHub is a growing blood donation platform, connecting donors with those in need through thoughtful technology and compassion.',
    missionTitle: 'Our Mission',
    missionDescription: 'To build a seamless ecosystem where people in need of blood can find donors as quickly and safely as possible.',
    visionTitle: 'Our Vision',
    visionDescription: 'A future where blood is easier to access, and more people feel empowered to become life-saving heroes.',
    impactTitle: 'Our Impact So Far',
    impactSubtitle: 'A growing community making a difference across India',
    valuesTitle: 'Our Core Values',
    valuesSubtitle: 'The principles that guide everything we do',
    faqTitle: 'Frequently Asked Questions',
    faqItems: [
      { question: 'Who can donate blood?', answer: 'Most healthy adults can donate blood, but eligibility depends on local guidelines and a quick screening.' },
      { question: 'How often can I donate blood?', answer: 'Donation frequency varies by donation type and local guidelines. Many centers allow whole blood donations about every 8 weeks.' },
      { question: 'Is blood donation safe?', answer: 'Blood donation is generally safe at accredited centers. Single-use equipment and trained staff are standard.' },
      { question: 'How long does a blood donation take?', answer: 'The full visit typically takes around an hour, while the donation itself is much shorter.' },
    ],
  },
  contact: {
    schemaVersion: CMS_FRONTEND_PAGE_SCHEMA_VERSION,
    heroBadge: 'Contact Us',
    heroTitle: "We're Here to Help",
    heroDescription: 'Have questions? Need support? Our team is available 24/7 to assist you.',
    phoneLabel: 'Phone',
    phoneSubLabel: 'Available 24/7',
    emailLabel: 'Email',
    emailSubLabel: 'Response in 24 hours',
    officeLabel: 'Office',
    officeSubLabel: 'Visit us',
    formTitle: 'Send us a Message',
    submitButton: 'Send Message',
    sidebarTitle: 'Why Contact Us?',
    sidebarPoints: [
      { title: '24/7 Support', description: 'Our team is always available to help you' },
      { title: 'Quick Response', description: 'We typically respond within 2 hours' },
      { title: 'Expert Guidance', description: 'Get help from blood donation experts' },
    ],
    faqTitle: 'Frequently Asked Questions',
    faqSubtitle: "Can't find your answer? Feel free to contact us!",
    faqItems: [
      { q: 'What are your operating hours?', a: 'We provide 24/7 emergency support for urgent blood requests' },
      { q: 'How quickly can I expect a response?', a: 'Typically within 2 hours during business hours, and within 6 hours for overnight inquiries' },
      { q: 'Do you have physical offices?', a: 'Our headquarters is in Mumbai, but we operate digitally across India' },
    ],
  },
};

export const getCmsFrontendPageDefaultContent = <T extends CmsFrontendPageSlug>(slug: T): CmsFrontendPageContentMap[T] => (
  CMS_FRONTEND_PAGE_DEFAULT_CONTENT[slug]
);
