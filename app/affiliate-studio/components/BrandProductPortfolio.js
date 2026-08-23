'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import styles from './AffiliateStudio.module.css';

export function BrandProductPortfolio({
  data,
  filters,
  loading,
  error,
  onFiltersChange,
  onLoadMore,
  onRefresh
}) {
  const [searchTerm, setSearchTerm] = useState(filters.q || '');

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

                    {/* Affiliate Link Resolution */}
                    <div className={styles.affiliateResolutionSection}>
                      <span className={styles.sectionLabel}>Affiliate Route:</span>
                      {item.affiliate.link ? (
                        <div className={styles.linkInfoBox}>
                          <a
                            href={item.affiliate.link}
                            target="_blank"
                            rel="noopener noreferrer"
                            className={styles.resolvedLink}
                            title={item.affiliate.link}
                          >
                            {item.affiliate.link} ↗
                          </a>
                          <div className={styles.linkMetaRow}>
                            <span className={`${styles.linkSourceBadge} ${styles[`source_${item.affiliate.source}`]}`}>
                              {item.affiliate.source === 'brand_product' ? 'BRAND OVERRIDE' : 'LEGACY FALLBACK'}
                            </span>
                            {item.affiliate.trackingCode && (
                              <span className={styles.trackingCodeSpan}>
                                Track: <code>{item.affiliate.trackingCode}</code>
                              </span>
                            )}
                          </div>
                        </div>
                      ) : (
                        <div className={styles.missingLinkBox}>
                          <span>No Affiliate Link Found</span>
                        </div>
                      )}
                    </div>

                    {/* Readiness Checker */}
                    <div className={styles.readinessSection}>
                      <div className={styles.readinessOverallRow}>
                        <span className={styles.sectionLabel}>Readiness Status:</span>
                        <span className={`${styles.overallReadinessBadge} ${styles[`readinessOverall_${readinessOverall}`]}`}>
                          {readinessOverall.toUpperCase().replace('_', ' ')}
                        </span>
                      </div>
                      <div className={styles.readinessGrid}>
                        <div className={styles.readinessSubcell}>
                          <span>Truth:</span>
                          <span className={styles[`readinessVal_${item.readiness.productTruth}`]}>
                            {item.readiness.productTruth.toUpperCase()}
                          </span>
                        </div>
                        <div className={styles.readinessSubcell}>
                          <span>Image:</span>
                          <span className={styles[`readinessVal_${item.readiness.image}`]}>
                            {item.readiness.image.toUpperCase()}
                          </span>
                        </div>
                        <div className={styles.readinessSubcell}>
                          <span>Link:</span>
                          <span className={styles[`readinessVal_${item.readiness.affiliateLink}`]}>
                            {item.readiness.affiliateLink.toUpperCase().replace('_', ' ')}
                          </span>
                        </div>
                        <div className={styles.readinessSubcell}>
                          <span>Assoc:</span>
                          <span className={styles[`readinessVal_${item.readiness.association}`]}>
                            {item.readiness.association.toUpperCase().replace('_', ' ')}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Footer Actions */}
                    <div className={styles.cardActions}>
                      <Link href="/products" className={styles.cardActionDbLink}>
                        Open Product Database ↗
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
    </div>
  );
}
