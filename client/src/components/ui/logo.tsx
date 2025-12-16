import React from 'react';
import { cn } from '@/lib/utils';

interface LogoProps extends React.SVGProps<SVGSVGElement> {
  className?: string;
}

export const Logo = ({ className, ...props }: LogoProps) => {
  // Common Gradients & Filters
  const defs = (
    <defs>
      <linearGradient id="primary-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#2563eb" /> {/* blue-600 */}
        <stop offset="100%" stopColor="#9333ea" /> {/* purple-600 */}
      </linearGradient>
      <linearGradient id="accent-gradient" x1="100%" y1="0%" x2="0%" y2="100%">
        <stop offset="0%" stopColor="#6366f1" /> {/* indigo-500 */}
        <stop offset="100%" stopColor="#2563eb" /> {/* blue-600 */}
      </linearGradient>
    </defs>
  );

  return (
    <svg
      viewBox="0 0 40 40"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={cn('h-8 w-8', className)}
      {...props}
    >
      {defs}
      {/* Top bar - shortest */}
      <path d="M8 8H24C28.4183 8 32 11.5817 32 16V16H14L8 8Z" fill="url(#primary-gradient)" />
      {/* Middle bar - medium */}
      <path
        d="M8 18H28C30.2091 18 32 19.7909 32 22V22C32 24.2091 30.2091 26 28 26H8V18Z"
        fill="url(#accent-gradient)"
      />
      {/* Bottom stem - fast trail */}
      <path d="M8 28H18L14 36H8V28Z" fill="url(#primary-gradient)" />
    </svg>
  );
};
