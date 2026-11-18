import { Keyboard, X } from 'lucide-react';
import { translations, type Locale } from '../i18n/translations';

interface KeyboardShortcutsModalProps {
  open: boolean;
  onClose: () => void;
  locale: Locale;
}

export function KeyboardShortcutsModal({
  open,
  onClose,
  locale,
}: KeyboardShortcutsModalProps) {
  if (!open) return null;

  const t = translations[locale].shortcutsModal;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-xs"
      role="dialog"
      aria-modal="true"
      aria-labelledby="shortcuts-modal-title"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl dark:border-[#263449] dark:bg-[#0B1220]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-violet-100 text-[#7C3AED] dark:bg-violet-950/60">
              <Keyboard className="h-5 w-5" />
            </div>
            <div>
              <h2
                id="shortcuts-modal-title"
                className="font-display text-lg font-bold text-slate-900 dark:text-slate-50"
              >
                {t.title}
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">{t.subtitle}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={t.close}
            className="rounded-lg p-1.5 text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-[#162235] dark:hover:text-white"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <ul className="mt-5 divide-y divide-slate-100 rounded-xl border border-slate-200 bg-slate-50/70 dark:divide-[#263449] dark:border-[#263449] dark:bg-[#162235]/50">
          {t.items.map((item) => (
            <li
              key={item.desc}
              className="flex items-center justify-between gap-3 px-3.5 py-2.5 text-xs"
            >
              <span className="text-slate-700 dark:text-slate-200">{item.desc}</span>
              <span className="flex shrink-0 items-center gap-1">
                {item.keys.map((keyLabel) => (
                  <kbd
                    key={keyLabel}
                    className="rounded-md border border-slate-300 bg-white px-2 py-0.5 font-mono text-[11px] font-semibold text-slate-800 shadow-2xs dark:border-[#334155] dark:bg-[#0B1220] dark:text-slate-100"
                  >
                    {keyLabel}
                  </kbd>
                ))}
              </span>
            </li>
          ))}
        </ul>

        <div className="mt-4 flex items-center justify-between gap-3">
          <p className="text-[11px] text-slate-500 dark:text-slate-400">{t.note}</p>
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 rounded-xl bg-[#7C3AED] px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-[#6D28D9]"
          >
            {t.close}
          </button>
        </div>
      </div>
    </div>
  );
}
