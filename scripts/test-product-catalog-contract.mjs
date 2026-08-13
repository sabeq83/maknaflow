import assert from 'node:assert/strict';
import { toProductCatalogItem } from '../lib/product-catalog-service.js';
const item=toProductCatalogItem({id:'p1',product_name:'Produk',product_description:'Desc',category:'Food',raw_photo_url:'/uploads/a.png',target_audience:'Family'});
assert.equal(item.id,'p1');assert.equal(item.image_url.startsWith('/api/v2/products/image?path='),true);assert.equal(item.completeness.description,true);assert.equal(item.completeness.target_audience,true);
console.log('Product catalog contract tests passed.');
