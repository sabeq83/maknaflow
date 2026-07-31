import Database from 'better-sqlite3';

const DB_PATH = './data/makna.db';
const db = new Database(DB_PATH);

console.log("=== SCHEDULER CONFIG ===");
const configs = db.prepare('SELECT * FROM scheduler_config').all();
console.log(configs);
