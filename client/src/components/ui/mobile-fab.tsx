import { ButtonHTMLAttributes, forwardRef } from 'react';
import { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

interface MobileFABProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  icon: LucideIcon;
  label: string;
  className?: string;
}

const MobileFAB = forwardRef<HTMLButtonElement, MobileFABProps>(
  ({ icon: Icon, label, className, ...props }, ref) => {
    return (
      <button
        ref={ref}
        className={cn(
          "mobile-fab",
          "flex items-center gap-3 px-4 py-3 rounded-full shadow-lg",
          "font-medium text-sm transition-all duration-300",
          "hover:shadow-xl active:scale-95",
          "touch-manipulation",
          "min-h-[56px] min-w-[56px]",
          className
        )}
        data-testid="mobile-fab-button"
        aria-label={label}
        {...props}
      >
        <Icon className="h-6 w-6" />
        <span className="hidden sm:inline">{label}</span>
      </button>
    );
  }
);

MobileFAB.displayName = 'MobileFAB';

export { MobileFAB };