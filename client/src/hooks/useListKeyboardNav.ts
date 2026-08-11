import { useCallback, useEffect, useRef } from 'react';

/**
 * COP-I02: j/k (and arrow) navigation over a list of focusable rows.
 *
 * Attach the returned `containerRef` to the element wrapping the rows, and give
 * each row `data-list-row` plus a `tabIndex`. Keys are handled at the container,
 * so nothing is registered globally and two lists on one page cannot fight.
 *
 * Behaviour:
 *   j / ArrowDown  next row      k / ArrowUp  previous row
 *   Enter          activate      Escape       blur, releasing the list
 *   Home / End     first / last
 *
 * Deliberately inert while the user is typing: events originating from an
 * input, textarea, select or contenteditable are ignored, so the search box and
 * every inline cell editor keep working normally. Modifier-held presses are
 * ignored too, so browser and OS shortcuts are never swallowed.
 */
export function useListKeyboardNav<T extends HTMLElement = HTMLDivElement>() {
  const containerRef = useRef<T | null>(null);

  const isTypingTarget = useCallback((target: EventTarget | null) => {
    if (!(target instanceof HTMLElement)) return false;
    if (target.isContentEditable) return true;
    const tag = target.tagName;
    return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT';
  }, []);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      if (isTypingTarget(event.target)) return;

      const rows = Array.from(container.querySelectorAll<HTMLElement>('[data-list-row]')).filter(
        (row) => row.offsetParent !== null,
      );
      if (rows.length === 0) return;

      const active = document.activeElement as HTMLElement | null;
      const current = rows.findIndex((row) => row === active || row.contains(active));

      const focusAt = (index: number) => {
        const next = rows[Math.max(0, Math.min(rows.length - 1, index))];
        if (!next) return;
        event.preventDefault();
        next.focus();
        // Keep the focused row inside the scroll viewport without yanking the
        // page around when it is already visible.
        next.scrollIntoView({ block: 'nearest' });
      };

      switch (event.key) {
        case 'j':
        case 'ArrowDown':
          focusAt(current < 0 ? 0 : current + 1);
          break;
        case 'k':
        case 'ArrowUp':
          focusAt(current < 0 ? 0 : current - 1);
          break;
        case 'Home':
          focusAt(0);
          break;
        case 'End':
          focusAt(rows.length - 1);
          break;
        case 'Enter':
          if (current >= 0) {
            event.preventDefault();
            rows[current].click();
          }
          break;
        case 'Escape':
          if (current >= 0) {
            event.preventDefault();
            rows[current].blur();
          }
          break;
        default:
          break;
      }
    };

    container.addEventListener('keydown', onKeyDown);
    return () => container.removeEventListener('keydown', onKeyDown);
  }, [isTypingTarget]);

  return containerRef;
}
