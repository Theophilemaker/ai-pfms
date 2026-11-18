import { useEffect } from 'react';
import { Download, Monitor, ShieldCheck, Smartphone, X } from 'lucide-react';
import type { DevicePlatform, InstallStatus } from '../hooks/usePWAInstall';
import type { Locale } from '../i18n/translations';
import { translations } from '../i18n/translations';

interface InstallModalProps {
  open: boolean;
  onClose: () => void;
  locale: Locale;
  platform: DevicePlatform;
  canNativePrompt: boolean;
  isInstalled: boolean;
  status: InstallStatus;
  onInstall: () => Promise<unknown>;
}

export function InstallModal({
  open,
  onClose,
  locale,
  platform,
  canNativePrompt,
  isInstalled,
  status,
  onInstall,
}: InstallModalProps) {
  const t = translations[locale].installModal;

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  const manualSteps =
    platform === 'ios'
      ? t.stepsIos
      : platform === 'android'
        ? t.stepsAndroid
        : t.stepsDesktop;

  const statusText = isInstalled
    ? t.statusInstalled
    : canNativePrompt
      ? t.statusAvailable
      : status === 'cancelled'
        ? t.statusCancelled
        : status === 'error'
          ? t.statusError
          : null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-xs"
      role="dialog"
      aria-modal="true"
      aria-labelledby="install-modal-title"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl dark:border-[#263449] dark:bg-[#0B1220]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <img
              src="/assets/icons/icon.svg"
              alt="AI-PFMS"
              className="h-10 w-10 rounded-xl"
              width={40}
              height={40}
            />
            <div>
              <p className="text-xs font-semibold tracking-wide text-[#7C3AED]">AI-PFMS</p>
              <h2
                id="install-modal-title"
                className="font-display text-lg font-bold text-slate-900 dark:text-slate-50"
              >
                {t.title}
              </h2>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={t.close}
            className="rounded-lg p-1.5 text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900 focus-visible:outline-2 focus-visible:outline-[#7C3AED] dark:text-slate-400 dark:hover:bg-[#162235] dark:hover:text-white"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <p className="mt-4 text-sm leading-relaxed text-slate-600 dark:text-slate-300">
          {t.subtitle}
        </p>

        {statusText && (
          <div className="mt-4 rounded-xl border border-violet-200 bg-violet-50 px-3.5 py-2.5 text-xs font-medium text-violet-900 dark:border-violet-500/30 dark:bg-violet-950/40 dark:text-violet-200">
            {statusText}
          </div>
        )}

        {!isInstalled && canNativePrompt && (
          <div className="mt-5 flex flex-col gap-2.5 sm:flex-row">
            <button
              type="button"
              onClick={onInstall}
              className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-[#7C3AED] px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#6D28D9] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7C3AED]"
            >
              <Download className="h-4 w-4" />
              {t.installNow}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="inline-flex flex-1 items-center justify-center rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50 dark:border-[#263449] dark:text-slate-200 dark:hover:bg-[#162235]"
            >
              {t.maybeLater}
            </button>
          </div>
        )}

        {!isInstalled && !canNativePrompt && (
          <div className="mt-5 rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-[#263449] dark:bg-[#162235]/60">
            <div className="flex items-center gap-2 text-xs font-semibold text-slate-800 dark:text-slate-100">
              {platform === 'desktop' ? (
                <Monitor className="h-4 w-4 text-[#7C3AED]" />
              ) : (
                <Smartphone className="h-4 w-4 text-[#7C3AED]" />
              )}
              <span>{t.manualHeading}</span>
            </div>
            <ol className="mt-3 space-y-2 text-xs leading-relaxed text-slate-600 dark:text-slate-300">
              {manualSteps.map((step, i) => (
                <li key={i} className="flex gap-2">
                  <span className="font-mono-num font-semibold text-[#7C3AED]">{i + 1}.</span>
                  <span>{step}</span>
                </li>
              ))}
            </ol>
            <button
              type="button"
              onClick={onClose}
              className="mt-4 w-full rounded-xl border border-slate-200 bg-white py-2 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-100 dark:border-[#263449] dark:bg-[#0B1220] dark:text-slate-200 dark:hover:bg-[#162235]"
            >
              {t.close}
            </button>
          </div>
        )}

        <div className="mt-5 flex items-center gap-2 border-t border-slate-200 pt-4 text-xs text-slate-500 dark:border-[#263449] dark:text-slate-400">
          <ShieldCheck className="h-4 w-4 shrink-0 text-[#7C3AED]" />
          <span>{t.footerNote}</span>
        </div>
      </div>
    </div>
  );
}
