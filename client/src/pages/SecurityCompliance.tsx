/**
 * Security & Compliance Dashboard
 * Comprehensive security monitoring, audit logging, GDPR compliance, and session management
 */

import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form } from "@/components/ui/form";
import { 
  Shield, 
  Eye, 
  AlertTriangle, 
  Clock, 
  Users, 
  Lock, 
  FileText, 
  Activity, 
  Database, 
  Key,
  Download,
  Search,
  Filter,
  RefreshCw,
  Settings,
  CheckCircle,
  XCircle,
  AlertCircle,
  Info
} from 'lucide-react';
import { useToast } from "@/hooks/use-toast";
import { useValidatedForm } from "@/hooks/useValidatedForm";
import { TextField, SelectField, TextAreaField, DateField } from "@/components/forms/FormField";
import { z } from "zod";
import MainLayout from "@/components/layout/main-layout";
import { apiRequest } from "@/lib/queryClient";

// Validation schemas
const gdprRequestSchema = z.object({
  type: z.enum(['access', 'rectification', 'erasure', 'portability', 'restrict_processing', 'object_processing']),
  subjectEmail: z.string().email("Please enter a valid email address"),
  description: z.string().min(10, "Description must be at least 10 characters"),
  dataCategories: z.array(z.string()).min(1, "At least one data category is required"),
  affectedSystems: z.array(z.string()).min(1, "At least one system is required"),
});

const complianceSettingsSchema = z.object({
  gdprEnabled: z.boolean(),
  gdprResponseDays: z.number().min(1).max(90),
  sessionTimeoutMinutes: z.number().min(5).max(480),
  sessionWarningMinutes: z.number().min(1).max(60),
  encryptSensitiveFields: z.boolean(),
  maskDataInLogs: z.boolean(),
  notifyOnGdprRequest: z.boolean(),
  notifyOnSuspiciousActivity: z.boolean(),
});

export default function SecurityCompliance() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [auditFilters, setAuditFilters] = useState({
    startDate: '',
    endDate: '',
    category: '',
    severity: '',
    userId: '',
  });
  const [dataAccessFilters, setDataAccessFilters] = useState({
    startDate: '',
    endDate: '',
    resource: '',
    accessType: '',
    classification: '',
  });
  const [isGdprDialogOpen, setIsGdprDialogOpen] = useState(false);
  const [isSettingsDialogOpen, setIsSettingsDialogOpen] = useState(false);

  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Security dashboard data
  const { data: dashboardData, isLoading: dashboardLoading } = useQuery({
    queryKey: ['/api/security-compliance/security-dashboard'],
    staleTime: 2 * 60 * 1000, // 2 minutes
    refetchInterval: 5 * 60 * 1000, // Refresh every 5 minutes
  });

  // Audit logs
  const { data: auditLogs, isLoading: auditLoading } = useQuery({
    queryKey: ['/api/security-compliance/audit-logs', auditFilters],
    enabled: activeTab === 'audit-logs',
  });

  // Data access logs
  const { data: dataAccessLogs, isLoading: dataAccessLoading } = useQuery({
    queryKey: ['/api/security-compliance/data-access-logs', dataAccessFilters],
    enabled: activeTab === 'data-access',
  });

  // GDPR requests
  const { data: gdprRequests, isLoading: gdprLoading } = useQuery({
    queryKey: ['/api/security-compliance/gdpr-requests'],
    enabled: activeTab === 'gdpr',
  });

  // Security sessions
  const { data: securitySessions, isLoading: sessionsLoading } = useQuery({
    queryKey: ['/api/security-compliance/security-sessions'],
    enabled: activeTab === 'sessions',
    refetchInterval: 60 * 1000, // Refresh every minute
  });

  // Compliance settings
  const { data: complianceSettings } = useQuery({
    queryKey: ['/api/security-compliance/compliance-settings'],
    enabled: activeTab === 'settings',
  });

  // GDPR request form
  const gdprForm = useValidatedForm({
    schema: gdprRequestSchema,
    onSubmit: async (data) => {
      await apiRequest('/api/security-compliance/gdpr-requests', {
        method: 'POST',
        body: JSON.stringify(data),
      });
      queryClient.invalidateQueries({ queryKey: ['/api/security-compliance/gdpr-requests'] });
      setIsGdprDialogOpen(false);
    },
    successMessage: "GDPR request created successfully",
    resetOnSuccess: true,
  });

  // Settings form
  const settingsForm = useValidatedForm({
    schema: complianceSettingsSchema,
    onSubmit: async (data) => {
      await apiRequest('/api/security-compliance/compliance-settings', {
        method: 'PUT',
        body: JSON.stringify(data),
      });
      queryClient.invalidateQueries({ queryKey: ['/api/security-compliance/compliance-settings'] });
      setIsSettingsDialogOpen(false);
    },
    successMessage: "Compliance settings updated successfully",
    defaultValues: complianceSettings,
  });

  // Terminate session mutation
  const terminateSessionMutation = useMutation({
    mutationFn: (sessionId: string) => 
      apiRequest(`/api/security-compliance/security-sessions/${sessionId}/terminate`, {
        method: 'POST',
        body: JSON.stringify({ reason: 'admin_termination' }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/security-compliance/security-sessions'] });
      toast({
        title: "Session Terminated",
        description: "The user session has been terminated successfully.",
      });
    },
  });

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical': return 'destructive';
      case 'high': return 'destructive';
      case 'medium': return 'default';
      case 'low': return 'secondary';
      default: return 'outline';
    }
  };

  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case 'critical': return <AlertTriangle className="h-4 w-4" />;
      case 'high': return <AlertCircle className="h-4 w-4" />;
      case 'medium': return <Info className="h-4 w-4" />;
      case 'low': return <CheckCircle className="h-4 w-4" />;
      default: return <Info className="h-4 w-4" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'default';
      case 'in_progress': return 'secondary';
      case 'pending': return 'outline';
      case 'rejected': return 'destructive';
      default: return 'outline';
    }
  };

  return (
    <MainLayout>
      <div className="container mx-auto p-6 space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold">Security & Compliance</h1>
            <p className="text-muted-foreground mt-2">
              Comprehensive security monitoring, audit logging, and GDPR compliance management
            </p>
          </div>
          <div className="flex space-x-2">
            <Dialog open={isGdprDialogOpen} onOpenChange={setIsGdprDialogOpen}>
              <DialogTrigger asChild>
                <Button variant="outline">
                  <FileText className="mr-2 h-4 w-4" />
                  GDPR Request
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl">
                <DialogHeader>
                  <DialogTitle>Create GDPR Request</DialogTitle>
                  <DialogDescription>
                    Submit a GDPR data subject request for processing
                  </DialogDescription>
                </DialogHeader>
                <Form {...gdprForm}>
                  <form onSubmit={gdprForm.handleValidatedSubmit} className="space-y-4">
                    <SelectField
                      control={gdprForm.control}
                      name="type"
                      label="Request Type"
                      required
                      options={[
                        { value: 'access', label: 'Data Access Request' },
                        { value: 'rectification', label: 'Data Rectification' },
                        { value: 'erasure', label: 'Data Erasure (Right to be Forgotten)' },
                        { value: 'portability', label: 'Data Portability' },
                        { value: 'restrict_processing', label: 'Restrict Processing' },
                        { value: 'object_processing', label: 'Object to Processing' },
                      ]}
                    />
                    <TextField
                      control={gdprForm.control}
                      name="subjectEmail"
                      label="Data Subject Email"
                      type="email"
                      required
                    />
                    <TextAreaField
                      control={gdprForm.control}
                      name="description"
                      label="Request Description"
                      required
                      rows={3}
                    />
                    <div className="flex justify-end gap-2">
                      <Button type="button" variant="outline" onClick={() => setIsGdprDialogOpen(false)}>
                        Cancel
                      </Button>
                      <Button type="submit" disabled={gdprForm.isSubmitting}>
                        {gdprForm.isSubmitting ? 'Creating...' : 'Create Request'}
                      </Button>
                    </div>
                  </form>
                </Form>
              </DialogContent>
            </Dialog>
            
            <Dialog open={isSettingsDialogOpen} onOpenChange={setIsSettingsDialogOpen}>
              <DialogTrigger asChild>
                <Button>
                  <Settings className="mr-2 h-4 w-4" />
                  Settings
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl">
                <DialogHeader>
                  <DialogTitle>Compliance Settings</DialogTitle>
                  <DialogDescription>
                    Configure security and compliance settings for your organization
                  </DialogDescription>
                </DialogHeader>
                {/* Settings form would go here */}
              </DialogContent>
            </Dialog>
          </div>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-6">
            <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
            <TabsTrigger value="audit-logs">Audit Logs</TabsTrigger>
            <TabsTrigger value="data-access">Data Access</TabsTrigger>
            <TabsTrigger value="gdpr">GDPR Requests</TabsTrigger>
            <TabsTrigger value="sessions">Security Sessions</TabsTrigger>
            <TabsTrigger value="settings">Settings</TabsTrigger>
          </TabsList>

          {/* Dashboard Tab */}
          <TabsContent value="dashboard" className="space-y-6">
            {dashboardLoading ? (
              <div className="text-center py-8">Loading security dashboard...</div>
            ) : (
              <>
                {/* Security Overview Cards */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                      <CardTitle className="text-sm font-medium">Active Sessions</CardTitle>
                      <Users className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold">{dashboardData?.activeSessions || 0}</div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                      <CardTitle className="text-sm font-medium">GDPR Requests</CardTitle>
                      <FileText className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold">
                        {dashboardData?.gdprStats?.reduce((sum: number, stat: any) => sum + parseInt(stat.count), 0) || 0}
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                      <CardTitle className="text-sm font-medium">Security Alerts</CardTitle>
                      <AlertTriangle className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold">{dashboardData?.securityAlerts?.length || 0}</div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                      <CardTitle className="text-sm font-medium">Data Access Events</CardTitle>
                      <Database className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold">
                        {dashboardData?.accessStats?.reduce((sum: number, stat: any) => sum + parseInt(stat.count), 0) || 0}
                      </div>
                    </CardContent>
                  </Card>
                </div>

                {/* Recent Security Alerts */}
                {dashboardData?.securityAlerts?.length > 0 && (
                  <Card>
                    <CardHeader>
                      <CardTitle>Recent Security Alerts</CardTitle>
                      <CardDescription>Suspicious activities detected in the last 7 days</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2">
                        {dashboardData.securityAlerts.slice(0, 5).map((alert: any, index: number) => (
                          <div key={index} className="flex items-center justify-between p-3 bg-orange-50 dark:bg-orange-950 rounded-lg">
                            <div className="flex items-center space-x-3">
                              <AlertTriangle className="h-4 w-4 text-orange-600" />
                              <div>
                                <p className="text-sm font-medium">{alert.resource} accessed suspiciously</p>
                                <p className="text-xs text-muted-foreground">
                                  Risk Score: {alert.riskScore} | {new Date(alert.accessedAt).toLocaleString()}
                                </p>
                              </div>
                            </div>
                            <Badge variant="destructive">High Risk</Badge>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                )}
              </>
            )}
          </TabsContent>

          {/* Audit Logs Tab */}
          <TabsContent value="audit-logs" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Audit Logs</CardTitle>
                <CardDescription>Comprehensive audit trail of all system activities</CardDescription>
              </CardHeader>
              <CardContent>
                {auditLoading ? (
                  <div className="text-center py-8">Loading audit logs...</div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Timestamp</TableHead>
                        <TableHead>User</TableHead>
                        <TableHead>Action</TableHead>
                        <TableHead>Resource</TableHead>
                        <TableHead>Severity</TableHead>
                        <TableHead>Category</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {auditLogs?.logs?.map((log: any) => (
                        <TableRow key={log.id}>
                          <TableCell>{new Date(log.timestamp).toLocaleString()}</TableCell>
                          <TableCell>{log.userId}</TableCell>
                          <TableCell>{log.action}</TableCell>
                          <TableCell>{log.resource}</TableCell>
                          <TableCell>
                            <Badge variant={getSeverityColor(log.severity)}>
                              {getSeverityIcon(log.severity)}
                              <span className="ml-1">{log.severity}</span>
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline">{log.category}</Badge>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* GDPR Requests Tab */}
          <TabsContent value="gdpr" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>GDPR Requests</CardTitle>
                <CardDescription>Data subject rights requests and compliance tracking</CardDescription>
              </CardHeader>
              <CardContent>
                {gdprLoading ? (
                  <div className="text-center py-8">Loading GDPR requests...</div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Created</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead>Subject</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Due Date</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {gdprRequests?.requests?.map((request: any) => (
                        <TableRow key={request.id}>
                          <TableCell>{new Date(request.createdAt).toLocaleDateString()}</TableCell>
                          <TableCell>
                            <Badge variant="outline">{request.type}</Badge>
                          </TableCell>
                          <TableCell>{request.subjectEmail}</TableCell>
                          <TableCell>
                            <Badge variant={getStatusColor(request.status)}>
                              {request.status}
                            </Badge>
                          </TableCell>
                          <TableCell>{new Date(request.dueDate).toLocaleDateString()}</TableCell>
                          <TableCell>
                            <Button size="sm" variant="outline">
                              <Eye className="h-4 w-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Security Sessions Tab */}
          <TabsContent value="sessions" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Active Security Sessions</CardTitle>
                <CardDescription>Monitor and manage active user sessions</CardDescription>
              </CardHeader>
              <CardContent>
                {sessionsLoading ? (
                  <div className="text-center py-8">Loading security sessions...</div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>User</TableHead>
                        <TableHead>IP Address</TableHead>
                        <TableHead>Last Activity</TableHead>
                        <TableHead>Expires</TableHead>
                        <TableHead>Risk Score</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {securitySessions?.sessions?.map((session: any) => (
                        <TableRow key={session.id}>
                          <TableCell>{session.userId}</TableCell>
                          <TableCell>{session.ipAddress}</TableCell>
                          <TableCell>{new Date(session.lastActivity).toLocaleString()}</TableCell>
                          <TableCell>{new Date(session.expiresAt).toLocaleString()}</TableCell>
                          <TableCell>
                            <Badge variant={session.riskScore > 50 ? 'destructive' : 'default'}>
                              {session.riskScore || 0}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <Button 
                              size="sm" 
                              variant="destructive"
                              onClick={() => terminateSessionMutation.mutate(session.sessionId)}
                              disabled={terminateSessionMutation.isPending}
                            >
                              <XCircle className="h-4 w-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </MainLayout>
  );
}