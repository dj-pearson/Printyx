import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DEVICE_TYPES, FLEET_AGES } from './types';
import type { FleetInputs } from './types';

interface FleetInformationStepProps {
  data: Partial<FleetInputs>;
  onChange: (data: Partial<FleetInputs>) => void;
}

export function FleetInformationStep({ data, onChange }: FleetInformationStepProps) {
  const handleDeviceTypeToggle = (deviceType: string, checked: boolean) => {
    const currentTypes = data.deviceTypes || [];
    const newTypes = checked
      ? [...currentTypes, deviceType]
      : currentTypes.filter(t => t !== deviceType);
    onChange({ deviceTypes: newTypes });
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold mb-2">Fleet Information</h2>
        <p className="text-gray-600">Tell us about your printer and copier fleet</p>
      </div>

      {/* Device Count */}
      <div className="space-y-2">
        <Label htmlFor="device-count">
          Number of devices: <span className="font-semibold text-lg">{data.deviceCount || 1}</span>
        </Label>
        <Slider
          id="device-count"
          min={1}
          max={50}
          step={1}
          value={[data.deviceCount || 1]}
          onValueChange={([value]) => onChange({ deviceCount: value })}
          className="w-full"
        />
        <div className="flex justify-between text-xs text-gray-500">
          <span>1</span>
          <span>50+</span>
        </div>
      </div>

      {/* Device Types */}
      <div className="space-y-3">
        <Label>Device types in your fleet (select all that apply)</Label>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {DEVICE_TYPES.map((type) => (
            <div key={type.value} className="flex items-center space-x-2 border rounded-lg p-3 hover:bg-gray-50">
              <Checkbox
                id={type.value}
                checked={(data.deviceTypes || []).includes(type.value)}
                onCheckedChange={(checked) => handleDeviceTypeToggle(type.value, checked as boolean)}
              />
              <label
                htmlFor={type.value}
                className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
              >
                {type.label}
              </label>
            </div>
          ))}
        </div>
      </div>

      {/* Fleet Age */}
      <div className="space-y-2">
        <Label htmlFor="fleet-age">Average age of your fleet</Label>
        <Select
          value={data.fleetAge || ''}
          onValueChange={(value) => onChange({ fleetAge: value })}
        >
          <SelectTrigger id="fleet-age">
            <SelectValue placeholder="Select fleet age..." />
          </SelectTrigger>
          <SelectContent>
            {FLEET_AGES.map((age) => (
              <SelectItem key={age.value} value={age.value}>
                {age.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Monthly Page Volume */}
      <div className="space-y-2">
        <Label htmlFor="page-volume">
          Monthly page volume: <span className="font-semibold text-lg">{(data.monthlyPageVolume || 0).toLocaleString()}</span> pages
        </Label>
        <Slider
          id="page-volume"
          min={0}
          max={250000}
          step={1000}
          value={[data.monthlyPageVolume || 0]}
          onValueChange={([value]) => onChange({ monthlyPageVolume: value })}
          className="w-full"
        />
        <div className="flex justify-between text-xs text-gray-500">
          <span>0</span>
          <span>250K+</span>
        </div>
      </div>

      {/* Color Ratio */}
      <div className="space-y-2">
        <Label htmlFor="color-ratio">
          Color printing ratio: <span className="font-semibold text-lg">{data.colorRatio || 0}%</span> color
        </Label>
        <Slider
          id="color-ratio"
          min={0}
          max={100}
          step={5}
          value={[data.colorRatio || 20]}
          onValueChange={([value]) => onChange({ colorRatio: value })}
          className="w-full"
        />
        <div className="flex justify-between text-xs text-gray-500">
          <span>0% (All B&W)</span>
          <span>100% (All Color)</span>
        </div>
      </div>
    </div>
  );
}
