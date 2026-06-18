import React from 'react';

interface CardProps {
  children: React.ReactNode;
  className?: string;
  hoverable?: boolean;
}

export function Card({ children, className = '', hoverable = false }: CardProps) {
  return (
    <div className={`glass-panel ${hoverable ? 'glass-panel-hover' : ''} ${className}`}>
      {children}
    </div>
  );
}

export function CardHeader({ children, className = '' }: { children: React.ReactNode, className?: string }) {
  return (
    <div className={`p-4 border-b border-white/5 ${className}`} style={{ padding: '1.25rem', borderBottom: '1px solid var(--bg-glass-border)' }}>
      {children}
    </div>
  );
}

export function CardContent({ children, className = '' }: { children: React.ReactNode, className?: string }) {
  return (
    <div className={`p-4 ${className}`} style={{ padding: '1.25rem' }}>
      {children}
    </div>
  );
}
