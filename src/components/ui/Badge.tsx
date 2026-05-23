import type { StatusTone } from '../../types/content';

type BadgeProps = {
  children: string;
  tone?: StatusTone;
  className?: string;
};

const toneClasses: Record<StatusTone, string> = {
  success: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  warning: 'border-amber-200 bg-amber-50 text-amber-700',
  info: 'border-sky-200 bg-sky-50 text-sky-700',
  neutral: 'border-slate-200 bg-slate-50 text-slate-700',
  critical: 'border-rose-200 bg-rose-50 text-rose-700',
};

export function Badge({ children, tone = 'neutral', className = '' }: BadgeProps) {
  return (
    <span
      className={`inline-flex min-h-6 items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold leading-none ${toneClasses[tone]} ${className}`}
    >
      {children}
    </span>
  );
}
