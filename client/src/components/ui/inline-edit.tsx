import * as React from 'react';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Check, X, Pencil } from 'lucide-react';
import { cn } from '@/lib/utils';

interface InlineEditProps {
  value: string | number;
  onSave: (value: string) => void | Promise<void>;
  type?: 'text' | 'number' | 'email' | 'textarea' | 'select';
  selectOptions?: { value: string; label: string }[];
  placeholder?: string;
  className?: string;
  displayFormat?: (value: string | number) => string;
  validation?: (value: string) => string | null; // Returns error message or null
  autoSave?: boolean; // Save on blur instead of requiring button click
  editable?: boolean; // Allow editing (useful for permission control)
}

export function InlineEdit({
  value,
  onSave,
  type = 'text',
  selectOptions = [],
  placeholder,
  className,
  displayFormat,
  validation,
  autoSave = false,
  editable = true,
}: InlineEditProps) {
  const [isEditing, setIsEditing] = React.useState(false);
  const [editValue, setEditValue] = React.useState(String(value));
  const [error, setError] = React.useState<string | null>(null);
  const [isSaving, setIsSaving] = React.useState(false);
  const inputRef = React.useRef<HTMLInputElement | HTMLTextAreaElement>(null);

  // Update edit value when prop value changes
  React.useEffect(() => {
    if (!isEditing) {
      setEditValue(String(value));
    }
  }, [value, isEditing]);

  // Focus input when entering edit mode
  React.useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  const handleSave = async () => {
    // Validate
    if (validation) {
      const validationError = validation(editValue);
      if (validationError) {
        setError(validationError);
        return;
      }
    }

    // Don't save if value hasn't changed
    if (editValue === String(value)) {
      setIsEditing(false);
      setError(null);
      return;
    }

    setIsSaving(true);
    setError(null);

    try {
      await onSave(editValue);
      setIsEditing(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save');
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    setEditValue(String(value));
    setIsEditing(false);
    setError(null);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (type === 'textarea') {
      if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        handleSave();
      }
    } else {
      if (e.key === 'Enter') {
        e.preventDefault();
        handleSave();
      }
    }

    if (e.key === 'Escape') {
      handleCancel();
    }
  };

  const handleBlur = () => {
    if (autoSave && isEditing) {
      handleSave();
    }
  };

  const displayValue = displayFormat ? displayFormat(value) : String(value);

  if (!editable || !isEditing) {
    return (
      <div
        className={cn(
          'group relative inline-flex items-center gap-2',
          editable && 'cursor-pointer hover:bg-muted/50 rounded px-2 py-1 -mx-2 -my-1',
          className,
        )}
        onClick={() => editable && setIsEditing(true)}
      >
        <span className={cn(!value && 'text-muted-foreground')}>
          {value ? displayValue : placeholder || 'Click to edit'}
        </span>
        {editable && (
          <Pencil className="h-3 w-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
        )}
      </div>
    );
  }

  return (
    <div className={cn('inline-flex flex-col gap-1', className)}>
      <div className="flex items-center gap-2">
        {type === 'select' ? (
          <Select value={editValue} onValueChange={setEditValue}>
            <SelectTrigger className="h-8">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {selectOptions.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : type === 'textarea' ? (
          <Textarea
            ref={inputRef as React.RefObject<HTMLTextAreaElement>}
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            onKeyDown={handleKeyDown}
            onBlur={handleBlur}
            placeholder={placeholder}
            className="min-h-[60px]"
            disabled={isSaving}
          />
        ) : (
          <Input
            ref={inputRef as React.RefObject<HTMLInputElement>}
            type={type}
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            onKeyDown={handleKeyDown}
            onBlur={handleBlur}
            placeholder={placeholder}
            className="h-8"
            disabled={isSaving}
          />
        )}

        {!autoSave && (
          <div className="flex items-center gap-1">
            <Button
              size="sm"
              variant="ghost"
              className="h-8 w-8 p-0"
              onClick={handleSave}
              disabled={isSaving}
            >
              <Check className="h-4 w-4 text-green-600" />
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="h-8 w-8 p-0"
              onClick={handleCancel}
              disabled={isSaving}
            >
              <X className="h-4 w-4 text-destructive" />
            </Button>
          </div>
        )}
      </div>

      {error && <span className="text-xs text-destructive">{error}</span>}
    </div>
  );
}

/**
 * Inline edit for currency values
 */
interface InlineEditCurrencyProps extends Omit<InlineEditProps, 'type' | 'displayFormat'> {
  currency?: string;
}

export function InlineEditCurrency({ value, currency = 'USD', ...props }: InlineEditCurrencyProps) {
  return (
    <InlineEdit
      {...props}
      value={value}
      type="number"
      displayFormat={(val) => {
        const num = typeof val === 'string' ? parseFloat(val) : val;
        return new Intl.NumberFormat('en-US', {
          style: 'currency',
          currency,
        }).format(num || 0);
      }}
      validation={(val) => {
        const num = parseFloat(val);
        if (isNaN(num)) return 'Please enter a valid number';
        if (num < 0) return 'Value must be positive';
        return null;
      }}
    />
  );
}

/**
 * Inline edit for dates
 */
interface InlineEditDateProps extends Omit<InlineEditProps, 'type' | 'displayFormat'> {}

export function InlineEditDate({ value, ...props }: InlineEditDateProps) {
  return (
    <InlineEdit
      {...props}
      value={value}
      type="text"
      displayFormat={(val) => {
        if (!val) return '';
        try {
          return new Date(String(val)).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
          });
        } catch {
          return String(val);
        }
      }}
    />
  );
}
