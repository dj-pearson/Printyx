/**
 * Renders a single custom field input by its fieldType (CRMX-004).
 * Controlled: pass value + onChange. Value types by field:
 *   text/url/email/select/date → string; number → number; boolean → boolean;
 *   multiselect → string[].
 */
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import type { CustomFieldDefinition } from '@/hooks/useCustomFields';

interface Props {
  field: CustomFieldDefinition;
  value: unknown;
  onChange: (value: unknown) => void;
  disabled?: boolean;
}

export function CustomFieldInput({ field, value, onChange, disabled }: Props) {
  const id = `cf-${field.key}`;
  const options = field.options ?? [];

  const control = () => {
    switch (field.fieldType) {
      case 'boolean':
        return (
          <Switch
            id={id}
            checked={value === true}
            onCheckedChange={(c) => onChange(c)}
            disabled={disabled}
          />
        );
      case 'number':
        return (
          <Input
            id={id}
            type="number"
            value={value === null || value === undefined ? '' : String(value)}
            onChange={(e) => onChange(e.target.value === '' ? null : Number(e.target.value))}
            disabled={disabled}
          />
        );
      case 'date':
        return (
          <Input
            id={id}
            type="date"
            value={typeof value === 'string' ? value : ''}
            onChange={(e) => onChange(e.target.value)}
            disabled={disabled}
          />
        );
      case 'select':
        return (
          <Select
            value={typeof value === 'string' ? value : ''}
            onValueChange={(v) => onChange(v)}
            disabled={disabled}
          >
            <SelectTrigger id={id}>
              <SelectValue placeholder={`Select ${field.label}`} />
            </SelectTrigger>
            <SelectContent>
              {options.map((o) => (
                <SelectItem key={o.value} value={o.value}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        );
      case 'multiselect': {
        const selected = Array.isArray(value) ? (value as string[]) : [];
        const toggle = (v: string) =>
          onChange(selected.includes(v) ? selected.filter((x) => x !== v) : [...selected, v]);
        return (
          <div className="flex flex-wrap gap-2">
            {options.map((o) => {
              const on = selected.includes(o.value);
              return (
                <Badge
                  key={o.value}
                  variant={on ? 'default' : 'outline'}
                  className={disabled ? 'opacity-60' : 'cursor-pointer'}
                  onClick={() => !disabled && toggle(o.value)}
                >
                  {o.label}
                </Badge>
              );
            })}
            {options.length === 0 && (
              <span className="text-xs text-gray-400">No options configured</span>
            )}
          </div>
        );
      }
      case 'email':
      case 'url':
      case 'text':
      default:
        return (
          <Input
            id={id}
            type={
              field.fieldType === 'email' ? 'email' : field.fieldType === 'url' ? 'url' : 'text'
            }
            value={typeof value === 'string' ? value : ''}
            onChange={(e) => onChange(e.target.value)}
            disabled={disabled}
          />
        );
    }
  };

  return (
    <div className="space-y-1.5">
      <Label htmlFor={id} className="flex items-center gap-1">
        {field.label}
        {field.required && <span className="text-red-500">*</span>}
      </Label>
      {control()}
      {field.description && <p className="text-xs text-gray-500">{field.description}</p>}
    </div>
  );
}
