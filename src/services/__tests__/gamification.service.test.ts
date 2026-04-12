import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  authState,
  getDocMock,
  getDocsMock,
  setDocMock,
  batchSetMock,
  batchCommitMock,
  captureHandledErrorMock,
} = vi.hoisted(() => ({
  authState: {
    currentUser: null as null | { uid: string },
  },
  getDocMock: vi.fn(),
  getDocsMock: vi.fn(),
  setDocMock: vi.fn(),
  batchSetMock: vi.fn(),
  batchCommitMock: vi.fn(),
  captureHandledErrorMock: vi.fn(),
}));

vi.mock('../../firebase', () => ({
  auth: authState,
  db: {},
}));

vi.mock('firebase/firestore', () => ({
  collection: vi.fn((...segments: string[]) => ({ path: segments.join('/') })),
  doc: vi.fn((...segments: any[]) => ({ path: segments.map((segment) => String(segment?.path || segment)).join('/') })),
  getDoc: getDocMock,
  getDocs: getDocsMock,
  setDoc: setDocMock,
  updateDoc: vi.fn(),
  query: vi.fn((target: any) => ({ target })),
  where: vi.fn(),
  orderBy: vi.fn(),
  limit: vi.fn(),
  increment: vi.fn(),
  serverTimestamp: vi.fn(() => 'server-timestamp'),
  writeBatch: vi.fn(() => ({
    set: batchSetMock,
    commit: batchCommitMock,
  })),
}));

vi.mock('../errorLog.service', () => ({
  captureHandledError: captureHandledErrorMock,
}));

describe('gamification.service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authState.currentUser = null;
    getDocMock.mockResolvedValue({
      exists: () => true,
      data: () => ({
        totalDonations: 0,
        points: 0,
        currentStreak: 0,
        longestStreak: 0,
        emergencyResponses: 0,
        level: 1,
        nextLevelPoints: 500,
      }),
    });
    getDocsMock.mockResolvedValue({
      empty: true,
      docs: [],
    });
    setDocMock.mockResolvedValue(undefined);
    batchCommitMock.mockResolvedValue(undefined);
  });

  it('does not backfill stats or badges when auth is not settled to the owner yet', async () => {
    getDocMock
      .mockResolvedValueOnce({
        exists: () => true,
        data: () => ({
          totalDonations: 0,
          points: 0,
          currentStreak: 0,
          longestStreak: 0,
          emergencyResponses: 0,
          level: 1,
          nextLevelPoints: 500,
        }),
      })
      .mockResolvedValueOnce({
        exists: () => true,
        data: () => ({
          uid: 'donor-1',
          totalDonations: 3,
          impactScore: 300,
          bloodType: 'O+',
        }),
      });

    const { gamificationService } = await import('../gamification.service');

    const badges = await gamificationService.getUserBadges('donor-1');

    expect(badges.length).toBeGreaterThan(0);
    expect(setDocMock).not.toHaveBeenCalled();
    expect(batchSetMock).not.toHaveBeenCalled();
    expect(batchCommitMock).not.toHaveBeenCalled();
    expect(captureHandledErrorMock).not.toHaveBeenCalled();
  });
});
