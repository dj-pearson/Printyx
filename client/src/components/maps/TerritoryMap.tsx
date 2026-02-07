import { useEffect, useMemo, useRef, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

// Rep color palette for map markers
const REP_COLORS = [
  '#3b82f6',
  '#ef4444',
  '#10b981',
  '#f59e0b',
  '#8b5cf6',
  '#ec4899',
  '#06b6d4',
  '#f97316',
  '#14b8a6',
  '#6366f1',
  '#84cc16',
  '#e11d48',
  '#0ea5e9',
  '#d946ef',
  '#22c55e',
];

const UNASSIGNED_COLOR = '#9ca3af';

function createMarkerIcon(color: string, size = 12): L.DivIcon {
  return L.divIcon({
    className: '',
    html: `<div style="
      width: ${size}px;
      height: ${size}px;
      border-radius: 50%;
      background: ${color};
      border: 2px solid white;
      box-shadow: 0 1px 3px rgba(0,0,0,0.4);
    "></div>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  });
}

export interface MapAccount {
  id: string;
  companyName: string;
  recordType?: string;
  status?: string;
  billingCity?: string;
  billingState?: string;
  billingPostalCode?: string;
  ownerId?: string | null;
  assignedSalesRep?: string | null;
  lat?: number;
  lng?: number;
}

export interface MapRep {
  id: string;
  firstName?: string | null;
  lastName?: string | null;
  email?: string | null;
}

interface TerritoryMapProps {
  accounts: MapAccount[];
  reps: MapRep[];
  onReassign?: (accountId: string, newRepId: string) => void;
  repFilter?: string | null;
  showUnassigned?: boolean;
}

function FitBounds({ accounts }: { accounts: MapAccount[] }) {
  const map = useMap();
  useEffect(() => {
    const points = accounts
      .filter((a) => a.lat && a.lng)
      .map((a) => [a.lat!, a.lng!] as [number, number]);
    if (points.length > 0) {
      const bounds = L.latLngBounds(points);
      map.fitBounds(bounds, { padding: [30, 30] });
    }
  }, [accounts, map]);
  return null;
}

export default function TerritoryMap({
  accounts,
  reps,
  onReassign,
  repFilter,
  showUnassigned = true,
}: TerritoryMapProps) {
  const [selectedRepForReassign, setSelectedRepForReassign] = useState<string>('');

  // Build rep color map
  const repColorMap = useMemo(() => {
    const map = new Map<string, string>();
    reps.forEach((rep, i) => {
      map.set(rep.id, REP_COLORS[i % REP_COLORS.length]);
    });
    return map;
  }, [reps]);

  // Build rep name map
  const repNameMap = useMemo(() => {
    const map = new Map<string, string>();
    reps.forEach((rep) => {
      map.set(
        rep.id,
        `${rep.firstName || ''} ${rep.lastName || ''}`.trim() || rep.email || 'Unknown',
      );
    });
    return map;
  }, [reps]);

  // Filter accounts
  const filteredAccounts = useMemo(() => {
    return accounts.filter((a) => {
      if (!a.lat || !a.lng) return false;
      if (repFilter && a.ownerId !== repFilter) return false;
      if (!showUnassigned && !a.ownerId) return false;
      return true;
    });
  }, [accounts, repFilter, showUnassigned]);

  // Legend data
  const legendReps = useMemo(() => {
    const repIds = Array.from(new Set(filteredAccounts.map((a) => a.ownerId).filter(Boolean)));
    const hasUnassigned = filteredAccounts.some((a) => !a.ownerId);
    const items: Array<{ id: string | null; name: string; color: string; count: number }> = [];

    for (const repId of repIds) {
      if (repId) {
        items.push({
          id: repId,
          name: repNameMap.get(repId) || 'Unknown',
          color: repColorMap.get(repId) || UNASSIGNED_COLOR,
          count: filteredAccounts.filter((a) => a.ownerId === repId).length,
        });
      }
    }

    if (hasUnassigned) {
      items.push({
        id: null,
        name: 'Unassigned',
        color: UNASSIGNED_COLOR,
        count: filteredAccounts.filter((a) => !a.ownerId).length,
      });
    }

    return items.sort((a, b) => b.count - a.count);
  }, [filteredAccounts, repColorMap, repNameMap]);

  // Default center: US center
  const center: [number, number] = [39.8283, -98.5795];

  return (
    <div className="relative h-full w-full">
      <MapContainer
        center={center}
        zoom={4}
        className="h-full w-full rounded-lg"
        style={{ minHeight: '500px' }}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <FitBounds accounts={filteredAccounts} />

        {filteredAccounts.map((account) => {
          const color = account.ownerId
            ? repColorMap.get(account.ownerId) || UNASSIGNED_COLOR
            : UNASSIGNED_COLOR;

          return (
            <Marker
              key={account.id}
              position={[account.lat!, account.lng!]}
              icon={createMarkerIcon(color)}
            >
              <Popup>
                <div className="min-w-[200px] space-y-2 p-1">
                  <p className="font-semibold text-sm">{account.companyName}</p>
                  {account.billingCity && (
                    <p className="text-xs text-muted-foreground">
                      {account.billingCity}
                      {account.billingState ? `, ${account.billingState}` : ''}
                      {account.billingPostalCode ? ` ${account.billingPostalCode}` : ''}
                    </p>
                  )}
                  <p className="text-xs">
                    <span className="font-medium">Rep:</span>{' '}
                    {account.ownerId ? repNameMap.get(account.ownerId) || 'Unknown' : 'Unassigned'}
                  </p>
                  {account.status && (
                    <Badge variant="outline" className="text-xs">
                      {account.status}
                    </Badge>
                  )}
                  {onReassign && (
                    <div className="flex items-center gap-1 pt-1">
                      <Select
                        value={selectedRepForReassign}
                        onValueChange={setSelectedRepForReassign}
                      >
                        <SelectTrigger className="h-7 text-xs flex-1">
                          <SelectValue placeholder="Reassign to..." />
                        </SelectTrigger>
                        <SelectContent>
                          {reps.map((rep) => (
                            <SelectItem key={rep.id} value={rep.id}>
                              {repNameMap.get(rep.id)}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 text-xs"
                        disabled={!selectedRepForReassign}
                        onClick={() => {
                          if (selectedRepForReassign) {
                            onReassign(account.id, selectedRepForReassign);
                            setSelectedRepForReassign('');
                          }
                        }}
                      >
                        Go
                      </Button>
                    </div>
                  )}
                </div>
              </Popup>
            </Marker>
          );
        })}
      </MapContainer>

      {/* Legend */}
      {legendReps.length > 0 && (
        <div className="absolute top-3 right-3 z-[1000] bg-white/95 backdrop-blur rounded-lg border shadow-md p-3 max-w-[200px] max-h-[300px] overflow-y-auto">
          <p className="text-xs font-semibold mb-2">Sales Reps ({filteredAccounts.length})</p>
          <div className="space-y-1">
            {legendReps.map((item) => (
              <div key={item.id || 'unassigned'} className="flex items-center gap-2 text-xs">
                <div
                  className="w-3 h-3 rounded-full flex-shrink-0"
                  style={{ backgroundColor: item.color }}
                />
                <span className="truncate flex-1">{item.name}</span>
                <span className="text-muted-foreground">{item.count}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
