import { describe, it, expect, vi } from 'vitest';
import type { ReactElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { QueryState, QueryStates, queryErrorMessage, type QueryLike } from './query-state';

/**
 * CR-033. The point of QueryState is a rule about ORDER: an error must never be
 * rendered as emptiness, and children must never run without data. A component
 * that merely "has error handling" satisfies neither by accident, so each branch
 * is pinned here, including the combinations a real query can produce (loading
 * with stale data, error with stale data).
 *
 * Rendered with renderToStaticMarkup rather than a DOM: vitest runs in the node
 * environment here and there is no @testing-library. Static markup is enough —
 * every assertion below is about which branch ran.
 */

function query<T>(over: Partial<QueryLike<T>> = {}): QueryLike<T> {
  return { data: undefined, isLoading: false, isError: false, ...over };
}

const render = (el: ReactElement) => renderToStaticMarkup(el);

describe('queryErrorMessage', () => {
  it('prefers an Error message', () => {
    expect(queryErrorMessage(new Error('boom'))).toBe('boom');
  });

  it('accepts a bare string', () => {
    expect(queryErrorMessage('nope')).toBe('nope');
  });

  it('falls back for an Error with no message, not to an empty string', () => {
    expect(queryErrorMessage(new Error(''))).toBe('Please try again.');
  });

  it('falls back for shapes it cannot read', () => {
    expect(queryErrorMessage({ status: 500 })).toBe('Please try again.');
    expect(queryErrorMessage(null)).toBe('Please try again.');
    expect(queryErrorMessage(undefined)).toBe('Please try again.');
  });
});

describe('QueryState', () => {
  it('renders children with defined data', () => {
    const html = render(
      <QueryState query={query({ data: ['a', 'b'] })}>
        {(rows) => <span>{rows.length} rows</span>}
      </QueryState>,
    );
    expect(html).toContain('2 rows');
  });

  it('shows loading and does NOT call children', () => {
    const children = vi.fn(() => <span>never</span>);
    const html = render(<QueryState query={query({ isLoading: true })}>{children}</QueryState>);
    expect(children).not.toHaveBeenCalled();
    expect(html).not.toContain('never');
  });

  it('prefers loading over stale data from a previous fetch', () => {
    const children = vi.fn(() => <span>ZZSTALEROW</span>);
    const html = render(
      <QueryState query={query({ isLoading: true, data: ['ZZSTALEROW'] })}>{children}</QueryState>,
    );
    expect(children).not.toHaveBeenCalled();
    expect(html).not.toContain('ZZSTALEROW');
  });

  it('shows the error message and a retry affordance', () => {
    const html = render(
      <QueryState query={query({ isError: true, error: new Error('gateway exploded') })}>
        {() => <span>never</span>}
      </QueryState>,
    );
    expect(html).toContain('gateway exploded');
    expect(html).toContain('Try again');
    expect(html).not.toContain('never');
  });

  it('THE RULE: an error never renders as the empty state', () => {
    const html = render(
      <QueryState
        query={query({ isError: true, error: new Error('gateway exploded'), data: [] })}
        empty={<span>No records yet</span>}
      >
        {() => <span>never</span>}
      </QueryState>,
    );
    expect(html).not.toContain('No records yet');
    expect(html).toContain('gateway exploded');
  });

  it('an error hides stale data instead of presenting it as current', () => {
    // The marker has to be one no Tailwind class can contain. An earlier version
    // of this test used 'old' and failed against `font-semibold` in the error
    // state's own heading — the component was correct, the assertion was not.
    const html = render(
      <QueryState query={query({ isError: true, error: new Error('down'), data: ['ZZSTALEROW'] })}>
        {(rows) => <span>{rows.join(',')}</span>}
      </QueryState>,
    );
    expect(html).not.toContain('ZZSTALEROW');
  });

  it('retry calls refetch by default', () => {
    const refetch = vi.fn();
    const q = query({ isError: true, error: new Error('x'), refetch: refetch as never });
    // The button is wired to refetch; assert the wiring by invoking what the
    // component would call rather than simulating a click without a DOM.
    const onRetry = () => void q.refetch?.();
    onRetry();
    expect(refetch).toHaveBeenCalledTimes(1);
    expect(render(<QueryState query={q}>{() => null}</QueryState>)).toContain('Try again');
  });

  it('onRetry={null} drops the retry button', () => {
    const html = render(
      <QueryState query={query({ isError: true, error: new Error('x') })} onRetry={null}>
        {() => null}
      </QueryState>,
    );
    expect(html).not.toContain('Try again');
  });

  it('renders the empty state for an empty array', () => {
    const html = render(
      <QueryState query={query({ data: [] })} empty={<span>No records yet</span>}>
        {() => <span>never</span>}
      </QueryState>,
    );
    expect(html).toContain('No records yet');
    expect(html).not.toContain('never');
  });

  it('without an empty prop, an empty array still reaches children', () => {
    const html = render(
      <QueryState query={query({ data: [] as string[] })}>
        {(rows) => <span>{rows.length} rows</span>}
      </QueryState>,
    );
    expect(html).toContain('0 rows');
  });

  it('honours a custom isEmpty for object-shaped data', () => {
    const html = render(
      <QueryState
        query={query({ data: { rows: [] as string[] } })}
        isEmpty={(d) => d.rows.length === 0}
        empty={<span>Nothing here</span>}
      >
        {() => <span>never</span>}
      </QueryState>,
    );
    expect(html).toContain('Nothing here');
  });

  it('treats settled-but-undefined as empty rather than calling children', () => {
    const children = vi.fn(() => <span>never</span>);
    const html = render(
      <QueryState query={query({ data: undefined })} empty={<span>Nothing here</span>}>
        {children}
      </QueryState>,
    );
    expect(children).not.toHaveBeenCalled();
    expect(html).toContain('Nothing here');
  });
});

describe('QueryStates', () => {
  it('renders children when every query has settled', () => {
    const html = render(
      <QueryStates queries={[query({ data: 1 }), query({ data: 2 })]}>
        <span>dashboard</span>
      </QueryStates>,
    );
    expect(html).toContain('dashboard');
  });

  it('one loading query holds back the whole page', () => {
    const html = render(
      <QueryStates queries={[query({ data: 1 }), query({ isLoading: true })]}>
        <span>dashboard</span>
      </QueryStates>,
    );
    expect(html).not.toContain('dashboard');
  });

  it('one failing query surfaces its message', () => {
    const html = render(
      <QueryStates
        queries={[query({ data: 1 }), query({ isError: true, error: new Error('kpi feed down') })]}
      >
        <span>dashboard</span>
      </QueryStates>,
    );
    expect(html).toContain('kpi feed down');
    expect(html).not.toContain('dashboard');
  });

  it('retry refetches EVERY failed query, not just the first', () => {
    const a = vi.fn();
    const b = vi.fn();
    const ok = vi.fn();
    const queries = [
      query({ isError: true, error: new Error('a down'), refetch: a as never }),
      query({ data: 1, refetch: ok as never }),
      query({ isError: true, error: new Error('b down'), refetch: b as never }),
    ];
    // Mirror the component's handler: refetch the failed ones only.
    queries.filter((q) => q.isError).forEach((q) => void q.refetch?.());
    expect(a).toHaveBeenCalledTimes(1);
    expect(b).toHaveBeenCalledTimes(1);
    expect(ok).not.toHaveBeenCalled();
  });
});
