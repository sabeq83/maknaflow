'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import ProductEditModal from './ProductEditModal';
import styles from './AffiliateStudio.module.css';

export function BrandProductPortfolio({
  brandId,
  brandName,
  data,
  filters,
  loading,
  error,
  onFiltersChange,
  onLoadMore,
  onRefresh
}) {
  const [searchTerm, setSearchTerm] = useState(filters?.q || '');
  const [editingProduct, setEditingProduct] = useState(null);

  // Keep local search term in sync with filter prop
  useEffect(() => {
    setSearchTerm(filters.q || '');
  }, [filters.q]);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    onFiltersChange({ ...filters, q: searchTerm });
  };

  const handleFilterSelectChange = (key, value) => {
    onFiltersChange({ ...filters, [key]: value });
  };

  const handleResetFilters = () => {
    setSearchTerm('');
    onFiltersChange({
      q: '',
      association: 'all',
      readiness: 'all',
      category: ''
    });
  };

  if (error) {
    return (
      <div className={styles.portfolioErrorContainer}>
        <div className={styles.portfolioError}>
          <h3>Failed to Load Portfolio</h3>
          <p>{error}</p>
          <button onClick={onRefresh} className={styles.retryButton}>Retry</button>
        </div>
      </div>
    );
  }

  const items = data?.items || [];
  const facets = data?.facets || { association: {}, readiness: {}, categories: [] };
  const categories = facets.categories || [];
  const pagination = data?.pagination || { hasMore: false };

  return (
    <div className={styles.portfolioContainer}>
      {/* 1. Facets Summary Panel */}
      <div className={styles.facetsPanel}>
        <div className={styles.facetCard}>
          <h4>Association States</h4>
          <div className={styles.facetMetrics}>
            <div className={`${styles.facetMetric} ${styles.associationActive}`}>
              <span className={styles.metricLabel}>Active</span>
              <span className={styles.metricVal}>{facets.association.active || 0}</span>
            </div>
            <div className={`${styles.facetMetric} ${styles.associationInactive}`}>
              <span className={styles.metricLabel}>Inactive</span>
              <span className={styles.metricVal}>{facets.association.inactive || 0}</span>
            </div>
            <div className={`${styles.facetMetric} ${styles.associationCandidate}`}>
              <span className={styles.metricLabel}>Candidate</span>
              <span className={styles.metricVal}>{facets.association.candidate || 0}</span>
            </div>
          </div>
        </div>

        <div className={styles.facetCard}>
          <h4>Readiness States</h4>
          <div className={styles.facetMetrics}>
            <div className={`${styles.facetMetric} ${styles.readinessReady}`}>
              <span className={styles.metricLabel}>Ready</span>
              <span className={styles.metricVal}>{facets.readiness.ready || 0}</span>
            </div>
            <div className={`${styles.facetMetric} ${styles.readinessReview}`}>
              <span className={styles.metricLabel}>Needs Review</span>
              <span className={styles.metricVal}>{facets.readiness.needs_review || 0}</span>
            </div>
            <div className={`${styles.facetMetric} ${styles.readinessIncomplete}`}>
              <span className={styles.metricLabel}>Incomplete</span>
              <span className={styles.metricVal}>{facets.readiness.incomplete || 0}</span>
            </div>
          </div>
        </div>
      </div>

      {/* 2. Search & Toolbar */}
      <div className={styles.portfolioToolbar}>
        <form onSubmit={handleSearchSubmit} className={styles.searchForm}>
          <input
            type="text"
            placeholder="Search by name, description, USP..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className={styles.searchInput}
          />
          <button type="submit" className={styles.searchButton}>Search</button>
        </form>

        <div className={styles.filterGroup}>
          <div className={styles.filterControl}>
            <label htmlFor="assoc-filter">Association:</label>
            <select
              id="assoc-filter"
              value={filters.association || 'all'}
              onChange={(e) => handleFilterSelectChange('association', e.target.value)}
              className={styles.filterSelect}
            >
              <option value="all">All Associations</option>
              <option value="candidate">Candidate Only</option>
              <option value="active">Active Only</option>
              <option value="inactive">Inactive Only</option>
            </select>
          </div>

          <div className={styles.filterControl}>
            <label htmlFor="readiness-filter">Readiness:</label>
            <select
              id="readiness-filter"
              value={filters.readiness || 'all'}
              onChange={(e) => handleFilterSelectChange('readiness', e.target.value)}
              className={styles.filterSelect}
            >
              <option value="all">All Readiness</option>
              <option value="ready">Ready</option>
              <option value="needs_review">Needs Review</option>
              <option value="incomplete">Incomplete</option>
            </select>
          </div>

          <div className={styles.filterControl}>
            <label htmlFor="category-filter">Category:</label>
            <select
              id="category-filter"
              value={filters.category || ''}
              onChange={(e) => handleFilterSelectChange('category', e.target.value)}
              className={styles.filterSelect}
            >
              <option value="">All Categories</option>
              {categories.map((c) => (
                <option key={c.name} value={c.name}>
                  {c.name} ({c.count})
                </option>
              ))}
            </select>
          </div>

          {(filters.q || filters.association !== 'all' || filters.readiness !== 'all' || filters.category) && (
            <button onClick={handleResetFilters} className={styles.resetButton}>
              Reset Filters
            </button>
          )}
        </div>
      </div>

      {/* 3. Product Catalog Grid */}
      {loading && items.length === 0 ? (
        <div className={styles.portfolioLoading}>Loading portfolio catalog...</div>
      ) : items.length === 0 ? (
        <div className={styles.emptyPortfolioState}>
          <h3>No Products Found</h3>
          <p>Tidak ada produk yang cocok dengan pencarian atau filter aktif.</p>
          <div className={styles.globalProductDbLinkContainer}>
            <Link href="/products" className={styles.globalProductDbLink}>
              Open Product Database to link products ↗
            </Link>
          </div>
        </div>
      ) : (
        <>
          <div className={styles.portfolioGrid}>
            {items.map((item) => {
              const associationState = item.association.state;
              const readinessOverall = item.readiness.overall;

              return (
                <div key={item.productId} className={styles.productCard}>
                  {/* Product Header */}
                  <div className={styles.cardImageContainer}>
                    {item.imageUrl ? (
                      <img
                        src={item.imageUrl}
                        alt={item.displayName}
                        className={styles.cardImage}
                        onError={(e) => {
                          e.target.onerror = null;
                          e.target.src = '/placeholder-product.png';
                        }}
                      />
                    ) : (
                      <div className={styles.cardImagePlaceholder}>
                        <span>No Image</span>
                      </div>
                    )}
                    <span className={`${styles.associationBadge} ${styles[`assocBadge_${associationState}`]}`}>
                      {associationState.toUpperCase()}
                    </span>
                  </div>

                  {/* Product Info */}
                  <div className={styles.cardContent}>
                    <div className={styles.cardHeader}>
                      <span className={styles.cardCategory}>{item.category}</span>
                      <h3 className={styles.cardTitle} title={item.displayName}>
                        {item.displayName}
                      </h3>
                      <div className={styles.productIdRow}>
                        <span className={styles.productIdLabel}>ID: </span>
                        <code className={styles.productIdCode}>{item.productId}</code>
                      </div>
                    </div>

                    <div className={styles.cardDetails}>
                      {item.description && (
                        <p className={styles.detailItem}>
                          <strong>Desc: </strong>
                          {item.description}
                        </p>
                      )}
                      {item.uniqueSellingPoint && (
                        <p className={styles.detailItem}>
                          <strong>USP: </strong>
                          {item.uniqueSellingPoint}
                        </p>
                      )}
                      {item.targetAudience && (
                        <p className={styles.detailItem}>
                          <strong>Audience: </strong>
                          {item.targetAudience}
                        </p>
                      )}
                    </div>

                    {/* Status Asosiasi */}
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '10px 12px',
                      background: 'var(--surface-bg, rgba(15, 23, 42, 0.6))',
                      borderRadius: '8px',
                      fontSize: '12px',
                      border: '1px solid var(--border-color, #1e293b)',
                      margin: '12px 0 10px 0'
                    }}>
                      <span style={{ color: 'var(--text-muted, #94a3b8)', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>
                        Status Asosiasi
                      </span>
                      <span style={{
                        fontWeight: 700,
                        fontSize: '11px',
                        padding: '3px 8px',
                        borderRadius: '6px',
                        background: (associationState === 'active' || item.assoc_status === 'ACTIVE_ASSOC') ? 'rgba(16, 185, 129, 0.15)' : 'rgba(245, 158, 11, 0.15)',
                        color: (associationState === 'active' || item.assoc_status === 'ACTIVE_ASSOC') ? '#10b981' : '#f59e0b',
                        border: (associationState === 'active' || item.assoc_status === 'ACTIVE_ASSOC') ? '1px solid rgba(16, 185, 129, 0.3)' : '1px solid rgba(245, 158, 11, 0.3)'
                      }}>
                        {associationState ? associationState.toUpperCase() : 'CANDIDATE'}
                      </span>
                    </div>

                    {/* Footer Actions */}
                    <div style={{ display: 'flex', gap: '8px', marginTop: 'auto' }}>
                      <button
                        type="button"
                        onClick={() => setEditingProduct({
                          id: item.productId,
                          product_name: item.displayName || item.name,
                          sku: item.sku || item.productId,
                          category: item.category,
                          product_description: item.description,
                          affiliate_link: item.affiliate?.link || '',
                          price: item.price,
                          commission_rate: item.commissionRate,
                          target_audience: item.targetAudience,
                          unique_selling_point: item.uniqueSellingPoint,
                          pain_point_solved: item.painPointSolved,
                          key_visuals_extracted: item.keyVisuals,
                          tags: item.tags,
                          assoc_status: associationState ? (associationState === 'active' ? 'ACTIVE_ASSOC' : associationState.toUpperCase()) : 'CANDIDATE'
                        })}
                        style={{
                          flex: 1,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '6px',
                          padding: '8px 12px',
                          borderRadius: '8px',
                          border: '1px solid var(--border-color, #1e293b)',
                          background: 'var(--surface-subtle, #0f172a)',
                          color: 'var(--text-main, #f8fafc)',
                          fontSize: '12px',
                          fontWeight: 600,
                          cursor: 'pointer'
                        }}
                      >
                        ✏️ Edit Produk
                      </button>
                      <Link
                        href="/products"
                        style={{
                          flex: 1,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '4px',
                          padding: '8px 12px',
                          borderRadius: '8px',
                          border: 'none',
                          background: 'var(--primary, #3b82f6)',
                          color: '#ffffff',
                          fontSize: '12px',
                          fontWeight: 600,
                          textDecoration: 'none',
                          cursor: 'pointer'
                        }}
                      >
                        Detail DB ↗
                      </Link>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* 4. Pagination */}
          {pagination.hasMore && (
            <div className={styles.paginationRow}>
              <button
                onClick={onLoadMore}
                disabled={loading}
                className={styles.loadMoreButton}
              >
                {loading ? 'Loading more products...' : 'Load More Products'}
              </button>
            </div>
          )}
        </>
      )}

      {/* Product Edit Modal */}
      {editingProduct && (
        <ProductEditModal
          product={editingProduct}
          brandId={brandId}
          brandName={brandName}
          isOpen={Boolean(editingProduct)}
          onClose={() => setEditingProduct(null)}
          onSuccess={() => {
            onRefresh?.();
          }}
        />
      )}
    </div>
  );
}
