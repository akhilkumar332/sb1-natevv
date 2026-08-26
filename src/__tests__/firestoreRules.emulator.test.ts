/**
 * Firestore security-rules tests.
 *
 * These run against the Firestore emulator, not jsdom, so they are excluded from
 * the default `npm run test:run` sweep (see `vitest.config.ts`) and executed by
 * `npm run test:rules`, which boots the emulator around them.
 *
 * They exist because two collections shipped with no `match` block at all.
 * `firestore.rules` has no catch-all, so an unmatched collection is deny-all:
 * every CMS blog post save reported failure, and the gamification ledger could
 * never be written. Static review missed it twice; only running the rules caught
 * it. Keep these tests as the regression guard.
 */
import { readFileSync } from 'fs';
import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest';
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import { collection, doc, getDoc, getDocs, query, setDoc, where } from 'firebase/firestore';

const PROJECT_ID = 'demo-bloodhub-rules';
const EMULATOR_HOST = process.env.FIRESTORE_EMULATOR_HOST || '127.0.0.1:8080';
const [host, port] = EMULATOR_HOST.split(':');

let testEnv: RulesTestEnvironment;

const ADMIN = 'admin_1';
const SUPERADMIN = 'superadmin_1';
const DONOR = 'donor_1';
const OTHER_DONOR = 'donor_2';

beforeAll(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: PROJECT_ID,
    firestore: {
      host,
      port: Number(port),
      rules: readFileSync('firestore.rules', 'utf8'),
    },
  });
});

afterAll(async () => {
  if (testEnv) await testEnv.cleanup();
});

beforeEach(async () => {
  await testEnv.clearFirestore();
  // Role documents must exist because the rules resolve roles via
  // get(/databases/$(db)/documents/users/$(uid)).data.role
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    await setDoc(doc(db, 'users', ADMIN), { role: 'admin', status: 'active' });
    await setDoc(doc(db, 'users', SUPERADMIN), { role: 'superadmin', status: 'active' });
    await setDoc(doc(db, 'users', DONOR), { role: 'donor', status: 'active' });
    await setDoc(doc(db, 'users', OTHER_DONOR), { role: 'donor', status: 'active' });
    await setDoc(doc(db, 'cmsBlogPostRevisions', 'rev_1'), {
      postSlug: 'hello-world',
      savedAt: new Date(),
      title: 'Hello',
    });
    await setDoc(doc(db, 'pointTransactions', 'pt_1'), {
      userId: DONOR,
      points: 10,
      reason: 'donation',
    });
  });
});

const asAdmin = () => testEnv.authenticatedContext(ADMIN).firestore();
const asSuperadmin = () => testEnv.authenticatedContext(SUPERADMIN).firestore();
const asDonor = () => testEnv.authenticatedContext(DONOR).firestore();
const asOtherDonor = () => testEnv.authenticatedContext(OTHER_DONOR).firestore();
const asAnon = () => testEnv.unauthenticatedContext().firestore();

describe('rules harness sanity', () => {
  // If these fail, every assertion below is meaningless.
  it('lets an admin read their own user document', async () => {
    await assertSucceeds(getDoc(doc(asAdmin(), 'users', ADMIN)));
  });

  it('lets a donor read their own user document', async () => {
    await assertSucceeds(getDoc(doc(asDonor(), 'users', DONOR)));
  });
});

describe('cmsBlogPostRevisions', () => {
  // Regression: this collection had no match block, so the awaited revision
  // write inside the blog-post save flow threw PERMISSION_DENIED and aborted
  // the slug-rename cleanup, the cache invalidation and the success toast.
  it('allows an admin to write a revision (the blog save path)', async () => {
    await assertSucceeds(
      setDoc(doc(asAdmin(), 'cmsBlogPostRevisions', 'rev_2'), {
        postSlug: 'hello-world',
        savedAt: new Date(),
        title: 'Draft',
      }),
    );
  });

  it('allows a superadmin to write a revision', async () => {
    await assertSucceeds(
      setDoc(doc(asSuperadmin(), 'cmsBlogPostRevisions', 'rev_3'), {
        postSlug: 'hello-world',
        savedAt: new Date(),
        title: 'Draft',
      }),
    );
  });

  it('allows an admin to read a revision document', async () => {
    await assertSucceeds(getDoc(doc(asAdmin(), 'cmsBlogPostRevisions', 'rev_1')));
  });

  it('allows an admin to query revision history by postSlug', async () => {
    await assertSucceeds(
      getDocs(query(collection(asAdmin(), 'cmsBlogPostRevisions'), where('postSlug', '==', 'hello-world'))),
    );
  });

  it('denies anonymous reads', async () => {
    await assertFails(getDoc(doc(asAnon(), 'cmsBlogPostRevisions', 'rev_1')));
  });

  it('denies non-admin reads -- revisions can contain unpublished drafts', async () => {
    await assertFails(getDoc(doc(asDonor(), 'cmsBlogPostRevisions', 'rev_1')));
  });

  it('denies non-admin writes', async () => {
    await assertFails(
      setDoc(doc(asDonor(), 'cmsBlogPostRevisions', 'rev_4'), { postSlug: 'x', savedAt: new Date() }),
    );
  });
});

describe('pointTransactions', () => {
  // Regression: no match block meant awardPoints() incremented userStats.points
  // and then threw on the ledger write, leaving points with no audit trail.
  it('allows a donor to append their own ledger entry', async () => {
    await assertSucceeds(
      setDoc(doc(asDonor(), 'pointTransactions', 'pt_2'), {
        userId: DONOR,
        points: 5,
        reason: 'referral',
      }),
    );
  });

  it('allows a donor to read their own ledger entry', async () => {
    await assertSucceeds(getDoc(doc(asDonor(), 'pointTransactions', 'pt_1')));
  });

  it('allows an admin to read any ledger entry', async () => {
    await assertSucceeds(getDoc(doc(asAdmin(), 'pointTransactions', 'pt_1')));
  });

  it("denies writing a ledger entry attributed to another user", async () => {
    await assertFails(
      setDoc(doc(asDonor(), 'pointTransactions', 'pt_3'), {
        userId: OTHER_DONOR,
        points: 999,
        reason: 'spoofed',
      }),
    );
  });

  it('denies reading another donor ledger entry', async () => {
    await assertFails(getDoc(doc(asOtherDonor(), 'pointTransactions', 'pt_1')));
  });

  it('denies a non-numeric points value', async () => {
    await assertFails(
      setDoc(doc(asDonor(), 'pointTransactions', 'pt_4'), {
        userId: DONOR,
        points: 'lots',
        reason: 'bad type',
      }),
    );
  });

  it('denies anonymous writes', async () => {
    await assertFails(
      setDoc(doc(asAnon(), 'pointTransactions', 'pt_5'), { userId: DONOR, points: 1 }),
    );
  });
});
