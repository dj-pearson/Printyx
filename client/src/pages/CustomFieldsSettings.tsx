/**
 * Custom Fields admin page (CRMX-004).
 * Create / edit / reorder / deactivate custom field definitions per object type,
 * backed by /api/custom-fields (CRMX-003).
 */
import { useMemo, useState } from 'react';
import MainLayout from '@/components/layout/main-layout';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
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
import { Plus, Pencil, Trash2, X, AlertTriangle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import {
  useCustomFields,
  type CustomFieldDefinition,
  type CustomFieldObjectType,
  type CustomFieldType,
  type CustomFieldOption,
} from '@/hooks/useCustomFields';

const OBJECT_TYPES: { value: CustomFieldObjectType; label: string }[] = [
  { value: 'deals', label: 'Deals' },
  { value: 'leads', label: 'Leads' },
  { value: 'contacts', label: 'Contacts' },
  { value: 'companies', label: 'Companies' },
];

const FIELD_TYPES: { value: CustomFieldType; label: string }[] = [
  { value: 'text', label: 'Text' },
  { value: 'number', label: 'Number' },
  { value: 'date', label: 'Date' },
  { value: 'boolean', label: 'Yes / No' },
  { value: 'select', label: 'Dropdown (single)' },
  { value: 'multiselect', label: 'Dropdown (multi)' },
  { value: 'url', label: 'URL' },
  { value: 'email', label: 'Email' },
];

const slugify = (label: string) =>
  label
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .replace(/^([0-9])/, 'f_$1')
    .slice(0, 64);

interface FormState {
  id?: string;
  label: string;
  key: string;
  fieldType: CustomFieldType;
  required: boolean;
  defaultValue: string;
  description: string;
  options: CustomFieldOption[];
}

const emptyForm = (): FormState => ({
  label: '',
  key: '',
  fieldType: 'text',
  required: false,
  defaultValue: '',
  description: '',
  options: [],
});

export default function CustomFieldsSettings() {
  const { toast } = useToast();
  const [objectType, setObjectType] = useState<CustomFieldObjectType>('deals');
  const { fields, isLoading, isError, createField, updateField, deleteField } = useCustomFields(
    objectType,
    true,
  );

  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState<FormState>(emptyForm());
  const [keyEdited, setKeyEdited] = useState(false);

  const isEditing = Boolean(form.id);
  const needsOptions = form.fieldType === 'select' || form.fieldType === 'multiselect';

  const sortedFields = useMemo(
    () => [...fields].sort((a, b) => a.sortOrder - b.sortOrder),
    [fields],
  );

  const openCreate = () => {
    setForm(emptyForm());
    setKeyEdited(false);
    setDialogOpen(true);
  };

  const openEdit = (f: CustomFieldDefinition) => {
    setForm({
      id: f.id,
      label: f.label,
      key: f.key,
      fieldType: f.fieldType,
      required: f.required,
      defaultValue: f.defaultValue ?? '',
      description: f.description ?? '',
      options: f.options ?? [],
    });
    setKeyEdited(true);
    setDialogOpen(true);
  };

  const setLabel = (label: string) =>
    setForm((prev) => ({
      ...prev,
      label,
      key: !isEditing && !keyEdited ? slugify(label) : prev.key,
    }));

  const addOption = () =>
    setForm((prev) => ({ ...prev, options: [...prev.options, { value: '', label: '' }] }));
  const setOption = (i: number, patch: Partial<CustomFieldOption>) =>
    setForm((prev) => ({
      ...prev,
      options: prev.options.map((o, idx) => (idx === i ? { ...o, ...patch } : o)),
    }));
  const removeOption = (i: number) =>
    setForm((prev) => ({ ...prev, options: prev.options.filter((_, idx) => idx !== i) }));

  const validate = (): string | null => {
    if (!form.label.trim()) return 'Label is required';
    if (!/^[a-z][a-z0-9_]*$/.test(form.key))
      return 'Key must be lower_snake_case and start with a letter';
    if (needsOptions) {
      const opts = form.options.filter((o) => o.value.trim() && o.label.trim());
      if (opts.length === 0) return 'Dropdown fields need at least one option';
    }
    return null;
  };

  const submit = async () => {
    const err = validate();
    if (err) {
      toast({ title: 'Cannot save', description: err, variant: 'destructive' });
      return;
    }
    const options = needsOptions
      ? form.options.filter((o) => o.value.trim() && o.label.trim())
      : null;
    try {
      if (isEditing && form.id) {
        await updateField.mutateAsync({
          id: form.id,
          label: form.label,
          fieldType: form.fieldType,
          required: form.required,
          defaultValue: form.defaultValue || null,
          description: form.description || null,
          options,
        });
        toast({ title: 'Field updated' });
      } else {
        await createField.mutateAsync({
          objectType,
          key: form.key,
          label: form.label,
          fieldType: form.fieldType,
          required: form.required,
          defaultValue: form.defaultValue || null,
          description: form.description || null,
          options,
          sortOrder: sortedFields.length,
        });
        toast({ title: 'Field created' });
      }
      setDialogOpen(false);
    } catch (e: unknown) {
      toast({
        title: 'Save failed',
        description: e instanceof Error ? e.message : 'Please try again',
        variant: 'destructive',
      });
    }
  };

  const toggleActive = async (f: CustomFieldDefinition) => {
    try {
      await updateField.mutateAsync({ id: f.id, isActive: !f.isActive });
    } catch (e: unknown) {
      toast({
        title: 'Update failed',
        description: e instanceof Error ? e.message : 'Please try again',
        variant: 'destructive',
      });
    }
  };

  const remove = async (f: CustomFieldDefinition) => {
    if (!window.confirm(`Permanently delete "${f.label}"? Existing values are not removed.`))
      return;
    try {
      await deleteField.mutateAsync({ id: f.id, hard: true });
      toast({ title: 'Field deleted' });
    } catch (e: unknown) {
      toast({
        title: 'Delete failed',
        description: e instanceof Error ? e.message : 'Please try again',
        variant: 'destructive',
      });
    }
  };

  return (
    <MainLayout
      title="Custom Fields"
      description="Define your own fields on CRM records — no code required."
    >
      <div className="flex items-center justify-between mb-4">
        <Tabs value={objectType} onValueChange={(v) => setObjectType(v as CustomFieldObjectType)}>
          <TabsList>
            {OBJECT_TYPES.map((o) => (
              <TabsTrigger key={o.value} value={o.value}>
                {o.label}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
        <Button onClick={openCreate}>
          <Plus className="h-4 w-4 mr-2" />
          Add Field
        </Button>
      </div>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-10 text-center text-gray-500">Loading…</div>
          ) : isError ? (
            <div className="p-10 text-center text-gray-600">
              <AlertTriangle className="h-6 w-6 text-amber-500 mx-auto mb-2" />
              Could not load custom fields.
            </div>
          ) : sortedFields.length === 0 ? (
            <div className="p-10 text-center text-gray-500">
              No custom fields for {OBJECT_TYPES.find((o) => o.value === objectType)?.label} yet.
              <div className="mt-3">
                <Button variant="outline" onClick={openCreate}>
                  <Plus className="h-4 w-4 mr-2" />
                  Create your first field
                </Button>
              </div>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Label</TableHead>
                  <TableHead>Key</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Required</TableHead>
                  <TableHead>Active</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortedFields.map((f) => (
                  <TableRow key={f.id} className={f.isActive ? '' : 'opacity-60'}>
                    <TableCell className="font-medium">{f.label}</TableCell>
                    <TableCell>
                      <code className="text-xs bg-gray-100 px-1.5 py-0.5 rounded">{f.key}</code>
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary">
                        {FIELD_TYPES.find((t) => t.value === f.fieldType)?.label ?? f.fieldType}
                      </Badge>
                    </TableCell>
                    <TableCell>{f.required ? 'Yes' : 'No'}</TableCell>
                    <TableCell>
                      <Switch checked={f.isActive} onCheckedChange={() => toggleActive(f)} />
                    </TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="sm" onClick={() => openEdit(f)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => remove(f)}>
                        <Trash2 className="h-4 w-4 text-red-500" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{isEditing ? 'Edit Field' : 'New Field'}</DialogTitle>
            <DialogDescription>
              {OBJECT_TYPES.find((o) => o.value === objectType)?.label} · custom field
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="cf-label">Label</Label>
              <Input
                id="cf-label"
                value={form.label}
                onChange={(e) => setLabel(e.target.value)}
                placeholder="e.g. Contract Term"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="cf-key">Key</Label>
              <Input
                id="cf-key"
                value={form.key}
                disabled={isEditing}
                onChange={(e) => {
                  setKeyEdited(true);
                  setForm((prev) => ({ ...prev, key: e.target.value }));
                }}
                placeholder="contract_term"
              />
              <p className="text-xs text-gray-500">
                Stable machine key (lower_snake_case). Cannot be changed after creation.
              </p>
            </div>

            <div className="space-y-1.5">
              <Label>Type</Label>
              <Select
                value={form.fieldType}
                onValueChange={(v) =>
                  setForm((prev) => ({ ...prev, fieldType: v as CustomFieldType }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {FIELD_TYPES.map((t) => (
                    <SelectItem key={t.value} value={t.value}>
                      {t.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {needsOptions && (
              <div className="space-y-2">
                <Label>Options</Label>
                {form.options.map((o, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <Input
                      placeholder="Value"
                      value={o.value}
                      onChange={(e) => setOption(i, { value: e.target.value })}
                    />
                    <Input
                      placeholder="Label"
                      value={o.label}
                      onChange={(e) => setOption(i, { label: e.target.value })}
                    />
                    <Button variant="ghost" size="sm" onClick={() => removeOption(i)}>
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
                <Button variant="outline" size="sm" onClick={addOption}>
                  <Plus className="h-4 w-4 mr-2" />
                  Add option
                </Button>
              </div>
            )}

            {form.fieldType !== 'boolean' && !needsOptions && (
              <div className="space-y-1.5">
                <Label htmlFor="cf-default">Default value (optional)</Label>
                <Input
                  id="cf-default"
                  value={form.defaultValue}
                  onChange={(e) => setForm((prev) => ({ ...prev, defaultValue: e.target.value }))}
                />
              </div>
            )}

            <div className="space-y-1.5">
              <Label htmlFor="cf-desc">Help text (optional)</Label>
              <Textarea
                id="cf-desc"
                value={form.description}
                onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))}
                rows={2}
              />
            </div>

            <div className="flex items-center gap-2">
              <Switch
                id="cf-required"
                checked={form.required}
                onCheckedChange={(c) => setForm((prev) => ({ ...prev, required: c }))}
              />
              <Label htmlFor="cf-required">Required</Label>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={submit} disabled={createField.isPending || updateField.isPending}>
              {isEditing ? 'Save changes' : 'Create field'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </MainLayout>
  );
}
