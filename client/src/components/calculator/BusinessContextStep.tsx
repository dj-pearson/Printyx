import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { INDUSTRIES, PAIN_POINTS } from './types';
import type { FleetInputs } from './types';

interface BusinessContextStepProps {
  data: Partial<FleetInputs>;
  onChange: (data: Partial<FleetInputs>) => void;
}

export function BusinessContextStep({ data, onChange }: BusinessContextStepProps) {
  const handlePainPointToggle = (painPoint: string, checked: boolean) => {
    const currentPoints = data.painPoints || [];
    const newPoints = checked
      ? [...currentPoints, painPoint]
      : currentPoints.filter((p) => p !== painPoint);
    onChange({ painPoints: newPoints });
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold mb-2">Business Context</h2>
        <p className="text-gray-600">Help us provide tailored recommendations</p>
      </div>

      {/* Employee Count */}
      <div className="space-y-2">
        <Label htmlFor="employee-count">Number of employees</Label>
        <Input
          id="employee-count"
          type="number"
          min={1}
          value={data.employeeCount || ''}
          onChange={(e) => onChange({ employeeCount: parseInt(e.target.value) || 0 })}
          placeholder="Enter number of employees..."
        />
      </div>

      {/* Industry */}
      <div className="space-y-2">
        <Label htmlFor="industry">Industry</Label>
        <Select
          value={data.industry || ''}
          onValueChange={(value) => onChange({ industry: value })}
        >
          <SelectTrigger id="industry">
            <SelectValue placeholder="Select your industry..." />
          </SelectTrigger>
          <SelectContent>
            {INDUSTRIES.map((industry) => (
              <SelectItem key={industry.value} value={industry.value}>
                {industry.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Pain Points */}
      <div className="space-y-3">
        <Label>Current print management challenges (select all that apply)</Label>
        <div className="grid grid-cols-1 gap-3">
          {PAIN_POINTS.map((point) => (
            <div
              key={point.value}
              className="flex items-center space-x-2 border rounded-lg p-3 hover:bg-gray-50"
            >
              <Checkbox
                id={point.value}
                checked={(data.painPoints || []).includes(point.value)}
                onCheckedChange={(checked) =>
                  handlePainPointToggle(point.value, checked as boolean)
                }
              />
              <label
                htmlFor={point.value}
                className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
              >
                {point.label}
              </label>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
