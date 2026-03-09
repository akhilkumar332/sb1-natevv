import fs from 'fs/promises';
import path from 'path';

const root = process.cwd();
const assetsDir = path.join(root, 'dist', 'assets');

const BUDGETS = {
  maxSingleJsBytes: 700_000,
  maxTotalJsBytes: 6_500_000,
};

const main = async () => {
  try {
    const entries = await fs.readdir(assetsDir, { withFileTypes: true });
    const jsFiles = await Promise.all(
      entries
        .filter((entry) => entry.isFile() && entry.name.endsWith('.js'))
        .map(async (entry) => {
          const absolutePath = path.join(assetsDir, entry.name);
          const stat = await fs.stat(absolutePath);
          return { name: entry.name, bytes: stat.size };
        })
    );

    const largest = jsFiles.reduce((acc, curr) => (curr.bytes > acc.bytes ? curr : acc), { name: '', bytes: 0 });
    const totalJsBytes = jsFiles.reduce((sum, file) => sum + file.bytes, 0);

    const failures = [];
    if (largest.bytes > BUDGETS.maxSingleJsBytes) {
      failures.push(`Largest JS chunk exceeds budget: ${largest.name} (${largest.bytes} bytes)`);
    }
    if (totalJsBytes > BUDGETS.maxTotalJsBytes) {
      failures.push(`Total JS bytes exceed budget: ${totalJsBytes} bytes`);
    }

    if (failures.length > 0) {
      console.error('Memory bundle budget check failed:');
      failures.forEach((failure) => console.error(`- ${failure}`));
      process.exitCode = 1;
      return;
    }

    console.log('Memory bundle budget check passed.');
    console.log(`- Largest JS: ${largest.name} (${largest.bytes} bytes)`);
    console.log(`- Total JS: ${totalJsBytes} bytes`);
  } catch (error) {
    console.error('Failed to check budgets. Run build first.');
    process.exitCode = 1;
  }
};

void main();
