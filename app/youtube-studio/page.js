'use client';

import Sidebar from '../components/Sidebar';
import { YouTubeStudioWorkspace } from './components/YouTubeStudioWorkspace';

export default function YouTubeStudioPage() {
  return (
    <div className="layout-with-sidebar">
      <Sidebar />
      <main className="main-content" style={{ padding: '32px 36px', background: 'var(--bg-primary)', minHeight: '100vh', width: '100%' }}>
        <YouTubeStudioWorkspace />
      </main>
    </div>
  );
}
