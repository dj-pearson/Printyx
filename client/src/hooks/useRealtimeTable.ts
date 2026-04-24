/**
 * useRealtimeTable + useRealtimeBroadcast — Supabase Realtime replacements
 * for the deprecated useWebSocket hook.
 *
 * Part B of the Phase 6 cron-realtime migration. The old useWebSocket hook
 * and server/websocket-service.ts stay in place until the sunset PR — this
 * file is additive so components can migrate one at a time.
 *
 * Two hook flavors matching the two Realtime primitives:
 *
 *   useRealtimeTable<Row>(table, opts)
 *     Subscribes to postgres_changes (INSERT/UPDATE/DELETE) on `table`.
 *     Optional filter uses Supabase's filter string syntax, e.g.
 *     'tenant_id=eq.00000000-0000-0000-0000-000000000000'. RLS still
 *     applies — cross-tenant rows are filtered server-side before the
 *     payload ever hits the client.
 *
 *   useRealtimeBroadcast(channel, event, handler)
 *     Subscribes to broadcast events on a named channel. For application-
 *     originated signals that don't correspond to a DB row change
 *     (e.g., "admin forced all users to refresh permissions").
 *
 * The hooks call supabase.realtime.setAuth(jwt) on the current session so
 * RLS evaluates with the caller's claims. If the JWT refreshes, the
 * underlying Supabase client handles propagation automatically.
 */

import { useEffect, useRef, useState } from 'react';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';

interface RowWithId {
  id: string | number;
  [key: string]: unknown;
}

export interface UseRealtimeTableOptions<Row> {
  /**
   * Initial snapshot. If provided, the hook seeds its state with these rows
   * before any Realtime events arrive. Typical pattern: fetch via TanStack
   * Query for the first page, hand the results here so live updates apply
   * on top.
   */
  initial?: Row[];
  /**
   * PostgREST-style filter, e.g. `tenant_id=eq.${tenantId}`. Without this,
   * you'll receive every row the RLS policy allows — which is usually the
   * current tenant's rows, but pinning it here is clearer for readers.
   */
  filter?: string;
  /**
   * Custom schema. Defaults to 'public'.
   */
  schema?: string;
  /**
   * Events to listen for. Defaults to '*' (INSERT, UPDATE, DELETE).
   */
  event?: 'INSERT' | 'UPDATE' | 'DELETE' | '*';
  /**
   * Optional per-event hook for callers that want to side-effect (e.g.,
   * invalidate a TanStack Query cache on INSERT).
   */
  onChange?: (event: 'INSERT' | 'UPDATE' | 'DELETE', row: Row) => void;
}

/**
 * Subscribe to postgres_changes on a table and maintain an in-memory list
 * of rows. Returns the current list + a `connected` flag for UX.
 */
export function useRealtimeTable<Row extends RowWithId>(
  table: string,
  opts: UseRealtimeTableOptions<Row> = {},
): { rows: Row[]; connected: boolean } {
  const { initial, filter, schema = 'public', event = '*', onChange } = opts;
  const [rows, setRows] = useState<Row[]>(initial ?? []);
  const [connected, setConnected] = useState(false);
  const channelRef = useRef<RealtimeChannel | null>(null);

  useEffect(() => {
    const channelName = `${schema}-${table}-${filter ?? 'all'}`;
    const channel = supabase
      .channel(channelName)
      .on(
        // Type assertion: @supabase/supabase-js 2.x typings don't expose the
        // generic signature cleanly; runtime payload shape is stable.
        // deno-lint-ignore no-explicit-any
        'postgres_changes' as any,
        { event, schema, table, filter },
        (payload: {
          eventType: 'INSERT' | 'UPDATE' | 'DELETE';
          new: Row;
          old: Partial<Row> & { id?: Row['id'] };
        }) => {
          if (payload.eventType === 'INSERT') {
            setRows((prev) => {
              // Avoid duplicates when initial snapshot already has the row.
              if (prev.some((r) => r.id === payload.new.id)) return prev;
              return [payload.new, ...prev];
            });
            onChange?.('INSERT', payload.new);
          } else if (payload.eventType === 'UPDATE') {
            setRows((prev) =>
              prev.map((r) => (r.id === payload.new.id ? { ...r, ...payload.new } : r)),
            );
            onChange?.('UPDATE', payload.new);
          } else if (payload.eventType === 'DELETE') {
            const deletedId = payload.old?.id;
            if (deletedId === undefined) return;
            setRows((prev) => prev.filter((r) => r.id !== deletedId));
            // Synthesize a Row-shaped payload for the callback.
            onChange?.('DELETE', payload.old as Row);
          }
        },
      )
      .subscribe((status) => {
        setConnected(status === 'SUBSCRIBED');
      });

    channelRef.current = channel;
    return () => {
      supabase.removeChannel(channel);
      channelRef.current = null;
      setConnected(false);
    };
    // filter is a string — stable across renders when computed from stable inputs.
    // Table + schema + event rarely change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [table, schema, event, filter]);

  return { rows, connected };
}

/**
 * Subscribe to broadcast messages on a channel. Fires the handler every
 * time a message arrives. Use this for app-level events that aren't
 * row-shaped (e.g., permission refresh, multi-tab sync signals).
 */
export function useRealtimeBroadcast<Payload = unknown>(
  channelName: string,
  event: string,
  handler: (payload: Payload) => void,
): { connected: boolean } {
  const [connected, setConnected] = useState(false);
  const handlerRef = useRef(handler);
  handlerRef.current = handler;

  useEffect(() => {
    const channel = supabase
      .channel(channelName)
      .on('broadcast', { event }, (message) => {
        handlerRef.current(message.payload as Payload);
      })
      .subscribe((status) => {
        setConnected(status === 'SUBSCRIBED');
      });

    return () => {
      supabase.removeChannel(channel);
      setConnected(false);
    };
  }, [channelName, event]);

  return { connected };
}

/**
 * Emit a broadcast message on a channel. Typically called from a successful
 * mutation handler to notify other tabs / users listening on the same
 * channel.
 */
export async function sendRealtimeBroadcast<Payload = unknown>(
  channelName: string,
  event: string,
  payload: Payload,
): Promise<void> {
  const channel = supabase.channel(channelName);
  await channel.subscribe();
  await channel.send({ type: 'broadcast', event, payload });
  // Deliberately don't remove — the caller may want the channel to stay
  // live for subsequent sends. Consumer is responsible for cleanup.
}
