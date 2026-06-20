import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Mail, Network, Users } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import type {
  CanonicalEntry,
  CanonicalEmailEntry,
  CanonicalSmbEntry,
  CanonicalGroupEntry,
  EntryType,
} from '@shared/address-book-types';

// ---------------------------------------------------------------------------
// Validation schemas — type selector switches the active schema (US-018)
// ---------------------------------------------------------------------------

// RFC 5322 (practical subset) email validation.
const RFC5322 =
  // eslint-disable-next-line no-control-regex
  /^(?:[a-zA-Z0-9!#$%&'*+/=?^_`{|}~-]+(?:\.[a-zA-Z0-9!#$%&'*+/=?^_`{|}~-]+)*|"(?:[^"\\]|\\.)*")@(?:[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\.)+[a-zA-Z]{2,}$/;

const speedDialField = z
  .union([z.coerce.number().int().nonnegative(), z.literal('')])
  .optional()
  .transform((v) => (v === '' || v === undefined ? null : (v as number)));

const emailSchema = z.object({
  entry_type: z.literal('email'),
  display_name: z.string().min(1, 'Display name is required'),
  sort_name: z.string().optional(),
  email: z.string().min(1, 'Email is required').regex(RFC5322, 'Enter a valid email address'),
  speed_dial_index: speedDialField,
});

const smbSchema = z.object({
  entry_type: z.literal('smb'),
  display_name: z.string().min(1, 'Display name is required'),
  smb_host: z.string().min(1, 'Host is required'),
  smb_share_path: z.string().min(1, 'Share path is required'),
  smb_full_unc: z.string().min(1, 'UNC path is required'),
  smb_username: z.string().optional(),
  password: z.string().optional(),
  speed_dial_index: speedDialField,
});

const groupSchema = z.object({
  entry_type: z.literal('group'),
  display_name: z.string().min(1, 'Display name is required'),
  member_entry_ids: z.array(z.string()).default([]),
});

type EmailForm = z.input<typeof emailSchema>;
type SmbForm = z.input<typeof smbSchema>;
type GroupForm = z.input<typeof groupSchema>;
type AnyForm = EmailForm | SmbForm | GroupForm;

function deriveUnc(host?: string, share?: string): string {
  const h = (host || '').replace(/^\\+/, '').trim();
  const s = (share || '').replace(/^\\+/, '').replace(/^\/+/, '').trim();
  if (!h && !s) return '';
  return `\\\\${h}\\${s}`;
}

interface EntryFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  bookId: string;
  /** Existing entry to edit; undefined => create mode. */
  entry?: CanonicalEntry;
  /** Other entries in the same book, used for the group member picker. */
  existingEntries: CanonicalEntry[];
}

export function EntryFormDialog({
  open,
  onOpenChange,
  bookId,
  entry,
  existingEntries,
}: EntryFormDialogProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const isEdit = !!entry?.id;

  const [entryType, setEntryType] = useState<EntryType>(entry?.entry_type ?? 'email');

  // Reset the selected type whenever the dialog is opened for a (different) entry.
  useEffect(() => {
    if (open) setEntryType(entry?.entry_type ?? 'email');
  }, [open, entry]);

  const schema = useMemo(() => {
    if (entryType === 'email') return emailSchema;
    if (entryType === 'smb') return smbSchema;
    return groupSchema;
  }, [entryType]);

  const defaultValues = useMemo<AnyForm>(() => {
    if (entryType === 'email') {
      const e = entry?.entry_type === 'email' ? (entry as CanonicalEmailEntry) : undefined;
      return {
        entry_type: 'email',
        display_name: e?.display_name ?? entry?.display_name ?? '',
        sort_name: e?.sort_name ?? '',
        email: e?.email ?? '',
        speed_dial_index: e?.speed_dial_index ?? '',
      } as EmailForm;
    }
    if (entryType === 'smb') {
      const e = entry?.entry_type === 'smb' ? (entry as CanonicalSmbEntry) : undefined;
      return {
        entry_type: 'smb',
        display_name: e?.display_name ?? entry?.display_name ?? '',
        smb_host: e?.smb_host ?? '',
        smb_share_path: e?.smb_share_path ?? '',
        smb_full_unc: e?.smb_full_unc ?? '',
        smb_username: e?.smb_username ?? '',
        password: '',
        speed_dial_index: e?.speed_dial_index ?? '',
      } as SmbForm;
    }
    const e = entry?.entry_type === 'group' ? (entry as CanonicalGroupEntry) : undefined;
    return {
      entry_type: 'group',
      display_name: e?.display_name ?? entry?.display_name ?? '',
      member_entry_ids: e?.member_entry_ids ?? [],
    } as GroupForm;
  }, [entryType, entry]);

  const form = useForm<AnyForm>({
    resolver: zodResolver(schema) as any,
    defaultValues,
  });

  // Re-seed the form when the active schema / entry changes.
  useEffect(() => {
    form.reset(defaultValues);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [defaultValues]);

  // Auto-derive UNC from host + share while the user has not manually edited it.
  const [uncTouched, setUncTouched] = useState(false);
  useEffect(() => {
    if (entryType !== 'smb' || uncTouched) return;
    const sub = form.watch((values, { name }) => {
      if (name === 'smb_host' || name === 'smb_share_path') {
        const v = values as SmbForm;
        form.setValue('smb_full_unc' as any, deriveUnc(v.smb_host, v.smb_share_path), {
          shouldValidate: false,
        });
      }
    });
    return () => sub.unsubscribe();
  }, [entryType, uncTouched, form]);

  const mutation = useMutation({
    mutationFn: async (payload: Partial<CanonicalEntry>) => {
      if (isEdit) {
        return apiRequest(`/api/address-books/${bookId}/entries/${entry!.id}`, 'PATCH', payload);
      }
      return apiRequest(`/api/address-books/${bookId}/entries`, 'POST', payload);
    },
    // Optimistic update with rollback (US-018).
    onMutate: async (payload) => {
      const key = [`/api/address-books/${bookId}`];
      await queryClient.cancelQueries({ queryKey: key });
      const previous = queryClient.getQueryData<any>(key);
      queryClient.setQueryData<any>(key, (old: any) => {
        if (!old || !Array.isArray(old.entries)) return old;
        if (isEdit) {
          return {
            ...old,
            entries: old.entries.map((en: CanonicalEntry) =>
              en.id === entry!.id ? { ...en, ...payload } : en,
            ),
          };
        }
        return {
          ...old,
          entries: [...old.entries, { ...payload, id: `optimistic-${Date.now()}` }],
        };
      });
      return { previous, key };
    },
    onError: (err: any, _payload, context) => {
      if (context?.previous !== undefined) {
        queryClient.setQueryData(context.key, context.previous);
      }
      toast({
        title: isEdit ? 'Failed to update entry' : 'Failed to create entry',
        description: err?.message || 'An error occurred',
        variant: 'destructive',
      });
    },
    onSuccess: () => {
      toast({ title: isEdit ? 'Entry updated' : 'Entry created' });
      onOpenChange(false);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/address-books/${bookId}`] });
      queryClient.invalidateQueries({ queryKey: [`/api/address-books/${bookId}/entries`] });
    },
  });

  const onSubmit = (values: AnyForm) => {
    const parsed = schema.parse(values);
    mutation.mutate(parsed as Partial<CanonicalEntry>);
  };

  const typeOptions: { value: EntryType; label: string; icon: typeof Mail }[] = [
    { value: 'email', label: 'Email', icon: Mail },
    { value: 'smb', label: 'SMB (Network Folder)', icon: Network },
    { value: 'group', label: 'Group', icon: Users },
  ];

  const memberCandidates = existingEntries.filter(
    (e) => e.id && e.id !== entry?.id && e.entry_type !== 'group',
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Edit Entry' : 'Add Entry'}</DialogTitle>
          <DialogDescription>
            {isEdit
              ? 'Update this address book destination.'
              : 'Add a new destination to this address book.'}
          </DialogDescription>
        </DialogHeader>

        {/* Type selector — disabled in edit mode (changing type would change schema). */}
        <div className="space-y-2">
          <Label>Type</Label>
          <div className="grid grid-cols-3 gap-2">
            {typeOptions.map((opt) => {
              const Icon = opt.icon;
              const selected = entryType === opt.value;
              return (
                <button
                  key={opt.value}
                  type="button"
                  disabled={isEdit}
                  onClick={() => setEntryType(opt.value)}
                  className={`flex min-h-[48px] items-center justify-center gap-2 rounded-md border px-2 py-2 text-sm font-medium transition-colors disabled:opacity-50 ${
                    selected
                      ? 'border-blue-300 bg-blue-50 text-blue-700'
                      : 'border-gray-200 hover:bg-gray-50'
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  <span className="hidden sm:inline">{opt.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <ScrollArea className="max-h-[55vh] pr-3">
              <div className="space-y-4">
                <FormField
                  control={form.control}
                  name={'display_name' as any}
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Display Name</FormLabel>
                      <FormControl>
                        <Input className="min-h-[48px]" {...field} value={field.value ?? ''} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {entryType === 'email' && (
                  <>
                    <FormField
                      control={form.control}
                      name={'sort_name' as any}
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Sort Name</FormLabel>
                          <FormControl>
                            <Input className="min-h-[48px]" {...field} value={field.value ?? ''} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name={'email' as any}
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Email</FormLabel>
                          <FormControl>
                            <Input
                              type="email"
                              className="min-h-[48px]"
                              {...field}
                              value={field.value ?? ''}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <SpeedDialField form={form} />
                  </>
                )}

                {entryType === 'smb' && (
                  <>
                    <FormField
                      control={form.control}
                      name={'smb_host' as any}
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Host</FormLabel>
                          <FormControl>
                            <Input
                              className="min-h-[48px]"
                              placeholder="fileserver01"
                              {...field}
                              value={field.value ?? ''}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name={'smb_share_path' as any}
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Share Path</FormLabel>
                          <FormControl>
                            <Input
                              className="min-h-[48px]"
                              placeholder="scans\incoming"
                              {...field}
                              value={field.value ?? ''}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name={'smb_full_unc' as any}
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Full UNC Path</FormLabel>
                          <FormControl>
                            <Input
                              className="min-h-[48px] font-mono"
                              {...field}
                              value={field.value ?? ''}
                              onChange={(e) => {
                                setUncTouched(true);
                                field.onChange(e);
                              }}
                            />
                          </FormControl>
                          <FormDescription>
                            Auto-derived from host + share path. Edit to override.
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name={'smb_username' as any}
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Username</FormLabel>
                          <FormControl>
                            <Input className="min-h-[48px]" {...field} value={field.value ?? ''} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name={'password' as any}
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Password</FormLabel>
                          <FormControl>
                            <Input
                              type="password"
                              className="min-h-[48px]"
                              placeholder={isEdit ? 'Leave blank to keep current' : ''}
                              autoComplete="new-password"
                              {...field}
                              value={field.value ?? ''}
                            />
                          </FormControl>
                          <FormDescription>
                            Setting a password writes a new credential record.
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <SpeedDialField form={form} />
                  </>
                )}

                {entryType === 'group' && (
                  <FormField
                    control={form.control}
                    name={'member_entry_ids' as any}
                    render={({ field }) => {
                      const selected: string[] = field.value ?? [];
                      const toggle = (id: string) => {
                        if (selected.includes(id)) {
                          field.onChange(selected.filter((s) => s !== id));
                        } else {
                          field.onChange([...selected, id]);
                        }
                      };
                      return (
                        <FormItem>
                          <FormLabel>Members</FormLabel>
                          <FormDescription>
                            Select entries in this book to include in the group.
                          </FormDescription>
                          <div className="mt-2 space-y-1 rounded-md border p-2">
                            {memberCandidates.length === 0 && (
                              <p className="px-1 py-2 text-sm text-gray-500">
                                No other entries available to add.
                              </p>
                            )}
                            {memberCandidates.map((cand) => (
                              <label
                                key={cand.id}
                                className="flex min-h-[44px] cursor-pointer items-center gap-3 rounded px-2 py-1 hover:bg-gray-50"
                              >
                                <Checkbox
                                  checked={selected.includes(cand.id!)}
                                  onCheckedChange={() => toggle(cand.id!)}
                                />
                                <span className="text-sm">{cand.display_name}</span>
                              </label>
                            ))}
                          </div>
                          <FormMessage />
                        </FormItem>
                      );
                    }}
                  />
                )}
              </div>
            </ScrollArea>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                className="min-h-[48px]"
                onClick={() => onOpenChange(false)}
              >
                Cancel
              </Button>
              <Button type="submit" className="min-h-[48px]" disabled={mutation.isPending}>
                {mutation.isPending ? 'Saving…' : isEdit ? 'Save Changes' : 'Add Entry'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

function SpeedDialField({ form }: { form: ReturnType<typeof useForm<AnyForm>> }) {
  return (
    <FormField
      control={form.control}
      name={'speed_dial_index' as any}
      render={({ field }) => (
        <FormItem>
          <FormLabel>Speed Dial Index</FormLabel>
          <FormControl>
            <Input
              type="number"
              min={0}
              className="min-h-[48px]"
              {...field}
              value={field.value ?? ''}
            />
          </FormControl>
          <FormMessage />
        </FormItem>
      )}
    />
  );
}
