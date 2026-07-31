import { execSync } from 'child_process';
import fs from 'fs';
import net from 'net';

// Helper function to probe if a port is open on a host
function probePort(host, port, timeout = 250) {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    let isOpened = false;

    socket.setTimeout(timeout);

    socket.connect(port, host, () => {
      isOpened = true;
      socket.destroy();
      resolve(true);
    });

    socket.on('error', () => {
      socket.destroy();
      resolve(false);
    });

    socket.on('timeout', () => {
      socket.destroy();
      resolve(false);
    });
  });
}

export async function getCDPEndpoint() {
  const port = 9222;
  const candidates = new Set(['127.0.0.1']);

  try {
    // 1. Cek apakah berjalan di dalam WSL
    const isWSL = fs.existsSync('/proc/version') && 
                  fs.readFileSync('/proc/version', 'utf8').toLowerCase().includes('microsoft');
    
    if (isWSL) {
      // 2. Tambahkan default gateway (IP Windows Host dari sisi WSL)
      const routeOut = execSync("ip route | grep default | awk '{print $3}'", { encoding: 'utf8' }).trim();
      if (routeOut) {
        candidates.add(routeOut);
      }

      // 3. Query seluruh IP Host Windows menggunakan PowerShell interop
      try {
        const psCmd = `powershell.exe -Command "[System.Net.Dns]::GetHostAddresses([System.Net.Dns]::GetHostName()) | Where-Object { $_.AddressFamily -eq 'InterNetwork' } | Select-Object -ExpandProperty IPAddressToString"`;
        const psOut = execSync(psCmd, { encoding: 'utf8', timeout: 2000 });
        if (psOut) {
          psOut.split('\r\n')
            .join('\n')
            .split('\n')
            .map(ip => ip.trim())
            .filter(Boolean)
            .forEach(ip => candidates.add(ip));
        }
      } catch (_) {
        // Abaikan jika interop dinonaktifkan
      }
    }
  } catch (err) {
    // Fail silently
  }

  // Lakukan probing berurutan ke setiap kandidat
  for (const host of candidates) {
    console.log(`[CDP Probe] Memeriksa koneksi ke ${host}:${port}...`);
    const isOpen = await probePort(host, port);
    if (isOpen) {
      console.log(`[CDP Probe] Sukses terhubung ke Chrome debug di ${host}:${port}!`);
      return `http://${host}:${port}`;
    }
  }

  // Jika semua gagal, default ke localhost
  console.warn(`[CDP Probe] Semua kandidat IP gagal diprobe. Default ke http://127.0.0.1:9222`);
  return `http://127.0.0.1:9222`;
}
