import { execSync } from 'child_process';
import { FieldValue } from 'firebase-admin/firestore';
import { getAdminFirestore } from './lib/firebaseAdminApp.mjs';

const args = new Set(process.argv.slice(2));
const getArgValue = (prefix, fallback) => {
  const match = [...args].find((entry) => entry.startsWith(`${prefix}=`));
  return match ? match.slice(prefix.length + 1) : fallback;
};

const limit = Math.max(1, Number(getArgValue('--limit', '200')) || 200);
const dryRun = !args.has('--commit');

const readCurrentBranch = () => {
  try {
    return execSync('git rev-parse --abbrev-ref HEAD', { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim() || null;
  } catch {
    return null;
  }
};

const readGitLog = () => {
  const format = ['%H', '%h', '%an', '%ae', '%ad', '%s'].join('%x1f');
  const command = `git log --max-count=${limit} --date=iso-strict --pretty=format:${format}%x1e`;
  const output = execSync(command, { stdio: ['ignore', 'pipe', 'ignore'] }).toString();
  return output
    .split('\x1e')
    .map((entry) => entry.trim())
    .filter(Boolean)
    .map((entry) => {
      const [gitCommit, gitShortCommit, authorName, authorEmail, committedAt, commitMessage] = entry.split('\x1f');
      return {
        gitCommit,
        gitShortCommit,
        authorName,
        authorEmail,
        committedAt,
        commitMessage,
      };
    })
    .filter((entry) => entry.gitCommit);
};

const readAppVersionAtCommit = (gitCommit) => {
  if (!gitCommit) return null;

  try {
    const output = execSync(`git show ${gitCommit}:package.json`, { stdio: ['ignore', 'pipe', 'ignore'] }).toString();
    const parsed = JSON.parse(output);
    return typeof parsed?.version === 'string' ? parsed.version : null;
  } catch {
    return null;
  }
};

const main = async () => {
  const rows = readGitLog();
  const gitBranch = process.env.GITHUB_REF_NAME || readCurrentBranch();

  if (dryRun) {
    console.log(`Dry run: prepared ${rows.length} git history records. Re-run with --commit to write.`);
    return;
  }

  const db = getAdminFirestore();
  for (const row of rows) {
    await db.collection('deploymentHistory').doc(`git-${row.gitCommit}`).set({
      kind: 'git-commit',
      source: 'git-backfill',
      verificationLevel: 'historical',
      gitCommit: row.gitCommit,
      gitShortCommit: row.gitShortCommit || null,
      gitBranch: gitBranch || null,
      commitMessage: row.commitMessage || null,
      authorName: row.authorName || null,
      authorEmail: row.authorEmail || null,
      appVersion: readAppVersionAtCommit(row.gitCommit),
      deployTarget: 'firebase-hosting',
      environment: process.env.APP_ENVIRONMENT || 'prod',
      occurredAt: row.committedAt,
      recordedAt: FieldValue.serverTimestamp(),
      metadata: {
        importedVia: 'scripts/backfill-git-history.mjs',
      },
    }, { merge: true });
  }

  console.log(`Backfilled ${rows.length} git history records.`);
};

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
