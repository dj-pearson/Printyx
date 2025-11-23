/**
 * Scheduled Reports Dashboard
 * Automate report delivery via email - competitive advantage vs E-Automate
 */

import React, { useState } from 'react';
import MainLayout from '@/components/layout/main-layout';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Switch } from '@/components/ui/switch';
import {
  Calendar,
  Clock,
  Mail,
  FileText,
  Download,
  Edit,
  Trash2,
  Play,
  Pause,
  Copy,
  Eye,
  Users,
  Settings,
  Plus,
  CheckCircle2,
  Circle,
  TrendingUp,
  BarChart3,
  FileSpreadsheet,
  FileDown,
  Send,
  Zap,
  Target
} from 'lucide-react';

interface ScheduledReport {
  id: string;
  name: string;
  description: string;
  reportType: string;
  schedule: {
    frequency: 'daily' | 'weekly' | 'monthly' | 'quarterly';
    time: string;
    dayOfWeek?: number;
    dayOfMonth?: number;
    timezone: string;
  };
  recipients: string[];
  format: 'pdf' | 'excel' | 'csv';
  filters: any;
  status: 'active' | 'paused' | 'failed';
  lastRun?: Date;
  nextRun: Date;
  runCount: number;
  createdBy: string;
  createdAt: Date;
}

const mockScheduledReports: ScheduledReport[] = [
  {
    id: '1',
    name: 'Weekly Sales Performance',
    description: 'Comprehensive sales metrics and pipeline analysis sent to sales team every Monday',
    reportType: 'sales-dashboard',
    schedule: {
      frequency: 'weekly',
      time: '08:00',
      dayOfWeek: 1,
      timezone: 'America/New_York'
    },
    recipients: ['sales@company.com', 'manager@company.com'],
    format: 'pdf',
    filters: { dateRange: 'last-7-days' },
    status: 'active',
    lastRun: new Date('2025-11-18T08:00:00'),
    nextRun: new Date('2025-11-25T08:00:00'),
    runCount: 47,
    createdBy: 'John Doe',
    createdAt: new Date('2025-01-15')
  },
  {
    id: '2',
    name: 'Monthly Financial Summary',
    description: 'Revenue, expenses, and profitability report for executive team',
    reportType: 'financial-summary',
    schedule: {
      frequency: 'monthly',
      time: '09:00',
      dayOfMonth: 1,
      timezone: 'America/New_York'
    },
    recipients: ['cfo@company.com', 'ceo@company.com'],
    format: 'excel',
    filters: { dateRange: 'last-month' },
    status: 'active',
    lastRun: new Date('2025-11-01T09:00:00'),
    nextRun: new Date('2025-12-01T09:00:00'),
    runCount: 10,
    createdBy: 'Jane Smith',
    createdAt: new Date('2025-02-01')
  },
  {
    id: '3',
    name: 'Daily Service Metrics',
    description: 'Service call volume, response times, and technician performance',
    reportType: 'service-metrics',
    schedule: {
      frequency: 'daily',
      time: '17:00',
      timezone: 'America/New_York'
    },
    recipients: ['service@company.com'],
    format: 'csv',
    filters: { dateRange: 'today' },
    status: 'active',
    lastRun: new Date('2025-11-22T17:00:00'),
    nextRun: new Date('2025-11-23T17:00:00'),
    runCount: 234,
    createdBy: 'Mike Johnson',
    createdAt: new Date('2025-03-10')
  },
  {
    id: '4',
    name: 'Customer Health Scores',
    description: 'Weekly customer health analysis with churn risk alerts',
    reportType: 'customer-health',
    schedule: {
      frequency: 'weekly',
      time: '10:00',
      dayOfWeek: 5,
      timezone: 'America/New_York'
    },
    recipients: ['csm@company.com', 'sales@company.com'],
    format: 'pdf',
    filters: { healthScore: 'below-70' },
    status: 'paused',
    lastRun: new Date('2025-11-15T10:00:00'),
    nextRun: new Date('2025-11-29T10:00:00'),
    runCount: 12,
    createdBy: 'Sarah Lee',
    createdAt: new Date('2025-09-01')
  }
];

const reportTypes = [
  { value: 'sales-dashboard', label: 'Sales Dashboard', icon: TrendingUp },
  { value: 'financial-summary', label: 'Financial Summary', icon: BarChart3 },
  { value: 'service-metrics', label: 'Service Metrics', icon: Settings },
  { value: 'customer-health', label: 'Customer Health', icon: Users },
  { value: 'inventory-report', label: 'Inventory Report', icon: FileText },
  { value: 'equipment-status', label: 'Equipment Status', icon: Target }
];

export default function ScheduledReportsDashboard() {
  const [reports, setReports] = useState(mockScheduledReports);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [selectedReport, setSelectedReport] = useState<ScheduledReport | null>(null);

  const stats = {
    total: reports.length,
    active: reports.filter(r => r.status === 'active').length,
    paused: reports.filter(r => r.status === 'paused').length,
    totalDeliveries: reports.reduce((sum, r) => sum + r.runCount, 0)
  };

  const toggleReportStatus = (reportId: string) => {
    setReports(reports.map(r =>
      r.id === reportId
        ? { ...r, status: r.status === 'active' ? 'paused' : 'active' as any }
        : r
    ));
  };

  const runReportNow = (reportId: string) => {
    console.log('Running report:', reportId);
    // Trigger immediate report generation and delivery
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
            <CreateReportDialog onClose={() => setIsCreateDialogOpen(false)} />
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

        {/* Scheduled Reports List */}
        <div className="grid gap-4">
          {reports.map((report) => (
            <Card key={report.id} className="hover:shadow-md transition-shadow">
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <CardTitle>{report.name}</CardTitle>
                      <Badge variant={report.status === 'active' ? 'default' : 'secondary'}>
                        {report.status === 'active' ? (
                          <><CheckCircle2 className="h-3 w-3 mr-1" /> Active</>
                        ) : (
                          <><Pause className="h-3 w-3 mr-1" /> Paused</>
                        )}
                      </Badge>
                      <Badge variant="outline">
                        {report.format.toUpperCase()}
                      </Badge>
                    </div>
                    <CardDescription>{report.description}</CardDescription>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="ghost" size="icon" onClick={() => runReportNow(report.id)}>
                      <Play className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => setSelectedReport(report)}>
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => toggleReportStatus(report.id)}
                    >
                      {report.status === 'active' ? (
                        <Pause className="h-4 w-4" />
                      ) : (
                        <Play className="h-4 w-4" />
                      )}
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
                        {report.schedule.frequency.charAt(0).toUpperCase() + report.schedule.frequency.slice(1)} at {report.schedule.time}
                      </span>
                    </div>
                  </div>
                  <div>
                    <p className="text-muted-foreground mb-1">Recipients</p>
                    <div className="flex items-center gap-2">
                      <Mail className="h-4 w-4" />
                      <span className="font-medium">{report.recipients.length} recipient{report.recipients.length !== 1 ? 's' : ''}</span>
                    </div>
                  </div>
                  <div>
                    <p className="text-muted-foreground mb-1">Next Run</p>
                    <div className="flex items-center gap-2">
                      <Calendar className="h-4 w-4" />
                      <span className="font-medium">
                        {report.nextRun.toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                  <div>
                    <p className="text-muted-foreground mb-1">Deliveries</p>
                    <div className="flex items-center gap-2">
                      <Send className="h-4 w-4" />
                      <span className="font-medium">{report.runCount} sent</span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Empty State */}
        {reports.length === 0 && (
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
                      <p className="text-sm text-white/90">Regular metrics reviews improve performance</p>
                    </div>
                  </li>
                </ul>
              </div>
              <div className="flex items-center justify-center">
                <div className="text-center">
                  <div className="text-6xl font-bold mb-2">{stats.totalDeliveries}</div>
                  <p className="text-lg text-white/90">Reports Delivered Automatically</p>
                  <p className="text-sm text-white/80 mt-2">Saving ~{Math.round(stats.totalDeliveries * 0.25)} hours of manual work</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  );
}

function CreateReportDialog({ onClose }: { onClose: () => void }) {
  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    reportType: '',
    frequency: 'weekly',
    time: '09:00',
    dayOfWeek: '1',
    recipients: '',
    format: 'pdf'
  });

  const handleCreate = () => {
    console.log('Creating scheduled report:', formData);
    onClose();
  };

  return (
    <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
      <DialogHeader>
        <DialogTitle>Schedule New Report</DialogTitle>
        <DialogDescription>
          Automate report delivery to keep your team informed
        </DialogDescription>
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
            <Select value={formData.reportType} onValueChange={(v) => setFormData({ ...formData, reportType: v })}>
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
            <Select value={formData.frequency} onValueChange={(v) => setFormData({ ...formData, frequency: v })}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="daily">Daily</SelectItem>
                <SelectItem value="weekly">Weekly</SelectItem>
                <SelectItem value="monthly">Monthly</SelectItem>
                <SelectItem value="quarterly">Quarterly</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {formData.frequency === 'weekly' && (
            <div>
              <Label htmlFor="dayOfWeek">Day of Week</Label>
              <Select value={formData.dayOfWeek} onValueChange={(v) => setFormData({ ...formData, dayOfWeek: v })}>
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
          <div>
            <Label htmlFor="time">Time</Label>
            <Input
              id="time"
              type="time"
              value={formData.time}
              onChange={(e) => setFormData({ ...formData, time: e.target.value })}
            />
          </div>
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
            <Select value={formData.format} onValueChange={(v) => setFormData({ ...formData, format: v })}>
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
                <SelectItem value="excel">
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
        <Button variant="outline" onClick={onClose}>Cancel</Button>
        <div className="flex gap-2">
          {step > 1 && (
            <Button variant="outline" onClick={() => setStep(step - 1)}>
              Previous
            </Button>
          )}
          {step < 3 ? (
            <Button onClick={() => setStep(step + 1)}>Next</Button>
          ) : (
            <Button onClick={handleCreate}>
              <Calendar className="h-4 w-4 mr-2" />
              Schedule Report
            </Button>
          )}
        </div>
      </DialogFooter>
    </DialogContent>
  );
}
