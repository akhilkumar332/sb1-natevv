import { FIFTEEN_SECONDS_MS, FIVE_MINUTES_MS, FORTY_FIVE_SECONDS_MS, ONE_MINUTE_MS, TEN_MINUTES_MS, THREE_MINUTES_MS, TWO_MINUTES_MS } from './time';

export const QUERY_DEFAULTS = {
  staleTime: FIVE_MINUTES_MS,
  gcTime: TEN_MINUTES_MS,
  retry: 1,
} as const;

export const ADMIN_QUERY_TIMINGS = {
  users: {
    ttl: TWO_MINUTES_MS,
    staleTime: THREE_MINUTES_MS,
    gcTime: TEN_MINUTES_MS,
    refetchInterval: FIVE_MINUTES_MS,
  },
  verification: {
    ttl: ONE_MINUTE_MS,
    staleTime: ONE_MINUTE_MS,
    gcTime: FIVE_MINUTES_MS,
    refetchInterval: FORTY_FIVE_SECONDS_MS,
  },
  emergency: {
    ttl: ONE_MINUTE_MS,
    staleTime: ONE_MINUTE_MS,
    gcTime: FIVE_MINUTES_MS,
    refetchInterval: FORTY_FIVE_SECONDS_MS,
  },
  inventory: {
    ttl: TWO_MINUTES_MS,
    staleTime: TWO_MINUTES_MS,
    gcTime: TEN_MINUTES_MS,
    refetchInterval: TWO_MINUTES_MS,
  },
  recentActivity: {
    ttl: TWO_MINUTES_MS,
    staleTime: THREE_MINUTES_MS,
    gcTime: TEN_MINUTES_MS,
    refetchInterval: THREE_MINUTES_MS,
  },
  platform: {
    ttl: TEN_MINUTES_MS,
    staleTime: TEN_MINUTES_MS,
    gcTime: 2 * TEN_MINUTES_MS,
    refetchInterval: TEN_MINUTES_MS,
  },
  entitiesLarge: {
    ttl: TEN_MINUTES_MS,
    staleTime: TEN_MINUTES_MS,
    gcTime: 2 * TEN_MINUTES_MS,
    refetchInterval: TEN_MINUTES_MS,
  },
  entitiesMedium: {
    ttl: FIVE_MINUTES_MS,
    staleTime: THREE_MINUTES_MS,
    gcTime: TEN_MINUTES_MS,
    refetchInterval: THREE_MINUTES_MS,
  },
  notifications: {
    ttl: TWO_MINUTES_MS,
    staleTime: TWO_MINUTES_MS,
    gcTime: TEN_MINUTES_MS,
    refetchInterval: TWO_MINUTES_MS,
  },
  userDetail: {
    staleTime: 0,
    gcTime: 15 * ONE_MINUTE_MS,
  },
  userSecurity: {
    staleTime: ONE_MINUTE_MS,
    gcTime: FIVE_MINUTES_MS,
    refetchInterval: ONE_MINUTE_MS,
  },
  userKpis: {
    staleTime: TWO_MINUTES_MS,
    gcTime: TEN_MINUTES_MS,
    refetchInterval: TWO_MINUTES_MS,
  },
  userRefsTimeline: {
    staleTime: ONE_MINUTE_MS,
    gcTime: FIVE_MINUTES_MS,
    refetchInterval: FIFTEEN_SECONDS_MS,
  },
} as const;
