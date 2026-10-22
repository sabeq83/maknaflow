'use client';

import Sidebar from '../components/Sidebar';
import StudioWorkspace from '../components/contentflow-studio/StudioWorkspace';

export default function ContentFlowStudioPage() {
  return (
    <div className="app-layout">
      <Sidebar />
      <main className="main-content">
        <div style={{ padding: '24px 32px', maxWidth: '1400px', margin: '0 auto' }}>
          <StudioWorkspace />
        </div>
      </main>
    </div>
  );
}
