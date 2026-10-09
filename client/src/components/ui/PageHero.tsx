import { ReactNode } from 'react';

interface PageHeroProps {
  title: string;
  description?: string;
  id?: string;
  children?: ReactNode;
}

/** A consistent, compact route header for pages outside the visual home hero. */
export function PageHero({ title, description, id, children }: PageHeroProps) {
  const headingId = id ?? 'page-heading';

  return (
    <section
      className="relative isolate overflow-hidden bg-[#421015] text-white"
      aria-labelledby={headingId}
    >
      <div className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_85%_20%,rgba(139,29,36,0.9),transparent_34%),linear-gradient(115deg,#2d0c10_0%,#421015_58%,#58151b_100%)]" />
      <div className="container py-14 sm:py-18 lg:py-22">
        <div className="max-w-3xl">
          <span className="mb-4 block h-1 w-12 bg-brand-red" aria-hidden="true" />
          <h1 id={headingId} className="text-4xl font-black tracking-tight text-white sm:text-5xl lg:text-6xl">
            {title}
          </h1>
          {description && (
            <p className="mt-5 max-w-2xl text-base leading-relaxed text-white/80 sm:text-lg">
              {description}
            </p>
          )}
          {children}
        </div>
      </div>
    </section>
  );
}
