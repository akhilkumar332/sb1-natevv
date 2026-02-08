/**
 * Test Utilities
 *
 * Helpers for testing React components
 */

import React, { ReactElement } from 'react';
import { render, RenderOptions } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider } from '../contexts/AuthContext';

// Create a test query client
const createTestQueryClient = () =>
  new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        gcTime: 0,
      },
      mutations: {
        retry: false,
      },
    },
  });

interface AllTheProvidersProps {
  children: React.ReactNode;
}

const AllTheProviders = ({ children }: AllTheProvidersProps) => {
  const queryClient = createTestQueryClient();

  return (
    <BrowserRouter>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>{children}</AuthProvider>
      </QueryClientProvider>
    </BrowserRouter>
  );
};

const customRender = (
  ui: ReactElement,
  options?: Omit<RenderOptions, 'wrapper'>
) => render(ui, { wrapper: AllTheProviders, ...options });

export * from '@testing-library/react';
export { customRender as render };

// Mock user data
export const mockUser = {
  uid: 'test-user-123',
  email: 'test@example.com',
  displayName: 'Test User',
  role: 'donor' as const,
};

// Mock donor data
export const mockDonor = {
  id: 'donor-123',
  name: 'John Doe',
  email: 'john@example.com',
  bloodType: 'O+',
  phone: '+1234567890',
  city: 'Mumbai',
  state: 'Maharashtra',
  isAvailable: true,
  role: 'donor' as const,
};

// Mock donation data
export const mockDonation = {
  id: 'donation-123',
  donorId: 'donor-123',
  hospitalId: 'hospital-123',
  donationDate: new Date('2025-09-01'),
  units: 1,
  bloodType: 'O+',
  status: 'completed' as const,
};

// Mock bloodbank data
export const mockHospital = {
  id: 'bloodbank-123',
  name: 'Test BloodBank',
  email: 'bloodbank@example.com',
  phone: '+1234567890',
  city: 'Mumbai',
  state: 'Maharashtra',
  role: 'bloodbank' as const,
};

// Mock blood request data
export const mockBloodRequest = {
  id: 'request-123',
  hospitalId: 'hospital-123',
  bloodType: 'O+',
  units: 2,
  urgency: 'high' as const,
  status: 'pending' as const,
  createdAt: new Date('2025-10-01'),
};

// Mock campaign data
export const mockCampaign = {
  id: 'campaign-123',
  ngoId: 'ngo-123',
  name: 'Blood Drive 2025',
  description: 'Annual blood donation drive',
  startDate: new Date('2025-10-10'),
  endDate: new Date('2025-10-15'),
  target: 100,
  collected: 50,
  status: 'active' as const,
};

// Wait for async updates
export const waitFor = (callback: () => void, timeout = 1000) =>
  new Promise<void>((resolve) => {
    const startTime = Date.now();
    const interval = setInterval(() => {
      try {
        callback();
        clearInterval(interval);
        resolve();
      } catch (error) {
        if (Date.now() - startTime > timeout) {
          clearInterval(interval);
          throw error;
        }
      }
    }, 50);
  });
