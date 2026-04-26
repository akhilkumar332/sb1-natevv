import { GoogleAuth } from 'google-auth-library';
import { FieldValue } from 'firebase-admin/firestore';
import { getAdminFirestore } from './lib/firebaseAdminApp.mjs';

const args = new Set(process.argv.slice(2));
const getArgValue = (prefix, fallback) => {
  const match = [...args].find((entry) => entry.startsWith(`${prefix}=`));
  return match ? match.slice(prefix.length + 1) : fallback;
};

const limit = Math.max(1, Number(getArgValue('--limit', '100')) || 100);
const siteId = getArgValue('--site', process.env.FIREBASE_HOSTING_SITE || process.env.VITE_FIREBASE_PROJECT_ID || process.env.GCLOUD_PROJECT || process.env.GOOGLE_CLOUD_PROJECT);
const dryRun = !args.has('--commit');
const defaultSiteUrl = siteId ? `https://${siteId}.web.app` : null;

const getAccessToken = async () => {
  const auth = new GoogleAuth({
    scopes: [
      'https://www.googleapis.com/auth/firebase',
      'https://www.googleapis.com/auth/cloud-platform',
    ],
  });
  const client = await auth.getClient();
  const token = await client.getAccessToken();
  if (!token?.token) {
    throw new Error('Unable to acquire Google access token for Firebase Hosting history backfill.');
  }
  return token.token;
};

const extractVersionId = (name) => {
  if (typeof name !== 'string') return null;
  const parts = name.split('/');
  return parts[parts.length - 1] || null;
};

const fetchHostingVersions = async () => {
  if (!siteId) {
    throw new Error('Missing Firebase Hosting site id. Set FIREBASE_HOSTING_SITE or VITE_FIREBASE_PROJECT_ID.');
  }

  const token = await getAccessToken();
  const response = await fetch(`https://firebasehosting.googleapis.com/v1beta1/sites/${siteId}/versions?pageSize=${limit}`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Failed to fetch Firebase Hosting history (${response.status}): ${text}`);
  }

  const payload = await response.json();
  return Array.isArray(payload?.versions) ? payload.versions : [];
};

const main = async () => {
  const versions = await fetchHostingVersions();
  const db = getAdminFirestore();

  if (dryRun) {
    console.log(`Dry run: prepared ${versions.length} Firebase Hosting history records for site ${siteId}. Re-run with --commit to write.`);
    return;
  }

  for (const version of versions) {
    const versionId = extractVersionId(version.name);
    if (!versionId) continue;
    const occurredAt = version.finalizeTime || version.createTime || version.updateTime;
    if (!occurredAt) continue;

    await db.collection('deploymentHistory').doc(`hosting-${versionId}`).set({
      kind: 'firebase-hosting-release',
      source: 'firebase-hosting-backfill',
      verificationLevel: 'partial',
      releaseId: versionId,
      deployTarget: 'firebase-hosting',
      environment: process.env.APP_ENVIRONMENT || 'prod',
      projectId: process.env.VITE_FIREBASE_PROJECT_ID || process.env.GCLOUD_PROJECT || process.env.GOOGLE_CLOUD_PROJECT || null,
      siteUrl: process.env.SITE_URL || defaultSiteUrl,
      occurredAt,
      recordedAt: FieldValue.serverTimestamp(),
      metadata: {
        hostingSite: siteId,
        name: version.name || null,
        status: version.status || null,
        labels: version.labels || null,
        versionBytes: version.versionBytes || null,
        importedVia: 'scripts/backfill-firebase-hosting-history.mjs',
      },
    }, { merge: true });
  }

  console.log(`Backfilled ${versions.length} Firebase Hosting history records for site ${siteId}.`);
};

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
