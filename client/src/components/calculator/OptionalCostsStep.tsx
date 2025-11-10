import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { InfoIcon } from 'lucide-react';
import type { FleetInputs } from './types';

interface OptionalCostsStepProps {
  data: Partial<FleetInputs>;
  onChange: (data: Partial<FleetInputs>) => void;
}

export function OptionalCostsStep({ data, onChange }: OptionalCostsStepProps) {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold mb-2">Current Costs (Optional)</h2>
        <p className="text-gray-600">Provide actual costs for more accurate calculations, or skip to use industry estimates</p>
      </div>

      <Alert>
        <InfoIcon className="h-4 w-4" />
        <AlertDescription>
          These fields are optional. If you don't have exact numbers, our calculator will estimate based on industry averages for your fleet size and age.
        </AlertDescription>
      </Alert>

      {/* Monthly Supply Costs */}
      <div className="space-y-2">
        <Label htmlFor="supply-cost">Monthly supply costs (toner, drums, etc.)</Label>
        <div className="relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">$</span>
          <Input
            id="supply-cost"
            type="number"
            min={0}
            step={50}
            value={data.monthlySupplieCost || ''}
            onChange={(e) => onChange({ monthlySupplieCost: parseFloat(e.target.value) || undefined })}
            placeholder="Leave blank to estimate..."
            className="pl-7"
          />
        </div>
      </div>

      {/* Monthly Service Costs */}
      <div className="space-y-2">
        <Label htmlFor="service-cost">Monthly service/maintenance costs</Label>
        <div className="relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">$</span>
          <Input
            id="service-cost"
            type="number"
            min={0}
            step={50}
            value={data.monthlyServiceCost || ''}
            onChange={(e) => onChange({ monthlyServiceCost: parseFloat(e.target.value) || undefined })}
            placeholder="Leave blank to estimate..."
            className="pl-7"
          />
        </div>
      </div>

      {/* Monthly Downtime */}
      <div className="space-y-2">
        <Label htmlFor="downtime-hours">Estimated downtime hours per month</Label>
        <Input
          id="downtime-hours"
          type="number"
          min={0}
          step={0.5}
          value={data.monthlyDowntimeHours || ''}
          onChange={(e) => onChange({ monthlyDowntimeHours: parseFloat(e.target.value) || undefined })}
          placeholder="Leave blank to estimate..."
        />
        <p className="text-xs text-gray-500">Time when devices are unavailable due to breakdowns or maintenance</p>
      </div>

      {/* Monthly Energy Costs */}
      <div className="space-y-2">
        <Label htmlFor="energy-cost">Monthly energy costs (electricity for devices)</Label>
        <div className="relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">$</span>
          <Input
            id="energy-cost"
            type="number"
            min={0}
            step={10}
            value={data.monthlyEnergyCost || ''}
            onChange={(e) => onChange({ monthlyEnergyCost: parseFloat(e.target.value) || undefined })}
            placeholder="Leave blank to estimate..."
            className="pl-7"
          />
        </div>
      </div>
    </div>
  );
}
