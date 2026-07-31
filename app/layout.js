import './globals.css';

export const metadata = {
  title: 'MAKNA FLOW — Isolated SaaS Content Flow Platform',
  description: 'Industrial-grade AI content engine for strategic video production & multi-node orchestration',
  icons: {
    icon: '/favicon.svg',
  },
};

export default function RootLayout({ children }) {
  return (
    <html lang="id">
      <body>{children}</body>
    </html>
  );
}
