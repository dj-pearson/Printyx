import * as React from 'react';
import { Link } from 'wouter';
import { ChevronRight, Home } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface BreadcrumbItem {
  label: string;
  href?: string;
}

interface BreadcrumbsProps {
  items: BreadcrumbItem[];
  className?: string;
}

/**
 * Reusable breadcrumb navigation component (UX-002).
 *
 * - First item shows a Home icon.
 * - Last item is rendered as plain text (current page).
 * - Middle items collapse on mobile when there are more than 3 items.
 * - Uses shadcn/ui styling conventions with Tailwind.
 */
export function Breadcrumbs({ items, className }: BreadcrumbsProps) {
  if (!items.length) return null;

  // On mobile, if there are more than 3 items we collapse the middle ones
  // and show an ellipsis instead.
  const shouldCollapse = items.length > 3;

  return (
    <nav aria-label="Breadcrumb" className={cn('mb-4', className)}>
      <ol className="flex flex-wrap items-center gap-1.5 text-sm text-muted-foreground sm:gap-2">
        {items.map((item, index) => {
          const isFirst = index === 0;
          const isLast = index === items.length - 1;
          const isMiddle = !isFirst && !isLast;

          // On mobile, hide middle items when collapsing
          const hiddenOnMobile = shouldCollapse && isMiddle;

          return (
            <React.Fragment key={index}>
              {/* Separator */}
              {index > 0 && (
                <li
                  role="presentation"
                  aria-hidden="true"
                  className={cn(
                    '[&>svg]:w-3.5 [&>svg]:h-3.5',
                    hiddenOnMobile && 'hidden sm:list-item',
                  )}
                >
                  <ChevronRight />
                </li>
              )}

              {/* Ellipsis shown only on mobile when middle items are collapsed */}
              {shouldCollapse && index === 1 && (
                <>
                  <li
                    role="presentation"
                    aria-hidden="true"
                    className="[&>svg]:w-3.5 [&>svg]:h-3.5 sm:hidden"
                  >
                    <ChevronRight />
                  </li>
                  <li className="inline-flex items-center sm:hidden">
                    <span className="text-muted-foreground">...</span>
                  </li>
                </>
              )}

              <li
                className={cn(
                  'inline-flex items-center gap-1.5',
                  hiddenOnMobile && 'hidden sm:inline-flex',
                )}
              >
                {isLast ? (
                  // Current page: not a link
                  <span
                    role="link"
                    aria-disabled="true"
                    aria-current="page"
                    className="font-medium text-foreground truncate max-w-[200px] sm:max-w-none"
                  >
                    {isFirst && <Home className="inline h-3.5 w-3.5 mr-1 -mt-0.5" />}
                    {item.label}
                  </span>
                ) : item.href ? (
                  // Navigable link
                  <Link
                    href={item.href}
                    className="transition-colors hover:text-foreground inline-flex items-center"
                  >
                    {isFirst && <Home className="h-3.5 w-3.5 mr-1" />}
                    {item.label}
                  </Link>
                ) : (
                  // No href but not last — render as plain text
                  <span className="inline-flex items-center">
                    {isFirst && <Home className="h-3.5 w-3.5 mr-1" />}
                    {item.label}
                  </span>
                )}
              </li>
            </React.Fragment>
          );
        })}
      </ol>
    </nav>
  );
}
