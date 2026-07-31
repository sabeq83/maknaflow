import { NextResponse } from 'next/server';
import { getAllApiKeys, addApiKey, addApiKeysBulk, updateApiKey, deleteApiKey, deleteInvalidApiKeys, markApiKeyStatus, getPoolSummary } from '@/lib/db';
import { testGeminiConnection } from '@/lib/gemini';

export async function GET() {
  try {
    const keys = await getAllApiKeys();
    const pool = await getPoolSummary();

    // Mask API keys for security
    const maskedKeys = keys.map(k => ({
      ...k,
      api_key: k.api_key ? k.api_key.slice(0, 8) + '...' + k.api_key.slice(-4) : '',
    }));

    return NextResponse.json({ success: true, data: { keys: maskedKeys, pool } });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const body = await request.json();

    // Action: Health Check All Keys in Pool
    if (body.action === 'health-check-all') {
      const allKeys = await getAllApiKeys();
      
      const checkResults = await Promise.all(
        allKeys.map(async (k) => {
          const check = await testGeminiConnection(k.api_key);
          if (check.success) {
            await markApiKeyStatus(k.id, 'ACTIVE', 1);
            return { id: k.id, name: k.key_name, status: 'LIVE', message: check.message, success: true };
          } else {
            await markApiKeyStatus(k.id, 'INVALID', 0);
            return { id: k.id, name: k.key_name, status: 'DEAD', message: check.message, success: false };
          }
        })
      );

      const liveCount = checkResults.filter(r => r.success).length;
      const deadCount = checkResults.filter(r => !r.success).length;

      const keys = await getAllApiKeys();
      const pool = await getPoolSummary();
      return NextResponse.json({
        success: true,
        message: `Health Check Selesai: ${liveCount} Key Aktif (Live), ${deadCount} Key Mati/Ditolak (Invalid).`,
        summary: { liveCount, deadCount, total: allKeys.length },
        data: { keys, pool, results: checkResults }
      });
    }

    // Action: Bulk Import Keys
    if (body.bulk_keys && Array.isArray(body.bulk_keys)) {
      let keysToInsert = body.bulk_keys;
      let rejectedKeys = [];

      if (body.validate_live === true) {
        const checks = await Promise.all(
          body.bulk_keys.map(async (item) => {
            const check = await testGeminiConnection(item.api_key);
            return { item, check };
          })
        );

        const validated = [];
        for (const { item, check } of checks) {
          if (check.success) {
            validated.push(item);
          } else {
            rejectedKeys.push({ name: item.key_name, key: item.api_key, reason: check.message });
          }
        }
        keysToInsert = validated;
      }

      const result = await addApiKeysBulk(keysToInsert);
      const keys = await getAllApiKeys();
      const pool = await getPoolSummary();
      
      let msg = `Berhasil mengimpor ${result.addedCount} API Key baru ke pool.`;
      if (rejectedKeys.length > 0) {
        msg += ` ⚠️ ${rejectedKeys.length} Key ditolak oleh Google API (Key Mati/Revoked).`;
      }
      if (result.skippedCount > 0) {
        msg += ` (${result.skippedCount} duplikat dilewati).`;
      }

      return NextResponse.json({
        success: true,
        message: msg,
        summary: { ...result, rejectedCount: rejectedKeys.length },
        rejectedKeys,
        data: { keys, pool }
      });
    }

    // Single Key Import
    const { key_name, api_key, tier, daily_limit, validate_live } = body;
    if (!key_name || !api_key) {
      return NextResponse.json({ success: false, error: 'key_name dan api_key wajib diisi' }, { status: 400 });
    }

    if (validate_live === true) {
      const check = await testGeminiConnection(api_key);
      if (!check.success) {
        return NextResponse.json({
          success: false,
          error: `API Key ditolak oleh Google API: ${check.message}`
        }, { status: 400 });
      }
    }

    await addApiKey(key_name, api_key, tier || 'FREE', daily_limit || 20);
    const keys = await getAllApiKeys();
    const pool = await getPoolSummary();
    return NextResponse.json({ success: true, data: { keys, pool } });
  } catch (error) {
    if (error.message?.includes('UNIQUE')) {
      return NextResponse.json({ success: false, error: 'API Key ini sudah ada di pool' }, { status: 400 });
    }
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function PUT(request) {
  try {
    const { id, ...updates } = await request.json();
    if (!id) {
      return NextResponse.json({ success: false, error: 'id wajib diisi' }, { status: 400 });
    }
    await updateApiKey(id, updates);
    const keys = await getAllApiKeys();
    const pool = await getPoolSummary();
    return NextResponse.json({ success: true, data: { keys, pool } });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function DELETE(request) {
  try {
    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action');

    if (action === 'clean-dead') {
      const result = await deleteInvalidApiKeys();
      const keys = await getAllApiKeys();
      const pool = await getPoolSummary();
      return NextResponse.json({
        success: true,
        message: `Berhasil menghapus ${result.deletedCount} API Key yang mati/invalid dari pool.`,
        data: { keys, pool }
      });
    }

    const id = searchParams.get('id');
    if (!id) {
      return NextResponse.json({ success: false, error: 'id wajib diisi' }, { status: 400 });
    }
    await deleteApiKey(Number(id));
    const keys = await getAllApiKeys();
    const pool = await getPoolSummary();
    return NextResponse.json({ success: true, data: { keys, pool } });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
