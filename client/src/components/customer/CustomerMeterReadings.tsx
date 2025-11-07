import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Calendar, Printer, TrendingUp, TrendingDown, Eye, Download } from 'lucide-react';
import { format, startOfMonth, endOfMonth, subMonths } from 'date-fns';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';

interface MeterReading {
  id: string;
  deviceId: string;
  collectionTimestamp: Date;
  totalImpressions: number;
  bwImpressions: number;
  colorImpressions: number;
  tonerLevels: { [key: string]: number };
  rawData: any;
}

interface DeviceWithReadings {
  deviceId: string;
  deviceName: string;
  serialNumber: string;
  model: string;
  readings: MeterReading[];
}

interface CustomerMetricsHistory {
  customerId: string;
  timeline: DeviceWithReadings[];
  totalDevices: number;
  totalReadings: number;
}

interface Props {
  customerId: string;
}

export default function CustomerMeterReadings({ customerId }: Props) {
  const [selectedDevice, setSelectedDevice] = useState<string | null>(null);
  const [dateRange, setDateRange] = useState<'7d' | '30d' | '90d' | 'all'>('30d');

  // Fetch customer meter reading history
  const { data: metricsHistory, isLoading } = useQuery<CustomerMetricsHistory>({
    queryKey: ['/api/customers', customerId, 'metrics/history'],
    select: (data: any) => ({
      ...data,
      timeline: data.timeline.map((device: any) => ({
        ...device,
        readings: device.readings.map((reading: any) => ({
          ...reading,
          collectionTimestamp: new Date(reading.collectionTimestamp),
        })),
      })),
    }),
  });

  // Fetch customer devices for selection
  const { data: customerDevices } = useQuery({
    queryKey: ['/api/customers', customerId, 'devices'],
  });

  if (isLoading) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-center h-32">
            <div className="text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
              <p className="mt-2 text-sm text-gray-600">Loading meter readings...</p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!metricsHistory || metricsHistory.timeline.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Meter Readings</CardTitle>
          <CardDescription>No meter reading data available</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-12 text-gray-500">
            <Printer className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>No devices or meter readings found for this customer.</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Filter readings by date range
  const getFilteredReadings = (readings: MeterReading[]) => {
    const now = new Date();
    let cutoffDate: Date;

    switch (dateRange) {
      case '7d':
        cutoffDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case '30d':
        cutoffDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        break;
      case '90d':
        cutoffDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
        break;
      default:
        return readings;
    }

    return readings.filter((r) => r.collectionTimestamp >= cutoffDate);
  };

  // Selected device data
  const selectedDeviceData = selectedDevice
    ? metricsHistory.timeline.find((d) => d.deviceId === selectedDevice)
    : metricsHistory.timeline[0];

  const filteredReadings = selectedDeviceData
    ? getFilteredReadings(selectedDeviceData.readings)
    : [];

  // Prepare chart data
  const chartData = filteredReadings
    .map((reading) => ({
      date: format(reading.collectionTimestamp, 'MMM dd'),
      timestamp: reading.collectionTimestamp.getTime(),
      totalImpressions: reading.totalImpressions,
      bwImpressions: reading.bwImpressions,
      colorImpressions: reading.colorImpressions,
    }))
    .sort((a, b) => a.timestamp - b.timestamp);

  // Calculate usage statistics
  const calculateUsage = () => {
    if (filteredReadings.length < 2) {
      return { bwUsage: 0, colorUsage: 0, totalUsage: 0 };
    }

    const oldest = filteredReadings[filteredReadings.length - 1];
    const newest = filteredReadings[0];

    return {
      bwUsage: Math.max(0, newest.bwImpressions - oldest.bwImpressions),
      colorUsage: Math.max(0, newest.colorImpressions - oldest.colorImpressions),
      totalUsage: Math.max(0, newest.totalImpressions - oldest.totalImpressions),
    };
  };

  const usage = calculateUsage();

  // Calculate monthly average
  const calculateMonthlyAverage = () => {
    if (filteredReadings.length < 2) return 0;

    const oldest = filteredReadings[filteredReadings.length - 1];
    const newest = filteredReadings[0];
    const daysDiff =
      (newest.collectionTimestamp.getTime() - oldest.collectionTimestamp.getTime()) /
      (1000 * 60 * 60 * 24);

    if (daysDiff === 0) return 0;

    const totalUsage = newest.totalImpressions - oldest.totalImpressions;
    return Math.round((totalUsage / daysDiff) * 30);
  };

  const monthlyAverage = calculateMonthlyAverage();

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Devices</CardTitle>
            <Printer className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metricsHistory.totalDevices}</div>
            <p className="text-xs text-muted-foreground">{metricsHistory.totalReadings} readings</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Usage (Period)</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{usage.totalUsage.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">
              B&W: {usage.bwUsage.toLocaleString()} • Color: {usage.colorUsage.toLocaleString()}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Monthly Average</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{monthlyAverage.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">impressions per month</p>
          </CardContent>
        </Card>
      </div>

      {/* Main Content */}
      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <div>
              <CardTitle>Meter Reading History</CardTitle>
              <CardDescription>Track device usage over time</CardDescription>
            </div>
            <div className="flex gap-2">
              <Select value={dateRange} onValueChange={(v: any) => setDateRange(v)}>
                <SelectTrigger className="w-32">
                  <SelectValue placeholder="Date Range" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="7d">Last 7 days</SelectItem>
                  <SelectItem value="30d">Last 30 days</SelectItem>
                  <SelectItem value="90d">Last 90 days</SelectItem>
                  <SelectItem value="all">All time</SelectItem>
                </SelectContent>
              </Select>

              {metricsHistory.timeline.length > 1 && (
                <Select
                  value={selectedDevice || metricsHistory.timeline[0].deviceId}
                  onValueChange={setSelectedDevice}
                >
                  <SelectTrigger className="w-64">
                    <SelectValue placeholder="Select Device" />
                  </SelectTrigger>
                  <SelectContent>
                    {metricsHistory.timeline.map((device) => (
                      <SelectItem key={device.deviceId} value={device.deviceId}>
                        {device.deviceName} ({device.serialNumber})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}

              <Button variant="outline" size="sm">
                <Download className="h-4 w-4 mr-2" />
                Export
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="chart" className="space-y-4">
            <TabsList>
              <TabsTrigger value="chart">Chart View</TabsTrigger>
              <TabsTrigger value="table">Table View</TabsTrigger>
              <TabsTrigger value="device">Device Details</TabsTrigger>
            </TabsList>

            {/* Chart View */}
            <TabsContent value="chart">
              <div className="space-y-6">
                <div>
                  <h3 className="text-sm font-semibold mb-4">Total Impressions Over Time</h3>
                  <ResponsiveContainer width="100%" height={300}>
                    <LineChart data={chartData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="date" />
                      <YAxis />
                      <Tooltip />
                      <Legend />
                      <Line
                        type="monotone"
                        dataKey="totalImpressions"
                        stroke="#8884d8"
                        name="Total"
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>

                <div>
                  <h3 className="text-sm font-semibold mb-4">B&W vs Color Impressions</h3>
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={chartData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="date" />
                      <YAxis />
                      <Tooltip />
                      <Legend />
                      <Bar dataKey="bwImpressions" fill="#6b7280" name="B&W" />
                      <Bar dataKey="colorImpressions" fill="#3b82f6" name="Color" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </TabsContent>

            {/* Table View */}
            <TabsContent value="table">
              <div className="rounded-md border">
                <table className="w-full">
                  <thead>
                    <tr className="border-b bg-gray-50">
                      <th className="text-left p-3 text-sm font-semibold">Date & Time</th>
                      <th className="text-right p-3 text-sm font-semibold">Total</th>
                      <th className="text-right p-3 text-sm font-semibold">B&W</th>
                      <th className="text-right p-3 text-sm font-semibold">Color</th>
                      <th className="text-right p-3 text-sm font-semibold">Differential</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredReadings.map((reading, index) => {
                      const prevReading = filteredReadings[index + 1];
                      const diff = prevReading
                        ? reading.totalImpressions - prevReading.totalImpressions
                        : 0;

                      return (
                        <tr key={reading.id} className="border-b hover:bg-gray-50">
                          <td className="p-3 text-sm">
                            {format(reading.collectionTimestamp, 'PPpp')}
                          </td>
                          <td className="p-3 text-sm text-right">
                            {reading.totalImpressions?.toLocaleString() || '-'}
                          </td>
                          <td className="p-3 text-sm text-right">
                            {reading.bwImpressions?.toLocaleString() || '-'}
                          </td>
                          <td className="p-3 text-sm text-right">
                            {reading.colorImpressions?.toLocaleString() || '-'}
                          </td>
                          <td className="p-3 text-sm text-right">
                            {diff > 0 ? (
                              <span className="text-green-600">+{diff.toLocaleString()}</span>
                            ) : (
                              <span className="text-gray-400">-</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </TabsContent>

            {/* Device Details */}
            <TabsContent value="device">
              {selectedDeviceData && (
                <div className="space-y-6">
                  <div>
                    <h3 className="font-semibold mb-4">Device Information</h3>
                    <dl className="grid grid-cols-2 gap-4">
                      <div>
                        <dt className="text-sm text-gray-600">Device Name</dt>
                        <dd className="text-sm font-medium">{selectedDeviceData.deviceName}</dd>
                      </div>
                      <div>
                        <dt className="text-sm text-gray-600">Serial Number</dt>
                        <dd className="text-sm font-medium">{selectedDeviceData.serialNumber}</dd>
                      </div>
                      <div>
                        <dt className="text-sm text-gray-600">Model</dt>
                        <dd className="text-sm font-medium">{selectedDeviceData.model}</dd>
                      </div>
                      <div>
                        <dt className="text-sm text-gray-600">Total Readings</dt>
                        <dd className="text-sm font-medium">
                          {selectedDeviceData.readings.length}
                        </dd>
                      </div>
                    </dl>
                  </div>

                  {selectedDeviceData.readings[0] && (
                    <div>
                      <h3 className="font-semibold mb-4">Latest Reading</h3>
                      <div className="rounded-lg border p-4">
                        <div className="grid grid-cols-3 gap-4">
                          <div>
                            <p className="text-sm text-gray-600">Total Impressions</p>
                            <p className="text-2xl font-bold">
                              {selectedDeviceData.readings[0].totalImpressions?.toLocaleString()}
                            </p>
                          </div>
                          <div>
                            <p className="text-sm text-gray-600">B&W Impressions</p>
                            <p className="text-2xl font-bold">
                              {selectedDeviceData.readings[0].bwImpressions?.toLocaleString()}
                            </p>
                          </div>
                          <div>
                            <p className="text-sm text-gray-600">Color Impressions</p>
                            <p className="text-2xl font-bold">
                              {selectedDeviceData.readings[0].colorImpressions?.toLocaleString()}
                            </p>
                          </div>
                        </div>
                        <p className="text-xs text-gray-500 mt-4">
                          Last updated:{' '}
                          {format(selectedDeviceData.readings[0].collectionTimestamp, 'PPpp')}
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}
