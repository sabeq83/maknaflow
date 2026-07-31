import fs from 'fs';
import path from 'path';

export function logToBridgeInjector(msg) {
  try {
    const logDir = path.join(process.cwd(), 'public');
    if (!fs.existsSync(logDir)) fs.mkdirSync(logDir, { recursive: true });
    const logFile = path.join(logDir, 'bridge_injector_logs.txt');
    const time = new Date().toLocaleString('id-ID');
    fs.appendFileSync(logFile, `[${time}] ${msg}\n`);
    console.log(`[Bridge Injector] ${msg}`);
  } catch (err) {
    console.error('Failed to write bridge injector log:', err);
  }
}
