import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import MainLayout from "@/components/layout/main-layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  CheckCircle,
  XCircle,
  AlertTriangle,
  Clock,
  Rocket,
  Shield,
  Database,
  Users,
  Settings,
  Activity,
  FileText,
  Globe,
  Lock,
  Zap,
  Monitor
} from "lucide-react";

interface ReadinessCheck {
  id: string;
  category: string;
  name: string;
  description: string;
  status: 'complete' | 'incomplete' | 'warning' | 'in-progress';
  priority: 'high' | 'medium' | 'low';
  lastChecked: string;
  details?: string;
}

interface DeploymentMetrics {
  overallReadiness: number;
  criticalIssues: number;
  completedChecks: number;
  totalChecks: number;
  estimatedLaunchDate: string;
}

export default function DeploymentReadiness() {
  const [selectedCategory, setSelectedCategory] = useState<string>("all");

  const { data: readinessChecks, isLoading } = useQuery<ReadinessCheck[]>({
    queryKey: ["/api/deployment/readiness"],
  });

  const { data: metrics } = useQuery<DeploymentMetrics>({
    queryKey: ["/api/deployment/metrics"],
  });

  // Mock data for deployment readiness
  const mockChecks: ReadinessCheck[] = readinessChecks || [
    // Database & Infrastructure
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

  const mockMetrics: DeploymentMetrics = metrics || {
    overallReadiness: 78,
    criticalIssues: 2,
    completedChecks: 14,
    totalChecks: 18,
    estimatedLaunchDate: "2025-01-15"
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'complete':
        return <CheckCircle className="h-5 w-5 text-green-600" />;
      case 'incomplete':
        return <XCircle className="h-5 w-5 text-red-600" />;
      case 'warning':
        return <AlertTriangle className="h-5 w-5 text-yellow-600" />;
      case 'in-progress':
        return <Clock className="h-5 w-5 text-blue-600" />;
      default:
        return <XCircle className="h-5 w-5 text-gray-400" />;
    }
  };

  const getStatusBadge = (status: string) => {
    const variants = {
      complete: 'default',
      incomplete: 'destructive',
      warning: 'secondary',
      'in-progress': 'outline'
    } as const;
    
    return (
      <Badge variant={variants[status as keyof typeof variants] || 'secondary'}>
        {status === 'in-progress' ? 'In Progress' : status.charAt(0).toUpperCase() + status.slice(1)}
      </Badge>
    );
  };

  const getPriorityBadge = (priority: string) => {
    const colors = {
      high: 'bg-red-100 text-red-800',
      medium: 'bg-yellow-100 text-yellow-800', 
      low: 'bg-green-100 text-green-800'
    };
    
    return (
      <Badge className={colors[priority as keyof typeof colors] || colors.medium}>
        {priority.charAt(0).toUpperCase() + priority.slice(1)}
      </Badge>
    );
  };

  const categories = ['all', ...Array.from(new Set(mockChecks.map(check => check.category)))];
  const filteredChecks = selectedCategory === 'all' 
    ? mockChecks 
    : mockChecks.filter(check => check.category === selectedCategory);

  const categoryIcons = {
    Infrastructure: Database,
    Security: Shield,
    Testing: Activity,
    Documentation: FileText,
    Business: Users
  };

  return (
    <MainLayout 
      title="Deployment Readiness" 
      description="Monitor go-live preparation and deployment checklist"
    >
      <div className="space-y-6">
        {/* Overview Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
          <Card>
            <CardContent className="p-4 sm:p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs sm:text-sm font-medium text-gray-600">Overall Readiness</p>
                  <p className="text-2xl sm:text-3xl font-bold text-gray-900">{mockMetrics.overallReadiness}%</p>
                  <Progress value={mockMetrics.overallReadiness} className="mt-2 h-2" />
                </div>
                <div className="w-10 h-10 sm:w-12 sm:h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                  <Rocket className="h-5 w-5 sm:h-6 sm:w-6 text-blue-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4 sm:p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs sm:text-sm font-medium text-gray-600">Critical Issues</p>
                  <p className="text-2xl sm:text-3xl font-bold text-red-600">{mockMetrics.criticalIssues}</p>
                  <p className="text-xs text-gray-500">Require immediate attention</p>
                </div>
                <div className="w-10 h-10 sm:w-12 sm:h-12 bg-red-100 rounded-lg flex items-center justify-center">
                  <AlertTriangle className="h-5 w-5 sm:h-6 sm:w-6 text-red-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4 sm:p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs sm:text-sm font-medium text-gray-600">Completed</p>
                  <p className="text-2xl sm:text-3xl font-bold text-gray-900">
                    {mockMetrics.completedChecks}/{mockMetrics.totalChecks}
                  </p>
                  <p className="text-xs text-green-600">
                    {Math.round((mockMetrics.completedChecks / mockMetrics.totalChecks) * 100)}% complete
                  </p>
                </div>
                <div className="w-10 h-10 sm:w-12 sm:h-12 bg-green-100 rounded-lg flex items-center justify-center">
                  <CheckCircle className="h-5 w-5 sm:h-6 sm:w-6 text-green-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4 sm:p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs sm:text-sm font-medium text-gray-600">Est. Launch</p>
                  <p className="text-lg sm:text-xl font-bold text-gray-900">
                    {new Date(mockMetrics.estimatedLaunchDate).toLocaleDateString()}
                  </p>
                  <p className="text-xs text-gray-500">2 weeks remaining</p>
                </div>
                <div className="w-10 h-10 sm:w-12 sm:h-12 bg-purple-100 rounded-lg flex items-center justify-center">
                  <Globe className="h-5 w-5 sm:h-6 sm:w-6 text-purple-600" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Critical Issues Alert */}
        {mockMetrics.criticalIssues > 0 && (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Critical Issues Require Attention</AlertTitle>
            <AlertDescription>
              {mockMetrics.criticalIssues} critical issue{mockMetrics.criticalIssues > 1 ? 's' : ''} must be resolved before deployment. 
              Review the checklist below for details.
            </AlertDescription>
          </Alert>
        )}

        {/* Category Filter */}
        <Card>
          <CardHeader>
            <CardTitle>Deployment Checklist</CardTitle>
            <CardDescription>Track progress across all deployment readiness categories</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2 mb-6">
              {categories.map((category) => (
                <Button
                  key={category}
                  variant={selectedCategory === category ? "default" : "outline"}
                  size="sm"
                  onClick={() => setSelectedCategory(category)}
                  className="capitalize"
                >
                  {category === 'all' ? 'All Categories' : category}
                </Button>
              ))}
            </div>

            <div className="space-y-4">
              {filteredChecks.map((check) => {
                const IconComponent = categoryIcons[check.category as keyof typeof categoryIcons] || Settings;
                
                return (
                  <div key={check.id} className="flex items-center justify-between p-4 border rounded-lg">
                    <div className="flex items-center gap-4">
                      {getStatusIcon(check.status)}
                      <IconComponent className="h-5 w-5 text-gray-500" />
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <h4 className="font-medium">{check.name}</h4>
                          {getPriorityBadge(check.priority)}
                        </div>
                        <p className="text-sm text-gray-600">{check.description}</p>
                        {check.details && (
                          <p className="text-xs text-gray-500 mt-1">{check.details}</p>
                        )}
                        <p className="text-xs text-gray-400 mt-1">
                          Last checked: {new Date(check.lastChecked).toLocaleString()}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      {getStatusBadge(check.status)}
                      <Button variant="outline" size="sm">
                        View Details
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Launch Actions */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Rocket className="h-5 w-5" />
              Launch Actions
            </CardTitle>
            <CardDescription>Ready to deploy? Complete final pre-launch steps</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col sm:flex-row gap-4">
              <Button size="lg" className="flex-1" disabled={mockMetrics.criticalIssues > 0}>
                <Rocket className="h-4 w-4 mr-2" />
                Deploy to Production
              </Button>
              <Button variant="outline" size="lg" className="flex-1">
                <Monitor className="h-4 w-4 mr-2" />
                Run Final Tests
              </Button>
              <Button variant="outline" size="lg" className="flex-1">
                <FileText className="h-4 w-4 mr-2" />
                Export Checklist
              </Button>
            </div>
            
            {mockMetrics.criticalIssues > 0 && (
              <Alert className="mt-4">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  Deployment is blocked until all critical issues are resolved.
                </AlertDescription>
              </Alert>
            )}
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  );
}