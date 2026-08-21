'use client';

import Sidebar from '../components/Sidebar';
import { YouTubeStudioWorkspace } from './components/YouTubeStudioWorkspace';

export default function YouTubeStudioPage() {
  return (
    <div className="layout-with-sidebar">
      <Sidebar />
      <main className="main-content">
        <div className="page-container">
          <YouTubeStudioWorkspace />
        </div>
      </main>
    </div>
  );
}
