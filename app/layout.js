import './globals.css';
import './theme.css';

export const metadata = {
  title: 'MAKNA FLOW — Isolated SaaS Content Flow Platform',
  description: 'Industrial-grade AI content engine for strategic video production & multi-node orchestration',
  icons: {
    icon: '/favicon.svg',
  },
};

export default function RootLayout({ children }) {
  return (
    <html lang="id" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                try {
                  const storedTheme = localStorage.getItem('theme');
                  const theme = storedTheme === 'light' || storedTheme === 'dark' ? storedTheme : 'dark';
                  document.documentElement.dataset.theme = theme;
                  document.documentElement.style.colorScheme = theme;
                } catch (e) {}
              })();
            `
          }}
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
