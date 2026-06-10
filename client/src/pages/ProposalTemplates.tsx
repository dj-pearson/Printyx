// PROP-004: Proposal template library — list, create, clone, delete, set-default.
// Editing opens ProposalTemplateEditor (the visual builder) at /proposal-templates/:id/edit.

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useLocation } from 'wouter';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Loader2, Plus, Copy, Trash2, Star, Pencil, FileText, AlertCircle } from 'lucide-react';

const QUERY_KEY = '/api/proposals/proposal-templates';

const TEMPLATE_TYPES = [
  { value: 'equipment_lease', label: 'Equipment Lease' },
  { value: 'service_contract', label: 'Service Contract' },
  { value: 'maintenance_agreement', label: 'Maintenance Agreement' },
  { value: 'managed_services', label: 'Managed Services' },
  { value: 'general', label: 'General Proposal' },
];

interface TemplateRow {
  id: string;
  template_name: string;
  template_type: string;
  description?: string | null;
  is_default?: boolean;
  is_active?: boolean;
  updated_at?: string | null;
}

export default function ProposalTemplates() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [, navigate] = useLocation();
  const [createOpen, setCreateOpen] = useState(false);
  const [newName, setNewName] = useState('');
  const [newType, setNewType] = useState('equipment_lease');

  const { data, isLoading, isError, error } = useQuery<TemplateRow[]>({
    queryKey: [QUERY_KEY],
    queryFn: () => apiRequest(QUERY_KEY),
  });

  const templates = Array.isArray(data) ? data : [];
  const invalidate = () => queryClient.invalidateQueries({ queryKey: [QUERY_KEY] });

  const createMutation = useMutation({
    mutationFn: () =>
      apiRequest(QUERY_KEY, {
        method: 'POST',
        body: {
          templateName: newName.trim() || 'Untitled Template',
          templateType: newType,
          templateContent: { sections: [], globalStyling: null },
        },
      }),
    onSuccess: (row: TemplateRow) => {
      setCreateOpen(false);
      setNewName('');
      invalidate();
      if (row?.id) navigate(`/proposal-templates/${row.id}/edit`);
    },
    onError: (e: any) =>
      toast({ title: 'Create failed', description: e?.message, variant: 'destructive' }),
  });

  const cloneMutation = useMutation({
    mutationFn: (id: string) => apiRequest(`${QUERY_KEY}/${id}/clone`, { method: 'POST' }),
    onSuccess: () => {
      invalidate();
      toast({ title: 'Cloned', description: 'Template duplicated.' });
    },
    onError: (e: any) =>
      toast({ title: 'Clone failed', description: e?.message, variant: 'destructive' }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiRequest(`${QUERY_KEY}/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      invalidate();
      toast({ title: 'Deleted', description: 'Template removed.' });
    },
    onError: (e: any) =>
      toast({ title: 'Delete failed', description: e?.message, variant: 'destructive' }),
  });

  const setDefaultMutation = useMutation({
    mutationFn: (row: TemplateRow) =>
      apiRequest(`${QUERY_KEY}/${row.id}`, {
        method: 'PATCH',
        body: { isDefault: true, templateType: row.template_type },
      }),
    onSuccess: () => {
      invalidate();
      toast({ title: 'Default set', description: 'Default template updated for this type.' });
    },
    onError: (e: any) =>
      toast({ title: 'Failed', description: e?.message, variant: 'destructive' }),
  });

  const typeLabel = (t: string) =>
    TEMPLATE_TYPES.find((x) => x.value === t)?.label ?? t.replace(/_/g, ' ');

  return (
    <div className="p-4 sm:p-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Proposal Templates</h1>
          <p className="text-sm text-muted-foreground">
            Build a branded template once and reuse it on every quote.
          </p>
        </div>
        <Button onClick={() => setCreateOpen(true)}>
          <Plus className="h-4 w-4 mr-2" /> New Template
        </Button>
      </div>

      {isLoading && (
        <div className="flex items-center justify-center h-48 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin mr-2" /> Loading templates…
        </div>
      )}

      {isError && (
        <div className="flex flex-col items-center justify-center h-48 text-center">
          <AlertCircle className="h-8 w-8 text-destructive mb-2" />
          <p className="font-medium">Couldn’t load templates</p>
          <p className="text-sm text-muted-foreground mb-4">{(error as any)?.message}</p>
          <Button onClick={() => invalidate()}>Retry</Button>
        </div>
      )}

      {!isLoading && !isError && templates.length === 0 && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <FileText className="h-10 w-10 text-muted-foreground mb-3" />
            <p className="font-medium mb-1">No templates yet</p>
            <p className="text-sm text-muted-foreground mb-4">
              Create your first reusable proposal template.
            </p>
            <Button onClick={() => setCreateOpen(true)}>
              <Plus className="h-4 w-4 mr-2" /> New Template
            </Button>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {templates.map((t) => (
          <Card key={t.id} className="flex flex-col">
            <CardHeader className="pb-2">
              <div className="flex items-start justify-between gap-2">
                <CardTitle className="text-base flex items-center gap-2">
                  {t.template_name}
                  {t.is_default && (
                    <Badge variant="secondary" className="text-[10px]">
                      <Star className="h-3 w-3 mr-1 fill-amber-400 text-amber-400" />
                      Default
                    </Badge>
                  )}
                </CardTitle>
              </div>
              <Badge variant="outline" className="w-fit text-xs">
                {typeLabel(t.template_type)}
              </Badge>
            </CardHeader>
            <CardContent className="flex-1 flex flex-col justify-between">
              {t.description && (
                <p className="text-sm text-muted-foreground line-clamp-2 mb-3">{t.description}</p>
              )}
              <div className="flex flex-wrap gap-2 mt-auto">
                <Button
                  size="sm"
                  onClick={() => navigate(`/proposal-templates/${t.id}/edit`)}
                  className="min-h-[40px]"
                >
                  <Pencil className="h-4 w-4 mr-1" /> Edit
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => cloneMutation.mutate(t.id)}
                  disabled={cloneMutation.isPending}
                  className="min-h-[40px]"
                >
                  <Copy className="h-4 w-4 mr-1" /> Clone
                </Button>
                {!t.is_default && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setDefaultMutation.mutate(t)}
                    disabled={setDefaultMutation.isPending}
                    className="min-h-[40px]"
                  >
                    <Star className="h-4 w-4 mr-1" /> Set default
                  </Button>
                )}
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    if (confirm(`Delete template "${t.template_name}"?`)) {
                      deleteMutation.mutate(t.id);
                    }
                  }}
                  disabled={deleteMutation.isPending}
                  className="min-h-[40px] text-destructive"
                >
                  <Trash2 className="h-4 w-4 mr-1" /> Delete
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New Proposal Template</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1">
              <Label>Template Name</Label>
              <Input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="Standard Equipment Lease"
                autoFocus
              />
            </div>
            <div className="space-y-1">
              <Label>Type</Label>
              <Select value={newType} onValueChange={setNewType}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TEMPLATE_TYPES.map((t) => (
                    <SelectItem key={t.value} value={t.value}>
                      {t.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>
              Cancel
            </Button>
            <Button onClick={() => createMutation.mutate()} disabled={createMutation.isPending}>
              {createMutation.isPending ? 'Creating…' : 'Create & Edit'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
