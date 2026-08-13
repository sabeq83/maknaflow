'use client';

export default function ProductPicker({ products, value, loading, error, summary, search, onSearch, onChange, onRetry }) {
  return <div style={{display:'grid',gap:7}}>
    <input className="form-input" type="search" value={search} onChange={event=>onSearch(event.target.value)} placeholder="Cari nama atau kategori produk…" aria-label="Cari produk" disabled={loading}/>
    <select required className="form-select" value={value} onChange={event=>onChange(event.target.value)} disabled={loading||Boolean(error)} aria-label="Produk dari Data Produk">
      <option value="">{loading?'Memuat Data Produk…':'Pilih produk dari Data Produk'}</option>
      {products.map(product=><option key={product.id||product.product_id} value={product.id||product.product_id}>{product.product_name} · {product.category||'Tanpa kategori'}</option>)}
    </select>
    {summary&&<small>{summary.total} produk ditemukan{summary.linked!==undefined?` · ${summary.linked} linked ke brand terpilih`:''}</small>}
    {error&&<div style={{fontSize:12,color:'var(--status-danger)'}}>{error} <button type="button" className="btn btn-secondary btn-sm" onClick={onRetry}>Coba Lagi</button></div>}
    {!loading&&!error&&summary?.total===0&&<small>Tidak ada Data Produk pada tenant ini.</small>}
  </div>;
}
