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
import { BrandCampaignPrograms } from './BrandCampaignPrograms';
import { CampaignProgramDetail } from './CampaignProgramDetail';
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

  // Campaign Programs State
  const [programs, setPrograms] = useState([]);
  const [loadingPrograms, setLoadingPrograms] = useState(false);
  const [programsError, setProgramsError] = useState(null);

  const [programDetail, setProgramDetail] = useState(null);
  const [loadingProgramDetail, setLoadingProgramDetail] = useState(false);
  const [programDetailError, setProgramDetailError] = useState(null);

  const requestedProgramId = searchParams ? searchParams.get('program') : null;
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

  const loadPrograms = (brandId) => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    const controller = new AbortController();
    abortControllerRef.current = controller;

    setLoadingPrograms(true);
    setProgramsError(null);

    fetch(`/api/v2/affiliate-studio/brands/${brandId}/programs`, { signal: controller.signal })
      .then(res => res.json())
      .then(body => {
        if (!body.success) throw new Error(body.error || 'Failed to load programs');
        setPrograms(body.data || []);
      })
      .catch(err => {
        if (err.name !== 'AbortError') {
          setProgramsError(err.message);
        }
      })
      .finally(() => {
        if (abortControllerRef.current === controller) {
          setLoadingPrograms(false);
          abortControllerRef.current = null;
        }
      });
  };

  const loadProgramDetail = (brandId, programId) => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    const controller = new AbortController();
    abortControllerRef.current = controller;

    setLoadingProgramDetail(true);
    setProgramDetailError(null);

    fetch(`/api/v2/affiliate-studio/brands/${brandId}/programs/${programId}`, { signal: controller.signal })
      .then(res => {
        if (res.status === 404) throw new Error('Program not found or unauthorized');
        return res.json();
      })
      .then(body => {
        if (!body.success) throw new Error(body.error || 'Failed to load program details');
        setProgramDetail(body.data);
      })
      .catch(err => {
        if (err.name !== 'AbortError') {
          setProgramDetailError(err.message);
        }
      })
      .finally(() => {
        if (abortControllerRef.current === controller) {
          setLoadingProgramDetail(false);
          abortControllerRef.current = null;
        }
      });
  };

  const handleCreateProgram = (payload) => {
    if (!activeBrand) return Promise.reject(new Error('No active brand selected'));
    return fetch(`/api/v2/affiliate-studio/brands/${activeBrand.id}/programs`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    })
      .then(res => res.json())
      .then(body => {
        if (!body.success) throw new Error(body.error || 'Failed to create program');
        loadPrograms(activeBrand.id);
        return body.data;
      });
  };

  const handleUpdateProgram = (programId, payload) => {
    if (!activeBrand) return Promise.reject(new Error('No active brand selected'));
    return fetch(`/api/v2/affiliate-studio/brands/${activeBrand.id}/programs/${programId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    })
      .then(res => res.json())
      .then(body => {
        if (!body.success) throw new Error(body.error || 'Failed to update program');
        loadProgramDetail(activeBrand.id, programId);
      });
  };

  const handleArchiveProgram = (programId) => {
    if (!activeBrand) return Promise.resolve();
    return fetch(`/api/v2/affiliate-studio/brands/${activeBrand.id}/programs/${programId}`, {
      method: 'DELETE'
    })
      .then(res => res.json())
      .then(body => {
        if (!body.success) throw new Error(body.error || 'Failed to archive program');
        router.push(buildAffiliateStudioUrl(activeBrand.id, { view: 'campaigns' }));
      });
  };

  const handleAddProductsToProgram = (programId, productIds) => {
    if (!activeBrand) return Promise.reject(new Error('No active brand selected'));
    return fetch(`/api/v2/affiliate-studio/brands/${activeBrand.id}/programs/${programId}/products`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ productIds })
    })
      .then(res => res.json())
      .then(body => {
        if (!body.success) throw new Error(body.error || 'Failed to add products');
        loadProgramDetail(activeBrand.id, programId);
      });
  };

  const handleRemoveProductsFromProgram = (programId, productIds) => {
    if (!activeBrand) return Promise.reject(new Error('No active brand selected'));
    return fetch(`/api/v2/affiliate-studio/brands/${activeBrand.id}/programs/${programId}/products`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ productIds })
    })
      .then(res => res.json())
      .then(body => {
        if (!body.success) throw new Error(body.error || 'Failed to remove products');
        loadProgramDetail(activeBrand.id, programId);
      });
  };

  useEffect(() => {
    if (!activeBrand) {
      setOverview(null);
      setPortfolio(null);
      setPrograms([]);
      setProgramDetail(null);
      return;
    }

    if (activeView === 'overview') {
      loadOverview(activeBrand.id);
    } else if (activeView === 'products') {
      loadProducts(activeBrand.id, productFilters);
    } else if (activeView === 'campaigns') {
      if (requestedProgramId) {
        loadProgramDetail(activeBrand.id, requestedProgramId);
      } else {
        loadPrograms(activeBrand.id);
        setProgramDetail(null);
      }
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
      {activeView === 'campaigns' && !requestedProgramId && (
        <BrandCampaignPrograms
          programs={programs}
          loading={loadingPrograms}
          error={programsError}
          onCreate={handleCreateProgram}
          onSelect={(programId) => {
            router.push(buildAffiliateStudioUrl(activeBrand?.id, {
              view: 'campaigns',
              program: programId
            }));
          }}
          onRefresh={() => activeBrand && loadPrograms(activeBrand.id)}
        />
      )}
      {activeView === 'campaigns' && requestedProgramId && (
        <CampaignProgramDetail
          brandId={activeBrand?.id}
          program={programDetail}
          loading={loadingProgramDetail}
          error={programDetailError}
          onBack={() => {
            router.push(buildAffiliateStudioUrl(activeBrand?.id, { view: 'campaigns' }));
          }}
          onUpdate={handleUpdateProgram}
          onArchive={handleArchiveProgram}
          onAddProducts={handleAddProductsToProgram}
          onRemoveProducts={handleRemoveProductsFromProgram}
          onRefresh={() => activeBrand && loadProgramDetail(activeBrand.id, requestedProgramId)}
        />
      )}
    </AffiliateStudioShell>
  );
}
