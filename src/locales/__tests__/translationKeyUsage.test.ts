import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import ts from 'typescript';
import en from '../en';

const ROOT_DIR = path.resolve(__dirname, '../../..');
const SRC_DIR = path.join(ROOT_DIR, 'src');

const flattenLocaleKeys = (input: unknown, prefix = ''): string[] => {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return [];
  return Object.entries(input).flatMap(([key, value]) => {
    const nextKey = prefix ? `${prefix}.${key}` : key;
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      return flattenLocaleKeys(value, nextKey);
    }
    return typeof value === 'string' ? [nextKey] : [];
  });
};

const walkSourceFiles = (dir: string): string[] => {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    if (entry.name === 'locales' || entry.name === 'generated' || entry.name === 'node_modules') return [];
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) return walkSourceFiles(fullPath);
    return /\.(ts|tsx)$/.test(entry.name) ? [fullPath] : [];
  });
};

const collectLiteralTranslationKeys = (filePath: string): string[] => {
  const source = fs.readFileSync(filePath, 'utf8');
  if (!source.includes('t(')) {
    return [];
  }
  const sourceFile = ts.createSourceFile(
    filePath,
    source,
    ts.ScriptTarget.Latest,
    true,
    filePath.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
  );

  const keys = new Set<string>();
  const visit = (node: ts.Node) => {
    if (
      ts.isCallExpression(node)
      && ts.isIdentifier(node.expression)
      && node.expression.text === 't'
      && node.arguments.length > 0
      && ts.isStringLiteralLike(node.arguments[0])
    ) {
      keys.add(node.arguments[0].text);
    }
    ts.forEachChild(node, visit);
  };

  visit(sourceFile);
  return Array.from(keys);
};

describe('translation key usage', () => {
  it('keeps literal t(...) keys aligned with the english locale catalog', () => {
    const localeKeys = new Set(flattenLocaleKeys(en));
    const missingByFile = walkSourceFiles(SRC_DIR).reduce<Record<string, string[]>>((acc, filePath) => {
      const missingKeys = collectLiteralTranslationKeys(filePath).filter((key) => !localeKeys.has(key));
      if (missingKeys.length > 0) {
        acc[path.relative(ROOT_DIR, filePath)] = missingKeys.sort();
      }
      return acc;
    }, {});

    expect(missingByFile).toEqual({});
  });
});
