import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const SERVER_DIR = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_RULES_DIR = path.resolve(SERVER_DIR, '..', '5e_rules', 'rules');

function assertRelativePath(rulePath) {
  if (typeof rulePath !== 'string' || !rulePath.trim() || rulePath.includes('\\') || rulePath.startsWith('/')) {
    throw new TypeError('Rule record path must be a non-empty relative path.');
  }
  const segments = rulePath.split('/').map((segment) => {
    try {
      return decodeURIComponent(segment);
    } catch {
      return '';
    }
  });
  if (segments.some((segment) => !segment || segment === '.' || segment === '..' || segment.includes('/') || segment.includes('\\'))) {
    throw new TypeError('Rule record path must stay inside the rules database.');
  }
  return rulePath;
}

/** Synchronous, read-only access to the generated rules database for server lookups. */
export class LocalRulesDatabase {
  constructor({ rootDir = DEFAULT_RULES_DIR } = {}) {
    this.rootDir = path.resolve(rootDir);
    this.cache = new Map();
  }

  readJson(relativePath) {
    const safePath = assertRelativePath(relativePath);
    const absolutePath = path.resolve(this.rootDir, safePath);
    if (!absolutePath.startsWith(`${this.rootDir}${path.sep}`)) {
      throw new TypeError('Rule record path must stay inside the rules database.');
    }
    if (this.cache.has(safePath)) return this.cache.get(safePath);
    try {
      const value = JSON.parse(fs.readFileSync(absolutePath, 'utf8'));
      this.cache.set(safePath, value);
      return value;
    } catch (error) {
      if (error.code === 'ENOENT') return null;
      throw error;
    }
  }

  getManifest() {
    const manifest = this.readJson('index.json');
    if (!manifest || !Number.isInteger(manifest.schemaVersion) || !manifest.catalogs) {
      throw new Error('The local rules manifest is missing or invalid.');
    }
    return manifest;
  }

  getCatalog(catalogId) {
    const catalogPath = this.getManifest().catalogs?.[catalogId]?.path;
    if (!catalogPath) throw new Error(`Unknown rules catalog: ${catalogId}`);
    const catalog = this.readJson(catalogPath);
    if (!catalog || !Array.isArray(catalog.items)) throw new Error(`Rules catalog has no item list: ${catalogId}`);
    return catalog;
  }

  getClassEntry(classId) {
    return this.getManifest().classes.find((entry) => entry.id === classId) || null;
  }

  getRecord(recordPath) {
    return this.readJson(recordPath);
  }

  getCatalogRecord(catalogId, recordId) {
    const entry = this.getCatalog(catalogId).items.find((item) => item.id === recordId);
    return entry ? this.getRecord(entry.path) : null;
  }
}

export const localRulesDatabase = new LocalRulesDatabase();
