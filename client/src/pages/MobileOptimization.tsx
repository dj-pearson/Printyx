import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import MainLayout from "@/components/layout/main-layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Smartphone,
  Tablet,
  Monitor,
  Wifi,
  Battery,
  Signal,
  MapPin,
  Clock,
  CheckCircle,
  AlertTriangle,
  Wrench,
  Calendar,
  User,
  Camera,
  FileText,
  Download
} from "lucide-react";

interface MobileMetrics {
  activeUsers: number;
  offlineCapability: number;
  avgResponseTime: number;
  dataUsage: string;
  batteryOptimization: number;
  crashRate: number;
}

interface DeviceBreakdown {
  mobile: number;
  tablet: number;
  desktop: number;
}

export default function MobileOptimization() {
  const [selectedDevice, setSelectedDevice] = useState<string>("mobile");

  const { data: mobileMetrics, isLoading } = useQuery<MobileMetrics>({
    queryKey: ["/api/mobile/metrics"],
  });

  const { data: deviceBreakdown } = useQuery<DeviceBreakdown>({
    queryKey: ["/api/mobile/devices"],
  });

  // Mock data for demo
  const mockMetrics = {
    activeUsers: 234,
    offlineCapability: 95,
    avgResponseTime: 1.2,
    dataUsage: "2.4MB",
    batteryOptimization: 88,
    crashRate: 0.02
  };

  const mockDeviceBreakdown = {
    mobile: 68,
    tablet: 22,
    desktop: 10
  };

  const metrics = mobileMetrics || mockMetrics;
  const devices = deviceBreakdown || mockDeviceBreakdown;

  const mobileFeatures = [
    {
      icon: MapPin,
      title: "GPS Integration",
      description: "Real-time technician location tracking and optimized routing",
      status: "active",
      usage: "85% adoption"
    },
    {
      icon: Camera,
      title: "Photo Documentation",
      description: "Equipment photos, before/after service images, and damage reports",
      status: "active", 
      usage: "92% adoption"
    },
    {
      icon: Wifi,
      title: "Offline Sync",
      description: "Work orders sync automatically when connection is restored",
      status: "active",
      usage: "95% reliability"
    },
    {
      icon: Battery,
      title: "Battery Optimization",
      description: "Background sync optimization to preserve device battery life",
      status: "optimized",
      usage: "88% efficiency"
    },
    {
      icon: FileText,
      title: "Digital Forms",
      description: "Customer signatures, service reports, and completion forms",
      status: "active",
      usage: "78% paperless"
    },
    {
      icon: Clock,
      title: "Time Tracking",
      description: "Automatic time tracking with arrival/departure timestamps",
      status: "active",
      usage: "91% accuracy"
    }
  ];

  const performanceMetrics = [
    { label: "App Load Time", value: "1.2s", target: "< 2s", status: "good" },
    { label: "API Response", value: "450ms", target: "< 500ms", status: "good" },
    { label: "Image Upload", value: "2.1s", target: "< 3s", status: "good" },
    { label: "Offline Storage", value: "25MB", target: "< 50MB", status: "good" },
    { label: "Memory Usage", value: "120MB", target: "< 200MB", status: "good" },
    { label: "CPU Usage", value: "15%", target: "< 20%", status: "good" }
  ];

  const recentUpdates = [
    {
      version: "v2.4.1",
      date: "2024-12-15",
      changes: ["Improved offline sync reliability", "Battery optimization updates", "Bug fixes for photo upload"]
    },
    {
      version: "v2.4.0", 
      date: "2024-12-01",
      changes: ["Added GPS tracking for technicians", "Enhanced digital signature capture", "Performance improvements"]
    },
    {
      version: "v2.3.2",
      date: "2024-11-20",
      changes: ["Fixed crash on Android 14", "Improved form validation", "Updated security certificates"]
    }
  ];

  return (
    <MainLayout 
      title="Mobile Optimization" 
      description="Monitor and optimize mobile app performance for field technicians"
    >
      <div className="space-y-6">
        {/* Overview Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
          <Card>
            <CardContent className="p-4 sm:p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs sm:text-sm font-medium text-gray-600">Active Mobile Users</p>
                  <p className="text-2xl sm:text-3xl font-bold text-gray-900">{metrics.activeUsers}</p>
                  <p className="text-xs text-green-600">+12% from last month</p>
                </div>
                <div className="w-10 h-10 sm:w-12 sm:h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                  <Smartphone className="h-5 w-5 sm:h-6 sm:w-6 text-blue-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4 sm:p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs sm:text-sm font-medium text-gray-600">Offline Capability</p>
                  <p className="text-2xl sm:text-3xl font-bold text-gray-900">{metrics.offlineCapability}%</p>
                  <p className="text-xs text-green-600">Excellent coverage</p>
                </div>
                <div className="w-10 h-10 sm:w-12 sm:h-12 bg-green-100 rounded-lg flex items-center justify-center">
                  <Wifi className="h-5 w-5 sm:h-6 sm:w-6 text-green-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4 sm:p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs sm:text-sm font-medium text-gray-600">Avg Response Time</p>
                  <p className="text-2xl sm:text-3xl font-bold text-gray-900">{metrics.avgResponseTime}s</p>
                  <p className="text-xs text-green-600">Target: &lt; 2s</p>
                </div>
                <div className="w-10 h-10 sm:w-12 sm:h-12 bg-orange-100 rounded-lg flex items-center justify-center">
                  <Clock className="h-5 w-5 sm:h-6 sm:w-6 text-orange-600" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Device Breakdown Chart */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Monitor className="h-5 w-5" />
              Device Usage Breakdown
            </CardTitle>
            <CardDescription>Distribution of users across different device types</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Smartphone className="h-5 w-5 text-blue-600" />
                  <span className="font-medium">Mobile Devices</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-24 h-2 bg-gray-200 rounded-full overflow-hidden">
                    <div className="w-full h-full bg-blue-600 rounded-full" style={{ width: `${devices.mobile}%` }}></div>
                  </div>
                  <span className="text-sm font-medium w-12">{devices.mobile}%</span>
                </div>
              </div>
              
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Tablet className="h-5 w-5 text-green-600" />
                  <span className="font-medium">Tablets</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-24 h-2 bg-gray-200 rounded-full overflow-hidden">
                    <div className="w-full h-full bg-green-600 rounded-full" style={{ width: `${devices.tablet}%` }}></div>
                  </div>
                  <span className="text-sm font-medium w-12">{devices.tablet}%</span>
                </div>
              </div>
              
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Monitor className="h-5 w-5 text-gray-600" />
                  <span className="font-medium">Desktop</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-24 h-2 bg-gray-200 rounded-full overflow-hidden">
                    <div className="w-full h-full bg-gray-600 rounded-full" style={{ width: `${devices.desktop}%` }}></div>
                  </div>
                  <span className="text-sm font-medium w-12">{devices.desktop}%</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Main Content Tabs */}
        <Tabs defaultValue="features" className="space-y-4">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="features">Mobile Features</TabsTrigger>
            <TabsTrigger value="performance">Performance</TabsTrigger>
            <TabsTrigger value="updates">Updates</TabsTrigger>
            <TabsTrigger value="settings">Settings</TabsTrigger>
          </TabsList>

          <TabsContent value="features" className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {mobileFeatures.map((feature, index) => (
                <Card key={index}>
                  <CardContent className="p-6">
                    <div className="flex items-start justify-between mb-4">
                      <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                        <feature.icon className="h-5 w-5 text-blue-600" />
                      </div>
                      <Badge variant={feature.status === 'active' ? 'default' : 'secondary'}>
                        {feature.status}
                      </Badge>
                    </div>
                    <h3 className="font-semibold text-gray-900 mb-2">{feature.title}</h3>
                    <p className="text-sm text-gray-600 mb-3">{feature.description}</p>
                    <div className="text-xs text-blue-600 font-medium">{feature.usage}</div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="performance" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Performance Metrics</CardTitle>
                <CardDescription>Real-time mobile app performance indicators</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {performanceMetrics.map((metric, index) => (
                    <div key={index} className="p-4 border rounded-lg">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-medium text-gray-600">{metric.label}</span>
                        <CheckCircle className="h-4 w-4 text-green-600" />
                      </div>
                      <div className="text-2xl font-bold text-gray-900 mb-1">{metric.value}</div>
                      <div className="text-xs text-gray-500">Target: {metric.target}</div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="updates" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Recent Updates</CardTitle>
                <CardDescription>Mobile app version history and changes</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {recentUpdates.map((update, index) => (
                    <div key={index} className="border-l-2 border-blue-600 pl-4">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="font-semibold text-gray-900">{update.version}</span>
                        <Badge variant="outline">{update.date}</Badge>
                      </div>
                      <ul className="space-y-1">
                        {update.changes.map((change, changeIndex) => (
                          <li key={changeIndex} className="text-sm text-gray-600 flex items-start gap-2">
                            <CheckCircle className="h-3 w-3 text-green-600 mt-0.5 flex-shrink-0" />
                            {change}
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="settings" className="space-y-4">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle>Optimization Settings</CardTitle>
                  <CardDescription>Configure mobile app performance parameters</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-medium">Battery Optimization</div>
                      <div className="text-sm text-gray-600">Reduce background activity</div>
                    </div>
                    <Badge variant="default">Enabled</Badge>
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-medium">Data Compression</div>
                      <div className="text-sm text-gray-600">Compress images and files</div>
                    </div>
                    <Badge variant="default">Enabled</Badge>
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-medium">Offline Caching</div>
                      <div className="text-sm text-gray-600">Cache critical data locally</div>
                    </div>
                    <Badge variant="default">Enabled</Badge>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Push Notifications</CardTitle>
                  <CardDescription>Manage mobile notification settings</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-medium">New Work Orders</div>
                      <div className="text-sm text-gray-600">Instant notifications</div>
                    </div>
                    <Badge variant="default">Active</Badge>
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-medium">Schedule Changes</div>
                      <div className="text-sm text-gray-600">Route updates</div>
                    </div>
                    <Badge variant="default">Active</Badge>
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-medium">Emergency Calls</div>
                      <div className="text-sm text-gray-600">High priority alerts</div>
                    </div>
                    <Badge variant="default">Active</Badge>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </MainLayout>
  );
}