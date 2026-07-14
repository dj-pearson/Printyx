/**
 * NotesPanel (CRMX-006) — first-class notes for any CRM record.
 * Drop into any detail page: <NotesPanel parentType="lead" parentId={id} />
 */
import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Pin, PinOff, Trash2, StickyNote } from 'lucide-react';
import { format } from 'date-fns';
import { useToast } from '@/hooks/use-toast';
import { useCrmNotes, type CrmRecordType } from '@/hooks/useCrmNotes';

interface Props {
  parentType: CrmRecordType;
  parentId: string | undefined;
}

export function NotesPanel({ parentType, parentId }: Props) {
  const { toast } = useToast();
  const { notes, isLoading, isError, addNote, updateNote, deleteNote } = useCrmNotes(
    parentType,
    parentId,
  );
  const [draft, setDraft] = useState('');

  const submit = async () => {
    const body = draft.trim();
    if (!body) return;
    try {
      await addNote.mutateAsync(body);
      setDraft('');
    } catch (e: unknown) {
      toast({
        title: 'Could not add note',
        description: e instanceof Error ? e.message : 'Please try again',
        variant: 'destructive',
      });
    }
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <StickyNote className="h-4 w-4" />
          Notes
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Add a note…"
            rows={2}
          />
          <div className="flex justify-end">
            <Button size="sm" onClick={submit} disabled={!draft.trim() || addNote.isPending}>
              {addNote.isPending ? 'Adding…' : 'Add note'}
            </Button>
          </div>
        </div>

        {isLoading && <p className="text-sm text-gray-500">Loading notes…</p>}
        {isError && <p className="text-sm text-gray-600">Could not load notes.</p>}
        {!isLoading && !isError && notes.length === 0 && (
          <p className="text-sm text-gray-400">No notes yet.</p>
        )}

        <div className="space-y-3">
          {notes.map((note) => (
            <div key={note.id} className="rounded-lg border p-3">
              <div className="flex items-start justify-between gap-2">
                <p className="text-sm whitespace-pre-wrap flex-1">{note.body}</p>
                <div className="flex items-center gap-1 shrink-0">
                  <Button
                    variant="ghost"
                    size="sm"
                    title={note.isPinned ? 'Unpin' : 'Pin'}
                    onClick={() => updateNote.mutate({ id: note.id, isPinned: !note.isPinned })}
                  >
                    {note.isPinned ? <PinOff className="h-4 w-4" /> : <Pin className="h-4 w-4" />}
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    title="Delete"
                    onClick={() => deleteNote.mutate(note.id)}
                  >
                    <Trash2 className="h-4 w-4 text-red-500" />
                  </Button>
                </div>
              </div>
              <div className="mt-2 text-xs text-gray-400">
                {note.isPinned && <span className="mr-2 text-amber-600">Pinned</span>}
                {format(new Date(note.createdAt), 'MMM dd, yyyy • h:mm a')}
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
