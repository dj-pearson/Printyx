/**
 * Focus Management Components
 * WCAG 2.1 Level A - Focus Order (2.4.3), Focus Visible (2.4.7)
 *
 * Provides focus trapping and management for modal dialogs,
 * dropdown menus, and other interactive components.
 */

import {
  useEffect,
  useRef,
  useCallback,
  type ReactNode,
  type RefObject,
} from 'react';
import {
  getFocusableElements,
  createFocusTrap,
  focusFirst,
} from '@/lib/accessibility/utils';

interface FocusTrapProps {
  children: ReactNode;
  /** Whether the focus trap is active */
  active?: boolean;
  /** Whether to focus the first element on mount */
  autoFocus?: boolean;
  /** Whether to return focus to the previously focused element on unmount */
  returnFocus?: boolean;
  /** Callback when Escape is pressed */
  onEscape?: () => void;
  /** Additional class name */
  className?: string;
}

/**
 * Focus Trap Component
 * Traps keyboard focus within a container, essential for modal dialogs
 */
export function FocusTrap({
  children,
  active = true,
  autoFocus = true,
  returnFocus = true,
  onEscape,
  className,
}: FocusTrapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const previousActiveElement = useRef<Element | null>(null);

  // Store the previously focused element
  useEffect(() => {
    if (active) {
      previousActiveElement.current = document.activeElement;
    }
  }, [active]);

  // Set up focus trap
  useEffect(() => {
    if (!active || !containerRef.current) return;

    const container = containerRef.current;

    // Auto-focus first focusable element
    if (autoFocus) {
      focusFirst(container);
    }

    // Create focus trap
    const removeTrap = createFocusTrap(container);

    // Handle Escape key
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && onEscape) {
        e.preventDefault();
        e.stopPropagation();
        onEscape();
      }
    };

    container.addEventListener('keydown', handleKeyDown);

    return () => {
      removeTrap();
      container.removeEventListener('keydown', handleKeyDown);
    };
  }, [active, autoFocus, onEscape]);

  // Return focus on unmount
  useEffect(() => {
    return () => {
      if (returnFocus && previousActiveElement.current instanceof HTMLElement) {
        previousActiveElement.current.focus();
      }
    };
  }, [returnFocus]);

  return (
    <div ref={containerRef} className={className}>
      {children}
    </div>
  );
}

interface FocusGuardProps {
  onFocus: () => void;
}

/**
 * Focus Guard Component
 * Hidden elements that catch focus when tabbing out of a focus trap
 */
export function FocusGuard({ onFocus }: FocusGuardProps) {
  return (
    <div
      tabIndex={0}
      style={{
        position: 'absolute',
        width: '1px',
        height: '1px',
        padding: 0,
        margin: '-1px',
        overflow: 'hidden',
        clip: 'rect(0, 0, 0, 0)',
        whiteSpace: 'nowrap',
        border: 0,
      }}
      onFocus={onFocus}
      aria-hidden="true"
    />
  );
}

interface FocusScopeProps {
  children: ReactNode;
  /** Whether to contain focus within this scope */
  contain?: boolean;
  /** Whether to restore focus to the last focused element when re-entering */
  restoreFocus?: boolean;
}

/**
 * Focus Scope Component
 * Manages focus within a scope, useful for complex UI components
 */
export function FocusScope({
  children,
  contain = false,
  restoreFocus = false,
}: FocusScopeProps) {
  const scopeRef = useRef<HTMLDivElement>(null);
  const lastFocused = useRef<HTMLElement | null>(null);

  // Track last focused element within scope
  useEffect(() => {
    if (!restoreFocus || !scopeRef.current) return;

    const scope = scopeRef.current;

    const handleFocusIn = (e: FocusEvent) => {
      if (e.target instanceof HTMLElement && scope.contains(e.target)) {
        lastFocused.current = e.target;
      }
    };

    scope.addEventListener('focusin', handleFocusIn);
    return () => scope.removeEventListener('focusin', handleFocusIn);
  }, [restoreFocus]);

  // Contain focus if enabled
  useEffect(() => {
    if (!contain || !scopeRef.current) return;
    return createFocusTrap(scopeRef.current);
  }, [contain]);

  return <div ref={scopeRef}>{children}</div>;
}

/**
 * Hook for managing focus within a component
 */
export function useFocusManager(containerRef: RefObject<HTMLElement>) {
  const focusFirst = useCallback(() => {
    if (!containerRef.current) return;
    const focusable = getFocusableElements(containerRef.current);
    if (focusable.length > 0) {
      (focusable[0] as HTMLElement).focus();
    }
  }, [containerRef]);

  const focusLast = useCallback(() => {
    if (!containerRef.current) return;
    const focusable = getFocusableElements(containerRef.current);
    if (focusable.length > 0) {
      (focusable[focusable.length - 1] as HTMLElement).focus();
    }
  }, [containerRef]);

  const focusNext = useCallback(() => {
    if (!containerRef.current) return;
    const focusable = Array.from(getFocusableElements(containerRef.current)) as HTMLElement[];
    const currentIndex = focusable.findIndex((el) => el === document.activeElement);
    if (currentIndex >= 0 && currentIndex < focusable.length - 1) {
      focusable[currentIndex + 1].focus();
    }
  }, [containerRef]);

  const focusPrevious = useCallback(() => {
    if (!containerRef.current) return;
    const focusable = Array.from(getFocusableElements(containerRef.current)) as HTMLElement[];
    const currentIndex = focusable.findIndex((el) => el === document.activeElement);
    if (currentIndex > 0) {
      focusable[currentIndex - 1].focus();
    }
  }, [containerRef]);

  const focusByIndex = useCallback((index: number) => {
    if (!containerRef.current) return;
    const focusable = Array.from(getFocusableElements(containerRef.current)) as HTMLElement[];
    if (index >= 0 && index < focusable.length) {
      focusable[index].focus();
    }
  }, [containerRef]);

  const getFocusableCount = useCallback(() => {
    if (!containerRef.current) return 0;
    return getFocusableElements(containerRef.current).length;
  }, [containerRef]);

  const getCurrentFocusIndex = useCallback(() => {
    if (!containerRef.current) return -1;
    const focusable = Array.from(getFocusableElements(containerRef.current));
    return focusable.findIndex((el) => el === document.activeElement);
  }, [containerRef]);

  return {
    focusFirst,
    focusLast,
    focusNext,
    focusPrevious,
    focusByIndex,
    getFocusableCount,
    getCurrentFocusIndex,
  };
}

/**
 * Hook for handling keyboard navigation in lists/menus
 */
export function useRovingFocus(
  containerRef: RefObject<HTMLElement>,
  options: {
    selector?: string;
    orientation?: 'horizontal' | 'vertical' | 'both';
    loop?: boolean;
  } = {}
) {
  const {
    selector = '[role="menuitem"], [role="option"], [role="tab"], button, a',
    orientation = 'vertical',
    loop = true,
  } = options;

  useEffect(() => {
    if (!containerRef.current) return;

    const container = containerRef.current;

    const handleKeyDown = (e: KeyboardEvent) => {
      const items = Array.from(container.querySelectorAll(selector)) as HTMLElement[];
      const currentIndex = items.findIndex((item) => item === document.activeElement);

      if (currentIndex === -1) return;

      let nextIndex = currentIndex;
      let handled = false;

      const moveUp = () => {
        nextIndex = currentIndex - 1;
        if (nextIndex < 0) nextIndex = loop ? items.length - 1 : 0;
        handled = true;
      };

      const moveDown = () => {
        nextIndex = currentIndex + 1;
        if (nextIndex >= items.length) nextIndex = loop ? 0 : items.length - 1;
        handled = true;
      };

      switch (e.key) {
        case 'ArrowUp':
          if (orientation === 'vertical' || orientation === 'both') moveUp();
          break;
        case 'ArrowDown':
          if (orientation === 'vertical' || orientation === 'both') moveDown();
          break;
        case 'ArrowLeft':
          if (orientation === 'horizontal' || orientation === 'both') moveUp();
          break;
        case 'ArrowRight':
          if (orientation === 'horizontal' || orientation === 'both') moveDown();
          break;
        case 'Home':
          nextIndex = 0;
          handled = true;
          break;
        case 'End':
          nextIndex = items.length - 1;
          handled = true;
          break;
      }

      if (handled) {
        e.preventDefault();
        items[nextIndex].focus();
      }
    };

    container.addEventListener('keydown', handleKeyDown);
    return () => container.removeEventListener('keydown', handleKeyDown);
  }, [containerRef, selector, orientation, loop]);
}

export default FocusTrap;
