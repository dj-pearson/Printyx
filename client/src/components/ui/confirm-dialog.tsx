/**
 * An in-app replacement for `window.confirm` (UI-BROWSER-DIALOGS-001).
 *
 * Twenty destructive actions in this product asked with a browser confirm. That
 * modal blocks the main thread, cannot be styled or themed, renders differently
 * on every platform, and on iOS Safari arrives with the site's hostname above
 * it - so the last thing between a user and a delete looked least like the
 * product.
 *
 * WHY A PROMISE, NOT A COMPONENT PER CALL SITE. The story's filing note warns
 * that several of these confirms sit inside a mutation callback rather than a
 * click handler, so a declarative `<AlertDialog open={...}>` has to be hoisted
 * into component state and the surrounding logic split in two. A promise keeps
 * the call site's SHAPE - `if (!(await confirm({...}))) return;` reads the way
 * `if (!confirm(...)) return;` read - so twenty conversions stay mechanical.
 *
 * WHY A PROVIDER, NOT A HOOK RETURNING JSX. A hook that hands back a `dialog`
 * element needs every one of those twenty components to find a place in its
 * render tree to put it, which is twenty judgement calls in files the change
 * otherwise does not touch. One provider at the app root renders it once.
 *
 * RESOLVING FALSE IS THE DEFAULT AND IT MATTERS. Escape, the overlay and the
 * cancel button all resolve false, and so does a second question arriving while
 * one is open. A promise that never settles leaves the caller's `await` hanging
 * forever, which for a delete handler is a button that did nothing and said
 * nothing - worse than either answer.
 */
import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';

export interface ConfirmOptions {
  title: string;
  description?: string;
  /** Defaults to "Delete": every current caller is a destructive act. */
  confirmLabel?: string;
  cancelLabel?: string;
  /** Destructive styling is the default, for the same reason. */
  destructive?: boolean;
}

export type ConfirmFn = (options: ConfirmOptions) => Promise<boolean>;

export interface TextPromptOptions {
  title: string;
  description?: string;
  label: string;
  defaultValue?: string;
  placeholder?: string;
  confirmLabel?: string;
  /** Submitting nothing is a cancel unless the caller says otherwise. */
  allowEmpty?: boolean;
}

/** Resolves null on cancel, matching window.prompt so call sites keep their shape. */
export type TextPromptFn = (options: TextPromptOptions) => Promise<string | null>;

interface PendingConfirm extends ConfirmOptions {
  resolve: (answer: boolean) => void;
}

interface PendingPrompt extends TextPromptOptions {
  resolve: (answer: string | null) => void;
}

/**
 * Outside a provider the answer is NO, not a crash and not a silent yes.
 * A destructive action reached through a tree nobody wrapped must not proceed
 * unasked, and throwing would turn a missing provider into a broken page.
 */
const ConfirmContext = createContext<ConfirmFn>(() => Promise.resolve(false));

/** Outside a provider a prompt answers null - a cancel - for the same reason. */
const TextPromptContext = createContext<TextPromptFn>(() => Promise.resolve(null));

export function useConfirm(): ConfirmFn {
  return useContext(ConfirmContext);
}

export function useTextPrompt(): TextPromptFn {
  return useContext(TextPromptContext);
}

export function ConfirmDialogProvider({ children }: { children: ReactNode }) {
  const [pending, setPending] = useState<PendingConfirm | null>(null);
  // Also in a ref: the settle path runs from event handlers that captured an
  // older render, and reading `pending` there would see a stale value.
  const pendingRef = useRef<PendingConfirm | null>(null);

  const settle = useCallback((answer: boolean) => {
    pendingRef.current?.resolve(answer);
    pendingRef.current = null;
    setPending(null);
  }, []);

  const confirm = useCallback<ConfirmFn>((options) => {
    return new Promise<boolean>((resolve) => {
      pendingRef.current?.resolve(false);
      const next = { ...options, resolve };
      pendingRef.current = next;
      setPending(next);
    });
  }, []);

  const [prompting, setPrompting] = useState<PendingPrompt | null>(null);
  const [draft, setDraft] = useState('');
  const promptingRef = useRef<PendingPrompt | null>(null);

  const settlePrompt = useCallback((answer: string | null) => {
    promptingRef.current?.resolve(answer);
    promptingRef.current = null;
    setPrompting(null);
    setDraft('');
  }, []);

  const textPrompt = useCallback<TextPromptFn>((options) => {
    return new Promise<string | null>((resolve) => {
      promptingRef.current?.resolve(null);
      const next = { ...options, resolve };
      promptingRef.current = next;
      setPrompting(next);
      setDraft(options.defaultValue ?? '');
    });
  }, []);

  const submitPrompt = useCallback(() => {
    const trimmed = draft.trim();
    // An empty answer is a cancel unless the caller asked for it: window.prompt
    // returns '' there, and every caller here treats a blank URL or reason as
    // nothing to act on.
    if (trimmed === '' && !promptingRef.current?.allowEmpty) {
      settlePrompt(null);
      return;
    }
    settlePrompt(draft);
  }, [draft, settlePrompt]);

  return (
    <TextPromptContext.Provider value={textPrompt}>
      <ConfirmContext.Provider value={confirm}>
        {children}
        <AlertDialog
          open={pending !== null}
          onOpenChange={(open) => {
            if (!open) settle(false);
          }}
        >
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>{pending?.title}</AlertDialogTitle>
              {pending?.description ? (
                <AlertDialogDescription>{pending.description}</AlertDialogDescription>
              ) : null}
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel onClick={() => settle(false)}>
                {pending?.cancelLabel ?? 'Cancel'}
              </AlertDialogCancel>
              <AlertDialogAction asChild>
                <Button
                  variant={pending?.destructive === false ? 'default' : 'destructive'}
                  onClick={() => settle(true)}
                >
                  {pending?.confirmLabel ?? 'Delete'}
                </Button>
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
        <Dialog
          open={prompting !== null}
          onOpenChange={(open) => {
            if (!open) settlePrompt(null);
          }}
        >
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{prompting?.title}</DialogTitle>
              {prompting?.description ? (
                <DialogDescription>{prompting.description}</DialogDescription>
              ) : null}
            </DialogHeader>
            <form
              onSubmit={(event) => {
                event.preventDefault();
                submitPrompt();
              }}
              className="space-y-3"
            >
              {/* Wrapped rather than linked by id: no id means nothing collides
                when another dialog is mounted at the same time (CR-035). */}
              <label className="block space-y-1.5">
                <span className="text-sm font-medium leading-none">{prompting?.label}</span>
                <Input
                  value={draft}
                  autoFocus
                  placeholder={prompting?.placeholder}
                  onChange={(event) => setDraft(event.target.value)}
                />
              </label>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => settlePrompt(null)}>
                  Cancel
                </Button>
                <Button type="submit">{prompting?.confirmLabel ?? 'Save'}</Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </ConfirmContext.Provider>
    </TextPromptContext.Provider>
  );
}
