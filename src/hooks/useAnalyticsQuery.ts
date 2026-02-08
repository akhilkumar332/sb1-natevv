/**
 * React Query Hooks for Analytics
 *
 * Optimized hooks with caching for analytics data
 */

import { useQuery, UseQueryOptions } from '@tanstack/react-query';
import {
  getDonorStats,
  getDonationTrend,
  getBloodBankStats,
  getBloodRequestTrend,
  getInventoryDistribution,
  getCampaignStats,
  getNGOCampaignPerformance,
  getPlatformStats,
  getUserGrowthTrend,
  getBloodTypeDistribution,
  getGeographicDistribution,
  getTopDonors,
  type DateRange,
  type DonorStats,
  type BloodBankStats,
  type CampaignStats,
  type PlatformStats,
  type TrendData,
  type BloodTypeDistribution,
  type GeographicDistribution,
} from '../services/analytics.service';

// ============================================================================
// DONOR ANALYTICS HOOKS
// ============================================================================

/**
 * Hook to get donor statistics with caching
 */
export const useDonorStats = (
  donorId: string,
  options?: Omit<UseQueryOptions<DonorStats>, 'queryKey' | 'queryFn'>
) => {
  return useQuery({
    queryKey: ['donorStats', donorId],
    queryFn: () => getDonorStats(donorId),
    enabled: !!donorId,
    ...options,
  });
};

/**
 * Hook to get donation trend with caching
 */
export const useDonationTrend = (
  donorId: string,
  dateRange: DateRange,
  options?: Omit<UseQueryOptions<TrendData[]>, 'queryKey' | 'queryFn'>
) => {
  return useQuery({
    queryKey: ['donationTrend', donorId, dateRange],
    queryFn: () => getDonationTrend(donorId, dateRange),
    enabled: !!donorId && !!dateRange.startDate && !!dateRange.endDate,
    ...options,
  });
};

// ============================================================================
// BLOODBANK ANALYTICS HOOKS
// ============================================================================

/**
 * Hook to get bloodbank statistics with caching
 */
export const useBloodBankStats = (
  bloodBankId: string,
  options?: Omit<UseQueryOptions<BloodBankStats>, 'queryKey' | 'queryFn'>
) => {
  return useQuery({
    queryKey: ['bloodBankStats', bloodBankId],
    queryFn: () => getBloodBankStats(bloodBankId),
    enabled: !!bloodBankId,
    ...options,
  });
};

// Legacy alias
export const useHospitalStats = useBloodBankStats;

/**
 * Hook to get blood request trend with caching
 */
export const useBloodRequestTrend = (
  hospitalId: string,
  dateRange: DateRange,
  options?: Omit<UseQueryOptions<TrendData[]>, 'queryKey' | 'queryFn'>
) => {
  return useQuery({
    queryKey: ['bloodRequestTrend', hospitalId, dateRange],
    queryFn: () => getBloodRequestTrend(hospitalId, dateRange),
    enabled: !!hospitalId && !!dateRange.startDate && !!dateRange.endDate,
    ...options,
  });
};

/**
 * Hook to get inventory distribution with caching
 */
export const useInventoryDistribution = (
  hospitalId: string,
  options?: Omit<UseQueryOptions<BloodTypeDistribution[]>, 'queryKey' | 'queryFn'>
) => {
  return useQuery({
    queryKey: ['inventoryDistribution', hospitalId],
    queryFn: () => getInventoryDistribution(hospitalId),
    enabled: !!hospitalId,
    ...options,
  });
};

// ============================================================================
// CAMPAIGN ANALYTICS HOOKS
// ============================================================================

/**
 * Hook to get campaign statistics with caching
 */
export const useCampaignStats = (
  campaignId: string,
  options?: Omit<UseQueryOptions<CampaignStats>, 'queryKey' | 'queryFn'>
) => {
  return useQuery({
    queryKey: ['campaignStats', campaignId],
    queryFn: () => getCampaignStats(campaignId),
    enabled: !!campaignId,
    ...options,
  });
};

/**
 * Hook to get NGO campaign performance with caching
 */
export const useNGOCampaignPerformance = (
  ngoId: string,
  dateRange: DateRange,
  options?: Omit<UseQueryOptions<TrendData[]>, 'queryKey' | 'queryFn'>
) => {
  return useQuery({
    queryKey: ['ngoCampaignPerformance', ngoId, dateRange],
    queryFn: () => getNGOCampaignPerformance(ngoId, dateRange),
    enabled: !!ngoId && !!dateRange.startDate && !!dateRange.endDate,
    ...options,
  });
};

// ============================================================================
// PLATFORM ANALYTICS HOOKS
// ============================================================================

/**
 * Hook to get platform statistics with caching
 */
export const usePlatformStats = (
  options?: Omit<UseQueryOptions<PlatformStats>, 'queryKey' | 'queryFn'>
) => {
  return useQuery({
    queryKey: ['platformStats'],
    queryFn: () => getPlatformStats(),
    // Cache platform stats for 10 minutes (less frequently changing)
    staleTime: 10 * 60 * 1000,
    ...options,
  });
};

/**
 * Hook to get user growth trend with caching
 */
export const useUserGrowthTrend = (
  dateRange: DateRange,
  options?: Omit<UseQueryOptions<TrendData[]>, 'queryKey' | 'queryFn'>
) => {
  return useQuery({
    queryKey: ['userGrowthTrend', dateRange],
    queryFn: () => getUserGrowthTrend(dateRange),
    enabled: !!dateRange.startDate && !!dateRange.endDate,
    ...options,
  });
};

/**
 * Hook to get blood type distribution with caching
 */
export const useBloodTypeDistribution = (
  options?: Omit<UseQueryOptions<BloodTypeDistribution[]>, 'queryKey' | 'queryFn'>
) => {
  return useQuery({
    queryKey: ['bloodTypeDistribution'],
    queryFn: () => getBloodTypeDistribution(),
    // Cache blood type distribution for 15 minutes (rarely changes)
    staleTime: 15 * 60 * 1000,
    ...options,
  });
};

/**
 * Hook to get geographic distribution with caching
 */
export const useGeographicDistribution = (
  options?: Omit<UseQueryOptions<GeographicDistribution[]>, 'queryKey' | 'queryFn'>
) => {
  return useQuery({
    queryKey: ['geographicDistribution'],
    queryFn: () => getGeographicDistribution(),
    // Cache geographic distribution for 15 minutes (rarely changes)
    staleTime: 15 * 60 * 1000,
    ...options,
  });
};

/**
 * Hook to get top donors with caching
 */
export const useTopDonors = (
  limit: number = 10,
  options?: Omit<UseQueryOptions<any[]>, 'queryKey' | 'queryFn'>
) => {
  return useQuery({
    queryKey: ['topDonors', limit],
    queryFn: () => getTopDonors(limit),
    // Cache top donors for 10 minutes
    staleTime: 10 * 60 * 1000,
    ...options,
  });
};
