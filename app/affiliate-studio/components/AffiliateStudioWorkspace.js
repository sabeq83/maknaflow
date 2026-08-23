'use client';

import { useEffect, useMemo, useState, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { resolveActiveAffiliateBrand, buildAffiliateStudioUrl } from '@/lib/affiliate-studio-workspace-state';
import { AffiliateStudioShell } from './AffiliateStudioShell';
import { BrandOverview } from './BrandOverview';
import styles from './AffiliateStudio.module.css';

export function AffiliateStudioWorkspace() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const requestedBrandId = searchParams ? searchParams.get('brand') : null;

  const [brands, setBrands] = useState([]);
  const [activeBrand, setActiveBrand] = useState(null);
  const [overview, setOverview] = useState(null);
  const [loadingBrands, setLoadingBrands] = useState(true);
  const [loadingOverview, setLoadingOverview] = useState(false);
  const [brandsError, setBrandsError] = useState(null);
  const [overviewError, setOverviewError] = useState(null);

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
        router.replace(buildAffiliateStudioUrl(resolved.id));
      } else {
        router.replace('/affiliate-studio');
      }
    }
  }, [brands, requestedBrandId, loadingBrands, brandsError, router]);

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

  useEffect(() => {
    if (activeBrand) {
      loadOverview(activeBrand.id);
    } else {
      setOverview(null);
    }
  }, [activeBrand]);

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
      onBrandChange={(brandId) => {
        router.push(buildAffiliateStudioUrl(brandId));
      }}
    >
      <BrandOverview
        overview={overview}
        loading={loadingOverview}
        error={overviewError}
        onRefresh={() => activeBrand && loadOverview(activeBrand.id)}
      />
    </AffiliateStudioShell>
  );
}
