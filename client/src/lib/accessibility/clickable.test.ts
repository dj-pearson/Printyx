import { describe, it, expect, vi } from 'vitest';
import type { KeyboardEvent } from 'react';
import { clickableProps } from './clickable';

/** Minimal stand-in for the fields clickableProps reads off a KeyboardEvent. */
function keyEvent(key: string, sameTarget = true) {
  const element = {};
  const preventDefault = vi.fn();
  return {
    event: {
      key,
      target: sameTarget ? element : {},
      currentTarget: element,
      preventDefault,
    } as unknown as KeyboardEvent,
    preventDefault,
  };
}

describe('clickableProps', () => {
  it('makes the element a focusable button to assistive technology', () => {
    const props = clickableProps(() => {});
    expect(props.role).toBe('button');
    expect(props.tabIndex).toBe(0);
  });

  it('calls the handler on click', () => {
    const onActivate = vi.fn();
    clickableProps(onActivate).onClick();
    expect(onActivate).toHaveBeenCalledTimes(1);
  });

  it.each(['Enter', ' '])('activates on %j', (key) => {
    const onActivate = vi.fn();
    const { event } = keyEvent(key);
    clickableProps(onActivate).onKeyDown(event);
    expect(onActivate).toHaveBeenCalledTimes(1);
  });

  it('swallows the page scroll that Space would otherwise cause', () => {
    const { event, preventDefault } = keyEvent(' ');
    clickableProps(() => {}).onKeyDown(event);
    expect(preventDefault).toHaveBeenCalled();
  });

  it('leaves Enter alone so a nested form can still submit', () => {
    const { event, preventDefault } = keyEvent('Enter');
    clickableProps(() => {}).onKeyDown(event);
    expect(preventDefault).not.toHaveBeenCalled();
  });

  it.each(['a', 'Tab', 'Escape', 'ArrowDown'])('ignores %j', (key) => {
    const onActivate = vi.fn();
    const { event, preventDefault } = keyEvent(key);
    clickableProps(onActivate).onKeyDown(event);
    expect(onActivate).not.toHaveBeenCalled();
    expect(preventDefault).not.toHaveBeenCalled();
  });

  // The regression this guard exists for: several of these wrappers contain
  // inputs and one contentEditable region. Without it, a space typed inside
  // any of them bubbles up, gets preventDefault'ed, and never reaches the
  // field — and Enter on a nested button fires the row handler as well.
  it.each(['Enter', ' '])('ignores %j pressed on a descendant', (key) => {
    const onActivate = vi.fn();
    const { event, preventDefault } = keyEvent(key, false);
    clickableProps(onActivate).onKeyDown(event);
    expect(onActivate).not.toHaveBeenCalled();
    expect(preventDefault).not.toHaveBeenCalled();
  });
});
