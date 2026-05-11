import { forwardRef, useEffect, useImperativeHandle, useState } from 'react';
import type { Editor, Range } from '@tiptap/core';
import { cn } from '@/lib/utils';
import type { SlashCommandItem } from './SlashCommand';

interface SlashCommandListProps {
  items: SlashCommandItem[];
  command: (item: SlashCommandItem) => void;
  editor: Editor;
  range: Range;
}

export interface SlashCommandListRef {
  onKeyDown: (props: { event: KeyboardEvent }) => boolean;
}

export const SlashCommandList = forwardRef<SlashCommandListRef, SlashCommandListProps>(
  ({ items, command }, ref) => {
    const [selected, setSelected] = useState(0);

    useEffect(() => setSelected(0), [items]);

    useImperativeHandle(ref, () => ({
      onKeyDown: ({ event }) => {
        if (event.key === 'ArrowDown') {
          setSelected((s) => (s + 1) % Math.max(items.length, 1));
          return true;
        }
        if (event.key === 'ArrowUp') {
          setSelected((s) => (s - 1 + Math.max(items.length, 1)) % Math.max(items.length, 1));
          return true;
        }
        if (event.key === 'Enter') {
          const item = items[selected];
          if (item) {
            command(item);
            return true;
          }
        }
        return false;
      },
    }));

    if (items.length === 0) {
      return (
        <div className="rounded-md border bg-popover text-popover-foreground shadow-md px-3 py-2 text-xs text-muted-foreground">
          No commands match
        </div>
      );
    }

    return (
      <div className="rounded-md border bg-popover text-popover-foreground shadow-md py-1 min-w-[240px] max-h-80 overflow-y-auto">
        {items.map((item, idx) => {
          const Icon = item.icon;
          return (
            <button
              key={item.title}
              type="button"
              onClick={() => command(item)}
              onMouseEnter={() => setSelected(idx)}
              className={cn(
                'w-full flex items-start gap-2 px-2 py-1.5 text-sm text-left hover:bg-muted/70',
                selected === idx && 'bg-muted',
              )}
            >
              <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded border bg-background">
                <Icon className="h-3.5 w-3.5" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block font-medium">{item.title}</span>
                <span className="block text-xs text-muted-foreground truncate">
                  {item.description}
                </span>
              </span>
            </button>
          );
        })}
      </div>
    );
  },
);

SlashCommandList.displayName = 'SlashCommandList';
