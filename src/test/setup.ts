/**
 * Test Setup Configuration
 *
 * Global test setup for Vitest
 */

import { afterEach, vi } from 'vitest';
import { cleanup } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';

const createMemoryStorage = (): Storage => {
  const state = new Map<string, string>();
  return {
    get length() {
      return state.size;
    },
    clear() {
      state.clear();
    },
    getItem(key: string) {
      return state.has(key) ? state.get(key) ?? null : null;
    },
    key(index: number) {
      return Array.from(state.keys())[index] ?? null;
    },
    removeItem(key: string) {
      state.delete(key);
    },
    setItem(key: string, value: string) {
      state.set(String(key), String(value));
    },
  } as Storage;
};

const ensureStorage = (name: 'localStorage' | 'sessionStorage') => {
  const target = (window as any)[name];
  const hasCompleteApi = target
    && typeof target.getItem === 'function'
    && typeof target.setItem === 'function'
    && typeof target.removeItem === 'function'
    && typeof target.clear === 'function'
    && typeof target.key === 'function';

  if (hasCompleteApi) return;

  const fallback = createMemoryStorage();
  Object.defineProperty(window, name, {
    configurable: true,
    enumerable: true,
    writable: true,
    value: fallback,
  });
  Object.defineProperty(globalThis, name, {
    configurable: true,
    enumerable: true,
    writable: true,
    value: fallback,
  });
};

ensureStorage('localStorage');
ensureStorage('sessionStorage');

// Cleanup after each test
afterEach(() => {
  cleanup();
});

// Mock Firebase
vi.mock('../firebase', () => ({
  default: {},
  auth: {
    currentUser: null,
    onAuthStateChanged: vi.fn(() => {
      // Return unsubscribe function
      return () => {};
    }),
  },
  db: {},
  storage: {},
  firebaseMeasurementId: '',
}));

// Mock window.matchMedia
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation(query => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

// Mock IntersectionObserver
global.IntersectionObserver = class IntersectionObserver {
  constructor() {}
  disconnect() {}
  observe() {}
  takeRecords() {
    return [];
  }
  unobserve() {}
} as any;

// Mock PerformanceObserver
global.PerformanceObserver = class PerformanceObserver {
  constructor() {}
  disconnect() {}
  observe() {}
  takeRecords() {
    return [];
  }
} as any;
