import { AsyncLocalStorage } from 'async_hooks';
import fs from 'fs';
import path from 'path';

export const logContextStorage = new AsyncLocalStorage();

const MAX_LOG_BYTES = 200_000;   // 200 KB
const KEEP_LOG_LINES = 500;      // keep latest 500 lines

function maybeTruncateLog(logFile) {
  try {
    const stat = fs.statSync(logFile);
    if (stat.size > MAX_LOG_BYTES) {
      const content = fs.readFileSync(logFile, 'utf8');
      const lines = content.split('\n').filter(Boolean);
      const kept = lines.slice(-KEEP_LOG_LINES);
      const truncated =
        `[AUTO-TRUNCATED: ${new Date().toISOString()} — menjaga ${KEEP_LOG_LINES} baris terbaru]\n` +
        kept.join('\n') + '\n';
      fs.writeFileSync(logFile, truncated);
    }
  } catch (err) {
    // Fail silently
  }
}

export function writeLogToFile(logFile, message) {
  try {
    const logDir = path.dirname(logFile);
    if (!fs.existsSync(logDir)) {
      fs.mkdirSync(logDir, { recursive: true });
    }
    const timestamp = new Date().toLocaleTimeString('id-ID', { hour12: false });
    const logMessage = `[${timestamp}] ${message}\n`;
    fs.appendFileSync(logFile, logMessage);
    
    // Check truncation on roughly 5% of writes
    if (Math.random() < 0.05) {
      maybeTruncateLog(logFile);
    }
  } catch (err) {
    // Fail silently
  }
}

export function ensureLogFilesExist() {
  try {
    const logDir = path.join(process.cwd(), 'public');
    if (!fs.existsSync(logDir)) {
      fs.mkdirSync(logDir, { recursive: true });
    }

    const files = {
      're_campaign_logs.txt': 'Belum ada log aktivitas RE Campaign.',
      'opc_logs.txt': 'Belum ada log aktivitas OPC Campaign.',
      'strategic_campaign_logs.txt': 'Belum ada log aktivitas Strategic Campaign.',
      'instant_factory_logs.txt': 'Belum ada log aktivitas Instant Factory.',
      'autopilot_logs.txt': 'Belum ada log aktivitas autopilot.',
      'multiplier_logs.txt': 'Belum ada log aktivitas multiplier.',
      'bridge_injector_logs.txt': 'Belum ada log aktivitas Bridge Injector.'
    };

    for (const [filename, placeholder] of Object.entries(files)) {
      const logFile = path.join(logDir, filename);
      if (!fs.existsSync(logFile)) {
        fs.writeFileSync(logFile, `[System Initialized] ${placeholder}\n`, 'utf8');
      }
    }
  } catch (err) {
    console.error('Failed to pre-create log files:', err.message);
  }
}

let hooked = false;
export function hookConsole() {
  if (hooked) return;
  hooked = true;

  const originalLog = console.log;
  const originalInfo = console.info;
  const originalWarn = console.warn;
  const originalError = console.error;

  const formatArgs = (args) => {
    return args.map(arg => {
      if (arg instanceof Error) {
        return arg.stack || arg.toString();
      }
      if (typeof arg === 'object' && arg !== null) {
        try {
          return JSON.stringify(arg);
        } catch (_) {
          return String(arg);
        }
      }
      return String(arg);
    }).join(' ');
  };

  console.log = function (...args) {
    originalLog.apply(console, args);
    const logFile = logContextStorage.getStore();
    if (logFile) {
      writeLogToFile(logFile, formatArgs(args));
    }
  };

  console.info = function (...args) {
    originalInfo.apply(console, args);
    const logFile = logContextStorage.getStore();
    if (logFile) {
      writeLogToFile(logFile, `[INFO] ${formatArgs(args)}`);
    }
  };

  console.warn = function (...args) {
    originalWarn.apply(console, args);
    const logFile = logContextStorage.getStore();
    if (logFile) {
      writeLogToFile(logFile, `[WARN] ${formatArgs(args)}`);
    }
  };

  console.error = function (...args) {
    originalError.apply(console, args);
    const logFile = logContextStorage.getStore();
    if (logFile) {
      writeLogToFile(logFile, `[ERROR] ${formatArgs(args)}`);
    }
  };
}
