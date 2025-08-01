import type { Express } from "express";
// Use custom auth middleware instead of Replit Auth
const requireAuth = (req: any, res: any, next: any) => {
  if (!req.session?.userId) {
    return res.status(401).json({ message: "Authentication required" });
  }
  next();
};

// Mock data for integrations and deployment readiness
const mockIntegrations = [
  {
    id: "1",
    name: "Xerox ConnectKey",
    category: "Device Management",
    description: "Connect to Xerox multifunction devices for meter readings and supply monitoring",
    status: "connected",
    provider: "Xerox",
    lastSync: "2025-01-01T10:30:00Z",
    config: {
      apiKey: "xerox_api_key_***",
      endpoint: "https://api.xerox.com/v1",
      syncFrequency: "hourly"
    }
  },
  {
    id: "2", 
    name: "Canon imageRUNNER ADVANCE",
    category: "Device Management",
    description: "Integration with Canon devices for remote monitoring and management",
    status: "disconnected",
    provider: "Canon",
    lastSync: "Never",
  },
  {
    id: "3",
    name: "HP PrintOS",
    category: "Device Management", 
    description: "HP Smart Device Services for fleet monitoring and predictive analytics",
    status: "error",
    provider: "HP",
    lastSync: "2025-01-01T08:15:00Z",
  },
  {
    id: "4",
    name: "QuickBooks Online",
    category: "Accounting",
    description: "Sync invoices, payments, and customer data with QuickBooks",
    status: "connected",
    provider: "Intuit",
    lastSync: "2025-01-01T11:00:00Z",
  },
  {
    id: "5",
    name: "Salesforce CRM",
    category: "CRM",
    description: "Two-way sync of customer data, opportunities, and service cases",
    status: "pending",
    provider: "Salesforce",
    lastSync: "Never",
  }
];

const mockWebhooks = [
  {
    id: "1",
    name: "Service Ticket Created",
    url: "https://example.com/webhooks/ticket-created",
    events: ["service_ticket.created", "service_ticket.updated"],
    status: "active",
    lastTriggered: "2025-01-01T10:45:00Z",
    successRate: 98.5
  },
  {
    id: "2",
    name: "Invoice Generated",
    url: "https://accounting.company.com/api/invoices",
    events: ["invoice.created", "invoice.paid"],
    status: "active", 
    lastTriggered: "2025-01-01T09:30:00Z",
    successRate: 100
  }
];

const mockReadinessChecks = [
  // Infrastructure
  {
    id: "1",
    category: "Infrastructure",
    name: "Database Migration Scripts",
    description: "Production database schema and migration scripts ready",
    status: "complete",
    priority: "high",
    lastChecked: "2025-01-01T10:00:00Z",
    details: "All migration scripts tested and validated"
  },
  {
    id: "2", 
    category: "Infrastructure",
    name: "Production Environment Setup",
    description: "Production servers configured and tested",
    status: "complete",
    priority: "high",
    lastChecked: "2025-01-01T09:30:00Z",
  },
  {
    id: "3",
    category: "Infrastructure", 
    name: "SSL Certificates",
    description: "SSL certificates installed and configured",
    status: "complete",
    priority: "high",
    lastChecked: "2025-01-01T08:45:00Z",
  },
  {
    id: "4",
    category: "Infrastructure",
    name: "CDN Configuration",
    description: "Content delivery network setup for static assets",
    status: "in-progress",
    priority: "medium",
    lastChecked: "2025-01-01T07:15:00Z",
  },
  
  // Security & Compliance
  {
    id: "5",
    category: "Security",
    name: "Security Audit",
    description: "Comprehensive security audit completed",
    status: "warning",
    priority: "high",
    lastChecked: "2024-12-28T14:30:00Z",
    details: "Minor issues identified - patch scheduled"
  },
  {
    id: "6",
    category: "Security",
    name: "Data Encryption",
    description: "All sensitive data encrypted at rest and in transit",
    status: "complete",
    priority: "high",
    lastChecked: "2025-01-01T11:20:00Z",
  },
  {
    id: "7",
    category: "Security",
    name: "Access Controls",
    description: "Role-based access control fully implemented",
    status: "complete",
    priority: "high",
    lastChecked: "2025-01-01T10:45:00Z",
  },
  {
    id: "8",
    category: "Security",
    name: "Backup & Recovery",
    description: "Automated backup and disaster recovery procedures",
    status: "complete",
    priority: "high",
    lastChecked: "2025-01-01T09:00:00Z",
  },

  // Testing & Quality
  {
    id: "9",
    category: "Testing",
    name: "Load Testing",
    description: "System performance under expected load verified",
    status: "complete",
    priority: "high",
    lastChecked: "2024-12-30T16:00:00Z",
  },
  {
    id: "10",
    category: "Testing",
    name: "Integration Testing",
    description: "All third-party integrations tested",
    status: "incomplete",
    priority: "high",
    lastChecked: "2024-12-29T13:45:00Z",
    details: "HP PrintOS integration pending final tests"
  },
  {
    id: "11",
    category: "Testing",
    name: "User Acceptance Testing",
    description: "UAT completed with pilot customers",
    status: "in-progress",
    priority: "high",
    lastChecked: "2025-01-01T08:30:00Z",
  },
  {
    id: "12",
    category: "Testing",
    name: "Mobile Testing", 
    description: "Mobile app tested across devices and platforms",
    status: "complete",
    priority: "medium",
    lastChecked: "2024-12-31T12:00:00Z",
  },

  // Documentation & Training
  {
    id: "13",
    category: "Documentation",
    name: "User Documentation",
    description: "Complete user manuals and help documentation",
    status: "complete",
    priority: "medium",
    lastChecked: "2025-01-01T07:30:00Z",
  },
  {
    id: "14",
    category: "Documentation",
    name: "API Documentation",
    description: "Comprehensive API documentation for integrations",
    status: "complete",
    priority: "medium",
    lastChecked: "2024-12-30T15:20:00Z",
  },
  {
    id: "15",
    category: "Documentation",
    name: "Training Materials",
    description: "Training videos and materials for end users",
    status: "incomplete",
    priority: "medium",
    lastChecked: "2024-12-28T10:15:00Z",
  },

  // Business Readiness
  {
    id: "16",
    category: "Business",
    name: "Pricing Strategy",
    description: "Final pricing tiers and billing system configured",
    status: "complete",
    priority: "high",
    lastChecked: "2025-01-01T11:45:00Z",
  },
  {
    id: "17",
    category: "Business",
    name: "Support Team Training",
    description: "Customer support team trained on new platform",
    status: "in-progress",
    priority: "high",
    lastChecked: "2024-12-31T14:30:00Z",
  },
  {
    id: "18",
    category: "Business",
    name: "Marketing Materials",
    description: "Launch marketing materials and campaigns ready",
    status: "complete",
    priority: "medium",
    lastChecked: "2024-12-30T17:00:00Z",
  }
];

const mockDeploymentMetrics = {
  overallReadiness: 78,
  criticalIssues: 2,
  completedChecks: 14,
  totalChecks: 18,
  estimatedLaunchDate: "2025-01-15"
};

export function registerIntegrationRoutes(app: Express) {
  // Integration endpoints
  app.get("/api/integrations", requireAuth, async (req, res) => {
    res.json(mockIntegrations);
  });

  app.post("/api/integrations/connect", requireAuth, async (req, res) => {
    const { integrationId, config } = req.body;
    
    // Simulate connection process
    const integration = mockIntegrations.find(i => i.id === integrationId);
    if (integration) {
      integration.status = "connected";
      integration.lastSync = new Date().toISOString();
      integration.config = config;
    }
    
    res.json({ success: true, integration });
  });

  app.post("/api/integrations/:id/disconnect", requireAuth, async (req, res) => {
    const integrationId = req.params.id;
    
    const integration = mockIntegrations.find(i => i.id === integrationId);
    if (integration) {
      integration.status = "disconnected";
      integration.lastSync = "Never";
      delete integration.config;
    }
    
    res.json({ success: true, integration });
  });

  app.post("/api/integrations/:id/test", requireAuth, async (req, res) => {
    const integrationId = req.params.id;
    
    const integration = mockIntegrations.find(i => i.id === integrationId);
    if (!integration || integration.status !== "connected") {
      return res.status(400).json({ error: "Integration not connected" });
    }
    
    // Simulate test - random success/failure for demo
    const testSuccess = Math.random() > 0.3;
    
    if (testSuccess) {
      res.json({ success: true, message: "Integration test successful" });
    } else {
      res.status(400).json({ error: "Integration test failed" });
    }
  });

  // Webhook endpoints
  app.get("/api/webhooks", requireAuth, async (req, res) => {
    res.json(mockWebhooks);
  });

  app.post("/api/webhooks", requireAuth, async (req, res) => {
    const newWebhook = {
      id: (mockWebhooks.length + 1).toString(),
      ...req.body,
      status: "active",
      lastTriggered: "Never",
      successRate: 100
    };
    
    mockWebhooks.push(newWebhook);
    res.json(newWebhook);
  });

  // Deployment readiness endpoints
  app.get("/api/deployment/readiness", requireAuth, async (req, res) => {
    res.json(mockReadinessChecks);
  });

  app.get("/api/deployment/metrics", requireAuth, async (req, res) => {
    res.json(mockDeploymentMetrics);
  });

  app.post("/api/deployment/check/:id", requireAuth, async (req, res) => {
    const checkId = req.params.id;
    
    const check = mockReadinessChecks.find(c => c.id === checkId);
    if (check) {
      check.lastChecked = new Date().toISOString();
      check.status = "complete"; // Simulate successful check
    }
    
    res.json({ success: true, check });
  });
}