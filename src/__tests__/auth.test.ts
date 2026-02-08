/**
 * Authentication Tests
 *
 * Tests for authentication-related utilities and functions
 */

import { describe, it, expect } from 'vitest';
import {
  isDonor,
  isHospital,
  isNGO,
  isAdmin,
  isVerified,
  canCreateBloodRequest,
  canCreateCampaign,
  canDonateBlood,
  isEligibleToDonate,
  getDaysUntilEligible,
  getUserDisplayName,
  getUserInitials,
  getDashboardRoute,
  needsProfileCompletion,
} from '../utils/auth.utils';
import { mockDonor, mockHospital, mockNGO, mockAdmin } from '../utils/test.utils';

describe('Authentication Utilities', () => {
  describe('Role Checking', () => {
    it('should correctly identify donor role', () => {
      const donor = mockDonor();
      expect(isDonor(donor)).toBe(true);
      expect(isHospital(donor)).toBe(false);
      expect(isNGO(donor)).toBe(false);
      expect(isAdmin(donor)).toBe(false);
    });

    it('should correctly identify bloodbank role', () => {
      const bloodbank = mockHospital();
      expect(isHospital(bloodbank)).toBe(true);
      expect(isDonor(bloodbank)).toBe(false);
      expect(isNGO(bloodbank)).toBe(false);
      expect(isAdmin(bloodbank)).toBe(false);
    });

    it('should correctly identify legacy hospital role', () => {
      const legacyHospital = mockHospital({ role: 'hospital' });
      expect(isHospital(legacyHospital)).toBe(true);
      expect(isDonor(legacyHospital)).toBe(false);
      expect(isNGO(legacyHospital)).toBe(false);
      expect(isAdmin(legacyHospital)).toBe(false);
    });

    it('should correctly identify NGO role', () => {
      const ngo = mockNGO();
      expect(isNGO(ngo)).toBe(true);
      expect(isDonor(ngo)).toBe(false);
      expect(isHospital(ngo)).toBe(false);
      expect(isAdmin(ngo)).toBe(false);
    });

    it('should correctly identify admin role', () => {
      const admin = mockAdmin();
      expect(isAdmin(admin)).toBe(true);
      expect(isDonor(admin)).toBe(false);
      expect(isHospital(admin)).toBe(false);
      expect(isNGO(admin)).toBe(false);
    });

    it('should return false for null user', () => {
      expect(isDonor(null)).toBe(false);
      expect(isHospital(null)).toBe(false);
      expect(isNGO(null)).toBe(false);
      expect(isAdmin(null)).toBe(false);
    });
  });

  describe('Verification Status', () => {
    it('should check if user is verified', () => {
      const verifiedHospital = mockHospital({ verified: true });
      const unverifiedHospital = mockHospital({ verified: false });

      expect(isVerified(verifiedHospital)).toBe(true);
      expect(isVerified(unverifiedHospital)).toBe(false);
    });

    it('should return false for null user', () => {
      expect(isVerified(null)).toBe(false);
    });
  });

  describe('Permissions', () => {
    it('should allow verified bloodbanks to create blood requests', () => {
      const bloodbank = mockHospital({ verified: true, status: 'active' });
      expect(canCreateBloodRequest(bloodbank)).toBe(true);
    });

    it('should not allow unverified bloodbanks to create blood requests', () => {
      const bloodbank = mockHospital({ verified: false });
      expect(canCreateBloodRequest(bloodbank)).toBe(false);
    });

    it('should allow admin to create blood requests', () => {
      const admin = mockAdmin();
      expect(canCreateBloodRequest(admin)).toBe(true);
    });

    it('should allow verified NGOs to create campaigns', () => {
      const ngo = mockNGO({ verified: true, status: 'active' });
      expect(canCreateCampaign(ngo)).toBe(true);
    });

    it('should not allow unverified NGOs to create campaigns', () => {
      const ngo = mockNGO({ verified: false });
      expect(canCreateCampaign(ngo)).toBe(false);
    });

    it('should allow active donors to donate blood', () => {
      const donor = mockDonor({ status: 'active' });
      expect(canDonateBlood(donor)).toBe(true);
    });

    it('should not allow inactive donors to donate blood', () => {
      const donor = mockDonor({ status: 'inactive' });
      expect(canDonateBlood(donor)).toBe(false);
    });
  });

  describe('Donation Eligibility', () => {
    it('should allow donation if no previous donation', () => {
      const donor = mockDonor({ lastDonation: undefined });
      expect(isEligibleToDonate(donor)).toBe(true);
    });

    it('should not allow donation within 90 days', () => {
      const lastDonation = new Date();
      lastDonation.setDate(lastDonation.getDate() - 30); // 30 days ago
      const donor = mockDonor({ lastDonation: lastDonation as any });
      expect(isEligibleToDonate(donor)).toBe(false);
    });

    it('should allow donation after 90 days', () => {
      const lastDonation = new Date();
      lastDonation.setDate(lastDonation.getDate() - 100); // 100 days ago
      const donor = mockDonor({ lastDonation: lastDonation as any });
      expect(isEligibleToDonate(donor)).toBe(true);
    });

    it('should calculate days until eligible correctly', () => {
      const lastDonation = new Date();
      lastDonation.setDate(lastDonation.getDate() - 30); // 30 days ago
      const donor = mockDonor({ lastDonation: lastDonation as any });
      const daysRemaining = getDaysUntilEligible(donor);
      expect(daysRemaining).toBeGreaterThan(0);
      expect(daysRemaining).toBeLessThanOrEqual(60);
    });
  });

  describe('User Display', () => {
    it('should get display name from displayName', () => {
      const user = mockDonor({ displayName: 'John Doe' });
      expect(getUserDisplayName(user)).toBe('John Doe');
    });

    it('should get display name from bloodbank name', () => {
      const bloodbank = mockHospital({
        displayName: null,
        bloodBankName: 'City BloodBank',
      });
      expect(getUserDisplayName(bloodbank)).toBe('City BloodBank');
    });

    it('should get display name from organization name', () => {
      const ngo = mockNGO({
        displayName: null,
        organizationName: 'Blood Donation Society',
      });
      expect(getUserDisplayName(ngo)).toBe('Blood Donation Society');
    });

    it('should get display name from email', () => {
      const user = mockDonor({
        displayName: null,
        email: 'test@example.com',
      });
      expect(getUserDisplayName(user)).toBe('test');
    });

    it('should return Guest for null user', () => {
      expect(getUserDisplayName(null)).toBe('Guest');
    });

    it('should get user initials correctly', () => {
      const user = mockDonor({ displayName: 'John Doe' });
      expect(getUserInitials(user)).toBe('JD');
    });

    it('should get initials for single word name', () => {
      const user = mockDonor({ displayName: 'John' });
      expect(getUserInitials(user)).toBe('JO');
    });
  });

  describe('Dashboard Routes', () => {
    it('should get correct donor dashboard route', () => {
      const donor = mockDonor();
      expect(getDashboardRoute(donor)).toBe('/donor/dashboard');
    });

    it('should get correct bloodbank dashboard route', () => {
      const bloodbank = mockHospital();
      expect(getDashboardRoute(bloodbank)).toBe('/bloodbank/dashboard');
    });

    it('should get correct NGO dashboard route', () => {
      const ngo = mockNGO();
      expect(getDashboardRoute(ngo)).toBe('/ngo/dashboard');
    });

    it('should get correct admin dashboard route', () => {
      const admin = mockAdmin();
      expect(getDashboardRoute(admin)).toBe('/admin/dashboard');
    });

    it('should return home for null user', () => {
      expect(getDashboardRoute(null)).toBe('/');
    });
  });

  describe('Profile Completion', () => {
    it('should detect incomplete donor profile', () => {
      const donor = mockDonor({
        bloodType: undefined,
      });
      expect(needsProfileCompletion(donor)).toBe(true);
    });

    it('should detect complete donor profile', () => {
      const donor = mockDonor();
      expect(needsProfileCompletion(donor)).toBe(false);
    });

    it('should detect incomplete bloodbank profile', () => {
      const bloodbank = mockHospital({
        bloodBankName: undefined,
      });
      expect(needsProfileCompletion(bloodbank)).toBe(true);
    });

    it('should detect incomplete NGO profile', () => {
      const ngo = mockNGO({
        mission: undefined,
      });
      expect(needsProfileCompletion(ngo)).toBe(true);
    });
  });
});
