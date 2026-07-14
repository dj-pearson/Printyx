/**
 * CRMX-011: Web Form builder — edit fields (add/remove/reorder + map to lead
 * fields incl. custom fields), settings, publish, embed snippet, submissions.
 */
import { useEffect, useMemo, useState } from 'react';
import { useRoute, useLocation } from 'wouter';
import MainLayout from '@/components/layout/main-layout';
import {
  useWebForm,
  useWebForms,
  useWebFormSubmissions,
  type WebFormField,
  type WebFormFieldType,
  type WebFormSettings,
} from '@/hooks/useWebForms';
import { useCustomFields } from '@/hooks/useCustomFields';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useToast } from '@/hooks/use-toast';
import { ArrowLeft, ChevronUp, ChevronDown, Trash2, Plus, Copy, Save } from 'lucide-react';

const FIELD_TYPES: WebFormFieldType[] = [
  'text',
  'email',
  'phone',
  'textarea',
  'select',
  'checkbox',
  'number',
  'url',
];

const LEAD_FIELD_OPTIONS = [
  { value: 'companyName', label: 'Company' },
  { value: 'primaryContactName', label: 'Contact Name' },
  { value: 'primaryContactEmail', label: 'Email' },
  { value: 'primaryContactPhone', label: 'Phone' },
  { value: 'notes', label: 'Notes' },
];

const NO_MAP = '__none__';

function slugifyKey(label: string, existing: Set<string>): string {
  const base =
    label
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '')
      .slice(0, 40) || 'field';
  let key = base;
  let n = 1;
  while (existing.has(key)) key = `${base}_${n++}`;
  return key;
}

export default function WebFormBuilder() {
  const [, params] = useRoute('/marketing/forms/:id');
  const formId = params?.id;
  const [, navigate] = useLocation();
  const { toast } = useToast();

  const { data: form, isLoading } = useWebForm(formId);
  const { updateForm, deleteForm } = useWebForms();
  const { fields: customFields } = useCustomFields('leads');
  const { data: submissions = [] } = useWebFormSubmissions(formId);

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [status, setStatus] = useState<'draft' | 'published' | 'archived'>('draft');
  const [fields, setFields] = useState<WebFormField[]>([]);
  const [settings, setSettings] = useState<WebFormSettings>({});

  useEffect(() => {
    if (form) {
      setName(form.name);
      setDescription(form.description ?? '');
      setStatus(form.status);
      setFields(form.fields ?? []);
      setSettings(form.settings ?? {});
    }
  }, [form?.id]);

  const mapToOptions = useMemo(
    () => [
      ...LEAD_FIELD_OPTIONS,
      ...customFields
        .filter((f) => f.isActive)
        .map((f) => ({ value: `cf_${f.key}`, label: `${f.label} (custom)` })),
    ],
    [customFields],
  );

  const hostedUrl = form ? `${window.location.origin}/f/${form.publicToken}` : '';
  const embedSnippet = form
    ? `<iframe src="${hostedUrl}" width="100%" height="600" frameborder="0" title="${form.name}"></iframe>`
    : '';

  const addField = () => {
    setFields((prev) => {
      const existing = new Set(prev.map((f) => f.key));
      const key = slugifyKey('field', existing);
      return [
        ...prev,
        { key, label: 'New Field', type: 'text', required: false, order: prev.length },
      ];
    });
  };

  const updateField = (index: number, patch: Partial<WebFormField>) => {
    setFields((prev) => prev.map((f, i) => (i === index ? { ...f, ...patch } : f)));
  };

  const moveField = (index: number, dir: -1 | 1) => {
    setFields((prev) => {
      const target = index + dir;
      if (target < 0 || target >= prev.length) return prev;
      const next = [...prev];
      const [moved] = next.splice(index, 1);
      next.splice(target, 0, moved);
      return next.map((f, i) => ({ ...f, order: i }));
    });
  };

  const removeField = (index: number) => {
    setFields((prev) => prev.filter((_, i) => i !== index).map((f, i) => ({ ...f, order: i })));
  };

  const handleSave = async (nextStatus?: 'draft' | 'published' | 'archived') => {
    if (!formId) return;
    const finalStatus = nextStatus ?? status;
    try {
      await updateForm.mutateAsync({
        id: formId,
        name,
        description,
        status: finalStatus,
        fields: fields.map((f, i) => ({ ...f, order: i })),
        settings,
      });
      setStatus(finalStatus);
      toast({ title: finalStatus === 'published' ? 'Form published' : 'Form saved' });
    } catch {
      toast({ title: 'Failed to save form', variant: 'destructive' });
    }
  };

  const handleDelete = async () => {
    if (!formId) return;
    await deleteForm.mutateAsync(formId);
    toast({ title: 'Form deleted' });
    navigate('/marketing/forms');
  };

  const copy = (text: string, what: string) => {
    navigator.clipboard?.writeText(text).then(() => toast({ title: `${what} copied` }));
  };

  if (isLoading || !form) {
    return (
      <MainLayout>
        <div className="p-6 space-y-3">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-64 w-full" />
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className="p-4 sm:p-6 space-y-4 max-w-4xl mx-auto">
        <div className="flex items-center justify-between gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate('/marketing/forms')}
            className="gap-1.5"
          >
            <ArrowLeft className="h-4 w-4" /> Forms
          </Button>
          <div className="flex items-center gap-2">
            <Badge
              variant={status === 'published' ? 'default' : 'secondary'}
              className="capitalize"
            >
              {status}
            </Badge>
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleSave()}
              disabled={updateForm.isPending}
              className="gap-1.5"
            >
              <Save className="h-4 w-4" /> Save
            </Button>
            {status !== 'published' ? (
              <Button
                size="sm"
                onClick={() => handleSave('published')}
                disabled={updateForm.isPending}
              >
                Publish
              </Button>
            ) : (
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleSave('draft')}
                disabled={updateForm.isPending}
              >
                Unpublish
              </Button>
            )}
          </div>
        </div>

        {/* Basics */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Form details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <Label htmlFor="name">Name</Label>
              <Input id="name" value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div>
              <Label htmlFor="desc">Description</Label>
              <Textarea
                id="desc"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>
          </CardContent>
        </Card>

        {/* Fields */}
        <Card>
          <CardHeader className="pb-3 flex-row items-center justify-between">
            <CardTitle className="text-base">Fields</CardTitle>
            <Button variant="outline" size="sm" onClick={addField} className="gap-1.5">
              <Plus className="h-4 w-4" /> Add field
            </Button>
          </CardHeader>
          <CardContent className="space-y-3">
            {fields.length === 0 && (
              <p className="text-sm text-muted-foreground">
                No fields yet. Add one to get started.
              </p>
            )}
            {fields.map((field, index) => (
              <div key={field.key} className="rounded-md border p-3 space-y-2">
                <div className="flex items-center gap-2">
                  <div className="flex flex-col">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-5 w-6"
                      disabled={index === 0}
                      onClick={() => moveField(index, -1)}
                      aria-label="Move up"
                    >
                      <ChevronUp className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-5 w-6"
                      disabled={index === fields.length - 1}
                      onClick={() => moveField(index, 1)}
                      aria-label="Move down"
                    >
                      <ChevronDown className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                  <Input
                    className="flex-1"
                    value={field.label}
                    onChange={(e) => updateField(index, { label: e.target.value })}
                    placeholder="Field label"
                  />
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-destructive"
                    onClick={() => removeField(index)}
                    aria-label="Remove field"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pl-8">
                  <div>
                    <Label className="text-xs">Type</Label>
                    <Select
                      value={field.type}
                      onValueChange={(v) => updateField(index, { type: v as WebFormFieldType })}
                    >
                      <SelectTrigger className="h-8">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {FIELD_TYPES.map((t) => (
                          <SelectItem key={t} value={t} className="capitalize">
                            {t}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-xs">Maps to</Label>
                    <Select
                      value={field.mapTo ?? NO_MAP}
                      onValueChange={(v) =>
                        updateField(index, { mapTo: v === NO_MAP ? undefined : v })
                      }
                    >
                      <SelectTrigger className="h-8">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={NO_MAP}>— Not mapped —</SelectItem>
                        {mapToOptions.map((o) => (
                          <SelectItem key={o.value} value={o.value}>
                            {o.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex items-end gap-2 pb-1">
                    <Switch
                      id={`req-${field.key}`}
                      checked={!!field.required}
                      onCheckedChange={(c) => updateField(index, { required: c })}
                    />
                    <Label htmlFor={`req-${field.key}`} className="text-xs">
                      Required
                    </Label>
                  </div>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Settings */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Settings</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Submit button text</Label>
              <Input
                value={settings.submitButtonText ?? ''}
                onChange={(e) => setSettings({ ...settings, submitButtonText: e.target.value })}
                placeholder="Submit"
              />
            </div>
            <div>
              <Label className="text-xs">Lead source</Label>
              <Input
                value={settings.leadSource ?? ''}
                onChange={(e) => setSettings({ ...settings, leadSource: e.target.value })}
                placeholder="web_form"
              />
            </div>
            <div className="sm:col-span-2">
              <Label className="text-xs">Success message</Label>
              <Textarea
                value={settings.successMessage ?? ''}
                onChange={(e) => setSettings({ ...settings, successMessage: e.target.value })}
                placeholder="Thanks! We received your submission."
              />
            </div>
            <div>
              <Label className="text-xs">Redirect URL (optional)</Label>
              <Input
                value={settings.redirectUrl ?? ''}
                onChange={(e) => setSettings({ ...settings, redirectUrl: e.target.value })}
                placeholder="https://"
              />
            </div>
            <div>
              <Label className="text-xs">Autoresponder workflow ID (optional)</Label>
              <Input
                value={settings.autoresponderWorkflowId ?? ''}
                onChange={(e) =>
                  setSettings({ ...settings, autoresponderWorkflowId: e.target.value })
                }
                placeholder="workflow id"
              />
            </div>
          </CardContent>
        </Card>

        {/* Embed */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Share &amp; embed</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <Label className="text-xs">Hosted URL</Label>
              <div className="flex gap-2">
                <Input readOnly value={hostedUrl} className="font-mono text-xs" />
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => copy(hostedUrl, 'URL')}
                  aria-label="Copy URL"
                >
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
            </div>
            <div>
              <Label className="text-xs">Embed snippet</Label>
              <div className="flex gap-2">
                <Textarea readOnly value={embedSnippet} className="font-mono text-xs" rows={2} />
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => copy(embedSnippet, 'Embed code')}
                  aria-label="Copy embed"
                >
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
              {status !== 'published' && (
                <p className="text-xs text-muted-foreground mt-1">
                  Publish the form to make the hosted URL live.
                </p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Submissions */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Recent submissions ({submissions.length})</CardTitle>
          </CardHeader>
          <CardContent>
            {submissions.length === 0 ? (
              <p className="text-sm text-muted-foreground">No submissions yet.</p>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>When</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Preview</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {submissions.slice(0, 25).map((s) => (
                      <TableRow key={s.id}>
                        <TableCell className="text-xs whitespace-nowrap">
                          {new Date(s.createdAt).toLocaleString()}
                        </TableCell>
                        <TableCell>
                          <Badge variant="secondary" className="capitalize text-[10px]">
                            {s.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-xs max-w-[280px] truncate">
                          {Object.entries(s.payload)
                            .map(([k, v]) => `${k}: ${String(v)}`)
                            .join(' · ')}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        <div className="flex justify-end">
          <Button
            variant="ghost"
            size="sm"
            className="text-destructive gap-1.5"
            onClick={handleDelete}
          >
            <Trash2 className="h-4 w-4" /> Delete form
          </Button>
        </div>
      </div>
    </MainLayout>
  );
}
