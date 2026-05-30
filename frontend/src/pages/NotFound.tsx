import { Link } from 'react-router-dom';
import { t } from '@/lib/i18n';

export function NotFound() {
  return (
    <div className="mx-auto flex min-h-[calc(100svh-13rem)] max-w-md flex-col items-center justify-center text-center">
      <section className="rise space-y-3">
        {/* "404" stays a quiet mono marker at eyebrow scale — the moss digit
            echoes the wordmark's accent dot — so the page leads with the same
            display title scale as every other page rather than a giant numeral. */}
        <p className="eyebrow">
          4<span className="text-moss">0</span>4 · {t('notFound.eyebrow')}
        </p>
        <h1 className="font-display text-4xl leading-[1.05] tracking-tight sm:text-5xl">
          {t('notFound.title')}
        </h1>
        <p className="mx-auto max-w-sm text-[0.95rem] leading-relaxed text-ink-soft">
          {t('notFound.subtitle')}
        </p>
      </section>

      <Link
        to="/"
        className="rise group mt-8 inline-flex items-center gap-2 text-sm font-medium text-moss-deep"
        style={{ animationDelay: '120ms' }}
      >
        <span className="border-b border-moss/40 pb-0.5 transition-colors group-hover:border-moss">
          {t('notFound.back')}
        </span>
        <span
          aria-hidden
          className="transition-transform duration-200 group-hover:translate-x-1"
        >
          →
        </span>
      </Link>
    </div>
  );
}
