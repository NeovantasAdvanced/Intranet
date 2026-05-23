import type { ReactNode } from 'react';

type CardProps = {
  children: ReactNode;
  className?: string;
};

export function Card({ children, className = '' }: CardProps) {
  return (
    <article className={`rounded-lg border border-slate-200 bg-white shadow-panel ${className}`}>
      {children}
    </article>
  );
}
