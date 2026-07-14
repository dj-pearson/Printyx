/**
 * Drop-in section that renders all active custom fields for an object type,
 * bound to a `values` map (keyed by field.key) + onChange (CRMX-004).
 *
 * Usage in a create/edit form:
 *   const [cf, setCf] = useState<Record<string, unknown>>(record.customFields ?? {});
 *   <CustomFieldsSection objectType="deals" values={cf} onChange={setCf} />
 *   // then submit `customFields: cf` in the payload — the server validates it.
 */
import { useCustomFields, type CustomFieldObjectType } from '@/hooks/useCustomFields';
import { CustomFieldInput } from './CustomFieldInput';

interface Props {
  objectType: CustomFieldObjectType;
  values: Record<string, unknown>;
  onChange: (values: Record<string, unknown>) => void;
  disabled?: boolean;
  /** Hide the "Custom Fields" heading (when embedding under an existing heading). */
  hideHeading?: boolean;
}

export function CustomFieldsSection({
  objectType,
  values,
  onChange,
  disabled,
  hideHeading,
}: Props) {
  const { fields, isLoading } = useCustomFields(objectType);

  if (isLoading || fields.length === 0) return null;

  const setValue = (key: string, v: unknown) => onChange({ ...values, [key]: v });

  return (
    <div className="space-y-4">
      {!hideHeading && <h4 className="text-sm font-semibold text-gray-700">Custom Fields</h4>}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {fields.map((field) => (
          <CustomFieldInput
            key={field.id}
            field={field}
            value={values[field.key]}
            onChange={(v) => setValue(field.key, v)}
            disabled={disabled}
          />
        ))}
      </div>
    </div>
  );
}
