/**
 * Keyboard Shortcuts Hook
 *
 * UX-011: Global keyboard shortcuts for power-user navigation.
 *
 * Provides a centralized keyboard shortcut system with:
 * - Cmd/Ctrl+K: Open command palette (already handled by command-palette)
 * - G then L: Go to Leads
 * - G then C: Go to Customers
 * - G then Q: Go to Quotes
 * - G then D: Go to Dashboard
 * - G then S: Go to Settings
 * - G then T: Go to Tasks
 * - N then L: New Lead
 * - N then Q: New Quote
 * - ?: Show keyboard shortcuts help
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { useLocation } from 'wouter';

interface ShortcutDef {
  keys: string;
  description: string;
  action: () => void;
  category: string;
}

export function useKeyboardShortcuts() {
  const [location, navigate] = useLocation();
  const [showHelp, setShowHelp] = useState(false);
  const pendingKey = useRef<string | null>(null);
  const pendingTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  const shortcuts: ShortcutDef[] = [
    {
      keys: 'g l',
      description: 'Go to Leads',
      action: () => navigate('/leads'),
      category: 'Navigation',
    },
    {
      keys: 'g c',
      description: 'Go to Customers',
      action: () => navigate('/customers'),
      category: 'Navigation',
    },
    {
      keys: 'g q',
      description: 'Go to Quotes',
      action: () => navigate('/quotes'),
      category: 'Navigation',
    },
    {
      keys: 'g d',
      description: 'Go to Dashboard',
      action: () => navigate('/'),
      category: 'Navigation',
    },
    {
      keys: 'g s',
      description: 'Go to Settings',
      action: () => navigate('/settings'),
      category: 'Navigation',
    },
    {
      keys: 'g t',
      description: 'Go to Tasks',
      action: () => navigate('/task-hub'),
      category: 'Navigation',
    },
    {
      keys: 'g r',
      description: 'Go to Reports',
      action: () => navigate('/reports'),
      category: 'Navigation',
    },
    {
      keys: 'g i',
      description: 'Go to Invoices',
      action: () => navigate('/invoices'),
      category: 'Navigation',
    },
    {
      keys: 'n l',
      description: 'New Lead',
      action: () => navigate('/leads?action=new'),
      category: 'Create',
    },
    {
      keys: 'n q',
      description: 'New Quote',
      action: () => navigate('/quotes/new'),
      category: 'Create',
    },
    {
      keys: 'n c',
      description: 'New Customer',
      action: () => navigate('/customers?action=new'),
      category: 'Create',
    },
    {
      keys: '?',
      description: 'Show keyboard shortcuts',
      action: () => setShowHelp(true),
      category: 'Help',
    },
  ];

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      // Skip on blog routes — BlogShell registers its own scoped shortcuts
      // (g i = Ideas, g b = Briefs, etc.) that would collide with the global
      // ones below (g i = Invoices). See US-BLOG-007.
      if (location.startsWith('/platform-admin/blog')) {
        return;
      }

      // Skip if user is typing in an input/textarea/contenteditable
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) {
        return;
      }

      // Skip if Cmd/Ctrl/Alt is held (those are other shortcuts)
      if (e.metaKey || e.ctrlKey || e.altKey) return;

      const key = e.key.toLowerCase();

      // Handle two-key sequences
      if (pendingKey.current) {
        const combo = `${pendingKey.current} ${key}`;
        const match = shortcuts.find((s) => s.keys === combo);
        if (match) {
          e.preventDefault();
          match.action();
        }
        pendingKey.current = null;
        if (pendingTimeout.current) {
          clearTimeout(pendingTimeout.current);
          pendingTimeout.current = null;
        }
        return;
      }

      // Single-key shortcuts
      if (key === '?') {
        e.preventDefault();
        setShowHelp(true);
        return;
      }

      // Start two-key sequence
      if (key === 'g' || key === 'n') {
        pendingKey.current = key;
        pendingTimeout.current = setTimeout(() => {
          pendingKey.current = null;
        }, 1000); // 1 second timeout for second key
        return;
      }
    },
    [location, navigate, shortcuts],
  );

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  return { shortcuts, showHelp, setShowHelp };
}
