import type { ReactNode } from 'react';

type CardProps = {
  children: ReactNode;
  className?: string;
};

export function Card({ children, className = '' }: CardProps) {
  return (
    <article
      className={`rounded-[14px] border border-neovantas-line bg-white shadow-panel transition-shadow duration-200 ${className}`}
    >
      {children}
    </article>
  );
}
