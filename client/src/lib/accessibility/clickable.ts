import type { KeyboardEvent } from 'react';

/**
 * CR-035: props for a non-button element that behaves like a button.
 *
 * The tree had 29 `<div onClick={...}>` rows, cards and toggles with no
 * keyboard path at all — a keyboard or screen-reader user could see them and
 * could not use them. Each needs the same four things (role, tabIndex, click,
 * key handler), and writing them out by hand 29 times is how three of them end
 * up subtly different.
 *
 * The `target !== currentTarget` guard is the part that is easy to leave out
 * and expensive to omit. Several of these wrappers contain inputs, buttons and
 * one contentEditable region; without the guard, typing a space inside any of
 * them bubbles up here, gets preventDefault'ed, and the space never reaches the
 * field. Enter on a nested button would likewise fire the row's handler as well
 * as the button's. Only keys pressed on the wrapper itself count.
 *
 * Space is preventDefault'ed because the browser scrolls the page on a
 * focusable element otherwise. Enter is not, so a nested form still submits.
 *
 * Spread it LAST so the element's own className/key/ref stay put, and drop the
 * element's existing onClick when you do — this supplies it:
 *
 *   <div className="..." {...clickableProps(() => select(row.id))}>
 *
 * Use a real <button> when writing an element from scratch. This is for the
 * ones that already exist and carry layout a <button> reset would fight.
 */
export function clickableProps(onActivate: () => void) {
  return {
    role: 'button' as const,
    tabIndex: 0,
    onClick: onActivate,
    onKeyDown: (event: KeyboardEvent) => {
      if (event.target !== event.currentTarget) return;
      if (event.key === 'Enter' || event.key === ' ') {
        if (event.key === ' ') event.preventDefault();
        onActivate();
      }
    },
  };
}
