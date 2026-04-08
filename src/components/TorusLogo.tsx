import React from 'react';

export const TorusLogo: React.FC<{ className?: string }> = ({ className }) => (
  <svg className={`${className || ''} logo-spin`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10" />
    <ellipse cx="12" cy="12" rx="10" ry="4" />
    <ellipse cx="12" cy="12" rx="4" ry="10" />
  </svg>
);
