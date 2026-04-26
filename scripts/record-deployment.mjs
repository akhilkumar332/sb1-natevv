import { readFile } from 'fs/promises';
import path from 'path';
import { applicationDefault, initializeApp, getApps } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';

const readVersionMetadata = async () => {
  const versionPath = path.resolve('public', 'version.json');
  const raw = await readFile(versionPath, 'utf8');
  return JSON.parse(raw);
};

const ensureAdminApp = () => {
  if (getApps().length > 0) {
    return getApps()[0];
  }

  return initializeApp({
    credential: applicationDefault(),
    projectId: process.env.VITE_FIREBASE_PROJECT_ID || process.env.GCLOUD_PROJECT || process.env.GOOGLE_CLOUD_PROJECT,
  });
};

const requiredString = (value, fallback = 'unknown') => (
  typeof value === 'string' && value.trim().length > 0 ? value.trim() : fallback
);

const main = async () => {
  const metadata = await readVersionMetadata();
  const app = ensureAdminApp();
  const db = getFirestore(app);

  const deployId = requiredString(metadata.deployId, `manual-${Date.now()}`);
  const workflowRunId = requiredString(process.env.GITHUB_RUN_ID, null);
  const workflowRunNumber = requiredString(process.env.GITHUB_RUN_NUMBER, null);
  const repository = requiredString(process.env.GITHUB_REPOSITORY, null);
  const workflowRunUrl = workflowRunId && repository
    ? `https://github.com/${repository}/actions/runs/${workflowRunId}`
    : null;

  await db.collection('deployments').doc(deployId).set({
    appVersion: requiredString(metadata.appVersion, '0.0.0'),
    buildTime: requiredString(metadata.buildTime, new Date().toISOString()),
    gitCommit: requiredString(metadata.gitCommit, requiredString(metadata.commit)),
    gitBranch: requiredString(metadata.gitBranch, process.env.GITHUB_REF_NAME),
    deployId,
    environment: requiredString(metadata.environment, 'prod'),
    deployTarget: requiredString(metadata.deployTarget, 'firebase-hosting'),
    workflowRunId,
    workflowRunNumber,
    workflowRunUrl,
    repository,
    siteUrl: requiredString(process.env.SITE_URL, null),
    projectId: requiredString(process.env.VITE_FIREBASE_PROJECT_ID, null),
    actor: requiredString(process.env.GITHUB_ACTOR, null),
    status: 'success',
    deployedAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  }, { merge: true });

  console.log(`Recorded deployment ledger entry: ${deployId}`);
};

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
