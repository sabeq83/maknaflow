'use client';

import { Suspense } from 'react';
import Sidebar from '../components/Sidebar';
import { YouTubeStudioWorkspace } from './components/YouTubeStudioWorkspace';

export default function YouTubeStudioPage() {
  return (
    <div className="layout-with-sidebar">
      <Sidebar />
      <main className="main-content">
        <div className="page-container">
          <Suspense fallback={<div style={{ color: 'var(--text-muted)', padding: 40, textAlign: 'center' }}>Loading YouTube Studio...</div>}>
            <YouTubeStudioWorkspace />
          </Suspense>
        </div>
      </main>
    </div>
  );
}
