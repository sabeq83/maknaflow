import { Suspense } from 'react';
import Sidebar from '../components/Sidebar';
import { AffiliateStudioWorkspace } from './components/AffiliateStudioWorkspace';
import styles from './components/AffiliateStudio.module.css';

export default function AffiliateStudioPage() {
  return (
    <div className="layout-with-sidebar">
      <Sidebar />
      <main className="main-content">
        <div className="page-container">
          <Suspense fallback={<div className={styles.loadingState}>Loading Affiliate Studio...</div>}>
            <AffiliateStudioWorkspace />
          </Suspense>
        </div>
      </main>
    </div>
  );
}
