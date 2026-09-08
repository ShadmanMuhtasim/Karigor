import React from 'react';
import { cn } from '../../lib/utils';

export function Card({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("rounded-xl border border-gray-800 bg-gray-900 shadow-sm", className)}>
      {children}
    </div>
  );
}

export function CardHeader({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <div className={cn("p-5 pb-2", className)}>{children}</div>;
}

export function CardTitle({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <h3 className={cn("text-base font-semibold text-gray-900 dark:text-white", className)}>{children}</h3>;
}

export function CardContent({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <div className={cn("p-5 pt-2", className)}>{children}</div>;
}
