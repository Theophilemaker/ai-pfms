/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ArrowRight,
  BarChart3,
  Check,
  ChevronDown,
  Cpu,
  Download,
  Globe,
  Keyboard,
  Landmark,
  Layers,
  Lock,
  Menu,
  Monitor,
  Moon,
  PiggyBank,
  Play,
  Search,
  Shield,
  ShieldCheck,
  Smartphone,
  Sun,
  Target,
  WifiOff,
  X,
} from 'lucide-react';
import { AuthPlaceholderModal, type AuthMode } from './components/AuthPlaceholderModal';
import { ContactUs } from './components/ContactUs';
import { Dashboard, type AuthenticatedUser } from './components/Dashboard';
import { InstallModal } from './components/InstallModal';
import { KeyboardShortcutsModal } from './components/KeyboardShortcutsModal';
import { useOnlineStatus, usePWAInstall } from './hooks/usePWAInstall';
import { translations, type Locale, type ThemeMode } from './i18n/translations';

export default function App() {
  const [locale, setLocale] = useState<Locale>(() => {
    if (typeof window !== 'undefined') {
      const saved = window.localStorage.getItem('ai_pfms_locale');
      if (saved === 'en' || saved === 'rw') return saved;
    }
    return 'en';
  });

  const [theme, setTheme] = useState<ThemeMode>(() => {
    if (typeof window !== 'undefined') {
      const saved = window.localStorage.getItem('ai_pfms_theme');
      if (saved === 'light' || saved === 'dark' || saved === 'system') return saved;
    }
    return 'light';
  });

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [installModalOpen, setInstallModalOpen] = useState(false);
  const [contactModalOpen, setContactModalOpen] = useState(false);
  const [shortcutsModalOpen, setShortcutsModalOpen] = useState(false);
  const [authModalMode, setAuthModalMode] = useState<AuthMode | null>(null);
  const [authenticatedUser, setAuthenticatedUser] = useState<AuthenticatedUser | null>(null);
  const [openFaqIndex, setOpenFaqIndex] = useState<number | null>(0);
  const [faqSearchQuery, setFaqSearchQuery] = useState('');
  const faqSearchInputRef = useRef<HTMLInputElement | null>(null);

  const isOnline = useOnlineStatus();
  const pwa = usePWAInstall();
  const t = translations[locale];

  // Apply light / dark / system theme to <html>
  useEffect(() => {
    const root = document.documentElement;
    const media = window.matchMedia('(prefers-color-scheme: dark)');

    const applyTheme = () => {
      const resolved = theme === 'system' ? (media.matches ? 'dark' : 'light') : theme;
      root.classList.toggle('dark', resolved === 'dark');
      root.setAttribute('data-theme', resolved);
    };

    applyTheme();
    window.localStorage.setItem('ai_pfms_theme', theme);
    media.addEventListener('change', applyTheme);
    return () => media.removeEventListener('change', applyTheme);
  }, [theme]);

  useEffect(() => {
    window.localStorage.setItem('ai_pfms_locale', locale);
    document.documentElement.lang = locale;
  }, [locale]);

  const handleInstallAction = useCallback(async () => {
    if (pwa.canNativePrompt) {
      const outcome = await pwa.triggerInstall();
      if (outcome !== 'accepted') {
        setInstallModalOpen(true);
      }
      return;
    }
    setInstallModalOpen(true);
  }, [pwa]);

  const featureIcons = [Landmark, Layers, Target, PiggyBank, BarChart3, Cpu];
  const trustIcons = [ShieldCheck, Lock, Globe, Smartphone];

  const cycleTheme = useCallback(() => {
    setTheme((prev) => (prev === 'light' ? 'dark' : prev === 'dark' ? 'system' : 'light'));
  }, []);

  const toggleLocale = useCallback(() => setLocale((l) => (l === 'en' ? 'rw' : 'en')), []);

  // Global keyboard shortcut handler for navigation & accessibility
  useEffect(() => {
    const isEditableTarget = (target: EventTarget | null): boolean => {
      if (!(target instanceof HTMLElement)) return false;
      const tag = target.tagName;
      return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || target.isContentEditable;
    };

    const onKeyDown = (e: KeyboardEvent) => {
      const mod = e.ctrlKey || e.metaKey;
      const key = e.key.toLowerCase();

      // Ctrl/Cmd + K: Focus FAQ search on landing view (Dashboard handles Ctrl+K when logged in)
      if (mod && key === 'k' && !authenticatedUser) {
        e.preventDefault();
        faqSearchInputRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        faqSearchInputRef.current?.focus();
        return;
      }

      // Ctrl/Cmd + I: Open PWA Install prompt/modal
      if (mod && key === 'i') {
        e.preventDefault();
        if (!pwa.isInstalled) {
          void handleInstallAction();
        }
        return;
      }

      // Ctrl/Cmd + / or '?': Toggle Keyboard Shortcuts help modal
      if ((mod && e.key === '/') || (!mod && !e.altKey && e.key === '?' && !isEditableTarget(e.target))) {
        e.preventDefault();
        setShortcutsModalOpen((prev) => !prev);
        return;
      }

      // Alt + T: Cycle theme
      if (e.altKey && !mod && key === 't') {
        e.preventDefault();
        cycleTheme();
        return;
      }

      // Alt + L: Toggle language
      if (e.altKey && !mod && key === 'l') {
        e.preventDefault();
        toggleLocale();
        return;
      }

      // Alt + C: Open Contact Support modal on landing view
      if (e.altKey && !mod && key === 'c' && !authenticatedUser) {
        e.preventDefault();
        setContactModalOpen(true);
        return;
      }

      // Escape: Dismiss shortcut help modal or mobile drawer
      if (e.key === 'Escape') {
        if (shortcutsModalOpen) {
          setShortcutsModalOpen(false);
        } else if (mobileMenuOpen) {
          setMobileMenuOpen(false);
        }
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [
    authenticatedUser,
    pwa.isInstalled,
    handleInstallAction,
    cycleTheme,
    toggleLocale,
    shortcutsModalOpen,
    mobileMenuOpen,
  ]);

  const ThemeIcon = theme === 'dark' ? Moon : theme === 'light' ? Sun : Monitor;

  if (authenticatedUser) {
    return (
      <>
        <Dashboard
          user={authenticatedUser}
          locale={locale}
          onToggleLocale={toggleLocale}
          theme={theme}
          onCycleTheme={cycleTheme}
          isInstalled={pwa.isInstalled}
          isOnline={isOnline}
          onInstallClick={handleInstallAction}
          onLogout={() => setAuthenticatedUser(null)}
        />

        {!isOnline && (
          <div
            role="status"
            className="fixed bottom-4 left-4 right-4 z-50 mx-auto flex max-w-lg items-center gap-2.5 rounded-xl border border-amber-400/50 bg-amber-600 px-4 py-2.5 text-xs font-medium text-white shadow-lg sm:right-auto"
          >
            <WifiOff className="h-4 w-4 shrink-0" />
            <span>{t.offlineBanner}</span>
          </div>
        )}

        <InstallModal
          open={installModalOpen}
          onClose={() => setInstallModalOpen(false)}
          locale={locale}
          platform={pwa.platform}
          canNativePrompt={pwa.canNativePrompt}
          isInstalled={pwa.isInstalled}
          status={pwa.status}
          onInstall={pwa.triggerInstall}
        />

        <KeyboardShortcutsModal
          open={shortcutsModalOpen}
          onClose={() => setShortcutsModalOpen(false)}
          locale={locale}
        />
      </>
    );
  }

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-[#0F172A] transition-colors duration-200 dark:bg-[#0F1724] dark:text-[#F8FAFC]">
      {/* Sticky Top Navigation Bar */}
      <header className="sticky top-0 z-40 border-b border-slate-200/80 bg-white/90 backdrop-blur-md dark:border-[#263449] dark:bg-[#0B1220]/90">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
          {/* Brand Lockup */}
          <a
            href="#top"
            className="flex shrink-0 items-center gap-2.5 whitespace-nowrap focus-visible:outline-2 focus-visible:outline-[#7C3AED]"
          >
            <img
              src="/assets/icons/icon.svg"
              alt="AI-PFMS"
              className="h-8 w-8 rounded-lg"
              width={32}
              height={32}
            />
            <span className="font-display text-lg font-bold tracking-tight text-slate-900 dark:text-white">
              {t.brandName}
            </span>
          </a>

          {/* Desktop Center Navigation */}
          <nav
            aria-label="Primary"
            className="hidden items-center gap-7 text-sm font-medium text-slate-600 lg:flex dark:text-slate-300"
          >
            <a
              href="#features"
              className="shrink-0 whitespace-nowrap transition-colors hover:text-[#7C3AED] dark:hover:text-violet-400"
            >
              {t.nav.features}
            </a>
            <a
              href="#how-it-works"
              className="shrink-0 whitespace-nowrap transition-colors hover:text-[#7C3AED] dark:hover:text-violet-400"
            >
              {t.nav.howItWorks}
            </a>
            <a
              href="#security"
              className="shrink-0 whitespace-nowrap transition-colors hover:text-[#7C3AED] dark:hover:text-violet-400"
            >
              {t.nav.security}
            </a>
            <a
              href="#pricing"
              className="shrink-0 whitespace-nowrap transition-colors hover:text-[#7C3AED] dark:hover:text-violet-400"
            >
              {t.nav.pricing}
            </a>
          </nav>

          {/* Desktop Right Controls: Language, Theme, Install Placeholder, Auth Placeholders */}
          <div className="hidden items-center gap-2.5 lg:flex">
            <button
              type="button"
              onClick={() => setLocale((l) => (l === 'en' ? 'rw' : 'en'))}
              aria-label={t.language.label}
              className="inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-100 dark:border-[#263449] dark:text-slate-200 dark:hover:bg-[#162235]"
            >
              <Globe className="h-3.5 w-3.5 text-[#7C3AED]" />
              <span>{locale.toUpperCase()}</span>
            </button>

            <button
              type="button"
              onClick={cycleTheme}
              aria-label={`${t.theme.label}: ${t.theme[theme]}`}
              title={`${t.theme.label}: ${t.theme[theme]}`}
              className="inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-100 dark:border-[#263449] dark:text-slate-200 dark:hover:bg-[#162235]"
            >
              <ThemeIcon className="h-3.5 w-3.5 text-[#7C3AED]" />
              <span>{t.theme[theme]}</span>
            </button>

            {!pwa.isInstalled ? (
              <button
                type="button"
                onClick={handleInstallAction}
                title={`${t.nav.installApp} (Ctrl+I)`}
                className="inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-lg border border-violet-200 bg-violet-50 px-3 py-1.5 text-xs font-semibold text-[#6D28D9] transition-colors hover:bg-violet-100 dark:border-violet-500/30 dark:bg-violet-950/40 dark:text-violet-300 dark:hover:bg-violet-900/50"
              >
                <Download className="h-3.5 w-3.5" />
                <span>{t.nav.installApp}</span>
              </button>
            ) : (
              <span className="inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-950/40 dark:text-emerald-300">
                <Check className="h-3.5 w-3.5" />
                <span>{t.nav.installed}</span>
              </span>
            )}

            <a
              href="#login"
              onClick={(e) => {
                e.preventDefault();
                setAuthModalMode('login');
              }}
              className="shrink-0 whitespace-nowrap rounded-lg px-3 py-1.5 text-sm font-semibold text-slate-700 transition-colors hover:text-[#7C3AED] dark:text-slate-200 dark:hover:text-violet-400"
            >
              {t.nav.login}
            </a>

            <a
              href="#register"
              onClick={(e) => {
                e.preventDefault();
                setAuthModalMode('register');
              }}
              className="inline-flex shrink-0 items-center whitespace-nowrap rounded-xl bg-[#7C3AED] px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-[#6D28D9] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7C3AED]"
            >
              {t.nav.getStarted}
            </a>
          </div>

          {/* Mobile Action Bar & Hamburger */}
          <div className="flex items-center gap-2 lg:hidden">
            {!pwa.isInstalled && (
              <button
                type="button"
                onClick={handleInstallAction}
                className="inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-lg border border-violet-200 bg-violet-50 px-2.5 py-1.5 text-xs font-semibold text-[#6D28D9] dark:border-violet-500/30 dark:bg-violet-950/40 dark:text-violet-300"
              >
                <Download className="h-3.5 w-3.5" />
                <span>{t.nav.installApp}</span>
              </button>
            )}
            <button
              type="button"
              onClick={() => setMobileMenuOpen((prev) => !prev)}
              aria-expanded={mobileMenuOpen}
              aria-label={mobileMenuOpen ? t.nav.closeMenu : t.nav.openMenu}
              className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-100 dark:border-[#263449] dark:text-slate-200 dark:hover:bg-[#162235]"
            >
              {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          </div>
        </div>

        {/* Responsive Mobile Drawer */}
        {mobileMenuOpen && (
          <div className="border-t border-slate-200 bg-white px-4 py-4 lg:hidden dark:border-[#263449] dark:bg-[#0B1220]">
            <nav aria-label="Mobile Primary" className="flex flex-col space-y-2">
              {[
                { href: '#features', label: t.nav.features },
                { href: '#how-it-works', label: t.nav.howItWorks },
                { href: '#security', label: t.nav.security },
                { href: '#pricing', label: t.nav.pricing },
              ].map((item) => (
                <a
                  key={item.href}
                  href={item.href}
                  onClick={() => setMobileMenuOpen(false)}
                  className="rounded-lg px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-[#162235]"
                >
                  {item.label}
                </a>
              ))}
            </nav>

            <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-slate-200 pt-4 dark:border-[#263449]">
              <button
                type="button"
                onClick={() => setLocale((l) => (l === 'en' ? 'rw' : 'en'))}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 dark:border-[#263449] dark:text-slate-200"
              >
                <Globe className="h-3.5 w-3.5 text-[#7C3AED]" />
                {t.language[locale]}
              </button>
              <button
                type="button"
                onClick={cycleTheme}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 dark:border-[#263449] dark:text-slate-200"
              >
                <ThemeIcon className="h-3.5 w-3.5 text-[#7C3AED]" />
                {t.theme[theme]}
              </button>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-2.5">
              <button
                type="button"
                onClick={() => {
                  setMobileMenuOpen(false);
                  setAuthModalMode('login');
                }}
                className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-800 dark:border-[#263449] dark:text-slate-100"
              >
                {t.nav.login}
              </button>
              <button
                type="button"
                onClick={() => {
                  setMobileMenuOpen(false);
                  setAuthModalMode('register');
                }}
                className="rounded-xl bg-[#7C3AED] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#6D28D9]"
              >
                {t.nav.getStarted}
              </button>
            </div>
          </div>
        )}
      </header>

      {/* Main Content Shell */}
      <main id="top">
        {/* Hero Section */}
        <section className="relative overflow-hidden border-b border-slate-200/70 bg-gradient-to-b from-violet-50/70 via-[#F8FAFC] to-[#F8FAFC] py-12 sm:py-16 lg:py-20 dark:border-[#263449] dark:from-[#162235]/60 dark:via-[#0F1724] dark:to-[#0F1724]">
          <div className="mx-auto grid max-w-7xl items-center gap-10 px-4 sm:px-6 lg:grid-cols-12 lg:gap-12 lg:px-8">
            {/* Hero Copy */}
            <div className="lg:col-span-6">
              <p className="text-xs font-semibold tracking-wider text-[#7C3AED] uppercase">
                {t.hero.kicker}
              </p>
              <h1 className="font-display mt-3 text-balance text-3xl font-extrabold tracking-tight text-slate-900 sm:text-5xl dark:text-white">
                {t.hero.titlePrefix}{' '}
                <span className="text-[#7C3AED] underline decoration-[#7C3AED]/40 decoration-4 underline-offset-8">
                  {t.hero.titleHighlight}
                </span>
              </h1>
              <p className="mt-5 max-w-xl text-base leading-relaxed text-slate-600 sm:text-lg dark:text-slate-300">
                {t.hero.subtitle}
              </p>

              <div className="mt-7 flex flex-wrap items-center gap-3.5">
                <button
                  type="button"
                  onClick={() => setAuthModalMode('register')}
                  className="inline-flex items-center gap-2 rounded-xl bg-[#7C3AED] px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-[#6D28D9] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7C3AED]"
                >
                  <span>{t.hero.ctaPrimary}</span>
                  <ArrowRight className="h-4 w-4" />
                </button>
                <a
                  href="#features"
                  className="inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-5 py-3 text-sm font-semibold text-slate-800 transition-colors hover:bg-slate-50 dark:border-[#263449] dark:bg-[#162235] dark:text-slate-100 dark:hover:bg-[#1E2D45]"
                >
                  <Play className="h-3.5 w-3.5 fill-current text-[#7C3AED]" />
                  <span>{t.hero.ctaSecondary}</span>
                </a>
              </div>

              <div className="mt-6 flex items-center gap-2 text-xs font-medium text-slate-600 dark:text-slate-400">
                <ShieldCheck className="h-4 w-4 text-[#7C3AED]" />
                <span>{t.hero.trustNote}</span>
              </div>
            </div>

            {/* Authenticated Workspace Access Card (replaces mock preview) */}
            <div className="lg:col-span-6">
              <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xl sm:p-7 dark:border-[#263449] dark:bg-[#0B1220]">
                <div className="flex items-center justify-between gap-3 border-b border-slate-100 pb-4 dark:border-[#263449]">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-100 text-[#7C3AED] dark:bg-violet-950/60">
                      <Lock className="h-5 w-5" />
                    </div>
                    <div>
                      <h2 className="font-display text-base font-bold text-slate-900 dark:text-white">
                        {t.hero.accessCard.title}
                      </h2>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        {t.brandName}
                      </p>
                    </div>
                  </div>
                </div>

                <p className="mt-4 text-sm leading-relaxed text-slate-600 dark:text-slate-300">
                  {t.hero.accessCard.subtitle}
                </p>

                <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2">
                  {t.hero.accessCard.highlights.map((item) => (
                    <div
                      key={item.label}
                      className="rounded-xl border border-slate-200 bg-slate-50/80 p-3.5 dark:border-[#263449] dark:bg-[#162235]/60"
                    >
                      <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
                        {item.label}
                      </p>
                      <p className="mt-1 text-xs font-semibold text-slate-900 dark:text-white">
                        {item.value}
                      </p>
                    </div>
                  ))}
                </div>

                <button
                  type="button"
                  onClick={() => setAuthModalMode('login')}
                  className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#7C3AED] px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-[#6D28D9] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7C3AED]"
                >
                  <span>{t.hero.accessCard.cta}</span>
                  <ArrowRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>

          {/* 4-Item Trust Strip */}
          <div className="mx-auto mt-10 max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="grid grid-cols-1 gap-3 rounded-2xl border border-slate-200 bg-white p-4 sm:grid-cols-2 lg:grid-cols-4 dark:border-[#263449] dark:bg-[#0B1220]">
              {t.trustStrip.map((item, idx) => {
                const Icon = trustIcons[idx];
                return (
                  <div key={item} className="flex items-center gap-2.5 px-2 py-1 text-xs font-medium text-slate-700 dark:text-slate-200">
                    <Icon className="h-4 w-4 shrink-0 text-[#7C3AED]" />
                    <span>{item}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* Features Section */}
        <section id="features" className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8">
          <h2 className="font-display text-center text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl dark:text-white">
            {t.featuresSection.heading}
          </h2>

          <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {t.featuresSection.items.map((feat, idx) => {
              const Icon = featureIcons[idx];
              return (
                <article
                  key={feat.title}
                  className="rounded-2xl border border-slate-200 bg-white p-6 transition-colors hover:border-violet-300 dark:border-[#263449] dark:bg-[#0B1220] dark:hover:border-violet-500/50"
                >
                  <div className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-violet-100 text-[#7C3AED] dark:bg-violet-950/60">
                    <Icon className="h-5 w-5" />
                  </div>
                  <h3 className="font-display mt-4 text-base font-bold text-slate-900 dark:text-white">
                    {feat.title}
                  </h3>
                  <p className="mt-1.5 text-sm leading-relaxed text-slate-600 dark:text-slate-300">
                    {feat.desc}
                  </p>
                </article>
              );
            })}
          </div>
        </section>

        {/* How It Works */}
        <section
          id="how-it-works"
          className="border-y border-slate-200/80 bg-white py-14 dark:border-[#263449] dark:bg-[#0B1220]"
        >
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <h2 className="font-display text-center text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl dark:text-white">
              {t.howItWorksSection.heading}
            </h2>

            <div className="mt-8 grid grid-cols-1 gap-6 md:grid-cols-3">
              {t.howItWorksSection.steps.map((step) => (
                <div
                  key={step.num}
                  className="flex items-start gap-4 rounded-2xl border border-slate-200 bg-[#F8FAFC] p-5 dark:border-[#263449] dark:bg-[#162235]/50"
                >
                  <span className="font-mono-num flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#7C3AED] text-xs font-bold text-white">
                    {step.num}
                  </span>
                  <div>
                    <h3 className="font-display text-base font-bold text-slate-900 dark:text-white">
                      {step.title}
                    </h3>
                    <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">{step.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Security Banner */}
        <section id="security" className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
          <div className="flex flex-col items-start justify-between gap-6 rounded-2xl bg-gradient-to-r from-[#0F1724] via-[#1E1B4B] to-[#3B0764] p-7 text-white sm:flex-row sm:items-center sm:p-9">
            <div className="flex items-start gap-4">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-white/10">
                <Shield className="h-6 w-6 text-violet-300" />
              </div>
              <div>
                <h2 className="font-display text-xl font-bold sm:text-2xl">
                  {t.securityBanner.title}
                </h2>
                <p className="mt-1.5 max-w-2xl text-sm text-slate-200">
                  {t.securityBanner.desc}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setAuthModalMode('register')}
              className="inline-flex shrink-0 items-center gap-2 whitespace-nowrap rounded-xl bg-[#7C3AED] px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#6D28D9]"
            >
              <span>{t.securityBanner.cta}</span>
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        </section>

        {/* Pricing Section */}
        <section id="pricing" className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
          <h2 className="font-display text-center text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl dark:text-white">
            {t.pricingSection.heading}
          </h2>

          <div className="mt-8 grid grid-cols-1 gap-6 lg:grid-cols-3">
            {t.pricingSection.plans.map((plan) => (
              <div
                key={plan.name}
                className={`flex flex-col justify-between rounded-2xl border bg-white p-6 dark:bg-[#0B1220] ${
                  plan.featured
                    ? 'border-[#7C3AED] ring-1 ring-[#7C3AED]'
                    : 'border-slate-200 dark:border-[#263449]'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="font-display text-lg font-bold text-slate-900 dark:text-white">
                      {plan.name}
                    </h3>
                    {plan.featured && (
                      <span className="text-xs font-semibold text-[#7C3AED]">
                        {t.pricingSection.popular}
                      </span>
                    )}
                  </div>
                  <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">{plan.desc}</p>
                  <p className="font-mono-num mt-4 text-2xl font-bold text-slate-900 dark:text-white">
                    {plan.price}
                  </p>
                  <ul className="mt-5 space-y-2.5 text-sm text-slate-600 dark:text-slate-300">
                    {plan.features.map((f) => (
                      <li key={f} className="flex items-start gap-2">
                        <Check className="mt-0.5 h-4 w-4 shrink-0 text-[#16A34A]" />
                        <span>{f}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <button
                  type="button"
                  onClick={() => setAuthModalMode('register')}
                  className={`mt-6 inline-flex w-full items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition-colors ${
                    plan.featured
                      ? 'bg-[#7C3AED] text-white hover:bg-[#6D28D9]'
                      : 'border border-slate-200 text-slate-800 hover:bg-slate-50 dark:border-[#263449] dark:text-slate-100 dark:hover:bg-[#162235]'
                  }`}
                >
                  <span>{t.pricingSection.cta}</span>
                  <ArrowRight className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
        </section>

        {/* FAQ Accordion */}
        <section id="faq" className="mx-auto max-w-7xl px-4 pb-16 pt-6 sm:px-6 lg:px-8">
          <h2 className="font-display text-center text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
            {t.faqSection.heading}
          </h2>

          {(() => {
            const trimmedFaqQuery = faqSearchQuery.trim();
            const normalizedFaqQuery = trimmedFaqQuery.toLowerCase();
            const indexedFaqs = t.faqSection.items.map((item, idx) => ({
              ...item,
              originalIdx: idx,
            }));
            const filteredFaqs = normalizedFaqQuery
              ? indexedFaqs.filter(
                  (item) =>
                    item.q.toLowerCase().includes(normalizedFaqQuery) ||
                    item.a.toLowerCase().includes(normalizedFaqQuery)
                )
              : indexedFaqs;

            return (
              <>
                <div className="mx-auto mt-5 max-w-md">
                  <div className="relative">
                    <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                    <input
                      ref={faqSearchInputRef}
                      type="search"
                      value={faqSearchQuery}
                      onChange={(e) => {
                        const next = e.target.value;
                        setFaqSearchQuery(next);
                        const q = next.trim().toLowerCase();
                        if (q) {
                          const firstMatchIdx = t.faqSection.items.findIndex(
                            (item) =>
                              item.q.toLowerCase().includes(q) ||
                              item.a.toLowerCase().includes(q)
                          );
                          setOpenFaqIndex(firstMatchIdx >= 0 ? firstMatchIdx : null);
                        }
                      }}
                      placeholder={t.faqSection.searchPlaceholder}
                      aria-label={t.faqSection.searchLabel}
                      className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-10 pr-16 text-sm text-slate-900 placeholder:text-slate-400 focus:border-[#7C3AED] focus:outline-none dark:border-[#263449] dark:bg-[#0B1220] dark:text-slate-100"
                    />
                    {trimmedFaqQuery ? (
                      <button
                        type="button"
                        onClick={() => {
                          setFaqSearchQuery('');
                          setOpenFaqIndex(0);
                        }}
                        aria-label={t.faqSection.clearSearch}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-md p-1 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-[#162235] dark:hover:text-slate-200"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    ) : (
                      <kbd className="pointer-events-none absolute right-2.5 top-1/2 hidden -translate-y-1/2 rounded border border-slate-200 bg-slate-50 px-1.5 py-0.5 font-mono text-[10px] font-semibold text-slate-400 sm:inline-block dark:border-[#263449] dark:bg-[#162235]">
                        Ctrl+K
                      </kbd>
                    )}
                  </div>
                  {trimmedFaqQuery && (
                    <p className="mt-2 text-center text-xs text-slate-500 dark:text-slate-400">
                      <span className="font-mono-num font-semibold text-[#7C3AED]">
                        {filteredFaqs.length}
                      </span>{' '}
                      {t.faqSection.resultsLabel}
                    </p>
                  )}
                </div>

                {filteredFaqs.length === 0 ? (
                  <div className="mx-auto mt-6 max-w-md rounded-2xl border border-slate-200 bg-white p-6 text-center dark:border-[#263449] dark:bg-[#0B1220]">
                    <p className="font-display text-sm font-bold text-slate-900 dark:text-white">
                      {t.faqSection.emptyTitle}
                    </p>
                    <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                      {t.faqSection.emptyHint}
                    </p>
                    <button
                      type="button"
                      onClick={() => {
                        setFaqSearchQuery('');
                        setOpenFaqIndex(0);
                      }}
                      className="mt-4 inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2 text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-100 dark:border-[#263449] dark:bg-[#162235] dark:text-slate-200 dark:hover:bg-[#1E2D45]"
                    >
                      <X className="h-3.5 w-3.5 text-[#7C3AED]" />
                      <span>{t.faqSection.clearSearch}</span>
                    </button>
                  </div>
                ) : (
                  <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-3">
                    {filteredFaqs.map((item) => {
                      const isOpen = openFaqIndex === item.originalIdx;
                      return (
                        <div
                          key={item.q}
                          className="rounded-xl border border-slate-200 bg-white dark:border-[#263449] dark:bg-[#0B1220]"
                        >
                          <button
                            type="button"
                            aria-expanded={isOpen}
                            onClick={() =>
                              setOpenFaqIndex(isOpen ? null : item.originalIdx)
                            }
                            className="flex w-full items-center justify-between gap-3 px-4 py-3.5 text-left text-sm font-semibold text-slate-900 dark:text-white"
                          >
                            <span>{item.q}</span>
                            <ChevronDown
                              className={`h-4 w-4 shrink-0 text-slate-500 transition-transform ${
                                isOpen ? 'rotate-180' : ''
                              }`}
                            />
                          </button>
                          {isOpen && (
                            <p className="border-t border-slate-100 px-4 py-3 text-xs leading-relaxed text-slate-600 dark:border-[#263449] dark:text-slate-300">
                              {item.a}
                            </p>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </>
            );
          })()}
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-[#263449] bg-[#0B1220] text-slate-300">
        <div className="mx-auto grid max-w-7xl grid-cols-1 gap-8 px-4 py-12 sm:grid-cols-2 sm:px-6 lg:grid-cols-12 lg:px-8">
          <div className="lg:col-span-5">
            <div className="flex items-center gap-2.5">
              <img
                src="/assets/icons/icon.svg"
                alt="AI-PFMS"
                className="h-8 w-8 rounded-lg"
                width={32}
                height={32}
              />
              <div>
                <p className="font-display text-base font-bold text-white">{t.brandName}</p>
                <p className="text-xs text-slate-400">{t.brandFull}</p>
              </div>
            </div>
            <p className="mt-3 text-xs text-slate-400">{t.brandTagline}</p>

            {/* Social Media Placeholder Links */}
            <div className="mt-5 flex items-center gap-2.5" aria-label="Social media">
              <a
                href="#social-linkedin"
                aria-label="LinkedIn (Placeholder)"
                title="LinkedIn (Placeholder)"
                className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-[#263449] bg-[#162235]/60 text-slate-300 transition-colors hover:border-[#7C3AED] hover:text-white focus-visible:outline-2 focus-visible:outline-[#7C3AED]"
              >
                <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                  <path d="M19 3a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h14m-.5 15.5v-5.3a3.26 3.26 0 0 0-3.26-3.26c-.85 0-1.84.52-2.28 1.3v-1.11h-2.79v8.37h2.79v-4.93c0-.77.62-1.4 1.39-1.4a1.4 1.4 0 0 1 1.4 1.4v4.93h2.75M6.88 8.56a1.68 1.68 0 0 0 1.68-1.68c0-.93-.75-1.69-1.68-1.69a1.69 1.69 0 0 0-1.69 1.69c0 .93.76 1.68 1.69 1.68m1.39 9.94v-8.37H5.5v8.37h2.77z" />
                </svg>
              </a>
              <a
                href="#social-twitter"
                aria-label="Twitter (Placeholder)"
                title="Twitter (Placeholder)"
                className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-[#263449] bg-[#162235]/60 text-slate-300 transition-colors hover:border-[#7C3AED] hover:text-white focus-visible:outline-2 focus-visible:outline-[#7C3AED]"
              >
                <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                  <path d="M22.46 6c-.77.35-1.6.58-2.46.69.88-.53 1.56-1.37 1.88-2.38-.83.5-1.75.85-2.72 1.05C18.37 4.5 17.26 4 16 4c-2.35 0-4.27 1.92-4.27 4.29 0 .34.04.67.11.98C8.28 9.09 5.11 7.38 3 4.79c-.37.63-.58 1.37-.58 2.15 0 1.49.75 2.81 1.91 3.56-.71 0-1.37-.2-1.95-.5v.03c0 2.08 1.48 3.82 3.44 4.21a4.22 4.22 0 0 1-1.93.07 4.28 4.28 0 0 0 4 2.98 8.521 8.521 0 0 1-5.33 1.84c-.34 0-.68-.02-1.02-.06C3.44 20.29 5.7 21 8.12 21 16 21 20.33 14.46 20.33 8.79c0-.19 0-.37-.01-.56.84-.6 1.56-1.36 2.14-2.23z" />
                </svg>
              </a>
              <a
                href="#social-github"
                aria-label="GitHub (Placeholder)"
                title="GitHub (Placeholder)"
                className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-[#263449] bg-[#162235]/60 text-slate-300 transition-colors hover:border-[#7C3AED] hover:text-white focus-visible:outline-2 focus-visible:outline-[#7C3AED]"
              >
                <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                  <path d="M12 2A10 10 0 0 0 2 12c0 4.42 2.87 8.17 6.84 9.5.5.08.66-.23.66-.5v-1.69c-2.77.6-3.36-1.34-3.36-1.34-.46-1.16-1.11-1.47-1.11-1.47-.91-.62.07-.6.07-.6 1 .07 1.53 1.03 1.53 1.03.87 1.52 2.34 1.07 2.91.83.09-.65.35-1.09.63-1.34-2.22-.25-4.55-1.11-4.55-4.92 0-1.11.38-2 1.03-2.71-.1-.25-.45-1.29.1-2.64 0 0 .84-.27 2.75 1.02.79-.22 1.65-.33 2.5-.33.85 0 1.71.11 2.5.33 1.91-1.29 2.75-1.02 2.75-1.02.55 1.35.2 2.39.1 2.64.65.71 1.03 1.6 1.03 2.71 0 3.82-2.34 4.66-4.57 4.91.36.31.69.92.69 1.85V21c0 .27.16.59.67.5C19.14 20.16 22 16.42 22 12A10 10 0 0 0 12 2z" />
                </svg>
              </a>
            </div>
          </div>

          <div className="lg:col-span-2">
            <h3 className="text-xs font-semibold tracking-wide text-white">{t.footer.product}</h3>
            <ul className="mt-3 space-y-2 text-xs text-slate-400">
              <li>
                <a href="#features" className="hover:text-white">
                  {t.nav.features}
                </a>
              </li>
              <li>
                <a href="#pricing" className="hover:text-white">
                  {t.nav.pricing}
                </a>
              </li>
              <li>
                <a href="#security" className="hover:text-white">
                  {t.nav.security}
                </a>
              </li>
            </ul>
          </div>

          <div className="lg:col-span-2">
            <h3 className="text-xs font-semibold tracking-wide text-white">{t.footer.company}</h3>
            <ul className="mt-3 space-y-2 text-xs text-slate-400">
              <li>
                <a href="#how-it-works" className="hover:text-white">
                  {t.footer.about}
                </a>
              </li>
              <li>
                <button
                  type="button"
                  onClick={() => setContactModalOpen(true)}
                  className="hover:text-white"
                >
                  {t.footer.contact}
                </button>
              </li>
              <li>
                <button
                  type="button"
                  onClick={handleInstallAction}
                  className="hover:text-white"
                >
                  {t.nav.installApp}
                </button>
              </li>
            </ul>
          </div>

          <div className="lg:col-span-3">
            <h3 className="text-xs font-semibold tracking-wide text-white">{t.footer.legal}</h3>
            <ul className="mt-3 space-y-2 text-xs text-slate-400">
              <li>
                <a href="#security" className="hover:text-white">
                  {t.footer.terms}
                </a>
              </li>
              <li>
                <a href="#security" className="hover:text-white">
                  {t.footer.privacy}
                </a>
              </li>
              <li>
                <a href="#security" className="hover:text-white">
                  {t.footer.cookies}
                </a>
              </li>
            </ul>
          </div>
        </div>

        <div className="border-t border-[#263449]">
          <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-2 px-4 py-4 text-xs text-slate-400 sm:flex-row sm:px-6 lg:px-8">
            <p>{t.footer.copyright}</p>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setShortcutsModalOpen(true)}
                title={`${t.footer.shortcutsButton} (?)`}
                className="inline-flex items-center gap-1.5 rounded-lg border border-[#263449] px-2.5 py-1 text-xs text-slate-200 transition-colors hover:bg-[#162235]"
              >
                <Keyboard className="h-3.5 w-3.5 text-[#7C3AED]" />
                <span>{t.footer.shortcutsButton}</span>
                <kbd className="rounded border border-[#334155] bg-[#0F1724] px-1 font-mono text-[10px] text-slate-400">
                  ?
                </kbd>
              </button>
              <button
                type="button"
                onClick={() => setLocale((l) => (l === 'en' ? 'rw' : 'en'))}
                className="inline-flex items-center gap-1.5 rounded-lg border border-[#263449] px-2.5 py-1 text-xs text-slate-200 hover:bg-[#162235]"
              >
                <Globe className="h-3.5 w-3.5 text-[#7C3AED]" />
                <span>{t.language[locale]}</span>
              </button>
            </div>
          </div>
        </div>
      </footer>

      {/* Offline Banner */}
      {!isOnline && (
        <div
          role="status"
          className="fixed bottom-4 left-4 right-4 z-50 mx-auto flex max-w-lg items-center gap-2.5 rounded-xl border border-amber-400/50 bg-amber-600 px-4 py-2.5 text-xs font-medium text-white shadow-lg sm:right-auto"
        >
          <WifiOff className="h-4 w-4 shrink-0" />
          <span>{t.offlineBanner}</span>
        </div>
      )}

      {/* PWA Installation Modal */}
      <InstallModal
        open={installModalOpen}
        onClose={() => setInstallModalOpen(false)}
        locale={locale}
        platform={pwa.platform}
        canNativePrompt={pwa.canNativePrompt}
        isInstalled={pwa.isInstalled}
        status={pwa.status}
        onInstall={pwa.triggerInstall}
      />

      {/* Authentication Placeholder Modal */}
      <AuthPlaceholderModal
        mode={authModalMode}
        onSwitchMode={setAuthModalMode}
        onClose={() => setAuthModalMode(null)}
        onLoginSuccess={(loggedInUser) => {
          setAuthenticatedUser(loggedInUser);
          setAuthModalMode(null);
        }}
        locale={locale}
      />
      {/* Contact Us Support Modal */}
      <ContactUs
        open={contactModalOpen}
        onClose={() => setContactModalOpen(false)}
        locale={locale}
      />

      {/* Keyboard Shortcuts Help Modal */}
      <KeyboardShortcutsModal
        open={shortcutsModalOpen}
        onClose={() => setShortcutsModalOpen(false)}
        locale={locale}
      />
    </div>
  );
}
