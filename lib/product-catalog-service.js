import { pgQuery } from './db-pg.js';
import { getActiveTenantId } from './tenant-context.js';
import { resolveActiveProductPhotoPath } from './product-reference-resolver.js';

function tenantId() { const id=getActiveTenantId(); if(!id||id==='__none__'){const e=new Error('Tenant operasional tidak tersedia.');e.status=403;throw e;} return id; }
function imageUrl(row){const value=resolveActiveProductPhotoPath(row);return value&&!/^https?:\/\//.test(value)?`/api/v2/products/image?path=${encodeURIComponent(value)}`:value;}
export function toProductCatalogItem(row){return {...row,image_url:imageUrl(row),completeness:{description:Boolean(row.product_description),usp:Boolean(row.unique_selling_point),image:Boolean(imageUrl(row)),target_audience:Boolean(row.target_audience),product_url:Boolean(row.source_url)}};}

export async function listProductCatalog({search='',category='',limit=50,cursor=null}={}){
  const size=Math.min(100,Math.max(1,Number(limit)||50)),params=[tenantId()],where=['tenant_id=$1'];
  if(search.trim()){params.push(`%${search.trim()}%`);where.push(`(product_name ILIKE $${params.length} OR category ILIKE $${params.length} OR unique_selling_point ILIKE $${params.length})`);}
  if(category.trim()){params.push(category.trim());where.push(`LOWER(category)=LOWER($${params.length})`);}
  if(cursor){params.push(cursor);where.push(`id>$${params.length}`);}
  params.push(size+1);
  const rows=(await pgQuery(`SELECT * FROM product_extractions WHERE ${where.join(' AND ')} ORDER BY id ASC LIMIT $${params.length}`,params)).rows;
  const hasMore=rows.length>size,data=rows.slice(0,size).map(toProductCatalogItem);
  return {data,pagination:{has_more:hasMore,next_cursor:hasMore?data.at(-1)?.id:null,limit:size}};
}

export async function listBindingSummaries({brandProfileId,productIds=[]}){
  if(!brandProfileId||!productIds.length)return new Map();
  const brand=(await pgQuery('SELECT id FROM brand_profiles WHERE tenant_id=$1 AND id=$2',[tenantId(),brandProfileId])).rows[0];
  if(!brand){const e=new Error('Brand Profile tidak ditemukan di tenant aktif.');e.status=403;throw e;}
  const rows=(await pgQuery(`SELECT * FROM brand_products WHERE tenant_id=$1 AND brand_profile_id=$2 AND product_id=ANY($3::text[])`,[tenantId(),brandProfileId,productIds])).rows;
  return new Map(rows.map(row=>[row.product_id,row]));
}
