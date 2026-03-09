import fs from 'fs/promises';
import path from 'path';

const root = process.cwd();
const assetsDir = path.join(root, 'dist', 'assets');

const toKb = (bytes) => Number((bytes / 1024).toFixed(2));

const main = async () => {
  try {
    const entries = await fs.readdir(assetsDir, { withFileTypes: true });
    const files = await Promise.all(
      entries
        .filter((entry) => entry.isFile())
        .map(async (entry) => {
          const absolutePath = path.join(assetsDir, entry.name);
          const stat = await fs.stat(absolutePath);
          return { name: entry.name, bytes: stat.size };
        })
    );

    const totalBytes = files.reduce((sum, file) => sum + file.bytes, 0);
    const jsBytes = files.filter((file) => file.name.endsWith('.js')).reduce((sum, file) => sum + file.bytes, 0);
    const cssBytes = files.filter((file) => file.name.endsWith('.css')).reduce((sum, file) => sum + file.bytes, 0);
    const topFiles = [...files].sort((a, b) => b.bytes - a.bytes).slice(0, 15);

    console.log('Memory Baseline (dist/assets)');
    console.log(`- Total assets: ${toKb(totalBytes)} KB`);
    console.log(`- Total JS: ${toKb(jsBytes)} KB`);
    console.log(`- Total CSS: ${toKb(cssBytes)} KB`);
    console.log('- Top 15 largest files:');
    topFiles.forEach((file, index) => {
      console.log(`  ${index + 1}. ${file.name} (${toKb(file.bytes)} KB)`);
    });
  } catch (error) {
    console.error('Failed to read dist/assets. Run build first.');
    process.exitCode = 1;
  }
};

void main();

