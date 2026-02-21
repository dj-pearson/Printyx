/**
 * Scheduled Reports Dashboard
 * Automate report delivery via email - competitive advantage vs E-Automate
 * Connected to /api/scheduled-reports backend
 */

import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import MainLayout from '@/components/layout/main-layout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Calendar,
  Clock,
  Mail,
  FileText,
  Trash2,
  Play,
  Pause,
  Users,
  Settings,
  Plus,
  CheckCircle2,
  TrendingUp,
  BarChart3,
  FileSpreadsheet,
  FileDown,
  Send,
  Zap,
  Target,
  Loader2,
  AlertCircle,
} from 'lucide-react';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';

interface ScheduleFromAPI {
  id: string;
  tenantId: string;
  reportDefinitionId: string;
  name: string;
  description: string | null;
  cronExpression: string;
  timezone: string | null;
  parameters: any;
  filters: any;
  recipients: string[];
  deliveryMethod: string | null;
  exportFormat: string | null;
  emailSubject: string | null;
  emailBody: string | null;
  isActive: boolean | null;
  lastRun: string | null;
  nextRun: string | null;
  runCount: number | null;
  lastStatus: string | null;
  lastError: string | null;
  createdBy: string;
  createdAt: string | null;
  updatedAt: string | null;
}

const reportTypes = [
  { value: 'sales-dashboard', label: 'Sales Dashboard', icon: TrendingUp },
  { value: 'financial-summary', label: 'Financial Summary', icon: BarChart3 },
  { value: 'service-metrics', label: 'Service Metrics', icon: Settings },
  { value: 'customer-health', label: 'Customer Health', icon: Users },
  { value: 'inventory-report', label: 'Inventory Report', icon: FileText },
  { value: 'equipment-status', label: 'Equipment Status', icon: Target },
];

function parseCronFrequency(cron: string): string {
  const parts = cron.split(' ');
  if (parts.length !== 5) return cron;
  const [, , dayOfMonth, month, dayOfWeek] = parts;
  if (month !== '*' && month.includes(',')) return 'Quarterly';
  if (dayOfMonth !== '*' && dayOfWeek === '*') return 'Monthly';
  if (dayOfWeek !== '*') return 'Weekly';
  return 'Daily';
}

function parseCronTime(cron: string): string {
  const parts = cron.split(' ');
  if (parts.length !== 5) return '';
  const minute = parts[0].padStart(2, '0');
  const hour = parts[1].padStart(2, '0');
  return `${hour}:${minute}`;
}

export default function ScheduledReportsDashboard() {
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: reports = [], isLoading } = useQuery<ScheduleFromAPI[]>({
    queryKey: ['/api/scheduled-reports'],
    queryFn: () => apiRequest('/api/scheduled-reports'),
  });

  const toggleMutation = useMutation({
    mutationFn: (id: string) => apiRequest(`/api/scheduled-reports/${id}/toggle`, 'PATCH'),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/scheduled-reports'] });
      toast({ title: 'Schedule updated' });
    },
    onError: () => {
      toast({ title: 'Error', description: 'Failed to toggle schedule', variant: 'destructive' });
    },
  });

  const runNowMutation = useMutation({
    mutationFn: (id: string) => apiRequest(`/api/scheduled-reports/${id}/run`, 'POST'),
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ['/api/scheduled-reports'] });
      toast({ title: 'Report executed', description: data.message || 'Report sent to recipients' });
    },
    onError: () => {
      toast({ title: 'Error', description: 'Failed to run report', variant: 'destructive' });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiRequest(`/api/scheduled-reports/${id}`, 'DELETE'),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/scheduled-reports'] });
      toast({ title: 'Schedule deleted' });
      setDeleteConfirmId(null);
    },
    onError: () => {
      toast({ title: 'Error', description: 'Failed to delete schedule', variant: 'destructive' });
    },
  });

  const stats = {
    total: reports.length,
    active: reports.filter((r) => r.isActive).length,
    paused: reports.filter((r) => !r.isActive).length,
    totalDeliveries: reports.reduce((sum, r) => sum + (r.runCount || 0), 0),
  };

  const formatRecipients = (recipients: any): number => {
    if (Array.isArray(recipients)) return recipients.length;
    return 0;
  };

  return (
    <MainLayout
      title="Scheduled Reports"
      description="Automate report delivery to your team via email"
    >
      <div className="container mx-auto p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-4xl font-bold mb-2">Scheduled Reports</h1>
            <p className="text-muted-foreground">
              Automate report delivery and keep your team informed
            </p>
          </div>
          <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
            <DialogTrigger asChild>
              <Button size="lg">
                <Plus className="h-5 w-5 mr-2" />
                Schedule New Report
              </Button>
            </DialogTrigger>
            <CreateReportDialog
              onClose={() => setIsCreateDialogOpen(false)}
              onSuccess={() => {
                setIsCreateDialogOpen(false);
                queryClient.invalidateQueries({ queryKey: ['/api/scheduled-reports'] });
              }}
            />
          </Dialog>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Total Schedules</p>
                  <p className="text-3xl font-bold">{stats.total}</p>
                </div>
                <Calendar className="h-8 w-8 text-blue-600" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Active</p>
                  <p className="text-3xl font-bold text-green-600">{stats.active}</p>
                </div>
                <CheckCircle2 className="h-8 w-8 text-green-600" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Paused</p>
                  <p className="text-3xl font-bold text-gray-600">{stats.paused}</p>
                </div>
                <Pause className="h-8 w-8 text-gray-600" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Delivered</p>
                  <p className="text-3xl font-bold text-purple-600">{stats.totalDeliveries}</p>
                </div>
                <Send className="h-8 w-8 text-purple-600" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Loading State */}
        {isLoading && (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        )}

        {/* Scheduled Reports List */}
        {!isLoading && (
          <div className="grid gap-4">
            {reports.map((report) => (
              <Card key={report.id} className="hover:shadow-md transition-shadow">
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <CardTitle>{report.name}</CardTitle>
                        <Badge variant={report.isActive ? 'default' : 'secondary'}>
                          {report.isActive ? (
                            <>
                              <CheckCircle2 className="h-3 w-3 mr-1" /> Active
                            </>
                          ) : (
                            <>
                              <Pause className="h-3 w-3 mr-1" /> Paused
                            </>
                          )}
                        </Badge>
                        <Badge variant="outline">
                          {(report.exportFormat || 'pdf').toUpperCase()}
                        </Badge>
                        {report.lastStatus === 'failed' && (
                          <Badge variant="destructive">
                            <AlertCircle className="h-3 w-3 mr-1" /> Failed
                          </Badge>
                        )}
                      </div>
                      <CardDescription>{report.description}</CardDescription>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => runNowMutation.mutate(report.id)}
                        disabled={runNowMutation.isPending}
                        title="Run now"
                      >
                        {runNowMutation.isPending ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Play className="h-4 w-4" />
                        )}
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => toggleMutation.mutate(report.id)}
                        title={report.isActive ? 'Pause' : 'Resume'}
                      >
                        {report.isActive ? (
                          <Pause className="h-4 w-4" />
                        ) : (
                          <Play className="h-4 w-4" />
                        )}
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setDeleteConfirmId(report.id)}
                        title="Delete"
                      >
                        <Trash2 className="h-4 w-4 text-red-500" />
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="grid md:grid-cols-4 gap-4 text-sm">
                    <div>
                      <p className="text-muted-foreground mb-1">Schedule</p>
                      <div className="flex items-center gap-2">
                        <Clock className="h-4 w-4" />
                        <span className="font-medium">
                          {parseCronFrequency(report.cronExpression)} at{' '}
                          {parseCronTime(report.cronExpression)}
                        </span>
                      </div>
                    </div>
                    <div>
                      <p className="text-muted-foreground mb-1">Recipients</p>
                      <div className="flex items-center gap-2">
                        <Mail className="h-4 w-4" />
                        <span className="font-medium">
                          {formatRecipients(report.recipients)} recipient
                          {formatRecipients(report.recipients) !== 1 ? 's' : ''}
                        </span>
                      </div>
                    </div>
                    <div>
                      <p className="text-muted-foreground mb-1">Next Run</p>
                      <div className="flex items-center gap-2">
                        <Calendar className="h-4 w-4" />
                        <span className="font-medium">
                          {report.nextRun
                            ? new Date(report.nextRun).toLocaleDateString()
                            : 'Not scheduled'}
                        </span>
                      </div>
                    </div>
                    <div>
                      <p className="text-muted-foreground mb-1">Deliveries</p>
                      <div className="flex items-center gap-2">
                        <Send className="h-4 w-4" />
                        <span className="font-medium">{report.runCount || 0} sent</span>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Empty State */}
        {!isLoading && reports.length === 0 && (
          <Card className="p-12 text-center">
            <Calendar className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-xl font-semibold mb-2">No Scheduled Reports</h3>
            <p className="text-muted-foreground mb-6">
              Create your first automated report to keep your team informed
            </p>
            <Button onClick={() => setIsCreateDialogOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Schedule Your First Report
            </Button>
          </Card>
        )}

        {/* Benefits Card */}
        <Card className="bg-gradient-to-r from-blue-600 to-purple-600 text-white border-0">
          <CardContent className="p-8">
            <div className="grid md:grid-cols-2 gap-8">
              <div>
                <h2 className="text-2xl font-bold mb-4">Why Schedule Reports?</h2>
                <ul className="space-y-3">
                  <li className="flex items-start gap-3">
                    <Zap className="h-5 w-5 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="font-semibold">Save Time</p>
                      <p className="text-sm text-white/90">Eliminate manual report generation</p>
                    </div>
                  </li>
                  <li className="flex items-start gap-3">
                    <Users className="h-5 w-5 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="font-semibold">Keep Teams Aligned</p>
                      <p className="text-sm text-white/90">Ensure everyone has the latest data</p>
                    </div>
                  </li>
                  <li className="flex items-start gap-3">
                    <Target className="h-5 w-5 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="font-semibold">Drive Accountability</p>
                      <p className="text-sm text-white/90">
                        Regular metrics reviews improve performance
                      </p>
                    </div>
                  </li>
                </ul>
              </div>
              <div className="flex items-center justify-center">
                <div className="text-center">
                  <div className="text-6xl font-bold mb-2">{stats.totalDeliveries}</div>
                  <p className="text-lg text-white/90">Reports Delivered Automatically</p>
                  <p className="text-sm text-white/80 mt-2">
                    Saving ~{Math.round(stats.totalDeliveries * 0.25)} hours of manual work
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteConfirmId} onOpenChange={() => setDeleteConfirmId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Scheduled Report</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this scheduled report? This action cannot be undone
              and all future deliveries will be stopped.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => deleteConfirmId && deleteMutation.mutate(deleteConfirmId)}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </MainLayout>
  );
}

function CreateReportDialog({
  onClose,
  onSuccess,
}: {
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [step, setStep] = useState(1);
  const { toast } = useToast();
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    reportType: '',
    frequency: 'weekly',
    time: '09:00',
    dayOfWeek: '1',
    dayOfMonth: '1',
    cronExpression: '',
    recipients: '',
    format: 'pdf',
  });

  const createMutation = useMutation({
    mutationFn: (data: any) => apiRequest('/api/scheduled-reports', 'POST', data),
    onSuccess: () => {
      toast({ title: 'Success', description: 'Scheduled report created' });
      onSuccess();
    },
    onError: () => {
      toast({
        title: 'Error',
        description: 'Failed to create scheduled report',
        variant: 'destructive',
      });
    },
  });

  const handleCreate = () => {
    const recipientList = formData.recipients
      .split(',')
      .map((e) => e.trim())
      .filter(Boolean);

    if (!formData.name || !formData.reportType || recipientList.length === 0) {
      toast({
        title: 'Validation Error',
        description: 'Please fill in name, report type, and at least one recipient',
        variant: 'destructive',
      });
      return;
    }

    createMutation.mutate({
      name: formData.name,
      description: formData.description,
      reportType: formData.reportType,
      frequency: formData.frequency,
      time: formData.time,
      dayOfWeek: formData.frequency === 'weekly' ? formData.dayOfWeek : undefined,
      dayOfMonth: formData.frequency === 'monthly' ? formData.dayOfMonth : undefined,
      cronExpression: formData.frequency === 'custom' ? formData.cronExpression : undefined,
      recipients: recipientList,
      format: formData.format,
    });
  };

  return (
    <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
      <DialogHeader>
        <DialogTitle>Schedule New Report</DialogTitle>
        <DialogDescription>Automate report delivery to keep your team informed</DialogDescription>
      </DialogHeader>

      <Tabs value={`step-${step}`} onValueChange={(v) => setStep(parseInt(v.split('-')[1]))}>
        <TabsList className="grid grid-cols-3 w-full">
          <TabsTrigger value="step-1">Report Details</TabsTrigger>
          <TabsTrigger value="step-2">Schedule</TabsTrigger>
          <TabsTrigger value="step-3">Delivery</TabsTrigger>
        </TabsList>

        <TabsContent value="step-1" className="space-y-4">
          <div>
            <Label htmlFor="name">Report Name</Label>
            <Input
              id="name"
              placeholder="e.g., Weekly Sales Summary"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            />
          </div>
          <div>
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              placeholder="What does this report contain?"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            />
          </div>
          <div>
            <Label htmlFor="reportType">Report Type</Label>
            <Select
              value={formData.reportType}
              onValueChange={(v) => setFormData({ ...formData, reportType: v })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select report type" />
              </SelectTrigger>
              <SelectContent>
                {reportTypes.map((type) => {
                  const Icon = type.icon;
                  return (
                    <SelectItem key={type.value} value={type.value}>
                      <div className="flex items-center gap-2">
                        <Icon className="h-4 w-4" />
                        {type.label}
                      </div>
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
          </div>
        </TabsContent>

        <TabsContent value="step-2" className="space-y-4">
          <div>
            <Label htmlFor="frequency">Frequency</Label>
            <Select
              value={formData.frequency}
              onValueChange={(v) => setFormData({ ...formData, frequency: v })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="daily">Daily</SelectItem>
                <SelectItem value="weekly">Weekly</SelectItem>
                <SelectItem value="monthly">Monthly</SelectItem>
                <SelectItem value="quarterly">Quarterly</SelectItem>
                <SelectItem value="custom">Custom Cron Expression</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {formData.frequency === 'custom' && (
            <div>
              <Label htmlFor="cronExpression">Cron Expression</Label>
              <Input
                id="cronExpression"
                placeholder="e.g., 0 9 * * 1-5 (weekdays at 9am)"
                value={formData.cronExpression}
                onChange={(e) => setFormData({ ...formData, cronExpression: e.target.value })}
              />
              <p className="text-xs text-muted-foreground mt-1">
                Format: minute hour day-of-month month day-of-week
              </p>
            </div>
          )}
          {formData.frequency === 'weekly' && (
            <div>
              <Label htmlFor="dayOfWeek">Day of Week</Label>
              <Select
                value={formData.dayOfWeek}
                onValueChange={(v) => setFormData({ ...formData, dayOfWeek: v })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">Monday</SelectItem>
                  <SelectItem value="2">Tuesday</SelectItem>
                  <SelectItem value="3">Wednesday</SelectItem>
                  <SelectItem value="4">Thursday</SelectItem>
                  <SelectItem value="5">Friday</SelectItem>
                  <SelectItem value="6">Saturday</SelectItem>
                  <SelectItem value="0">Sunday</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}
          {formData.frequency === 'monthly' && (
            <div>
              <Label htmlFor="dayOfMonth">Day of Month</Label>
              <Select
                value={formData.dayOfMonth}
                onValueChange={(v) => setFormData({ ...formData, dayOfMonth: v })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Array.from({ length: 28 }, (_, i) => i + 1).map((day) => (
                    <SelectItem key={day} value={String(day)}>
                      {day}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          {formData.frequency !== 'custom' && (
            <div>
              <Label htmlFor="time">Time</Label>
              <Input
                id="time"
                type="time"
                value={formData.time}
                onChange={(e) => setFormData({ ...formData, time: e.target.value })}
              />
            </div>
          )}
        </TabsContent>

        <TabsContent value="step-3" className="space-y-4">
          <div>
            <Label htmlFor="recipients">Recipients (comma-separated emails)</Label>
            <Textarea
              id="recipients"
              placeholder="email1@company.com, email2@company.com"
              value={formData.recipients}
              onChange={(e) => setFormData({ ...formData, recipients: e.target.value })}
            />
          </div>
          <div>
            <Label htmlFor="format">Report Format</Label>
            <Select
              value={formData.format}
              onValueChange={(v) => setFormData({ ...formData, format: v })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="pdf">
                  <div className="flex items-center gap-2">
                    <FileText className="h-4 w-4" />
                    PDF - Best for viewing
                  </div>
                </SelectItem>
                <SelectItem value="xlsx">
                  <div className="flex items-center gap-2">
                    <FileSpreadsheet className="h-4 w-4" />
                    Excel - Best for analysis
                  </div>
                </SelectItem>
                <SelectItem value="csv">
                  <div className="flex items-center gap-2">
                    <FileDown className="h-4 w-4" />
                    CSV - Best for import
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
        </TabsContent>
      </Tabs>

      <DialogFooter className="flex justify-between">
        <Button variant="outline" onClick={onClose}>
          Cancel
        </Button>
        <div className="flex gap-2">
          {step > 1 && (
            <Button variant="outline" onClick={() => setStep(step - 1)}>
              Previous
            </Button>
          )}
          {step < 3 ? (
            <Button onClick={() => setStep(step + 1)}>Next</Button>
          ) : (
            <Button onClick={handleCreate} disabled={createMutation.isPending}>
              {createMutation.isPending ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Calendar className="h-4 w-4 mr-2" />
              )}
              Schedule Report
            </Button>
          )}
        </div>
      </DialogFooter>
    </DialogContent>
  );
}
