import { useEffect, useState } from 'react';
import { signInWithPopup } from 'firebase/auth';
import { Loader2, Lock, ShieldCheck, X } from 'lucide-react';
import type { Locale } from '../i18n/translations';
import { translations } from '../i18n/translations';
import { auth, googleAuthProvider } from '../lib/firebase';

export type AuthMode = 'login' | 'register';

interface AuthPlaceholderModalProps {
  mode: AuthMode | null;
  onSwitchMode: (mode: AuthMode) => void;
  onClose: () => void;
  onLoginSuccess: () => void;
  locale: Locale;
}

export function AuthPlaceholderModal({
  mode,
  onSwitchMode,
  onClose,
  onLoginSuccess,
  locale,
}: AuthPlaceholderModalProps) {
  const t = translations[locale].authModal;
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    setErrorMessage(null);
    setSubmitting(false);
  }, [mode]);

  useEffect(() => {
    if (!mode) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !submitting) onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [mode, submitting, onClose]);

  if (!mode) return null;

  const isRegister = mode === 'register';

  const handleGoogleSignIn = async () => {
    setSubmitting(true);
    setErrorMessage(null);
    try {
      await signInWithPopup(auth, googleAuthProvider);
      onLoginSuccess();
    } catch (err) {
      const code =
        typeof err === 'object' && err !== null && 'code' in err
          ? String((err as { code?: string }).code)
          : '';
      if (code === 'auth/popup-closed-by-user' || code === 'auth/cancelled-popup-request') {
        setErrorMessage(t.authErrorGeneric);
      } else {
        setErrorMessage(t.authErrorGeneric);
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-xs"
      role="dialog"
      aria-modal="true"
      aria-labelledby="auth-modal-title"
      onClick={() => {
        if (!submitting) onClose();
      }}
    >
      <div
        className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl dark:border-[#263449] dark:bg-[#0B1220]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-100 text-[#7C3AED] dark:bg-violet-950/60">
              <Lock className="h-5 w-5" />
            </div>
            <div>
              <h2
                id="auth-modal-title"
                className="font-display text-lg font-bold text-slate-900 dark:text-slate-50"
              >
                {isRegister ? t.registerTitle : t.loginTitle}
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">AI-PFMS</p>
            </div>
          </div>
          <button
            type="button"
            disabled={submitting}
            onClick={onClose}
            aria-label={t.close}
            className="rounded-lg p-1.5 text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900 disabled:opacity-50 dark:text-slate-400 dark:hover:bg-[#162235] dark:hover:text-white"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <p className="mt-3 text-xs leading-relaxed text-slate-600 dark:text-slate-300">
          {isRegister ? t.registerDesc : t.loginDesc}
        </p>

        <div className="mt-6 space-y-4">
          {errorMessage && (
            <div
              role="alert"
              className="rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-2.5 text-xs font-medium text-rose-700 dark:border-rose-500/30 dark:bg-rose-950/40 dark:text-rose-300"
            >
              {errorMessage}
            </div>
          )}

          <button
            type="button"
            disabled={submitting}
            onClick={() => void handleGoogleSignIn()}
            className="flex w-full items-center justify-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-800 shadow-xs transition-colors hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7C3AED] disabled:cursor-not-allowed disabled:opacity-60 dark:border-[#263449] dark:bg-[#162235] dark:text-white dark:hover:bg-[#1E2D45]"
          >
            {submitting ? (
              <Loader2 className="h-4 w-4 animate-spin text-[#7C3AED]" />
            ) : (
              <svg className="h-4 w-4 shrink-0" viewBox="0 0 24 24" aria-hidden="true">
                <path
                  fill="#4285F4"
                  d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.17Z"
                />
                <path
                  fill="#34A853"
                  d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.11-6.72-4.96H1.29v3.14C3.26 21.3 7.31 24 12 24Z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.28 14.24c-.24-.72-.38-1.49-.38-2.24s.14-1.52.38-2.24V6.62H1.29C.47 8.24 0 10.06 0 12s.47 3.76 1.29 5.38l3.99-3.14Z"
                />
                <path
                  fill="#EA4335"
                  d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.31 0 3.26 2.7 1.29 6.62l3.99 3.14c.95-2.85 3.6-4.96 6.72-4.96Z"
                />
              </svg>
            )}
            <span>{submitting ? t.signingIn : t.googleButton}</span>
          </button>

          <div className="flex items-center gap-2 rounded-xl border border-slate-100 bg-slate-50/80 px-3 py-2 text-[11px] text-slate-500 dark:border-[#263449] dark:bg-[#162235]/60 dark:text-slate-400">
            <ShieldCheck className="h-4 w-4 shrink-0 text-[#16A34A]" />
            <span>{t.securityNotice}</span>
          </div>
        </div>

        <div className="mt-5 text-center">
          <button
            type="button"
            disabled={submitting}
            onClick={() => onSwitchMode(isRegister ? 'login' : 'register')}
            className="text-xs font-medium text-[#7C3AED] hover:underline disabled:opacity-50"
          >
            {isRegister ? t.switchToLogin : t.switchToRegister}
          </button>
        </div>
      </div>
    </div>
  );
}
