import React from 'react';

interface PageEntranceProps {
  children: React.ReactNode;
  className?: string;
}

export function PageEntrance({ children, className = '' }: PageEntranceProps) {
  return (
    <div className={`animate-fade-in-up ${className}`}>
      {children}
    </div>
  );
}
