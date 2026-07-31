import { createClient } from 'webdav';
import { getSetting } from './db.js';
import fs from 'fs';
import path from 'path';

export function getNextcloudClient(overrideConfig = null) {
  const url = getSetting('nextcloud_url');
  const username = getSetting('nextcloud_username');
  const password = getSetting('nextcloud_app_password');

  if (!url || !username || !password) {
    throw new Error('Kredensial Nextcloud belum dikonfigurasi secara lengkap.');
  }

  const baseUrl = url.replace(/\/+$/, '');
  const webdavUrl = `${baseUrl}/remote.php/webdav`;

  return createClient(webdavUrl, {
    username,
    password
  });
}

/**
 * Memastikan path direktori di Nextcloud tersedia.
 * Jika tidak ada, fungsi ini akan membuatnya secara bertahap (recursive).
 */
export async function checkAndCreateFolder(folderPath) {
  const client = getNextcloudClient();
  const parts = folderPath.split('/').filter(p => p.trim() !== '');
  let currentPath = '';

  for (const part of parts) {
    currentPath += `/${part}`;
    const exists = await client.exists(currentPath);
    if (!exists) {
      await client.createDirectory(currentPath);
    }
  }
}

export async function getOrCreatePublicShareLink(targetNextcloudPath) {
  const url = getSetting('nextcloud_url');
  const username = getSetting('nextcloud_username');
  const password = getSetting('nextcloud_app_password');

  if (!url || !username || !password) {
    throw new Error('Kredensial Nextcloud belum dikonfigurasi secara lengkap.');
  }

  const baseUrl = url.replace(/\/+$/, '');
  const path = targetNextcloudPath.startsWith('/') ? targetNextcloudPath : `/${targetNextcloudPath}`;
  const cleanPath = path.replace(/\/+/g, '/');

  let attempts = 5;
  let delay = 4000;

  for (let i = 0; i < attempts; i++) {
    try {
      const ocsUrl = `${baseUrl}/ocs/v2.php/apps/files_sharing/api/v1/shares?format=json`;
      const response = await fetch(ocsUrl, {
        method: 'POST',
        headers: {
          'OCS-APIRequest': 'true',
          'Content-Type': 'application/x-www-form-urlencoded',
          'Authorization': 'Basic ' + Buffer.from(`${username}:${password}`).toString('base64')
        },
        body: new URLSearchParams({
          path: cleanPath,
          shareType: '3', // public link share
          permissions: '1' // read-only
        })
      });

      if (response.status === 429) {
        console.warn(`[Nextcloud Share] Rate limited (429) for ${cleanPath}. Retrying in ${delay}ms... (Attempt ${i + 1}/${attempts})`);
        await new Promise(resolve => setTimeout(resolve, delay));
        delay *= 1.5;
        continue;
      }

      const text = await response.text();
      let json = {};
      try {
        json = JSON.parse(text);
      } catch (jsonErr) {
        throw new Error(`Failed to parse OCS JSON response: ${text.substring(0, 200)}`);
      }

      if (response.ok && json.ocs && json.ocs.meta && json.ocs.meta.statuscode === 200) {
        return json.ocs.data.url;
      }

      if (json.ocs && json.ocs.meta && (json.ocs.meta.statuscode === 403 || json.ocs.meta.statuscode === 409 || json.ocs.meta.statuscode === 400)) {
        const getSharesUrl = `${baseUrl}/ocs/v2.php/apps/files_sharing/api/v1/shares?path=${encodeURIComponent(cleanPath)}&format=json`;
        const getResponse = await fetch(getSharesUrl, {
          method: 'GET',
          headers: {
            'OCS-APIRequest': 'true',
            'Authorization': 'Basic ' + Buffer.from(`${username}:${password}`).toString('base64')
          }
        });

        if (getResponse.status === 429) {
          console.warn(`[Nextcloud Share GET] Rate limited (429) for ${cleanPath}. Retrying...`);
          await new Promise(resolve => setTimeout(resolve, delay));
          delay *= 1.5;
          continue;
        }

        const getText = await getResponse.text();
        let getJson = {};
        try {
          getJson = JSON.parse(getText);
        } catch (jsonErr) {
          throw new Error(`Failed to parse OCS GET JSON response: ${getText.substring(0, 200)}`);
        }

        if (getResponse.ok && getJson.ocs && getJson.ocs.data) {
          const data = getJson.ocs.data;
          const shares = Array.isArray(data) ? data : [data];
          const publicShare = shares.find(s => s.share_type === 3);
          if (publicShare) {
            return publicShare.url;
          }
        }
      }
      
      // If it fails for other reasons, break to fallback
      break;
    } catch (err) {
      console.error(`[Nextcloud Share] Failed to get or create share link for ${cleanPath}:`, err.message);
      if (i === attempts - 1) break;
      await new Promise(resolve => setTimeout(resolve, delay));
      delay *= 1.5;
    }
  }

  // Fallback to WebDAV direct link
  return `${baseUrl}/remote.php/webdav${cleanPath}`;
}

/**
 * Mengunggah file lokal ke Nextcloud.
 * localFilePath: path absolut file di server (misal: /tmp/file.mp4)
 * targetNextcloudPath: path tujuan di Nextcloud (misal: /MAKNA_Video_Generations/file.mp4)
 * Returns direct download URL yang bisa diakses secara publik.
 */
export async function uploadFileToNextcloud(localFilePath, targetNextcloudPath, generateShare = true) {
  const client = getNextcloudClient();
  
  const folderPath = targetNextcloudPath.substring(0, targetNextcloudPath.lastIndexOf('/'));
  if (folderPath) {
    await checkAndCreateFolder(folderPath);
  }

  const readStream = fs.createReadStream(localFilePath);
  
  await client.putFileContents(targetNextcloudPath, readStream, {
    overwrite: true
  });

  let publicUrl = '';
  if (generateShare) {
    publicUrl = await getOrCreatePublicShareLink(targetNextcloudPath);
  } else {
    const url = getSetting('nextcloud_url');
    const baseUrl = url.replace(/\/+$/, '');
    const cleanPath = targetNextcloudPath.startsWith('/') ? targetNextcloudPath : `/${targetNextcloudPath}`;
    publicUrl = `${baseUrl}/remote.php/webdav${cleanPath.replace(/\/+/g, '/')}`;
  }
  
  return {
    success: true,
    fileUrl: publicUrl
  };
}

/**
 * Mengunggah data dari buffer atau stream ke Nextcloud.
 */
export async function uploadBufferToNextcloud(buffer, targetNextcloudPath, generateShare = true) {
  const client = getNextcloudClient();
  
  const folderPath = targetNextcloudPath.substring(0, targetNextcloudPath.lastIndexOf('/'));
  if (folderPath) {
    await checkAndCreateFolder(folderPath);
  }

  await client.putFileContents(targetNextcloudPath, buffer, {
    overwrite: true
  });

  let publicUrl = '';
  if (generateShare) {
    publicUrl = await getOrCreatePublicShareLink(targetNextcloudPath);
  } else {
    const url = getSetting('nextcloud_url');
    const baseUrl = url.replace(/\/+$/, '');
    const cleanPath = targetNextcloudPath.startsWith('/') ? targetNextcloudPath : `/${targetNextcloudPath}`;
    publicUrl = `${baseUrl}/remote.php/webdav${cleanPath.replace(/\/+/g, '/')}`;
  }
  
  return {
    success: true,
    fileUrl: publicUrl
  };
}

/**
 * Mengunduh file dari URL lalu mengunggahnya ke Nextcloud.
 */
export async function uploadFileUrlToNextcloud(fileUrl, targetNextcloudPath) {
  const response = await fetch(fileUrl);
  if (!response.ok) throw new Error(`Failed to download file from URL: ${response.status}`);
  
  const arrayBuffer = await response.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  
  return await uploadBufferToNextcloud(buffer, targetNextcloudPath);
}

/**
 * Menguji koneksi ke server Nextcloud dengan credentials yang diberikan
 * tanpa menyimpannya ke database (digunakan dari halaman Settings).
 */
export async function testNextcloudConnection(url, username, password) {
  try {
    const baseUrl = url.replace(/\/+$/, '');
    const webdavUrl = `${baseUrl}/remote.php/webdav`;
    
    const client = createClient(webdavUrl, { username, password });
    // Coba baca root directory untuk validasi kredensial
    await client.getDirectoryContents('/');
    return { success: true };
  } catch (error) {
    return { success: false, message: error.message };
  }
}
