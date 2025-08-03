import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { FileText, PenTool, Clock, CheckCircle, XCircle, AlertCircle, Plus, Send, Eye, BarChart3 } from 'lucide-react';
import { format } from 'date-fns';
import { apiRequest } from '@/lib/queryClient';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useForm } from 'react-hook-form';
import { toast } from '@/hooks/use-toast';
import { PieChart, Pie, Cell, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, LineChart, Line } from 'recharts';

interface SignatureRequest {
  id: string;
  documentName: string;
  documentType: string;
  businessRecordId: string;
  customerName: string;
  customerEmail: string;
  status: 'pending' | 'completed' | 'expired' | 'cancelled';
  requestedBy: string;
  requestedDate: Date;
  expirationDate: Date;
  signedDate?: Date;
  documentUrl: string;
  signatureUrl?: string;
  remindersSent: number;
  lastReminderDate?: Date;
  contractValue?: number;
  contractDuration?: number;
  signers: Array<{
    name: string;
    email: string;
    role: string;
    status: string;
    signedDate?: Date;
  }>;
  createdAt: Date;
}

interface SignatureTemplate {
  id: string;
  templateName: string;
  documentType: string;
  description: string;
  templateUrl: string;
  signatureFields: Array<{
    fieldName: string;
    x: number;
    y: number;
    page: number;
    required: boolean;
  }>;
  isActive: boolean;
  usageCount: number;
  lastUsed: Date;
  createdAt: Date;
}

const getStatusColor = (status: string) => {
  switch (status) {
    case 'pending': return 'bg-yellow-100 text-yellow-800';
    case 'completed': return 'bg-green-100 text-green-800';
    case 'expired': return 'bg-red-100 text-red-800';
    case 'cancelled': return 'bg-gray-100 text-gray-800';
    default: return 'bg-gray-100 text-gray-800';
  }
};

const getStatusIcon = (status: string) => {
  switch (status) {
    case 'pending': return <Clock className="h-4 w-4" />;
    case 'completed': return <CheckCircle className="h-4 w-4" />;
    case 'expired': return <XCircle className="h-4 w-4" />;
    case 'cancelled': return <AlertCircle className="h-4 w-4" />;
    default: return <FileText className="h-4 w-4" />;
  }
};

const STATUS_COLORS = ['#ffc658', '#82ca9d', '#ff7c7c', '#8884d8'];

export default function ESignatureIntegration() {
  const [isCreateRequestOpen, setIsCreateRequestOpen] = useState(false);
  const [selectedRequestId, setSelectedRequestId] = useState<string | null>(null);
  const queryClient = useQueryClient();
  const { register, handleSubmit, reset, setValue, watch } = useForm();

  // Fetch signature requests
  const { data: signatureRequests = [], isLoading: requestsLoading } = useQuery({
    queryKey: ['/api/signature-requests'],
    select: (data: any[]) => data.map(request => ({
      ...request,
      requestedDate: new Date(request.requestedDate),
      expirationDate: new Date(request.expirationDate),
      signedDate: request.signedDate ? new Date(request.signedDate) : undefined,
      lastReminderDate: request.lastReminderDate ? new Date(request.lastReminderDate) : undefined,
      createdAt: new Date(request.createdAt)
    }))
  });

  // Fetch signature templates
  const { data: templates = [] } = useQuery<SignatureTemplate[]>({
    queryKey: ['/api/signature-templates'],
    select: (data: any[]) => data.map(template => ({
      ...template,
      lastUsed: new Date(template.lastUsed),
      createdAt: new Date(template.createdAt)
    }))
  });

  // Fetch customers for dropdown
  const { data: customers = [] } = useQuery({
    queryKey: ['/api/demos/customers'] // Reuse customers endpoint
  });

  // Fetch signature analytics
  const { data: analytics } = useQuery({
    queryKey: ['/api/signature-analytics']
  });

  // Create signature request mutation
  const createRequestMutation = useMutation({
    mutationFn: (data: any) => apiRequest('/api/signature-requests', {
      method: 'POST',
      body: JSON.stringify(data)
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/signature-requests'] });
      setIsCreateRequestOpen(false);
      reset();
      toast({
        title: "Signature Request Created",
        description: "The signature request has been sent to the customer.",
      });
    }
  });

  // Send reminder mutation
  const sendReminderMutation = useMutation({
    mutationFn: ({ id, customMessage }: any) => 
      apiRequest(`/api/signature-requests/${id}/remind`, {
        method: 'POST',
        body: JSON.stringify({ customMessage })
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/signature-requests'] });
      toast({
        title: "Reminder Sent",
        description: "Reminder email has been sent to the customer.",
      });
    }
  });

  const onSubmit = (data: any) => {
    createRequestMutation.mutate({
      ...data,
      contractValue: data.contractValue ? parseFloat(data.contractValue) : null,
      contractDuration: data.contractDuration ? parseInt(data.contractDuration) : null,
      expirationDays: parseInt(data.expirationDays) || 30
    });
  };

  const handleSendReminder = (requestId: string) => {
    sendReminderMutation.mutate({ 
      id: requestId, 
      customMessage: "Please review and sign the attached document at your earliest convenience." 
    });
  };

  if (requestsLoading) {
    return (
      <div className="container mx-auto p-6">
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
            <p className="mt-4 text-gray-600">Loading signature requests...</p>
          </div>
        </div>
      </div>
    );
  }

  const statusCounts = signatureRequests.reduce((acc, request) => {
    acc[request.status] = (acc[request.status] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const statusData = Object.entries(statusCounts).map(([status, count], index) => ({
    name: status.charAt(0).toUpperCase() + status.slice(1),
    value: count,
    fill: STATUS_COLORS[index % STATUS_COLORS.length]
  }));

  const completionRate = signatureRequests.length > 0 
    ? ((statusCounts.completed || 0) / signatureRequests.length * 100).toFixed(1)
    : '0';

  return (
    <div className="container mx-auto p-6">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">E-signature Integration</h1>
          <p className="text-gray-600 mt-2">Digital document signing and contract management</p>
        </div>
        
        <Dialog open={isCreateRequestOpen} onOpenChange={setIsCreateRequestOpen}>
          <DialogTrigger asChild>
            <Button className="flex items-center gap-2">
              <Plus className="h-4 w-4" />
              New Signature Request
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Create Signature Request</DialogTitle>
              <DialogDescription>
                Send a document for digital signature to a customer.
              </DialogDescription>
            </DialogHeader>
            
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="businessRecordId">Customer</Label>
                  <Select onValueChange={(value) => setValue('businessRecordId', value)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select customer" />
                    </SelectTrigger>
                    <SelectContent>
                      {customers.map((customer: any) => (
                        <SelectItem key={customer.id} value={customer.id}>
                          {customer.companyName}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="documentType">Document Type</Label>
                  <Select onValueChange={(value) => setValue('documentType', value)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="service_agreement">Service Agreement</SelectItem>
                      <SelectItem value="equipment_lease">Equipment Lease</SelectItem>
                      <SelectItem value="maintenance_contract">Maintenance Contract</SelectItem>
                      <SelectItem value="proposal">Proposal</SelectItem>
                      <SelectItem value="work_order">Work Order</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="documentName">Document Name</Label>
                <Input
                  placeholder="Service Agreement - ABC Corporation"
                  {...register('documentName')}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="templateId">Template (Optional)</Label>
                  <Select onValueChange={(value) => setValue('templateId', value)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select template" />
                    </SelectTrigger>
                    <SelectContent>
                      {templates.map((template) => (
                        <SelectItem key={template.id} value={template.id}>
                          {template.templateName}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="expirationDays">Expires in (days)</Label>
                  <Input
                    type="number"
                    placeholder="30"
                    {...register('expirationDays')}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="contractValue">Contract Value ($)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    placeholder="85000.00"
                    {...register('contractValue')}
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="contractDuration">Duration (months)</Label>
                  <Input
                    type="number"
                    placeholder="36"
                    {...register('contractDuration')}
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => setIsCreateRequestOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={createRequestMutation.isPending}>
                  {createRequestMutation.isPending ? 'Creating...' : 'Send for Signature'}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {analytics && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Requests</CardTitle>
              <FileText className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{analytics.totalRequests}</div>
              <p className="text-xs text-muted-foreground">
                {analytics.pendingRequests} pending
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Completion Rate</CardTitle>
              <CheckCircle className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{analytics.completionRate.toFixed(1)}%</div>
              <p className="text-xs text-muted-foreground">
                {analytics.completedRequests} completed
              </p>
              <Progress value={analytics.completionRate} className="mt-2" />
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Avg. Signing Time</CardTitle>
              <Clock className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{analytics.averageSigningTime} days</div>
              <p className="text-xs text-muted-foreground">
                Industry avg: 3.5 days
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Contract Value</CardTitle>
              <BarChart3 className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                ${analytics.totalContractValue.toLocaleString()}
              </div>
              <p className="text-xs text-muted-foreground">
                Total signed contracts
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      <Tabs defaultValue="requests" className="space-y-6">
        <TabsList>
          <TabsTrigger value="requests">Signature Requests</TabsTrigger>
          <TabsTrigger value="templates">Templates</TabsTrigger>
          <TabsTrigger value="analytics">Analytics</TabsTrigger>
        </TabsList>

        <TabsContent value="requests" className="space-y-6">
          {signatureRequests.length === 0 ? (
            <Card>
              <CardContent className="text-center py-12">
                <PenTool className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">No Signature Requests</h3>
                <p className="text-gray-600 mb-4">Create your first signature request to get started.</p>
                <Button onClick={() => setIsCreateRequestOpen(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  New Signature Request
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {signatureRequests.map((request) => (
                <Card key={request.id} className="hover:shadow-md transition-shadow">
                  <CardContent className="py-4">
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <h3 className="font-medium">{request.documentName}</h3>
                          <Badge className={getStatusColor(request.status)}>
                            <div className="flex items-center gap-1">
                              {getStatusIcon(request.status)}
                              {request.status}
                            </div>
                          </Badge>
                        </div>
                        
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm text-gray-600">
                          <div>
                            <span className="font-medium">Customer:</span>
                            <br />
                            {request.customerName}
                          </div>
                          <div>
                            <span className="font-medium">Requested:</span>
                            <br />
                            {format(request.requestedDate, 'MMM dd, yyyy')}
                          </div>
                          <div>
                            <span className="font-medium">Expires:</span>
                            <br />
                            {format(request.expirationDate, 'MMM dd, yyyy')}
                          </div>
                          <div>
                            <span className="font-medium">Value:</span>
                            <br />
                            {request.contractValue ? `$${request.contractValue.toLocaleString()}` : 'N/A'}
                          </div>
                        </div>

                        {request.signedDate && (
                          <div className="mt-2 text-sm text-green-600">
                            <CheckCircle className="h-4 w-4 inline mr-1" />
                            Signed on {format(request.signedDate, 'MMM dd, yyyy')}
                          </div>
                        )}

                        {request.remindersSent > 0 && (
                          <div className="mt-2 text-sm text-gray-500">
                            {request.remindersSent} reminder(s) sent
                            {request.lastReminderDate && ` • Last: ${format(request.lastReminderDate, 'MMM dd')}`}
                          </div>
                        )}
                      </div>
                      
                      <div className="flex gap-2 ml-4">
                        <Button size="sm" variant="outline">
                          <Eye className="h-4 w-4 mr-2" />
                          View
                        </Button>
                        
                        {request.status === 'pending' && (
                          <Button 
                            size="sm" 
                            variant="outline"
                            onClick={() => handleSendReminder(request.id)}
                            disabled={sendReminderMutation.isPending}
                          >
                            <Send className="h-4 w-4 mr-2" />
                            Remind
                          </Button>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="templates">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {templates.map((template) => (
              <Card key={template.id}>
                <CardHeader>
                  <div className="flex justify-between items-start">
                    <div>
                      <CardTitle className="text-lg">{template.templateName}</CardTitle>
                      <CardDescription>{template.description}</CardDescription>
                    </div>
                    <Badge variant={template.isActive ? 'default' : 'secondary'}>
                      {template.isActive ? 'Active' : 'Inactive'}
                    </Badge>
                  </div>
                </CardHeader>
                
                <CardContent className="space-y-4">
                  <div className="text-sm text-gray-600">
                    <div className="flex justify-between">
                      <span>Document Type:</span>
                      <span className="font-medium">{template.documentType.replace('_', ' ')}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Usage Count:</span>
                      <span className="font-medium">{template.usageCount}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Last Used:</span>
                      <span className="font-medium">{format(template.lastUsed, 'MMM dd, yyyy')}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Signature Fields:</span>
                      <span className="font-medium">{template.signatureFields.length}</span>
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" className="flex-1">
                      <Eye className="h-4 w-4 mr-2" />
                      Preview
                    </Button>
                    <Button size="sm" variant="outline" className="flex-1">
                      Edit
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="analytics" className="space-y-6">
          {analytics && (
            <>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Card>
                  <CardHeader>
                    <CardTitle>Requests by Status</CardTitle>
                    <CardDescription>Distribution of signature request statuses</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={300}>
                      <PieChart>
                        <Pie
                          data={statusData}
                          cx="50%"
                          cy="50%"
                          outerRadius={80}
                          dataKey="value"
                          label={({ name, value }) => `${name}: ${value}`}
                        >
                          {statusData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.fill} />
                          ))}
                        </Pie>
                        <Tooltip />
                      </PieChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Signing Speed Analysis</CardTitle>
                    <CardDescription>How quickly customers sign documents</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      <div className="flex justify-between items-center">
                        <span>Within 24 hours</span>
                        <div className="flex items-center gap-2">
                          <div className="w-24 bg-gray-200 rounded-full h-2">
                            <div 
                              className="bg-green-600 h-2 rounded-full" 
                              style={{ width: `${(analytics.signingSpeedAnalysis.within24Hours / analytics.completedRequests) * 100}%` }}
                            ></div>
                          </div>
                          <span className="text-sm font-medium">
                            {analytics.signingSpeedAnalysis.within24Hours}
                          </span>
                        </div>
                      </div>
                      
                      <div className="flex justify-between items-center">
                        <span>Within 48 hours</span>
                        <div className="flex items-center gap-2">
                          <div className="w-24 bg-gray-200 rounded-full h-2">
                            <div 
                              className="bg-blue-600 h-2 rounded-full" 
                              style={{ width: `${(analytics.signingSpeedAnalysis.within48Hours / analytics.completedRequests) * 100}%` }}
                            ></div>
                          </div>
                          <span className="text-sm font-medium">
                            {analytics.signingSpeedAnalysis.within48Hours}
                          </span>
                        </div>
                      </div>
                      
                      <div className="flex justify-between items-center">
                        <span>Within 1 week</span>
                        <div className="flex items-center gap-2">
                          <div className="w-24 bg-gray-200 rounded-full h-2">
                            <div 
                              className="bg-yellow-600 h-2 rounded-full" 
                              style={{ width: `${(analytics.signingSpeedAnalysis.within1Week / analytics.completedRequests) * 100}%` }}
                            ></div>
                          </div>
                          <span className="text-sm font-medium">
                            {analytics.signingSpeedAnalysis.within1Week}
                          </span>
                        </div>
                      </div>
                      
                      <div className="flex justify-between items-center">
                        <span>More than 1 week</span>
                        <div className="flex items-center gap-2">
                          <div className="w-24 bg-gray-200 rounded-full h-2">
                            <div 
                              className="bg-red-600 h-2 rounded-full" 
                              style={{ width: `${(analytics.signingSpeedAnalysis.moreThan1Week / analytics.completedRequests) * 100}%` }}
                            ></div>
                          </div>
                          <span className="text-sm font-medium">
                            {analytics.signingSpeedAnalysis.moreThan1Week}
                          </span>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>

              <Card>
                <CardHeader>
                  <CardTitle>Document Types Performance</CardTitle>
                  <CardDescription>Completion rates by document type</CardDescription>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={analytics.byDocumentType}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="type" />
                      <YAxis />
                      <Tooltip formatter={(value, name) => [value, name === 'count' ? 'Total' : 'Completed']} />
                      <Bar dataKey="count" fill="#8884d8" name="Total" />
                      <Bar dataKey="completed" fill="#82ca9d" name="Completed" />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}