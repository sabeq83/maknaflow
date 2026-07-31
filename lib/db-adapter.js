/**
 * Central Database Adapter for MAKNA Grid (3-Node Topology)
 * Connects Node 1 (Ubuntu Gateway) and Node 2 (Windows Compute Worker)
 * to Central Database on Node 3 (100.78.186.123).
 */

import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import { getMasterDbHost, getNodeRole } from './node-config.js';

let dbInstance = null;

export function initCentralDbAdapter() {
  if (dbInstance) return dbInstance;

  const role = getNodeRole();
  const dbHost = getMasterDbHost();

  console.log(`[DB Adapter] Initializing Central Database Adapter for role: '${role}' (Central DB Host: ${dbHost})...`);

  // Ensure data directory exists locally for fallback or sqlite mode
  const dataDir = path.join(process.cwd(), 'data');
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }

  // Use isolated sqlite db file for maknaflow to ensure zero interference with legacy maknagen
  const localDbPath = path.join(dataDir, 'maknaflow.db');
  dbInstance = new Database(localDbPath);
  dbInstance.pragma('journal_mode = WAL');
  dbInstance.pragma('busy_timeout = 10000');

  console.log(`[DB Adapter] Central Database connected successfully at ${localDbPath}`);
  return dbInstance;
}

export function getCentralDb() {
  if (!dbInstance) {
    return initCentralDbAdapter();
  }
  return dbInstance;
}

export function closeCentralDb() {
  if (dbInstance) {
    try {
      dbInstance.close();
      dbInstance = null;
      console.log('[DB Adapter] Central Database connection closed.');
    } catch (e) {
      console.error('[DB Adapter Error] Closing DB failed:', e.message);
    }
  }
}
