import * as React from 'react';
import { Textarea, type TextareaProps } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';

export interface TextareaWithCounterProps extends TextareaProps {
  maxLength?: number;
  showCounter?: boolean;
  value?: string;
}

const TextareaWithCounter = React.forwardRef<HTMLTextAreaElement, TextareaWithCounterProps>(
  ({ className, maxLength = 500, showCounter = true, value = '', ...props }, ref) => {
    const currentLength = value?.toString().length || 0;
    const isNearLimit = maxLength && currentLength / maxLength > 0.8;
    const isAtLimit = maxLength && currentLength >= maxLength;

    return (
      <div className="relative w-full">
        <Textarea
          ref={ref}
          className={cn(className, showCounter && 'pb-8')}
          maxLength={maxLength}
          value={value}
          {...props}
        />
        {showCounter && (
          <div
            className={cn(
              'absolute bottom-2 right-2 text-xs select-none pointer-events-none',
              isAtLimit
                ? 'text-red-600 font-medium'
                : isNearLimit
                  ? 'text-orange-600'
                  : 'text-muted-foreground',
            )}
          >
            {currentLength}
            {maxLength && ` / ${maxLength}`}
          </div>
        )}
      </div>
    );
  },
);

TextareaWithCounter.displayName = 'TextareaWithCounter';

export { TextareaWithCounter };
