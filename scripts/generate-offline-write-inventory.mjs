import { promises as fs } from 'fs';
import path from 'path';

const SRC_DIR = path.resolve('src');
const OUTPUT_DIR = path.resolve('src/generated');
const OUTPUT_FILE = path.join(OUTPUT_DIR, 'offlineWriteInventory.ts');

const SOURCE_EXTENSIONS = new Set(['.ts', '.tsx']);
const FIRESTORE_WRITE_PATTERN = /\b(addDoc|setDoc|updateDoc|deleteDoc|writeBatch|runTransaction|tx\.set|tx\.update|tx\.delete|batch\.set|batch\.update|batch\.delete)\s*\(/g;
const COLLECTION_PATTERN = /COLLECTIONS\.([A-Z0-9_]+)/;

const SENSITIVE_COLLECTIONS = new Set([
  'BLOOD_INVENTORY',
  'INVENTORY_TRANSFERS',
  'INVENTORY_RESERVATIONS',
  'FCM_TOKENS',
  'AUDIT_LOGS',
]);

const METHOD_CLASSIFICATION = {
  addDoc: 'queue_safe',
  setDoc: 'queue_safe',
  updateDoc: 'queue_safe',
  deleteDoc: 'online_only',
  writeBatch: 'online_only',
  runTransaction: 'online_only',
  'tx.set': 'online_only',
  'tx.update': 'online_only',
  'tx.delete': 'online_only',
  'batch.set': 'online_only',
  'batch.update': 'online_only',
  'batch.delete': 'online_only',
};

const ONLINE_ONLY_PATH_MARKERS = [
  '/services/notification.service.ts',
  '/services/fcmNotification.service.ts',
  '/services/audit.service.ts',
];

const readAllSourceFiles = async (dir) => {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === 'generated' || entry.name === '__tests__') continue;
      files.push(...await readAllSourceFiles(fullPath));
      continue;
    }
    if (!entry.isFile()) continue;
    if (!SOURCE_EXTENSIONS.has(path.extname(entry.name))) continue;
    files.push(fullPath);
  }
  return files;
};

const toModuleFromPath = (relativePath) => {
  const clean = relativePath.replace(/\\/g, '/');
  const parts = clean.split('/');
  if (parts[0] === 'pages' && parts[1]) return `pages/${parts[1]}`;
  if (parts[0] === 'services') return 'services';
  if (parts[0] === 'contexts') return 'contexts';
  if (parts[0] === 'hooks') return 'hooks';
  return parts[0] || 'src';
};

const detectMode = ({ method, collectionKey, relativePath, lineText }) => {
  if (ONLINE_ONLY_PATH_MARKERS.some((marker) => relativePath.endsWith(marker))) {
    return 'online_only';
  }
  if (collectionKey && SENSITIVE_COLLECTIONS.has(collectionKey)) {
    return 'online_only';
  }
  if (lineText.includes('queueFirestoreDocPatch(') || lineText.includes('updateAdmin') || lineText.includes('updateUserProfilePatch(')) {
    return 'queue_safe';
  }
  return METHOD_CLASSIFICATION[method] || 'persistence_backed';
};

const scanFile = async (filePath) => {
  const content = await fs.readFile(filePath, 'utf8');
  const relativePath = path.relative(SRC_DIR, filePath).replace(/\\/g, '/');
  const lines = content.split('\n');
  const rows = [];
  const docRefCollectionByVar = new Map();
  const collectionRefCollectionByVar = new Map();

  const docRefPattern = /\b(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*doc\s*\(\s*db\s*,\s*COLLECTIONS\.([A-Z0-9_]+)[\s\S]{0,500}?\)/g;
  let docRefMatch = docRefPattern.exec(content);
  while (docRefMatch) {
    docRefCollectionByVar.set(docRefMatch[1], docRefMatch[2]);
    docRefMatch = docRefPattern.exec(content);
  }

  const docFromCollectionPattern = /\b(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*doc\s*\(\s*collection\s*\(\s*db\s*,\s*COLLECTIONS\.([A-Z0-9_]+)[\s\S]{0,500}?\)\s*[\s\S]{0,200}?\)/g;
  let docFromCollectionMatch = docFromCollectionPattern.exec(content);
  while (docFromCollectionMatch) {
    docRefCollectionByVar.set(docFromCollectionMatch[1], docFromCollectionMatch[2]);
    docFromCollectionMatch = docFromCollectionPattern.exec(content);
  }

  const collectionRefPattern = /\b(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*collection\s*\(\s*db\s*,\s*COLLECTIONS\.([A-Z0-9_]+)[\s\S]{0,500}?\)/g;
  let collectionRefMatch = collectionRefPattern.exec(content);
  while (collectionRefMatch) {
    collectionRefCollectionByVar.set(collectionRefMatch[1], collectionRefMatch[2]);
    collectionRefMatch = collectionRefPattern.exec(content);
  }

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    if (!line) continue;
    FIRESTORE_WRITE_PATTERN.lastIndex = 0;
    let match = FIRESTORE_WRITE_PATTERN.exec(line);
    while (match) {
      const method = match[1];
      const neighbor = [
        line,
        lines[index + 1] || '',
        lines[index + 2] || '',
        lines[index + 3] || '',
      ].join(' ');
      const collectionMatch = COLLECTION_PATTERN.exec(neighbor);
      let collectionKey = collectionMatch ? collectionMatch[1] : 'UNKNOWN';

      if (collectionKey === 'UNKNOWN') {
        const directDocArgMatch = line.match(/\b(?:setDoc|updateDoc|deleteDoc)\s*\(\s*([A-Za-z_$][\w$]*)/);
        if (directDocArgMatch) {
          const maybeVar = directDocArgMatch[1];
          collectionKey = docRefCollectionByVar.get(maybeVar) || collectionKey;
        }

        const addDocArgMatch = line.match(/\baddDoc\s*\(\s*([A-Za-z_$][\w$]*)/);
        if (addDocArgMatch) {
          const maybeVar = addDocArgMatch[1];
          collectionKey = collectionRefCollectionByVar.get(maybeVar) || collectionKey;
        }

        const txDocArgMatch = line.match(/\b(?:tx\.set|tx\.update|tx\.delete|batch\.set|batch\.update|batch\.delete)\s*\(\s*([A-Za-z_$][\w$]*)/);
        if (txDocArgMatch) {
          const maybeVar = txDocArgMatch[1];
          collectionKey = docRefCollectionByVar.get(maybeVar) || collectionKey;
        }
      }

      const mode = detectMode({
        method,
        collectionKey,
        relativePath,
        lineText: neighbor,
      });
      rows.push({
        id: `${collectionKey}.${method}.${relativePath.replace(/[^\w/.-]/g, '_')}:${index + 1}`,
        method,
        collectionKey,
        module: toModuleFromPath(relativePath),
        path: relativePath,
        line: index + 1,
        area: `${collectionKey} ${method}`,
        mode,
      });
      match = FIRESTORE_WRITE_PATTERN.exec(line);
    }
  }

  return rows;
};

const main = async () => {
  const files = await readAllSourceFiles(SRC_DIR);
  const rows = [];
  for (const file of files) {
    rows.push(...await scanFile(file));
  }

  rows.sort((a, b) => {
    if (a.path === b.path) return a.line - b.line;
    return a.path < b.path ? -1 : 1;
  });

  const output = `// Auto-generated by scripts/generate-offline-write-inventory.mjs\n` +
    `// Do not edit manually.\n\n` +
    `export type GeneratedOfflineWriteInventoryRow = {\n` +
    `  id: string;\n` +
    `  method: string;\n` +
    `  collectionKey: string;\n` +
    `  module: string;\n` +
    `  path: string;\n` +
    `  line: number;\n` +
    `  area: string;\n` +
    `  mode: 'queue_safe' | 'online_only' | 'persistence_backed';\n` +
    `};\n\n` +
    `export const GENERATED_OFFLINE_WRITE_INVENTORY: GeneratedOfflineWriteInventoryRow[] = ${JSON.stringify(rows, null, 2)};\n`;

  await fs.mkdir(OUTPUT_DIR, { recursive: true });
  await fs.writeFile(OUTPUT_FILE, output, 'utf8');
  console.log(`Generated offline write inventory: ${rows.length} callsites -> ${path.relative(process.cwd(), OUTPUT_FILE)}`);
};

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
