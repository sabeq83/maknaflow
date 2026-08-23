'use client';

import { useEffect, useMemo, useState, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  resolveActiveAffiliateBrand,
  buildAffiliateStudioUrl,
  resolveAffiliateStudioView,
  parseAffiliateProductFilters
} from '@/lib/affiliate-studio-workspace-state';
import { AffiliateStudioShell } from './AffiliateStudioShell';
import { BrandOverview } from './BrandOverview';
import { BrandProductPortfolio } from './BrandProductPortfolio';
import styles from './AffiliateStudio.module.css';

export function AffiliateStudioWorkspace() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const requestedBrandId = searchParams ? searchParams.get('brand') : null;
  const activeView = resolveAffiliateStudioView(searchParams ? searchParams.get('view') : null);
  const productFilters = parseAffiliateProductFilters(searchParams);

  const [brands, setBrands] = useState([]);
  const [activeBrand, setActiveBrand] = useState(null);
  const [overview, setOverview] = useState(null);
  const [portfolio, setPortfolio] = useState(null);
  const [loadingBrands, setLoadingBrands] = useState(true);
  const [loadingOverview, setLoadingOverview] = useState(false);
  const [loadingPortfolio, setLoadingPortfolio] = useState(false);
  const [brandsError, setBrandsError] = useState(null);
  const [overviewError, setOverviewError] = useState(null);
  const [portfolioError, setPortfolioError] = useState(null);

  const abortControllerRef = useRef(null);

  // Load authorized brands
  useEffect(() => {
    setLoadingBrands(true);
    fetch('/api/v2/affiliate-studio/brands')
      .then(res => {
        if (res.status === 403) throw new Error('Affiliate Studio disabled or access denied');
        return res.json();
      })
      .then(body => {
        if (!body.success) throw new Error(body.error || 'Failed to load brands');
        setBrands(body.data || []);
        setBrandsError(null);
      })
      .catch(err => {
        setBrandsError(err.message);
      })
      .finally(() => {
        setLoadingBrands(false);
      });
  }, []);

  // Handle active brand resolution and URL canonicalization
  useEffect(() => {
    if (loadingBrands || brandsError) return;

    const { activeBrand: resolved, reason } = resolveActiveAffiliateBrand({ brands, requestedBrandId });
    setActiveBrand(resolved);

    if (reason === 'default' || reason === 'stale_or_invalid') {
      if (resolved) {
        router.replace(buildAffiliateStudioUrl(resolved.id, { view: activeView }));
      } else {
        router.replace('/affiliate-studio');
      }
    }
  }, [brands, requestedBrandId, loadingBrands, brandsError, router, activeView]);

  // Load brand overview
  const loadOverview = (brandId) => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    const controller = new AbortController();
    abortControllerRef.current = controller;

    setLoadingOverview(true);
    setOverviewError(null);

    fetch(`/api/v2/affiliate-studio/brands/${brandId}/overview`, { signal: controller.signal })
      .then(res => {
        if (res.status === 404) throw new Error('Brand not found or unauthorized');
        return res.json();
      })
      .then(body => {
        if (!body.success) throw new Error(body.error || 'Failed to load brand overview');
        setOverview(body.data);
        setOverviewError(null);
      })
      .catch(err => {
        if (err.name !== 'AbortError') {
          setOverviewError(err.message);
        }
      })
      .finally(() => {
        if (abortControllerRef.current === controller) {
          setLoadingOverview(false);
          abortControllerRef.current = null;
        }
      });
  };

  const loadProducts = (brandId, filters) => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    const controller = new AbortController();
    abortControllerRef.current = controller;

    setLoadingPortfolio(true);
    setPortfolioError(null);

    const queryParams = new URLSearchParams();
    if (filters.q) queryParams.set('q', filters.q);
    if (filters.association && filters.association !== 'all') queryParams.set('association', filters.association);
    if (filters.readiness && filters.readiness !== 'all') queryParams.set('readiness', filters.readiness);
    if (filters.category) queryParams.set('category', filters.category);
    if (filters.cursor) queryParams.set('cursor', filters.cursor);

    fetch(`/api/v2/affiliate-studio/brands/${brandId}/products?${queryParams.toString()}`, { signal: controller.signal })
      .then(res => {
        if (res.status === 404) throw new Error('Brand not found or unauthorized');
        return res.json();
      })
      .then(body => {
        if (!body.success) throw new Error(body.error || 'Failed to load brand products');
        if (filters.cursor) {
          setPortfolio(prev => {
            if (!prev) return body.data;
            return {
              ...body.data,
              items: [...prev.items, ...body.data.items]
            };
          });
        } else {
          setPortfolio(body.data);
        }
        setPortfolioError(null);
      })
      .catch(err => {
        if (err.name !== 'AbortError') {
          setPortfolioError(err.message);
        }
      })
      .finally(() => {
        if (abortControllerRef.current === controller) {
          setLoadingPortfolio(false);
          abortControllerRef.current = null;
        }
      });
  };

  useEffect(() => {
    if (!activeBrand) {
      setOverview(null);
      setPortfolio(null);
      return;
    }

    if (activeView === 'overview') {
      loadOverview(activeBrand.id);
    } else if (activeView === 'products') {
      loadProducts(activeBrand.id, productFilters);
    }
  }, [activeBrand, activeView, searchParams]);

  if (brandsError) {
    return <div className={styles.errorState}>{brandsError}</div>;
  }

  if (loadingBrands) {
    return <div className={styles.loadingState}>Loading workspace...</div>;
  }

  if (brands.length === 0) {
    return (
      <div className={styles.emptyWorkspace}>
        <h2>No Brands Available</h2>
        <p>Anda belum terhubung ke brand profile mana pun. Silakan hubungi administrator.</p>
      </div>
    );
  }

  return (
    <AffiliateStudioShell
      brands={brands}
      activeBrand={activeBrand}
      activeView={activeView}
      onBrandChange={(brandId) => {
        router.push(buildAffiliateStudioUrl(brandId, { view: activeView }));
      }}
      onNavigate={(view) => {
        router.push(buildAffiliateStudioUrl(activeBrand?.id, { view }));
      }}
    >
      {activeView === 'overview' && (
        <BrandOverview
          overview={overview}
          loading={loadingOverview}
          error={overviewError}
          onRefresh={() => activeBrand && loadOverview(activeBrand.id)}
        />
      )}
      {activeView === 'products' && (
        <BrandProductPortfolio
          data={portfolio}
          filters={productFilters}
          loading={loadingPortfolio}
          error={portfolioError}
          onFiltersChange={(newFilters) => {
            router.push(buildAffiliateStudioUrl(activeBrand?.id, {
              view: 'products',
              ...newFilters,
              cursor: undefined
            }));
          }}
          onLoadMore={() => {
            if (portfolio?.pagination?.nextCursor) {
              router.push(buildAffiliateStudioUrl(activeBrand?.id, {
                view: 'products',
                ...productFilters,
                cursor: portfolio.pagination.nextCursor
              }));
            }
          }}
          onRefresh={() => activeBrand && loadProducts(activeBrand.id, productFilters)}
        />
      )}
    </AffiliateStudioShell>
  );
}
