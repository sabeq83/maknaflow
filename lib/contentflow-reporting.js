import { pgQuery } from './db-pg.js';
import { getActiveTenantId } from './tenant-context.js';

export const REPORTING_DATE_DIMENSIONS = new Set(['production', 'publish']);
export const REPORTING_PIPELINE_STATUSES = new Set(['all', 'Completed', 'In Production']);
export const REPORTING_RANGES = new Set(['7d', '30d', 'this_month', 'last_month', 'all', 'custom']);

function getJakartaDateString(dateObj = new Date()) {
  return new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Jakarta' }).format(dateObj);
}

function addDaysJakarta(dateStr, days) {
  const [y, m, d] = dateStr.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + days));
  const ny = dt.getUTCFullYear();
  const nm = String(dt.getUTCMonth() + 1).padStart(2, '0');
  const nd = String(dt.getUTCDate()).padStart(2, '0');
  return `${ny}-${nm}-${nd}`;
}

export function parseAndValidateReportingFilters(rawInput = {}) {
  let params = rawInput;
  if (typeof URLSearchParams !== 'undefined' && rawInput instanceof URLSearchParams) {
    params = Object.fromEntries(rawInput.entries());
  }

  const dateDimension = params.date_dimension || params.dateDimension || 'production';
  if (!REPORTING_DATE_DIMENSIONS.has(dateDimension)) {
    const err = new Error(`date_dimension tidak valid: '${dateDimension}'. Nilai yang diizinkan: production, publish`);
    err.status = 400;
    throw err;
  }

  const pipelineStatus = params.pipeline_status || params.pipelineStatus || 'all';
  if (!REPORTING_PIPELINE_STATUSES.has(pipelineStatus)) {
    const err = new Error(`pipeline_status tidak valid: '${pipelineStatus}'. Nilai yang diizinkan: all, Completed, In Production`);
    err.status = 400;
    throw err;
  }

  let range = params.range;
  const rawDateFrom = params.date_from || params.dateFrom;
  const rawDateTo = params.date_to || params.dateTo;

  if (!range) {
    if (rawDateFrom || rawDateTo) {
      range = 'custom';
    } else {
      range = '30d';
    }
  }

  if (!REPORTING_RANGES.has(range)) {
    const err = new Error(`range tidak valid: '${range}'. Nilai yang diizinkan: 7d, 30d, this_month, last_month, all, custom`);
    err.status = 400;
    throw err;
  }

  let dateFrom = null;
  let dateTo = null;
  const todayStr = getJakartaDateString();

  if (range === '7d') {
    dateTo = todayStr;
    dateFrom = addDaysJakarta(todayStr, -6);
  } else if (range === '30d') {
    dateTo = todayStr;
    dateFrom = addDaysJakarta(todayStr, -29);
  } else if (range === 'this_month') {
    const [y, m] = todayStr.split('-');
    dateFrom = `${y}-${m}-01`;
    dateTo = todayStr;
  } else if (range === 'last_month') {
    const [y, m] = todayStr.split('-').map(Number);
    const prevYear = m === 1 ? y - 1 : y;
    const prevMonth = m === 1 ? 12 : m - 1;
    const prevMStr = String(prevMonth).padStart(2, '0');
    dateFrom = `${prevYear}-${prevMStr}-01`;
    const lastDay = new Date(Date.UTC(prevYear, prevMonth, 0)).getUTCDate();
    dateTo = `${prevYear}-${prevMStr}-${String(lastDay).padStart(2, '0')}`;
  } else if (range === 'all') {
    dateFrom = null;
    dateTo = null;
  } else if (range === 'custom') {
    if (!rawDateFrom || !rawDateTo) {
      const err = new Error('Untuk range=custom, parameter date_from dan date_to wajib diisi dengan format YYYY-MM-DD');
      err.status = 400;
      throw err;
    }
    const dateRegex = /^[0-9]{4}-[0-9]{2}-[0-9]{2}$/;
    if (!dateRegex.test(rawDateFrom) || !dateRegex.test(rawDateTo)) {
      const err = new Error('Format tanggal date_from atau date_to tidak valid. Gunakan YYYY-MM-DD');
      err.status = 400;
      throw err;
    }

    const tFrom = new Date(`${rawDateFrom}T00:00:00Z`).getTime();
    const tTo = new Date(`${rawDateTo}T00:00:00Z`).getTime();
    if (isNaN(tFrom) || isNaN(tTo)) {
      const err = new Error('Tanggal date_from atau date_to tidak dapat diparse');
      err.status = 400;
      throw err;
    }
    if (tFrom > tTo) {
      const err = new Error('date_from tidak boleh lebih besar dari date_to');
      err.status = 400;
      throw err;
    }

    const diffDays = Math.round((tTo - tFrom) / (1000 * 60 * 60 * 24)) + 1;
    if (diffDays > 366) {
      const err = new Error('Rentang custom date tidak boleh melebihi 366 hari');
      err.status = 400;
      throw err;
    }

    dateFrom = rawDateFrom;
    dateTo = rawDateTo;
  }

  const accountName = params.account || params.accountName || 'all';
  const dateFromIso = dateFrom ? `${dateFrom}T00:00:00+07:00` : null;
  const dateToExclusiveIso = dateTo ? `${addDaysJakarta(dateTo, 1)}T00:00:00+07:00` : null;

  return {
    range,
    dateDimension,
    dateFrom,
    dateTo,
    dateFromIso,
    dateToExclusiveIso,
    account: accountName,
    pipelineStatus,
    timezone: 'Asia/Jakarta'
  };
}

export async function getContentFlowReporting(filters = {}) {
  const tenantId = getActiveTenantId();
  if (!tenantId || tenantId === '__none__') {
    const error = new Error('Tenant operasional tidak tersedia.');
    error.status = 403;
    throw error;
  }

  const {
    range = '30d',
    dateDimension = 'production',
    dateFrom = null,
    dateTo = null,
    dateFromIso = null,
    dateToExclusiveIso = null,
    account: accountName = 'all',
    pipelineStatus = 'all',
    allowedAccounts
  } = filters;

  const baseParams = [tenantId];
  const baseWhere = [
    'tenant_id = $1',
    "nextcloud_url IS NOT NULL AND nextcloud_url <> ''"
  ];

  if (Array.isArray(allowedAccounts)) {
    if (allowedAccounts.length === 0) {
      baseWhere.push('FALSE');
    } else {
      baseParams.push(allowedAccounts.map(a => String(a).toLowerCase()));
      baseWhere.push(`LOWER(account_name) = ANY($${baseParams.length}::text[])`);
    }
  }

  if (accountName && accountName !== 'all') {
    baseParams.push(accountName.toLowerCase());
    baseWhere.push(`LOWER(account_name) = LOWER($${baseParams.length})`);
  }

  if (pipelineStatus && pipelineStatus !== 'all') {
    baseParams.push(pipelineStatus);
    baseWhere.push(`pipeline_status = $${baseParams.length}`);
  }

  const baseWhereSql = baseWhere.join(' AND ');

  // Standardized CTE query fragment
  const cteSql = `
    WITH normalized AS (
      SELECT
        tenant_id,
        video_id,
        LOWER(account_name) AS brand,
        pipeline_status,
        COALESCE(production_date, created_at) AS produced_at,
        LOWER(COALESCE(tiktok_status, '')) = 'published' AS is_tt_pub,
        LOWER(COALESCE(facebook_status, '')) = 'published' AS is_fb_pub,
        LOWER(COALESCE(instagram_status, '')) = 'published' AS is_ig_pub,
        LOWER(COALESCE(youtube_status, '')) = 'published' AS is_yt_pub,
        CASE
          WHEN tiktok_publish_date ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' THEN (tiktok_publish_date || 'T00:00:00+07:00')::timestamptz
          WHEN tiktok_publish_date ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}[ T]' THEN tiktok_publish_date::timestamptz
          ELSE NULL
        END AS tt_pub_at,
        CASE
          WHEN facebook_publish_date ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' THEN (facebook_publish_date || 'T00:00:00+07:00')::timestamptz
          WHEN facebook_publish_date ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}[ T]' THEN facebook_publish_date::timestamptz
          ELSE NULL
        END AS fb_pub_at,
        CASE
          WHEN instagram_publish_date ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' THEN (instagram_publish_date || 'T00:00:00+07:00')::timestamptz
          WHEN instagram_publish_date ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}[ T]' THEN instagram_publish_date::timestamptz
          ELSE NULL
        END AS ig_pub_at,
        CASE
          WHEN youtube_publish_date ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' THEN (youtube_publish_date || 'T00:00:00+07:00')::timestamptz
          WHEN youtube_publish_date ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}[ T]' THEN youtube_publish_date::timestamptz
          ELSE NULL
        END AS yt_pub_at,
        TRIM(tiktok_publish_date) AS tt_date_raw,
        TRIM(facebook_publish_date) AS fb_date_raw,
        TRIM(instagram_publish_date) AS ig_date_raw,
        TRIM(youtube_publish_date) AS yt_date_raw
      FROM content_flow_items
      WHERE ${baseWhereSql}
    )
  `;

  // Build date dimension WHERE filter
  const scopedParams = [...baseParams];
  const scopedWhere = [];

  if (dateFromIso && dateToExclusiveIso) {
    scopedParams.push(dateFromIso, dateToExclusiveIso);
    const pFrom = `$${scopedParams.length - 1}`;
    const pTo = `$${scopedParams.length}`;

    if (dateDimension === 'production') {
      scopedWhere.push(`produced_at >= ${pFrom} AND produced_at < ${pTo}`);
    } else if (dateDimension === 'publish') {
      scopedWhere.push(`(
        (is_tt_pub AND tt_pub_at >= ${pFrom} AND tt_pub_at < ${pTo}) OR
        (is_fb_pub AND fb_pub_at >= ${pFrom} AND fb_pub_at < ${pTo}) OR
        (is_ig_pub AND ig_pub_at >= ${pFrom} AND ig_pub_at < ${pTo}) OR
        (is_yt_pub AND yt_pub_at >= ${pFrom} AND yt_pub_at < ${pTo})
      )`);
    }
  }

  const scopedWhereSql = scopedWhere.length ? `WHERE ${scopedWhere.join(' AND ')}` : '';

  // 1. KPI Summary & Platform counts
  let platformFilterSql = '';
  if (dateDimension === 'publish' && dateFromIso && dateToExclusiveIso) {
    const pFrom = `$${scopedParams.length - 1}`;
    const pTo = `$${scopedParams.length}`;
    platformFilterSql = `AND tt_pub_at >= ${pFrom} AND tt_pub_at < ${pTo}`;
  }

  const summarySql = `
    ${cteSql}, scoped AS (
      SELECT * FROM normalized ${scopedWhereSql}
    )
    SELECT
      COUNT(DISTINCT video_id) as total_assets,
      COUNT(DISTINCT video_id) FILTER (WHERE pipeline_status = 'Completed') as completed_assets,
      COUNT(DISTINCT video_id) FILTER (WHERE pipeline_status = 'In Production') as in_production_assets,
      COUNT(DISTINCT video_id) FILTER (WHERE is_tt_pub OR is_fb_pub OR is_ig_pub OR is_yt_pub) as published_any_assets,
      COUNT(DISTINCT video_id) FILTER (WHERE NOT (is_tt_pub OR is_fb_pub OR is_ig_pub OR is_yt_pub)) as never_published_assets,
      COUNT(DISTINCT video_id) FILTER (WHERE pipeline_status = 'Completed' AND NOT (is_tt_pub OR is_fb_pub OR is_ig_pub OR is_yt_pub)) as ready_unpublished_assets,
      COUNT(DISTINCT video_id) FILTER (WHERE is_tt_pub AND is_fb_pub AND is_ig_pub) as fully_distributed_assets,
      ${dateDimension === 'publish' && dateFromIso && dateToExclusiveIso ? `
        COUNT(DISTINCT video_id) FILTER (WHERE is_tt_pub AND tt_pub_at >= $${scopedParams.length - 1} AND tt_pub_at < $${scopedParams.length}) as tiktok,
        COUNT(DISTINCT video_id) FILTER (WHERE is_fb_pub AND fb_pub_at >= $${scopedParams.length - 1} AND fb_pub_at < $${scopedParams.length}) as facebook,
        COUNT(DISTINCT video_id) FILTER (WHERE is_ig_pub AND ig_pub_at >= $${scopedParams.length - 1} AND ig_pub_at < $${scopedParams.length}) as instagram,
        COUNT(DISTINCT video_id) FILTER (WHERE is_yt_pub AND yt_pub_at >= $${scopedParams.length - 1} AND yt_pub_at < $${scopedParams.length}) as youtube
      ` : `
        COUNT(DISTINCT video_id) FILTER (WHERE is_tt_pub) as tiktok,
        COUNT(DISTINCT video_id) FILTER (WHERE is_fb_pub) as facebook,
        COUNT(DISTINCT video_id) FILTER (WHERE is_ig_pub) as instagram,
        COUNT(DISTINCT video_id) FILTER (WHERE is_yt_pub) as youtube
      `}
    FROM scoped
  `;

  // 2. Timeline bucketing query
  // Determine bucket grain: day (<= 45 days), week (<= 180 days), month (> 180 days)
  let diffDays = 30;
  if (dateFrom && dateTo) {
    const tFrom = new Date(`${dateFrom}T00:00:00Z`).getTime();
    const tTo = new Date(`${dateTo}T00:00:00Z`).getTime();
    diffDays = Math.round((tTo - tFrom) / (1000 * 60 * 60 * 24)) + 1;
  } else if (range === 'all') {
    diffDays = 365;
  }

  let bucketExpr = `TO_CHAR(produced_at::timestamp, 'YYYY-MM-DD')`;
  if (diffDays > 180) {
    bucketExpr = `TO_CHAR(DATE_TRUNC('month', produced_at::timestamp), 'YYYY-MM')`;
  } else if (diffDays > 45) {
    bucketExpr = `TO_CHAR(DATE_TRUNC('week', produced_at::timestamp), 'YYYY-MM-DD')`;
  }

  const timelineSql = `
    ${cteSql}, scoped AS (
      SELECT * FROM normalized ${scopedWhereSql}
    )
    SELECT
      ${bucketExpr} as period,
      COUNT(DISTINCT video_id) as produced,
      COUNT(DISTINCT video_id) FILTER (WHERE is_tt_pub OR is_fb_pub OR is_ig_pub OR is_yt_pub) as published
    FROM scoped
    WHERE produced_at IS NOT NULL
    GROUP BY 1
    ORDER BY 1 ASC
  `;

  // 3. Brands Breakdown Query
  const brandsSql = `
    ${cteSql}, scoped AS (
      SELECT * FROM normalized ${scopedWhereSql}
    )
    SELECT
      brand,
      COUNT(DISTINCT video_id) as total_assets,
      COUNT(DISTINCT video_id) FILTER (WHERE is_tt_pub OR is_fb_pub OR is_ig_pub OR is_yt_pub) as published_any_assets,
      COUNT(DISTINCT video_id) FILTER (WHERE NOT (is_tt_pub OR is_fb_pub OR is_ig_pub OR is_yt_pub)) as never_published_assets,
      ${dateDimension === 'publish' && dateFromIso && dateToExclusiveIso ? `
        COUNT(DISTINCT video_id) FILTER (WHERE is_tt_pub AND tt_pub_at >= $${scopedParams.length - 1} AND tt_pub_at < $${scopedParams.length}) as tiktok,
        COUNT(DISTINCT video_id) FILTER (WHERE is_fb_pub AND fb_pub_at >= $${scopedParams.length - 1} AND fb_pub_at < $${scopedParams.length}) as facebook,
        COUNT(DISTINCT video_id) FILTER (WHERE is_ig_pub AND ig_pub_at >= $${scopedParams.length - 1} AND ig_pub_at < $${scopedParams.length}) as instagram,
        COUNT(DISTINCT video_id) FILTER (WHERE is_yt_pub AND yt_pub_at >= $${scopedParams.length - 1} AND yt_pub_at < $${scopedParams.length}) as youtube
      ` : `
        COUNT(DISTINCT video_id) FILTER (WHERE is_tt_pub) as tiktok,
        COUNT(DISTINCT video_id) FILTER (WHERE is_fb_pub) as facebook,
        COUNT(DISTINCT video_id) FILTER (WHERE is_ig_pub) as instagram,
        COUNT(DISTINCT video_id) FILTER (WHERE is_yt_pub) as youtube
      `},
      ROUND(
        (COUNT(DISTINCT video_id) FILTER (WHERE is_tt_pub OR is_fb_pub OR is_ig_pub OR is_yt_pub)::numeric / 
         NULLIF(COUNT(DISTINCT video_id), 0)::numeric * 100), 2
      ) as coverage_percent
    FROM scoped
    WHERE brand IS NOT NULL AND brand <> ''
    GROUP BY brand
    ORDER BY total_assets DESC
  `;

  // 4. Anomalies Query
  const anomaliesSql = `
    ${cteSql}, scoped AS (
      SELECT * FROM normalized ${scopedWhereSql}
    )
    SELECT
      COUNT(*) FILTER (WHERE
        (is_tt_pub AND (tt_date_raw IS NULL OR tt_date_raw = '')) OR
        (is_fb_pub AND (fb_date_raw IS NULL OR fb_date_raw = '')) OR
        (is_ig_pub AND (ig_date_raw IS NULL OR ig_date_raw = '')) OR
        (is_yt_pub AND (yt_date_raw IS NULL OR yt_date_raw = ''))
      ) as published_without_date,
      COUNT(*) FILTER (WHERE
        (NOT is_tt_pub AND (tt_date_raw IS NOT NULL AND tt_date_raw <> '')) OR
        (NOT is_fb_pub AND (fb_date_raw IS NOT NULL AND fb_date_raw <> '')) OR
        (NOT is_ig_pub AND (ig_date_raw IS NOT NULL AND ig_date_raw <> '')) OR
        (NOT is_yt_pub AND (yt_date_raw IS NOT NULL AND yt_date_raw <> ''))
      ) as date_without_published_status,
      COUNT(*) FILTER (WHERE
        (tt_date_raw IS NOT NULL AND tt_date_raw <> '' AND tt_date_raw !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}') OR
        (fb_date_raw IS NOT NULL AND fb_date_raw <> '' AND fb_date_raw !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}') OR
        (ig_date_raw IS NOT NULL AND ig_date_raw <> '' AND ig_date_raw !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}') OR
        (yt_date_raw IS NOT NULL AND yt_date_raw <> '' AND yt_date_raw !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}')
      ) as invalid_publish_date
    FROM scoped
  `;

  // 5. Available accounts facet query
  const facetParams = [tenantId];
  let facetScope = "tenant_id = $1 AND nextcloud_url IS NOT NULL AND nextcloud_url <> ''";
  if (Array.isArray(allowedAccounts)) {
    if (allowedAccounts.length === 0) facetScope += ' AND FALSE';
    else {
      facetParams.push(allowedAccounts.map(a => String(a).toLowerCase()));
      facetScope += ` AND LOWER(account_name) = ANY($2::text[])`;
    }
  }

  const facetsSql = `
    SELECT DISTINCT LOWER(account_name) AS account_name
    FROM content_flow_items
    WHERE ${facetScope} AND account_name IS NOT NULL AND account_name <> ''
    ORDER BY account_name
  `;

  // Run queries in parallel
  const [summaryRes, timelineRes, brandsRes, anomaliesRes, facetsRes] = await Promise.all([
    pgQuery(summarySql, scopedParams),
    pgQuery(timelineSql, scopedParams),
    pgQuery(brandsSql, scopedParams),
    pgQuery(anomaliesSql, scopedParams),
    pgQuery(facetsSql, facetParams)
  ]);

  const sRow = summaryRes.rows[0] || {};
  const summary = {
    total_assets: Number(sRow.total_assets || 0),
    completed_assets: Number(sRow.completed_assets || 0),
    in_production_assets: Number(sRow.in_production_assets || 0),
    published_any_assets: Number(sRow.published_any_assets || 0),
    never_published_assets: Number(sRow.never_published_assets || 0),
    ready_unpublished_assets: Number(sRow.ready_unpublished_assets || 0),
    fully_distributed_assets: Number(sRow.fully_distributed_assets || 0)
  };

  const platforms = {
    tiktok: Number(sRow.tiktok || 0),
    facebook: Number(sRow.facebook || 0),
    instagram: Number(sRow.instagram || 0),
    youtube: Number(sRow.youtube || 0)
  };

  const timeline = timelineRes.rows.map(r => ({
    period: r.period,
    produced: Number(r.produced || 0),
    published: Number(r.published || 0)
  }));

  const brands = brandsRes.rows.map(r => ({
    brand: r.brand,
    total_assets: Number(r.total_assets || 0),
    published_any_assets: Number(r.published_any_assets || 0),
    never_published_assets: Number(r.never_published_assets || 0),
    tiktok: Number(r.tiktok || 0),
    facebook: Number(r.facebook || 0),
    instagram: Number(r.instagram || 0),
    youtube: Number(r.youtube || 0),
    coverage_percent: Number.parseFloat(r.coverage_percent || '0')
  }));

  const aRow = anomaliesRes.rows[0] || {};
  const pubNoDate = Number(aRow.published_without_date || 0);
  const dateNoPub = Number(aRow.date_without_published_status || 0);
  const invDate = Number(aRow.invalid_publish_date || 0);

  const anomalies = {
    published_without_date: pubNoDate,
    date_without_published_status: dateNoPub,
    invalid_publish_date: invDate,
    total: pubNoDate + dateNoPub + invDate
  };

  const available_accounts = facetsRes.rows.map(r => r.account_name);

  return {
    summary,
    platforms,
    timeline,
    brands,
    anomalies,
    available_accounts
  };
}
