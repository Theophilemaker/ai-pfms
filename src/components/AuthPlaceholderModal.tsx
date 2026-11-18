import { useEffect, useState } from 'react';
import { Lock, X } from 'lucide-react';
import type { Locale } from '../i18n/translations';
import { translations } from '../i18n/translations';

export type AuthMode = 'login' | 'register';

interface AuthPlaceholderModalProps {
  mode: AuthMode | null;
  onSwitchMode: (mode: AuthMode) => void;
  onClose: () => void;
  onLoginSuccess: (user: { name: string; email: string; isNewUser?: boolean }) => void;
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
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  useEffect(() => {
    setPassword('');
  }, [mode]);

  useEffect(() => {
    if (!mode) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [mode, onClose]);

  if (!mode) return null;

  const isRegister = mode === 'register';

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanEmail = email.trim() || 'member@aipfms.local';
    const derivedName =
      fullName.trim() ||
      cleanEmail
        .split('@')[0]
        .replace(/[._-]+/g, ' ')
        .replace(/\b\w/g, (c) => c.toUpperCase());

    onLoginSuccess({
      name: derivedName,
      email: cleanEmail,
      isNewUser: isRegister,
    });
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-xs"
      role="dialog"
      aria-modal="true"
      aria-labelledby="auth-modal-title"
      onClick={onClose}
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
            onClick={onClose}
            aria-label={t.close}
            className="rounded-lg p-1.5 text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-[#162235] dark:hover:text-white"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <p className="mt-3 text-xs leading-relaxed text-slate-600 dark:text-slate-300">
          {isRegister ? t.registerDesc : t.loginDesc}
        </p>

        <form className="mt-5 space-y-4" onSubmit={handleSubmit}>
          {isRegister && (
            <div>
              <label
                htmlFor="auth-fullname"
                className="block text-xs font-medium text-slate-700 dark:text-slate-200"
              >
                {t.fullNameLabel}
              </label>
              <input
                id="auth-fullname"
                type="text"
                required
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="John Doe"
                className="mt-1.5 w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-[#7C3AED] focus:outline-none dark:border-[#263449] dark:bg-[#162235] dark:text-slate-50"
              />
            </div>
          )}

          <div>
            <label
              htmlFor="auth-email"
              className="block text-xs font-medium text-slate-700 dark:text-slate-200"
            >
              {t.emailLabel}
            </label>
            <input
              id="auth-email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="name@example.com"
              className="mt-1.5 w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-[#7C3AED] focus:outline-none dark:border-[#263449] dark:bg-[#162235] dark:text-slate-50"
            />
          </div>

          <div>
            <label
              htmlFor="auth-password"
              className="block text-xs font-medium text-slate-700 dark:text-slate-200"
            >
              {t.passwordLabel}
            </label>
            <input
              id="auth-password"
              type="password"
              required
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••••••"
              className="mt-1.5 w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-[#7C3AED] focus:outline-none dark:border-[#263449] dark:bg-[#162235] dark:text-slate-50"
            />
          </div>

          <p className="text-[11px] text-slate-500 dark:text-slate-400">
            {t.placeholderNotice}
          </p>

          <button
            type="submit"
            className="w-full rounded-xl bg-[#7C3AED] px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#6D28D9] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7C3AED]"
          >
            {isRegister ? t.submitRegister : t.submitLogin}
          </button>
        </form>

        <div className="mt-4 text-center">
          <button
            type="button"
            onClick={() => onSwitchMode(isRegister ? 'login' : 'register')}
            className="text-xs font-medium text-[#7C3AED] hover:underline"
          >
            {isRegister ? t.switchToLogin : t.switchToRegister}
          </button>
        </div>
      </div>
    </div>
  );
}
