import { useEffect, useState } from 'react';
import { CheckCircle2, LifeBuoy, Mail, Send, X } from 'lucide-react';
import { translations, type Locale } from '../i18n/translations';

interface ContactUsProps {
  open: boolean;
  onClose: () => void;
  locale: Locale;
}

interface SubmittedTicket {
  reference: string;
  name: string;
  email: string;
  topic: string;
  subject: string;
}

export function ContactUs({ open, onClose, locale }: ContactUsProps) {
  const t = translations[locale].contactModal;

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [topic, setTopic] = useState<string>(t.topics[0]);
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submittedTicket, setSubmittedTicket] = useState<SubmittedTicket | null>(null);

  useEffect(() => {
    setTopic(t.topics[0]);
  }, [locale]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  const resetForm = () => {
    setName('');
    setEmail('');
    setTopic(t.topics[0]);
    setSubject('');
    setMessage('');
    setError(null);
    setSubmittedTicket(null);
  };

  const handleClose = () => {
    setError(null);
    onClose();
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanName = name.trim();
    const cleanEmail = email.trim();
    const cleanSubject = subject.trim();
    const cleanMessage = message.trim();
    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (
      !cleanName ||
      !emailPattern.test(cleanEmail) ||
      !cleanSubject ||
      cleanMessage.length < 10
    ) {
      setError(t.errorValidation);
      return;
    }

    const code = Math.floor(1000 + Math.random() * 9000);
    setError(null);
    setSubmittedTicket({
      reference: `SUP-2026-${code}`,
      name: cleanName,
      email: cleanEmail,
      topic,
      subject: cleanSubject,
    });
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-xs"
      role="dialog"
      aria-modal="true"
      aria-labelledby="contact-us-modal-title"
      onClick={handleClose}
    >
      <div
        className="max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl dark:border-[#263449] dark:bg-[#0B1220]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-violet-100 text-[#7C3AED] dark:bg-violet-950/60">
              <LifeBuoy className="h-5 w-5" />
            </div>
            <div>
              <h2
                id="contact-us-modal-title"
                className="font-display text-lg font-bold text-slate-900 dark:text-slate-50"
              >
                {t.title}
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">{t.subtitle}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleClose}
            aria-label={t.close}
            className="rounded-lg p-1.5 text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-[#162235] dark:hover:text-white"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {submittedTicket ? (
          <div className="mt-6 space-y-5">
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50/80 p-5 text-center dark:border-emerald-500/30 dark:bg-emerald-950/30">
              <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-full bg-emerald-100 text-[#16A34A] dark:bg-emerald-900/50">
                <CheckCircle2 className="h-6 w-6" />
              </div>
              <h3 className="font-display mt-3 text-base font-bold text-slate-900 dark:text-white">
                {t.successTitle}
              </h3>
              <p className="mt-1 text-xs leading-relaxed text-slate-600 dark:text-slate-300">
                {t.successDesc}
              </p>

              <div className="mt-4 space-y-2 rounded-xl border border-emerald-200/80 bg-white p-3.5 text-left text-xs dark:border-[#263449] dark:bg-[#0B1220]">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-slate-500 dark:text-slate-400">{t.ticketLabel}</span>
                  <span className="font-mono-num font-bold text-[#7C3AED]">
                    {submittedTicket.reference}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-slate-500 dark:text-slate-400">
                    {t.topicSummaryLabel}
                  </span>
                  <span className="font-semibold text-slate-800 dark:text-slate-100">
                    {submittedTicket.topic}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-slate-500 dark:text-slate-400">
                    {t.replyEmailLabel}
                  </span>
                  <span className="truncate font-medium text-slate-800 dark:text-slate-100">
                    {submittedTicket.email}
                  </span>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={resetForm}
                className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-50 dark:border-[#263449] dark:text-slate-200 dark:hover:bg-[#162235]"
              >
                {t.sendAnother}
              </button>
              <button
                type="button"
                onClick={handleClose}
                className="rounded-xl bg-[#7C3AED] px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-[#6D28D9]"
              >
                {t.close}
              </button>
            </div>
          </div>
        ) : (
          <form className="mt-5 space-y-4" onSubmit={handleSubmit} noValidate>
            {error && (
              <div
                role="alert"
                className="rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-2.5 text-xs font-medium text-rose-700 dark:border-rose-500/30 dark:bg-rose-950/40 dark:text-rose-300"
              >
                {error}
              </div>
            )}

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label
                  htmlFor="contact-name"
                  className="block text-xs font-medium text-slate-700 dark:text-slate-200"
                >
                  {t.nameLabel}
                </label>
                <input
                  id="contact-name"
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder={t.namePlaceholder}
                  className="mt-1.5 w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-[#7C3AED] focus:bg-white focus:outline-none dark:border-[#263449] dark:bg-[#162235] dark:text-slate-50 dark:focus:bg-[#0B1220]"
                />
              </div>

              <div>
                <label
                  htmlFor="contact-email"
                  className="block text-xs font-medium text-slate-700 dark:text-slate-200"
                >
                  {t.emailLabel}
                </label>
                <input
                  id="contact-email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder={t.emailPlaceholder}
                  className="mt-1.5 w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-[#7C3AED] focus:bg-white focus:outline-none dark:border-[#263449] dark:bg-[#162235] dark:text-slate-50 dark:focus:bg-[#0B1220]"
                />
              </div>
            </div>

            <div>
              <label
                htmlFor="contact-topic"
                className="block text-xs font-medium text-slate-700 dark:text-slate-200"
              >
                {t.topicLabel}
              </label>
              <select
                id="contact-topic"
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                className="mt-1.5 w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-sm text-slate-900 focus:border-[#7C3AED] focus:bg-white focus:outline-none dark:border-[#263449] dark:bg-[#162235] dark:text-slate-50 dark:focus:bg-[#0B1220]"
              >
                {t.topics.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label
                htmlFor="contact-subject"
                className="block text-xs font-medium text-slate-700 dark:text-slate-200"
              >
                {t.subjectLabel}
              </label>
              <input
                id="contact-subject"
                type="text"
                required
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder={t.subjectPlaceholder}
                className="mt-1.5 w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-[#7C3AED] focus:bg-white focus:outline-none dark:border-[#263449] dark:bg-[#162235] dark:text-slate-50 dark:focus:bg-[#0B1220]"
              />
            </div>

            <div>
              <label
                htmlFor="contact-message"
                className="block text-xs font-medium text-slate-700 dark:text-slate-200"
              >
                {t.messageLabel}
              </label>
              <textarea
                id="contact-message"
                rows={4}
                required
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder={t.messagePlaceholder}
                className="mt-1.5 w-full resize-y rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-[#7C3AED] focus:bg-white focus:outline-none dark:border-[#263449] dark:bg-[#162235] dark:text-slate-50 dark:focus:bg-[#0B1220]"
              />
            </div>

            <div className="flex flex-col-reverse items-stretch justify-between gap-3 border-t border-slate-100 pt-4 sm:flex-row sm:items-center dark:border-[#263449]">
              <span className="inline-flex items-center gap-1.5 text-[11px] text-slate-500 dark:text-slate-400">
                <Mail className="h-3.5 w-3.5 shrink-0 text-[#7C3AED]" />
                <span>{t.supportNote}</span>
              </span>
              <div className="flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={handleClose}
                  className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-50 dark:border-[#263449] dark:text-slate-200 dark:hover:bg-[#162235]"
                >
                  {t.cancel}
                </button>
                <button
                  type="submit"
                  className="inline-flex items-center gap-1.5 rounded-xl bg-[#7C3AED] px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-[#6D28D9] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7C3AED]"
                >
                  <Send className="h-3.5 w-3.5" />
                  <span>{t.submit}</span>
                </button>
              </div>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
