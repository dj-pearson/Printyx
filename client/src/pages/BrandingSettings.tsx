// PROP-003: Branding settings page — loads, edits, and persists company branding
// profiles through the branding-profiles edge function, rendering the existing
// BrandManager as the editor.

import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useLocation } from 'wouter';
import { apiRequest } from '@/lib/queryClient';
import { getApiUrl } from '@/lib/config';
import { getAccessToken } from '@/lib/supabase';
import { useToast } from '@/hooks/use-toast';
import BrandManager, { type BrandProfile } from '@/components/proposal-builder/BrandManager';
import { rowToProfile, profileToPayload, type BrandingRow } from '@/lib/branding/profile-mapping';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Loader2, Plus, Star, Trash2, AlertCircle } from 'lucide-react';

const QUERY_KEY = '/api/branding-profiles';
const NEW_ID = 'new';

function emptyProfile(): BrandProfile {
  // A blank draft that has not been persisted yet (id = NEW_ID).
  return rowToProfile({ id: NEW_ID, name: 'New Brand', company_name: '' });
}

export default function BrandingSettings() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [, navigate] = useLocation();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [draft, setDraft] = useState<BrandProfile | null>(null);

  const { data, isLoading, isError, error } = useQuery<{ profiles: BrandingRow[] }>({
    queryKey: [QUERY_KEY],
    queryFn: () => apiRequest(QUERY_KEY),
  });

  const rows = data?.profiles ?? [];

  // Resolve which profile is being edited: an in-progress draft (new), the
  // selected row, or the first/default row once loaded.
  const activeProfile: BrandProfile | null = useMemo(() => {
    if (draft) return draft;
    if (!rows.length) return null;
    const row = rows.find((r) => r.id === selectedId) ?? rows[0];
    return rowToProfile(row);
  }, [draft, rows, selectedId]);

  const invalidate = () => queryClient.invalidateQueries({ queryKey: [QUERY_KEY] });

  const saveMutation = useMutation({
    mutationFn: async (profile: BrandProfile) => {
      const payload = profileToPayload(profile);
      const isNew = profile.id === NEW_ID || !rows.some((r) => r.id === profile.id);
      if (isNew) {
        return apiRequest(QUERY_KEY, { method: 'POST', body: payload });
      }
      return apiRequest(`${QUERY_KEY}/${profile.id}`, { method: 'PUT', body: payload });
    },
    onSuccess: (res) => {
      const saved = res?.profile as BrandingRow | undefined;
      setDraft(null);
      if (saved?.id) setSelectedId(saved.id);
      invalidate();
      toast({ title: 'Saved', description: 'Branding profile saved.' });
    },
    onError: (e: any) =>
      toast({
        title: 'Save failed',
        description: e?.message ?? 'Could not save branding profile',
        variant: 'destructive',
      }),
  });

  const setDefaultMutation = useMutation({
    mutationFn: (id: string) => apiRequest(`${QUERY_KEY}/${id}/set-default`, { method: 'POST' }),
    onSuccess: () => {
      invalidate();
      toast({ title: 'Default updated', description: 'This is now the default brand.' });
    },
    onError: (e: any) =>
      toast({ title: 'Failed', description: e?.message, variant: 'destructive' }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiRequest(`${QUERY_KEY}/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      setSelectedId(null);
      setDraft(null);
      invalidate();
      toast({ title: 'Deleted', description: 'Branding profile removed.' });
    },
    onError: (e: any) =>
      toast({ title: 'Failed', description: e?.message, variant: 'destructive' }),
  });

  // Multipart logo upload — apiRequest forces JSON, so use a direct fetch with
  // the same auth headers the rest of the app sends.
  const uploadLogo = async (file: File): Promise<string> => {
    const profileId = activeProfile?.id;
    if (!profileId || profileId === NEW_ID) {
      toast({
        title: 'Save first',
        description: 'Save the profile before uploading a logo.',
        variant: 'destructive',
      });
      throw new Error('Profile must be saved before logo upload');
    }
    const form = new FormData();
    form.append('file', file);
    const token = await getAccessToken();
    const headers: Record<string, string> = {};
    if (token) headers['Authorization'] = `Bearer ${token}`;
    const tenantId =
      localStorage.getItem('tenant-id') ||
      localStorage.getItem('printyx-tenant-id') ||
      localStorage.getItem('x-tenant-id');
    if (tenantId) headers['x-tenant-id'] = tenantId;

    const res = await fetch(getApiUrl(`${QUERY_KEY}/${profileId}/logo`), {
      method: 'POST',
      headers,
      body: form,
      credentials: 'omit',
    });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(`Logo upload failed (${res.status}): ${text.slice(0, 200)}`);
    }
    const json = await res.json();
    invalidate();
    return json.logoUrl as string;
  };

  const handleNew = () => {
    setDraft(emptyProfile());
    setSelectedId(NEW_ID);
  };

  if (isLoading) {
    return (
      <div className="flex h-[60vh] items-center justify-center text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin mr-2" /> Loading branding…
      </div>
    );
  }

  if (isError) {
    return (
      <div className="flex h-[60vh] flex-col items-center justify-center text-center px-4">
        <AlertCircle className="h-8 w-8 text-destructive mb-2" />
        <p className="font-medium">Couldn’t load branding profiles</p>
        <p className="text-sm text-muted-foreground mb-4">
          {(error as any)?.message ?? 'Unknown error'}
        </p>
        <Button onClick={() => invalidate()}>Retry</Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Management bar */}
      <div className="flex flex-wrap items-center gap-2 border-b bg-white p-3">
        <h1 className="text-lg font-semibold mr-2">Branding</h1>
        <Select
          value={activeProfile?.id ?? ''}
          onValueChange={(v) => {
            setDraft(null);
            setSelectedId(v);
          }}
        >
          <SelectTrigger className="w-56 min-h-[40px]">
            <SelectValue placeholder="Select a profile" />
          </SelectTrigger>
          <SelectContent>
            {draft && <SelectItem value={NEW_ID}>New Brand (unsaved)</SelectItem>}
            {rows.map((r) => (
              <SelectItem key={r.id} value={r.id}>
                {r.name}
                {r.is_default ? ' ★' : ''}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Button variant="outline" size="sm" onClick={handleNew} className="min-h-[40px]">
          <Plus className="h-4 w-4 mr-1" /> New
        </Button>

        {activeProfile && activeProfile.id !== NEW_ID && (
          <>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setDefaultMutation.mutate(activeProfile.id)}
              disabled={activeProfile.isDefault || setDefaultMutation.isPending}
              className="min-h-[40px]"
            >
              <Star
                className={`h-4 w-4 mr-1 ${activeProfile.isDefault ? 'fill-amber-400 text-amber-400' : ''}`}
              />
              {activeProfile.isDefault ? 'Default' : 'Set default'}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                if (confirm('Delete this branding profile?')) {
                  deleteMutation.mutate(activeProfile.id);
                }
              }}
              disabled={deleteMutation.isPending}
              className="min-h-[40px] text-destructive"
            >
              <Trash2 className="h-4 w-4 mr-1" /> Delete
            </Button>
          </>
        )}
      </div>

      {/* Editor */}
      <div className="flex-1 overflow-hidden">
        {activeProfile ? (
          <BrandManager
            key={activeProfile.id}
            initialProfile={activeProfile}
            saving={saveMutation.isPending}
            onSave={(p) => saveMutation.mutate(p)}
            onUploadLogo={uploadLogo}
            onClose={() => navigate('/quote-proposal-generation')}
          />
        ) : (
          <div className="flex h-[50vh] flex-col items-center justify-center text-center px-4">
            <p className="text-muted-foreground mb-4">No branding profiles yet.</p>
            <Button onClick={handleNew}>
              <Plus className="h-4 w-4 mr-1" /> Create your first brand
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
