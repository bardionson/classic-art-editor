'use client';

import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { ArrowLeft, Menu, Moon, Sun, X } from 'react-feather';
import WalletProvider from '@/app/wallet-provider';
import logo from '../../public/logo/async-logo.svg';

const MIRROR_DISPLAY_ROUTE = /^\/mirror\/[^/]+\/display$/;

const NAV_LINKS = [
  { href: '/gallery/masters', label: 'Masters Gallery' },
  { href: '/gallery/layers', label: 'Layers Gallery' },
  { href: '/wallet', label: 'Async Wallet' },
];

function ThemeToggle() {
  const [mounted, setMounted] = useState(false);
  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    setIsDark(document.documentElement.classList.contains('dark'));
    setMounted(true);
  }, []);

  const toggleTheme = () => {
    const next = !isDark;
    document.documentElement.classList.toggle('dark', next);
    localStorage.setItem('theme', next ? 'dark' : 'light');
    setIsDark(next);
  };

  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label={isDark ? 'Switch to light theme' : 'Switch to dark theme'}
      aria-pressed={isDark}
      className="inline-flex items-center justify-center w-9 h-9 rounded-md text-text-muted hover:text-text hover:bg-surface-sunken transition"
    >
      {mounted ? (
        isDark ? (
          <Sun size={18} />
        ) : (
          <Moon size={18} />
        )
      ) : (
        <span className="w-[18px] h-[18px]" />
      )}
    </button>
  );
}

export interface SiteHeaderProps {
  backHref?: string;
  title?: string;
}

export default function SiteHeader({ backHref, title }: SiteHeaderProps) {
  const pathname = usePathname();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  if (pathname && MIRROR_DISPLAY_ROUTE.test(pathname)) {
    return null;
  }

  const compressed = Boolean(title);

  return (
    <header className="sticky top-0 z-40 bg-surface-raised/90 backdrop-blur border-b border-border">
      <div className="max-w-[1400px] mx-auto px-4 md:px-8 py-4 flex items-center justify-between">
        {compressed ? (
          <Link
            href={backHref || '/'}
            className="flex items-center gap-2 min-w-0 text-text hover:text-text-muted transition"
          >
            <ArrowLeft size={20} className="shrink-0" />
            <span className="truncate max-w-[240px] sm:max-w-none font-semibold text-text">
              {title}
            </span>
          </Link>
        ) : (
          <div className="flex items-center gap-6">
            <Link href="/" className="flex items-center shrink-0">
              <Image
                src={logo.src}
                width={logo.width}
                height={logo.height}
                alt="Async Art Logo"
                className="h-6 md:h-7 w-auto dark:invert"
              />
            </Link>
            <nav className="hidden md:flex items-center gap-6">
              {NAV_LINKS.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className="text-sm font-medium text-text-muted hover:text-text transition"
                >
                  {link.label}
                </Link>
              ))}
            </nav>
          </div>
        )}

        <div className="flex items-center gap-2">
          {!compressed && (
            <button
              type="button"
              onClick={() => setMobileNavOpen((open) => !open)}
              aria-label="Toggle navigation menu"
              aria-expanded={mobileNavOpen}
              className="md:hidden inline-flex items-center justify-center w-9 h-9 rounded-md text-text-muted hover:text-text hover:bg-surface-sunken transition"
            >
              {mobileNavOpen ? <X size={20} /> : <Menu size={20} />}
            </button>
          )}
          <ThemeToggle />
          <WalletProvider>
            <ConnectButton accountStatus="address" showBalance={false} />
          </WalletProvider>
        </div>
      </div>

      {!compressed && mobileNavOpen && (
        <nav className="md:hidden border-t border-border bg-surface-raised px-4 py-3 flex flex-col gap-3">
          {NAV_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              onClick={() => setMobileNavOpen(false)}
              className="text-sm font-medium text-text-muted hover:text-text transition"
            >
              {link.label}
            </Link>
          ))}
        </nav>
      )}
    </header>
  );
}
