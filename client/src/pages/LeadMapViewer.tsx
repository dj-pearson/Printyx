import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from 'react-leaflet';
import L from 'leaflet';
import MarkerClusterGroup from 'react-leaflet-cluster';
import 'leaflet/dist/leaflet.css';
import { apiRequest } from '@/lib/queryClient';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { useToast } from '@/hooks/use-toast';
import {
  MapPin,
  Filter,
  Route,
  Loader2,
  RefreshCw,
  X,
  ChevronDown,
  ChevronUp,
  Zap,
  BarChart3,
} from 'lucide-react';

// Brand color map
const BRAND_COLORS: Record<string, string> = {
  XEROX: '#3b82f6', // blue
  'KONICA-MINOL': '#ef4444', // red
  SHARP: '#10b981', // green
  RICOH: '#f59e0b', // amber
  CANON: '#8b5cf6', // purple
  'KYOCERA-MITA': '#ec4899', // pink
  HEIDELBERG: '#06b6d4', // cyan
  LEXMARK: '#f97316', // orange
  HP: '#14b8a6', // teal
  BROTHER: '#6366f1', // indigo
  EPSON: '#84cc16', // lime
  OTHER: '#9ca3af', // gray
};

function getBrandColor(brands: string[]): string {
  if (!brands.length) return BRAND_COLORS.OTHER;
  // Use the first brand for color
  const primary = brands[0].toUpperCase();
  for (const [key, color] of Object.entries(BRAND_COLORS)) {
    if (primary.includes(key) || key.includes(primary)) return color;
  }
  return BRAND_COLORS.OTHER;
}

function createBrandMarkerIcon(color: string, size = 14): L.DivIcon {
  return L.divIcon({
    className: '',
    html: `<div style="
      width: ${size}px;
      height: ${size}px;
      border-radius: 50%;
      background: ${color};
      border: 2px solid white;
      box-shadow: 0 1px 4px rgba(0,0,0,0.4);
      cursor: pointer;
    "></div>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  });
}

function createSelectedMarkerIcon(size = 18): L.DivIcon {
  return L.divIcon({
    className: '',
    html: `<div style="
      width: ${size}px;
      height: ${size}px;
      border-radius: 50%;
      background: #f59e0b;
      border: 3px solid #ffffff;
      box-shadow: 0 0 0 3px #f59e0b, 0 2px 6px rgba(0,0,0,0.5);
      cursor: pointer;
    "></div>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  });
}

interface LeadMapData {
  id: string;
  companyName: string;
  recordType: string;
  status: string;
  primaryContactName: string | null;
  primaryContactTitle: string | null;
  billingCity: string | null;
  billingState: string | null;
  billingPostalCode: string | null;
  addressLine1: string | null;
  city: string | null;
  state: string | null;
  postalCode: string | null;
  lat: number | null;
  lng: number | null;
  leadSource: string;
  notes: string | null;
  brands: string[];
  equipment: string[];
  uccStatuses: string[];
  unitCount: number;
  ownerId: string | null;
  assignedSalesRep: string | null;
}

interface MapStats {
  total: number;
  geocoded: number;
  pending: number;
  geocodedPct: number;
  brands: Record<string, number>;
  cities: Record<string, number>;
  uccStatuses: Record<string, number>;
}

function FitBounds({ leads }: { leads: LeadMapData[] }) {
  const map = useMap();
  useEffect(() => {
    const points = leads
      .filter((l) => l.lat && l.lng)
      .map((l) => [l.lat!, l.lng!] as [number, number]);
    if (points.length > 0) {
      const bounds = L.latLngBounds(points);
      map.fitBounds(bounds, { padding: [40, 40] });
    } else {
      // Default to Iowa center
      map.setView([41.878, -93.098], 7);
    }
  }, [leads, map]);
  return null;
}

export default function LeadMapViewer() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Filter state
  const [cityFilter, setCityFilter] = useState<string>('');
  const [brandFilter, setBrandFilter] = useState<string>('all');
  const [uccFilter, setUccFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [showOnlyGeocoded, setShowOnlyGeocoded] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(true);

  // Route mode state
  const [routeMode, setRouteMode] = useState(false);
  const [routeStops, setRouteStops] = useState<LeadMapData[]>([]);

  // Fetch map data
  const {
    data: mapResponse,
    isLoading,
    refetch,
  } = useQuery<{ leads: LeadMapData[]; stats: MapStats }>({
    queryKey: ['/api/leads/map-data', { source: 'EDA Import' }],
    queryFn: () => apiRequest('/api/leads/map-data?source=EDA+Import'),
  });

  const leads = mapResponse?.leads || [];
  const stats = mapResponse?.stats || {
    total: 0,
    geocoded: 0,
    pending: 0,
    geocodedPct: 0,
    brands: {},
    cities: {},
    uccStatuses: {},
  };

  // Geocode mutation
  const geocodeMutation = useMutation({
    mutationFn: (payload: { limit?: number }) => apiRequest('/api/leads/geocode', 'POST', payload),
    onSuccess: (data: any) => {
      toast({
        title: 'Geocoding Complete',
        description: `${data.successful || 0} of ${data.processed || 0} leads geocoded`,
      });
      queryClient.invalidateQueries({ queryKey: ['/api/leads/map-data'] });
    },
    onError: (err: Error) => {
      toast({
        title: 'Geocoding Failed',
        description: err.message,
        variant: 'destructive',
      });
    },
  });

  // Filter leads
  const filteredLeads = useMemo(() => {
    let result = leads;

    if (showOnlyGeocoded) {
      result = result.filter((l) => l.lat && l.lng);
    }

    if (cityFilter) {
      const cf = cityFilter.toLowerCase();
      result = result.filter((l) => (l.billingCity || l.city || '').toLowerCase().includes(cf));
    }

    if (brandFilter && brandFilter !== 'all') {
      result = result.filter((l) =>
        l.brands.some((b) => b.toUpperCase().includes(brandFilter.toUpperCase())),
      );
    }

    if (uccFilter && uccFilter !== 'all') {
      result = result.filter((l) => l.uccStatuses.includes(uccFilter));
    }

    if (searchQuery) {
      const sq = searchQuery.toLowerCase();
      result = result.filter(
        (l) =>
          l.companyName.toLowerCase().includes(sq) ||
          (l.primaryContactName || '').toLowerCase().includes(sq),
      );
    }

    return result;
  }, [leads, cityFilter, brandFilter, uccFilter, searchQuery, showOnlyGeocoded]);

  // Mappable leads (those with coords)
  const mappableLeads = useMemo(() => filteredLeads.filter((l) => l.lat && l.lng), [filteredLeads]);

  // Route line coordinates
  const routeLine = useMemo<[number, number][]>(
    () => routeStops.filter((s) => s.lat && s.lng).map((s) => [s.lat!, s.lng!]),
    [routeStops],
  );

  // Top brands and cities for filter options
  const brandOptions = useMemo(() => {
    return Object.entries(stats.brands)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 15);
  }, [stats.brands]);

  const cityOptions = useMemo(() => {
    return Object.entries(stats.cities)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 20);
  }, [stats.cities]);

  const uccOptions = useMemo(() => {
    return Object.entries(stats.uccStatuses).sort((a, b) => b[1] - a[1]);
  }, [stats.uccStatuses]);

  const toggleRouteStop = useCallback((lead: LeadMapData) => {
    setRouteStops((prev) => {
      const exists = prev.find((s) => s.id === lead.id);
      if (exists) return prev.filter((s) => s.id !== lead.id);
      return [...prev, lead];
    });
  }, []);

  // Iowa center
  const center: [number, number] = [41.878, -93.098];

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-[600px]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        <span className="ml-2 text-muted-foreground">Loading map data...</span>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-[calc(100vh-64px)]">
      {/* Stats Bar */}
      <div className="flex items-center gap-4 px-4 py-2 bg-muted/50 border-b text-sm flex-wrap">
        <div className="flex items-center gap-1.5">
          <MapPin className="h-4 w-4 text-blue-500" />
          <span className="font-medium">{stats.total}</span>
          <span className="text-muted-foreground">leads</span>
        </div>
        <div className="flex items-center gap-1.5">
          <Zap className="h-4 w-4 text-green-500" />
          <span className="font-medium">{stats.geocoded}</span>
          <span className="text-muted-foreground">geocoded ({stats.geocodedPct}%)</span>
        </div>
        <div className="flex items-center gap-1.5">
          <BarChart3 className="h-4 w-4 text-orange-500" />
          <span className="font-medium">{filteredLeads.length}</span>
          <span className="text-muted-foreground">filtered</span>
        </div>
        {routeMode && (
          <div className="flex items-center gap-1.5">
            <Route className="h-4 w-4 text-purple-500" />
            <span className="font-medium">{routeStops.length}</span>
            <span className="text-muted-foreground">stops</span>
          </div>
        )}

        <div className="ml-auto flex items-center gap-2">
          <Button
            variant={routeMode ? 'default' : 'outline'}
            size="sm"
            onClick={() => {
              setRouteMode(!routeMode);
              if (routeMode) setRouteStops([]);
            }}
          >
            <Route className="h-3.5 w-3.5 mr-1" />
            {routeMode ? 'Exit Route Mode' : 'Route Mode'}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => geocodeMutation.mutate({ limit: 25 })}
            disabled={geocodeMutation.isPending || stats.pending === 0}
          >
            {geocodeMutation.isPending ? (
              <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />
            ) : (
              <Zap className="h-3.5 w-3.5 mr-1" />
            )}
            Enrich Addresses ({stats.pending})
          </Button>
          <Button variant="ghost" size="sm" onClick={() => refetch()}>
            <RefreshCw className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Filter Sidebar */}
        <div
          className={`border-r bg-background transition-all duration-200 overflow-y-auto ${filtersOpen ? 'w-72' : 'w-10'}`}
        >
          <button
            className="w-full flex items-center justify-center p-2 hover:bg-muted/50"
            onClick={() => setFiltersOpen(!filtersOpen)}
          >
            {filtersOpen ? (
              <ChevronDown className="h-4 w-4 rotate-90" />
            ) : (
              <Filter className="h-4 w-4" />
            )}
          </button>

          {filtersOpen && (
            <div className="px-3 pb-4 space-y-4">
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">
                  Search
                </label>
                <Input
                  placeholder="Company or contact..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="h-8 text-sm"
                />
              </div>

              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">City</label>
                <Select
                  value={cityFilter || 'all'}
                  onValueChange={(v) => setCityFilter(v === 'all' ? '' : v)}
                >
                  <SelectTrigger className="h-8 text-sm">
                    <SelectValue placeholder="All cities" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Cities</SelectItem>
                    {cityOptions.map(([city, count]) => (
                      <SelectItem key={city} value={city}>
                        {city} ({count})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">
                  Brand
                </label>
                <Select value={brandFilter} onValueChange={setBrandFilter}>
                  <SelectTrigger className="h-8 text-sm">
                    <SelectValue placeholder="All brands" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Brands</SelectItem>
                    {brandOptions.map(([brand, count]) => (
                      <SelectItem key={brand} value={brand}>
                        {brand} ({count})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">
                  UCC Status
                </label>
                <Select value={uccFilter} onValueChange={setUccFilter}>
                  <SelectTrigger className="h-8 text-sm">
                    <SelectValue placeholder="All statuses" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Statuses</SelectItem>
                    {uccOptions.map(([status, count]) => (
                      <SelectItem key={status} value={status}>
                        {status} ({count})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-center gap-2">
                <Checkbox
                  id="showGeocoded"
                  checked={showOnlyGeocoded}
                  onCheckedChange={(v) => setShowOnlyGeocoded(!!v)}
                />
                <label htmlFor="showGeocoded" className="text-xs">
                  Show only geocoded
                </label>
              </div>

              {(cityFilter || brandFilter !== 'all' || uccFilter !== 'all' || searchQuery) && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full text-xs"
                  onClick={() => {
                    setCityFilter('');
                    setBrandFilter('all');
                    setUccFilter('all');
                    setSearchQuery('');
                    setShowOnlyGeocoded(false);
                  }}
                >
                  <X className="h-3 w-3 mr-1" /> Clear Filters
                </Button>
              )}

              {/* Brand Legend */}
              <div>
                <p className="text-xs font-medium text-muted-foreground mb-2">Brand Colors</p>
                <div className="space-y-1">
                  {brandOptions.slice(0, 10).map(([brand, count]) => (
                    <div key={brand} className="flex items-center gap-2 text-xs">
                      <div
                        className="w-3 h-3 rounded-full flex-shrink-0"
                        style={{ backgroundColor: getBrandColor([brand]) }}
                      />
                      <span className="truncate flex-1">{brand}</span>
                      <span className="text-muted-foreground">{count}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Route Mode Info */}
              {routeMode && (
                <Card className="border-purple-200 bg-purple-50/50">
                  <CardContent className="p-3">
                    <p className="text-xs font-medium text-purple-700 mb-2">Route Mode Active</p>
                    <p className="text-xs text-purple-600 mb-2">
                      Click map pins to add/remove stops.
                    </p>
                    {routeStops.length > 0 && (
                      <div className="space-y-1">
                        {routeStops.map((stop, i) => (
                          <div key={stop.id} className="flex items-center gap-1 text-xs">
                            <Badge
                              variant="outline"
                              className="h-4 w-4 p-0 flex items-center justify-center text-[10px]"
                            >
                              {i + 1}
                            </Badge>
                            <span className="truncate">{stop.companyName}</span>
                            <button
                              className="ml-auto text-red-400 hover:text-red-600"
                              onClick={() => toggleRouteStop(stop)}
                            >
                              <X className="h-3 w-3" />
                            </button>
                          </div>
                        ))}
                        <Button
                          variant="ghost"
                          size="sm"
                          className="w-full text-xs mt-1"
                          onClick={() => setRouteStops([])}
                        >
                          Clear Route
                        </Button>
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}
            </div>
          )}
        </div>

        {/* Map */}
        <div className="flex-1 relative">
          <MapContainer
            center={center}
            zoom={7}
            className="h-full w-full"
            style={{ minHeight: '500px' }}
          >
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            <FitBounds leads={mappableLeads} />

            <MarkerClusterGroup
              chunkedLoading
              maxClusterRadius={40}
              spiderfyOnMaxZoom
              showCoverageOnHover={false}
            >
              {mappableLeads.map((lead) => {
                const isRouteStop = routeStops.some((s) => s.id === lead.id);
                const color = getBrandColor(lead.brands);
                const icon = isRouteStop
                  ? createSelectedMarkerIcon()
                  : createBrandMarkerIcon(color);

                return (
                  <Marker
                    key={lead.id}
                    position={[lead.lat!, lead.lng!]}
                    icon={icon}
                    eventHandlers={{
                      click: () => {
                        if (routeMode) {
                          toggleRouteStop(lead);
                        }
                      },
                    }}
                  >
                    <Popup>
                      <div className="min-w-[220px] space-y-1.5 p-1">
                        <p className="font-semibold text-sm">{lead.companyName}</p>
                        {lead.primaryContactName && (
                          <p className="text-xs text-muted-foreground">
                            {lead.primaryContactName}
                            {lead.primaryContactTitle ? ` - ${lead.primaryContactTitle}` : ''}
                          </p>
                        )}
                        <p className="text-xs text-muted-foreground">
                          {lead.addressLine1 ||
                            [
                              lead.billingCity || lead.city,
                              lead.billingState || lead.state,
                              lead.billingPostalCode || lead.postalCode,
                            ]
                              .filter(Boolean)
                              .join(', ')}
                        </p>
                        {lead.brands.length > 0 && (
                          <div className="flex flex-wrap gap-1">
                            {lead.brands.map((b) => (
                              <Badge
                                key={b}
                                variant="secondary"
                                className="text-[10px] px-1.5 py-0"
                                style={{
                                  backgroundColor: getBrandColor([b]) + '20',
                                  color: getBrandColor([b]),
                                }}
                              >
                                {b}
                              </Badge>
                            ))}
                          </div>
                        )}
                        <p className="text-xs">
                          <span className="font-medium">{lead.unitCount}</span> equipment unit(s)
                        </p>
                        {lead.uccStatuses.length > 0 && (
                          <div className="flex gap-1">
                            {lead.uccStatuses.map((s) => (
                              <Badge key={s} variant="outline" className="text-[10px]">
                                {s}
                              </Badge>
                            ))}
                          </div>
                        )}
                        {lead.equipment.length > 0 && (
                          <div className="text-[10px] text-muted-foreground max-h-[80px] overflow-y-auto">
                            {lead.equipment.slice(0, 5).map((eq, i) => (
                              <div key={i}>{eq}</div>
                            ))}
                            {lead.equipment.length > 5 && (
                              <div className="text-muted-foreground">
                                +{lead.equipment.length - 5} more
                              </div>
                            )}
                          </div>
                        )}
                        {routeMode && (
                          <Button
                            size="sm"
                            variant={
                              routeStops.some((s) => s.id === lead.id) ? 'destructive' : 'default'
                            }
                            className="w-full h-7 text-xs mt-1"
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleRouteStop(lead);
                            }}
                          >
                            {routeStops.some((s) => s.id === lead.id)
                              ? 'Remove from Route'
                              : 'Add to Route'}
                          </Button>
                        )}
                      </div>
                    </Popup>
                  </Marker>
                );
              })}
            </MarkerClusterGroup>

            {/* Route line */}
            {routeLine.length > 1 && (
              <Polyline
                positions={routeLine}
                pathOptions={{
                  color: '#8b5cf6',
                  weight: 3,
                  opacity: 0.8,
                  dashArray: '10, 6',
                }}
              />
            )}
          </MapContainer>

          {/* No data overlay */}
          {mappableLeads.length === 0 && !isLoading && (
            <div className="absolute inset-0 flex items-center justify-center bg-background/50 z-[500]">
              <Card className="max-w-sm">
                <CardContent className="p-6 text-center">
                  <MapPin className="h-12 w-12 mx-auto mb-3 text-muted-foreground" />
                  <h3 className="font-medium mb-1">No Geocoded Leads</h3>
                  <p className="text-sm text-muted-foreground mb-4">
                    {stats.total > 0
                      ? `${stats.total} leads found but none have coordinates yet. Click "Enrich Addresses" to geocode them.`
                      : 'No leads found. Import leads first using the EDA import script.'}
                  </p>
                  {stats.total > 0 && (
                    <Button
                      onClick={() => geocodeMutation.mutate({ limit: 25 })}
                      disabled={geocodeMutation.isPending}
                    >
                      {geocodeMutation.isPending ? (
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      ) : (
                        <Zap className="h-4 w-4 mr-2" />
                      )}
                      Enrich Addresses
                    </Button>
                  )}
                </CardContent>
              </Card>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
