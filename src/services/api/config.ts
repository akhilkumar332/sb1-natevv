// src/services/api/config.ts

export const API_CONFIG = {
  BASE_URL: import.meta.env.VITE_API_BASE_URL,
    ENDPOINTS: {
      AUTH: {
        PHONE_LOGIN: '/auth/login/phone',
        VERIFY_OTP: '/auth/verify-otp',
        GOOGLE_LOGIN: '/auth/login/google',
      },
      DONORS: {
        LIST: '/donors',
        SEARCH: '/donors/search',
        PROFILE: (id: string) => `/donors/${id}`,
      },
      REQUESTS: {
        CREATE: '/requests',
        LIST: '/requests',
        DETAILS: (id: string) => `/requests/${id}`,
      },
    },
    HEADERS: {
      DEFAULT: {
        'Content-Type': 'application/json',
      },
    },
  };