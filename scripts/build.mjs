import { spawn, execSync } from 'child_process';
import { writeFile } from 'fs/promises';
import path from 'path';
import { writeFirebaseConfig } from './prepare-firebase-config.mjs';

const writeVersionFile = async () => {
  let commit = 'unknown';
  try {
    commit = execSync('git rev-parse --short HEAD', { stdio: ['ignore', 'pipe', 'ignore'] })
      .toString()
      .trim();
  } catch (error) {
    console.warn('Unable to read git commit hash, using fallback.');
  }

  const version = new Date().toISOString();
  const payload = { version, commit };
  const versionPath = path.resolve('public', 'version.json');
  await writeFile(versionPath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
};

const isWindows = process.platform === 'win32';
const getBinPath = (command) => {
  return isWindows
    ? `node_modules/.bin/${command}.cmd`
    : `node_modules/.bin/${command}`;
};

const run = (command, args, { filterStdout, filterStderr } = {}) => new Promise((resolve, reject) => {
  const needsFilter = filterStdout || filterStderr;
  const stdio = needsFilter ? ['inherit', filterStdout ? 'pipe' : 'inherit', filterStderr ? 'pipe' : 'inherit'] : 'inherit';
  const child = spawn(command, args, { stdio, shell: false });

  if (filterStdout && child.stdout) {
    child.stdout.on('data', (data) => {
      const output = data.toString();
      const filtered = filterStdout(output);
      if (filtered) {
        process.stdout.write(filtered);
      }
    });
  }

  if (filterStderr && child.stderr) {
    child.stderr.on('data', (data) => {
      const output = data.toString();
      const filtered = filterStderr(output);
      if (filtered) {
        process.stderr.write(filtered);
      }
    });
  }

  child.on('close', (code) => {
    if (code === 0) {
      resolve();
    } else {
      reject(new Error(`${command} ${args.join(' ')} exited with code ${code}`));
    }
  });
});

const suppressBaselineWarnings = (text) => {
  const filtered = text
    .split('\n')
    .filter(line => !line.includes('[baseline-browser-mapping]'));

  if (filtered.length === 0) {
    return '';
  }

  let output = filtered.join('\n');
  if (text.endsWith('\n')) {
    output += '\n';
  }
  return output;
};

try {
  await writeFirebaseConfig();
  await writeVersionFile();
  await run(getBinPath('tsc'), []);
  process.env.BROWSERSLIST_IGNORE_OLD_DATA = '1';
  const viteArgs = ['build', ...process.argv.slice(2)];
  await run(getBinPath('vite'), viteArgs, {
    filterStdout: suppressBaselineWarnings,
    filterStderr: suppressBaselineWarnings
  });
} catch (error) {
  console.error(error.message);
  process.exit(1);
}
