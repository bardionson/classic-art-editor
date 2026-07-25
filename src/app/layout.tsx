import App from '@/app/app';
import { Chivo } from 'next/font/google';
import type { Metadata } from 'next';
import '../styles/globals.css';
import { PreloadResources } from '@/app/preload-resources';
import { Analytics } from '@vercel/analytics/next';
import Script from 'next/script';
import SiteHeader from '@/components/site-header';

const chivo = Chivo({
  weight: ['400', '600'],
  subsets: ['latin'],
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'Async Classic Art Editor',
  description: 'Async Classic Art Editor',
  icons: {
    icon: [
      { url: '/logo/favicon.ico' },
      { url: '/logo/favicon-32x32.png', sizes: '32x32', type: 'image/png' },
      { url: '/logo/favicon-16x16.png', sizes: '16x16', type: 'image/png' },
    ],
  },
};

const themeInitScript = `(function(){try{var t=localStorage.getItem('theme');if(t==='dark'||(t===null&&window.matchMedia('(prefers-color-scheme: dark)').matches)){document.documentElement.classList.add('dark');}}catch(e){}})();`;

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={chivo.className}>
      <PreloadResources />
      <body>
        <Script
          id="theme-init"
          strategy="beforeInteractive"
          dangerouslySetInnerHTML={{ __html: themeInitScript }}
        />
        <App>
          <SiteHeader />
          {children}
        </App>
        <Analytics />
      </body>
    </html>
  );
}
