import type { Express } from "express";

// Mobile optimization API routes
export function registerMobileRoutes(app: Express) {
  // Mobile metrics endpoint
  app.get("/api/mobile/metrics", (req, res) => {
    const mockMetrics = {
      activeUsers: 234,
      offlineCapability: 95,
      avgResponseTime: 1.2,
      dataUsage: "2.4MB",
      batteryOptimization: 88,
      crashRate: 0.02
    };
    res.json(mockMetrics);
  });

  // Device breakdown endpoint
  app.get("/api/mobile/devices", (req, res) => {
    const mockDeviceBreakdown = {
      mobile: 68,
      tablet: 22,
      desktop: 10
    };
    res.json(mockDeviceBreakdown);
  });

  // Performance metrics endpoint
  app.get("/api/performance/metrics", (req, res) => {
    const mockPerformanceMetrics = {
      responseTime: 245,
      throughput: 1420,
      errorRate: 0.12,
      uptime: 99.95,
      memoryUsage: 68,
      cpuUsage: 34,
      diskUsage: 23,
      activeUsers: 187
    };
    res.json(mockPerformanceMetrics);
  });

  // System alerts endpoint
  app.get("/api/performance/alerts", (req, res) => {
    const mockAlerts = [
      {
        id: "1",
        type: 'warning',
        message: "Memory usage above 65% for 10 minutes",
        timestamp: new Date(Date.now() - 300000).toISOString(),
        resolved: false
      },
      {
        id: "2", 
        type: 'info',
        message: "Database optimization completed successfully",
        timestamp: new Date(Date.now() - 3600000).toISOString(),
        resolved: true
      },
      {
        id: "3",
        type: 'error',
        message: "API endpoint /api/reports timeout (resolved)",
        timestamp: new Date(Date.now() - 7200000).toISOString(),
        resolved: true
      }
    ];
    res.json(mockAlerts);
  });
}