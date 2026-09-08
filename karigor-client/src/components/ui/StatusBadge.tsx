import React from 'react';
import { cn } from '../../lib/utils';

export interface StatusBadgeProps {
  status: string;
  label?: React.ReactNode;
  pulse?: boolean;
  className?: string;
  size?: 'sm' | 'md';
}

export function getStatusTheme(status: string) {
  const norm = (status || '').toLowerCase().replace(/[\s_-]+/g, '');

  switch (norm) {
    // 1. Amber: Open / Pending / Requested
    case 'open':
    case 'pending':
    case 'requested':
    case 'new':
      return {
        badge: 'bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border border-amber-200/80 dark:border-amber-800/60',
        dot: 'bg-amber-500 dark:bg-amber-400',
      };

    // 2. Blue: InProgress / Active / Scheduled / Confirmed / Countered
    case 'inprogress':
    case 'active':
    case 'scheduled':
    case 'confirmed':
    case 'contacted':
    case 'customercounteroffered':
    case 'countered':
      return {
        badge: 'bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border border-blue-200/80 dark:border-blue-800/60',
        dot: 'bg-blue-500 dark:bg-blue-400',
      };

    // 3. Emerald: Completed / Resolved / Approved / Verified / Accepted
    case 'completed':
    case 'resolved':
    case 'approved':
    case 'verified':
    case 'accepted':
    case 'finished':
      return {
        badge: 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200/80 dark:border-emerald-800/60',
        dot: 'bg-emerald-500 dark:bg-emerald-400',
      };

    // 4. Rose: Cancelled / Rejected / Terminated / Escalated
    case 'cancelled':
    case 'canceled':
    case 'rejected':
    case 'terminated':
    case 'escalated':
    case 'failed':
      return {
        badge: 'bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border border-rose-200/80 dark:border-rose-800/60',
        dot: 'bg-rose-500 dark:bg-rose-400',
      };

    // 5. Default / Neutral
    default:
      return {
        badge: 'bg-gray-100 dark:bg-gray-800/80 text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-gray-700',
        dot: 'bg-gray-400 dark:bg-gray-500',
      };
  }
}

export function StatusBadge({
  status,
  label,
  pulse = false,
  className = '',
  size = 'sm',
}: StatusBadgeProps) {
  const theme = getStatusTheme(status);
  const displayLabel = label !== undefined ? label : status;
  const sizeClasses = size === 'md' ? 'px-3 py-1 text-xs' : 'px-2.5 py-0.5 text-xs';

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 font-bold rounded-full select-none transition-colors duration-150',
        theme.badge,
        sizeClasses,
        className
      )}
    >
      <span
        className={cn(
          'w-1.5 h-1.5 rounded-full shrink-0',
          theme.dot,
          pulse && 'animate-pulse'
        )}
      />
      <span>{displayLabel}</span>
    </span>
  );
}
