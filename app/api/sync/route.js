import { NextResponse } from 'next/server';
import { getSetting, setSetting } from '@/lib/db';
import { getCloudSyncState, startCloudSyncScheduler, stopCloudSyncScheduler } from '@/lib/cloud-sync-scheduler';

export async function GET() {
  try {
    const isEnabled = await getSetting('cloud_sync_enabled') === '1';
    const hubUrl = await getSetting('cloud_hub_url') || process.env.CLOUD_HUB_URL || 'http://localhost:3001';
    const token = await getSetting('secret_cloud_token') || process.env.SECRET_CLOUD_TOKEN || 'makna_cloud_secret_hub_token_2026';
    const interval = await getSetting('cloud_sync_interval') || '60';
    
    const lastPollTime = await getSetting('cloud_last_poll_time') || '';
    const lastSyncStatus = await getSetting('cloud_last_sync_status') || 'idle';
    const lastSyncError = await getSetting('cloud_last_sync_error') || '';

    const daemonState = getCloudSyncState();

    return NextResponse.json({
      success: true,
      data: {
        cloud_sync_enabled: isEnabled,
        cloud_hub_url: hubUrl,
        secret_cloud_token: token ? '••••••••' + token.slice(-6) : '',
        raw_token: token,
        cloud_sync_interval: Number(interval),
        cloud_last_poll_time: lastPollTime,
        cloud_last_sync_status: lastSyncStatus,
        cloud_last_sync_error: lastSyncError,
        daemon: daemonState
      }
    });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const { 
      cloud_sync_enabled, 
      cloud_hub_url, 
      secret_cloud_token, 
      cloud_sync_interval 
    } = await request.json();

    if (cloud_sync_enabled !== undefined) {
      const isEnabled = cloud_sync_enabled ? '1' : '0';
      await setSetting('cloud_sync_enabled', isEnabled);
      
      // Control daemon based on toggle
      if (cloud_sync_enabled) {
        startCloudSyncScheduler();
      } else {
        stopCloudSyncScheduler();
      }
    }

    if (cloud_hub_url !== undefined) {
      await setSetting('cloud_hub_url', cloud_hub_url.trim());
    }

    if (secret_cloud_token !== undefined) {
      await setSetting('secret_cloud_token', secret_cloud_token.trim());
    }

    if (cloud_sync_interval !== undefined) {
      await setSetting('cloud_sync_interval', String(cloud_sync_interval));
      
      // Restart scheduler to apply new interval if it's currently running
      const isEnabled = await getSetting('cloud_sync_enabled') === '1';
      if (isEnabled) {
        stopCloudSyncScheduler();
        startCloudSyncScheduler();
      }
    }

    return NextResponse.json({ 
      success: true, 
      message: 'Konfigurasi Cloud Hub Sync berhasil disimpan.' 
    });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
