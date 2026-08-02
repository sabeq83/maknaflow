import express from 'express';
import cors from 'cors';
import { getPgPool, pgQuery } from '../../lib/db-pg.js';

const app = express();
const PORT = Number(process.env.API_PORT || 7010);
const HOST = process.env.API_HOST || '127.0.0.1';
const allowedOrigins = new Set([
  process.env.STAGING_WEB_ORIGIN || 'http://127.0.0.1:5010',
  'http://localhost:5010'
]);

// Enable CORS & JSON Parsing
app.use(cors({
  origin(origin, callback) {
    if (!origin || allowedOrigins.has(origin)) return callback(null, true);
    return callback(new Error('Origin not allowed'));
  },
  methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json());

// Initialize PostgreSQL Pool
getPgPool();

// Health Check Endpoint
app.get('/health', async (req, res) => {
  try {
    const dbRes = await pgQuery('SELECT version();');
    res.json({
      status: 'healthy',
      engine: 'MAKNA Flow Headless Core API V2.0',
      port: PORT,
      database: `${process.env.PGHOST || '127.0.0.1'}:${process.env.PGPORT || '5432'}/${process.env.PGDATABASE || 'maknaflow_staging'}`,
      pgVersion: dbRes.rows[0].version
    });
  } catch (err) {
    res.status(500).json({ status: 'unhealthy', error: err.message });
  }
});

// System Health V2 Endpoint
app.get('/api/v2/system-health', async (req, res) => {
  try {
    const itemCount = await pgQuery('SELECT count(*) FROM content_flow_items;');
    const userCount = await pgQuery('SELECT count(*) FROM users;');
    res.json({
      success: true,
      data: {
        server_status: 'online',
        architecture: 'Decoupled API V2.0',
        content_flow_total: parseInt(itemCount.rows[0].count, 10),
        user_count: parseInt(userCount.rows[0].count, 10),
        timestamp: new Date().toISOString()
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ContentFlow Hub REST API V2 Endpoint
app.get('/api/v2/content-flow', async (req, res) => {
  try {
    const { sourceType, accountName, productName, pipelineStatus, page = 1, limit = 20, q } = req.query;

    let baseSql = 'FROM content_flow_items WHERE 1=1';
    const params = [];

    if (sourceType && sourceType !== 'all') {
      params.push(sourceType);
      baseSql += ` AND source_type = $${params.length}`;
    }
    if (accountName && accountName !== 'all') {
      params.push(accountName);
      baseSql += ` AND account_name = $${params.length}`;
    }
    if (productName && productName !== 'all') {
      params.push(productName);
      baseSql += ` AND nama_produk = $${params.length}`;
    }
    if (q && q.trim()) {
      params.push(`%${q.trim()}%`);
      baseSql += ` AND (video_id ILIKE $${params.length} OR hook ILIKE $${params.length} OR nama_produk ILIKE $${params.length} OR caption ILIKE $${params.length})`;
    }

    const countSql = `SELECT count(*) ${baseSql}`;
    const totalRes = await pgQuery(countSql, params);
    const totalItems = parseInt(totalRes.rows[0].count, 10);
    const totalPages = Math.ceil(totalItems / limit) || 1;

    let sql = `SELECT * ${baseSql} ORDER BY created_at DESC`;
    const offset = (parseInt(page, 10) - 1) * parseInt(limit, 10);
    params.push(parseInt(limit, 10), offset);
    sql += ` LIMIT $${params.length - 1} OFFSET $${params.length}`;

    const itemsRes = await pgQuery(sql, params);

    // Get available accounts & products
    const accountsRes = await pgQuery('SELECT DISTINCT account_name FROM content_flow_items WHERE account_name IS NOT NULL;');
    const productsRes = await pgQuery('SELECT DISTINCT nama_produk FROM content_flow_items WHERE nama_produk IS NOT NULL;');

    res.json({
      success: true,
      items: itemsRes.rows,
      total_items: totalItems,
      total_pages: totalPages,
      current_page: parseInt(page, 10),
      available_accounts: accountsRes.rows.map(r => r.account_name),
      available_products: productsRes.rows.map(r => r.nama_produk)
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Update ContentFlow Item Endpoint V2
app.patch('/api/v2/content-flow/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body;

    const allowedKeys = [
      'tiktok_status', 'tiktok_publish_date', 'permalink_tiktok',
      'facebook_status', 'facebook_publish_date', 'permalink_facebook',
      'instagram_status', 'instagram_publish_date', 'permalink_instagram',
      'youtube_status', 'youtube_publish_date', 'permalink_youtube',
      'account_name', 'drive_link', 'nextcloud_url', 'url_asset',
      'link_produk', 'link_affiliate', 'nama_produk'
    ];

    const fields = [];
    const values = [];

    for (const key of Object.keys(updateData)) {
      if (allowedKeys.includes(key) && updateData[key] !== undefined) {
        values.push(updateData[key]);
        fields.push(`"${key}" = $${values.length}`);
      }
    }

    if (fields.length === 0) {
      return res.status(400).json({ success: false, error: 'No valid update fields provided' });
    }

    values.push(new Date().toISOString());
    fields.push(`"updated_at" = $${values.length}`);

    values.push(id);
    const sql = `UPDATE content_flow_items SET ${fields.join(', ')} WHERE id = $${values.length} RETURNING *;`;

    const updateRes = await pgQuery(sql, values);
    if (updateRes.rowCount === 0) {
      return res.status(404).json({ success: false, error: 'ContentFlow item not found' });
    }

    res.json({ success: true, item: updateRes.rows[0] });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Current User Auth Me V2 Endpoint
app.get('/api/v2/auth/me', async (req, res) => {
  try {
    // Return admin permissions
    const permissionsRes = await pgQuery('SELECT menu_key FROM user_menu_permissions WHERE can_read = 1 OR can_write = 1;');
    res.json({
      authenticated: true,
      user: {
        id: 'admin_1',
        username: 'sabeqmursyid',
        role: 'admin',
        assignedBrandNames: ['siasatsehat', 'dummybrand01'],
        menuPermissions: permissionsRes.rows.map(r => r.menu_key)
      }
    });
  } catch (err) {
    res.status(500).json({ authenticated: false, error: err.message });
  }
});

app.listen(PORT, HOST, () => {
  console.log(`🚀 MAKNA Flow Headless Core API V2.0 listening on http://${HOST}:${PORT}`);
});
