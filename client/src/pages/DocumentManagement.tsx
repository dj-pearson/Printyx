import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { FileText, Upload, Search, FileCheck, Clock, AlertTriangle, CheckCircle, FolderOpen, Download, Share, Edit, Eye, Settings, Filter, FileSignature, Zap, Users, Calendar, Target, Activity } from 'lucide-react';
import { format } from 'date-fns';
import { apiRequest } from '@/lib/queryClient';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useForm } from 'react-hook-form';
import { toast } from '@/hooks/use-toast';
import { Textarea } from '@/components/ui/textarea';

interface DocumentCategory {
  id: string;
  name: string;
  documentCount: number;
  subcategories: Array<{
    name: string;
    count: number;
    icon: string;
  }>;
  recentActivity: number;
  complianceStatus: string;
  retentionPolicy: string;
  accessLevel: string;
}

interface Document {
  id: string;
  title: string;
  category: string;
  subcategory: string;
  fileType: string;
  fileSize: string;
  lastModified: Date;
  modifiedBy: string;
  status: string;
  version: string;
  tags: string[];
  permissions: {
    view: string[];
    edit: string[];
    approve: string[];
  };
  workflow?: {
    currentStage: string;
    nextAction: string;
    dueDate: Date;
    assignedTo: string;
  };
  ocrText: string;
  checksumMD5: string;
}

const getStatusColor = (status: string) => {
  switch (status) {
    case 'active': return 'bg-green-100 text-green-800';
    case 'draft': return 'bg-yellow-100 text-yellow-800';
    case 'approved': return 'bg-blue-100 text-blue-800';
    case 'expired': return 'bg-red-100 text-red-800';
    case 'under_review': return 'bg-orange-100 text-orange-800';
    default: return 'bg-gray-100 text-gray-800';
  }
};

const getComplianceColor = (status: string) => {
  switch (status) {
    case 'compliant': return 'bg-green-100 text-green-800';
    case 'review_required': return 'bg-yellow-100 text-yellow-800';
    case 'non_compliant': return 'bg-red-100 text-red-800';
    default: return 'bg-gray-100 text-gray-800';
  }
};

const getPriorityColor = (priority: string) => {
  switch (priority) {
    case 'critical': return 'bg-red-100 text-red-800';
    case 'high': return 'bg-orange-100 text-orange-800';
    case 'medium': return 'bg-yellow-100 text-yellow-800';
    case 'low': return 'bg-blue-100 text-blue-800';
    default: return 'bg-gray-100 text-gray-800';
  }
};

export default function DocumentManagement() {
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const queryClient = useQueryClient();
  const { register, handleSubmit, reset } = useForm();

  // Fetch document library
  const { data: documentLibrary, isLoading: libraryLoading } = useQuery({
    queryKey: ['/api/document-management/library', selectedCategory],
    select: (data: any) => ({
      ...data,
      recentDocuments: data.recentDocuments?.map((doc: any) => ({
        ...doc,
        lastModified: new Date(doc.lastModified),
        workflow: doc.workflow ? {
          ...doc.workflow,
          dueDate: new Date(doc.workflow.dueDate)
        } : undefined
      })) || []
    })
  });

  // Fetch workflow templates
  const { data: workflowData } = useQuery({
    queryKey: ['/api/document-management/workflows']
  });

  // Fetch search results
  const { data: searchResults } = useQuery({
    queryKey: ['/api/document-management/search', searchQuery],
    enabled: searchQuery.length > 2
  });

  // Upload document mutation
  const uploadMutation = useMutation({
    mutationFn: (data: any) => apiRequest('/api/document-management/upload', {
      method: 'POST',
      body: JSON.stringify(data)
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/document-management/library'] });
      setUploadDialogOpen(false);
      reset();
      toast({
        title: "Document Uploaded",
        description: "Document has been uploaded and OCR processing initiated.",
      });
    }
  });

  const handleUpload = (data: any) => {
    uploadMutation.mutate({
      fileName: data.fileName,
      fileSize: '2.4 MB', // Simulated
      fileType: 'pdf',
      category: data.category,
      tags: data.tags?.split(',').map((tag: string) => tag.trim()) || []
    });
  };

  if (libraryLoading) {
    return (
      <div className="container mx-auto p-6">
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
            <p className="mt-4 text-gray-600">Loading document management system...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Document Management</h1>
          <p className="text-gray-600 mt-2">Organize, automate, and manage all business documents</p>
        </div>
        
        <div className="flex items-center gap-3">
          <Dialog open={uploadDialogOpen} onOpenChange={setUploadDialogOpen}>
            <DialogTrigger asChild>
              <Button className="flex items-center gap-2">
                <Upload className="h-4 w-4" />
                Upload Document
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Upload New Document</DialogTitle>
                <DialogDescription>
                  Upload a document with automatic OCR processing and workflow assignment.
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleSubmit(handleUpload)} className="space-y-4">
                <div>
                  <Label htmlFor="fileName">File Name</Label>
                  <Input
                    id="fileName"
                    {...register('fileName', { required: true })}
                    placeholder="Enter document title"
                  />
                </div>
                <div>
                  <Label htmlFor="category">Category</Label>
                  <Select>
                    <SelectTrigger>
                      <SelectValue placeholder="Select category" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="contracts">Contracts & Agreements</SelectItem>
                      <SelectItem value="service-docs">Service Documentation</SelectItem>
                      <SelectItem value="financial">Financial Records</SelectItem>
                      <SelectItem value="compliance">Compliance & Legal</SelectItem>
                      <SelectItem value="training">Training & Procedures</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="tags">Tags (comma-separated)</Label>
                  <Input
                    id="tags"
                    {...register('tags')}
                    placeholder="e.g., contract, renewal, metro-office"
                  />
                </div>
                <div className="flex justify-end gap-2">
                  <Button type="button" variant="outline" onClick={() => setUploadDialogOpen(false)}>
                    Cancel
                  </Button>
                  <Button type="submit" disabled={uploadMutation.isPending}>
                    {uploadMutation.isPending ? 'Uploading...' : 'Upload'}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
          
          <Button variant="outline" className="flex items-center gap-2">
            <Settings className="h-4 w-4" />
            Automation Settings
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Documents</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {documentLibrary && (
              <>
                <div className="text-2xl font-bold">{documentLibrary.summary.totalDocuments.toLocaleString()}</div>
                <p className="text-xs text-muted-foreground">
                  {documentLibrary.summary.categoriesCount} categories
                </p>
                <div className="text-xs text-gray-600 mt-1">
                  Storage: {documentLibrary.summary.storageUsed} / {documentLibrary.summary.storageLimit}
                </div>
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pending Approval</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {documentLibrary && (
              <>
                <div className="text-2xl font-bold text-orange-600">{documentLibrary.summary.pendingApproval}</div>
                <p className="text-xs text-muted-foreground">
                  Requiring action
                </p>
                <div className="text-xs text-gray-600 mt-1">
                  {documentLibrary.summary.expiringSoon} expiring soon
                </div>
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Compliance Score</CardTitle>
            <FileCheck className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {documentLibrary && (
              <>
                <div className="text-2xl font-bold text-green-600">{documentLibrary.summary.complianceScore}%</div>
                <p className="text-xs text-muted-foreground">
                  Overall compliance rating
                </p>
                <Progress value={documentLibrary.summary.complianceScore} className="mt-2" />
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Automation Rate</CardTitle>
            <Zap className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {workflowData && (
              <>
                <div className="text-2xl font-bold">{workflowData.automationStats.automationSuccessRate}%</div>
                <p className="text-xs text-muted-foreground">
                  Workflow automation success
                </p>
                <div className="text-xs text-gray-600 mt-1">
                  {workflowData.automationStats.timesSaved}h saved/month
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="library" className="space-y-6">
        <TabsList>
          <TabsTrigger value="library">Document Library</TabsTrigger>
          <TabsTrigger value="workflows">Workflows</TabsTrigger>
          <TabsTrigger value="search">Search & OCR</TabsTrigger>
          <TabsTrigger value="automation">Automation</TabsTrigger>
        </TabsList>

        <TabsContent value="library" className="space-y-6">
          {/* Document Categories */}
          <Card>
            <CardHeader>
              <CardTitle>Document Categories</CardTitle>
              <CardDescription>Organize documents by type and compliance requirements</CardDescription>
            </CardHeader>
            <CardContent>
              {documentLibrary && (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {documentLibrary.categories.map((category: DocumentCategory) => (
                    <div
                      key={category.id}
                      className="border rounded-lg p-4 hover:shadow-md transition-shadow cursor-pointer"
                      onClick={() => setSelectedCategory(category.id)}
                    >
                      <div className="flex justify-between items-start mb-3">
                        <div>
                          <h4 className="font-medium">{category.name}</h4>
                          <div className="text-sm text-gray-600">{category.documentCount} documents</div>
                        </div>
                        <Badge className={getComplianceColor(category.complianceStatus)}>
                          {category.complianceStatus.replace('_', ' ')}
                        </Badge>
                      </div>
                      
                      <div className="space-y-2 mb-3">
                        {category.subcategories.slice(0, 3).map((sub, idx) => (
                          <div key={idx} className="flex justify-between text-sm">
                            <span className="text-gray-600">{sub.name}</span>
                            <span className="font-medium">{sub.count}</span>
                          </div>
                        ))}
                      </div>
                      
                      <div className="text-xs text-gray-500">
                        <div>Retention: {category.retentionPolicy}</div>
                        <div>Access: {category.accessLevel}</div>
                        <div className="flex items-center gap-1 mt-1">
                          <Activity className="h-3 w-3" />
                          {category.recentActivity} recent activities
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Recent Documents */}
          <Card>
            <CardHeader>
              <CardTitle>Recent Documents</CardTitle>
              <CardDescription>Recently accessed and modified documents</CardDescription>
            </CardHeader>
            <CardContent>
              {documentLibrary && (
                <div className="space-y-4">
                  {documentLibrary.recentDocuments.map((doc: Document) => (
                    <div key={doc.id} className="border rounded-lg p-4">
                      <div className="flex justify-between items-start mb-3">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <FileText className="h-4 w-4 text-blue-600" />
                            <h4 className="font-medium">{doc.title}</h4>
                            <Badge className={getStatusColor(doc.status)}>
                              {doc.status}
                            </Badge>
                          </div>
                          
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm text-gray-600 mb-2">
                            <div>
                              <span className="font-medium">Category:</span>
                              <br />
                              {doc.subcategory}
                            </div>
                            <div>
                              <span className="font-medium">Modified:</span>
                              <br />
                              {format(doc.lastModified, 'MMM dd, yyyy')}
                            </div>
                            <div>
                              <span className="font-medium">Modified by:</span>
                              <br />
                              {doc.modifiedBy}
                            </div>
                            <div>
                              <span className="font-medium">Version:</span>
                              <br />
                              {doc.version}
                            </div>
                          </div>
                          
                          <div className="flex gap-1 mb-2">
                            {doc.tags.map((tag, idx) => (
                              <Badge key={idx} variant="outline" className="text-xs">
                                {tag}
                              </Badge>
                            ))}
                          </div>
                          
                          {doc.workflow && (
                            <div className="bg-blue-50 rounded p-2 text-sm">
                              <div className="font-medium text-blue-800">Workflow Status</div>
                              <div className="text-blue-700">
                                Current stage: {doc.workflow.currentStage.replace('_', ' ')}
                              </div>
                              <div className="text-blue-700">
                                Next action: {doc.workflow.nextAction.replace('_', ' ')}
                              </div>
                              <div className="text-blue-700">
                                Assigned to: {doc.workflow.assignedTo}
                              </div>
                              <div className="text-blue-700">
                                Due: {format(doc.workflow.dueDate, 'MMM dd, yyyy HH:mm')}
                              </div>
                            </div>
                          )}
                        </div>
                        
                        <div className="text-right ml-4">
                          <div className="text-lg font-bold text-gray-600">{doc.fileType.toUpperCase()}</div>
                          <div className="text-sm text-gray-500">{doc.fileSize}</div>
                          
                          <div className="flex gap-1 mt-2">
                            <Button size="sm" variant="outline">
                              <Eye className="h-3 w-3" />
                            </Button>
                            <Button size="sm" variant="outline">
                              <Download className="h-3 w-3" />
                            </Button>
                            <Button size="sm" variant="outline">
                              <Share className="h-3 w-3" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Pending Actions */}
          {documentLibrary && documentLibrary.pendingActions.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Pending Actions</CardTitle>
                <CardDescription>Documents requiring immediate attention</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {documentLibrary.pendingActions.map((action: any) => (
                    <div key={action.id} className="border rounded-lg p-3">
                      <div className="flex justify-between items-start">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <Badge className={getPriorityColor(action.priority)}>
                              {action.priority}
                            </Badge>
                            <span className="font-medium capitalize">
                              {action.actionType.replace('_', ' ')}
                            </span>
                          </div>
                          
                          <div className="font-medium text-gray-900 mb-1">
                            {action.documentTitle}
                          </div>
                          
                          <div className="text-sm text-gray-600 mb-2">
                            {action.description}
                          </div>
                          
                          <div className="text-xs text-gray-500">
                            <div>Assigned to: {action.assignedTo}</div>
                            <div>Due: {format(new Date(action.dueDate), 'MMM dd, yyyy HH:mm')}</div>
                            <div>Estimated time: {action.estimatedTime} minutes</div>
                          </div>
                        </div>
                        
                        <div className="flex gap-2">
                          <Button size="sm" variant="outline">
                            View
                          </Button>
                          <Button size="sm">
                            Take Action
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="workflows" className="space-y-6">
          {workflowData && (
            <>
              {/* Workflow Templates */}
              <Card>
                <CardHeader>
                  <CardTitle>Workflow Templates</CardTitle>
                  <CardDescription>Automated document processing workflows</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {workflowData.templates.map((template: any) => (
                      <div key={template.id} className="border rounded-lg p-4">
                        <div className="flex justify-between items-start mb-3">
                          <div>
                            <h4 className="font-medium">{template.name}</h4>
                            <div className="text-sm text-gray-600 mb-2">{template.description}</div>
                            <Badge className={template.isActive ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}>
                              {template.isActive ? 'Active' : 'Inactive'}
                            </Badge>
                          </div>
                          
                          <div className="text-right">
                            <div className="text-lg font-bold">{template.usage}</div>
                            <div className="text-sm text-gray-500">times used</div>
                          </div>
                        </div>
                        
                        <div className="bg-gray-50 rounded p-3 mb-3">
                          <h5 className="font-medium text-gray-800 mb-2">Workflow Stages</h5>
                          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-2">
                            {template.stages.map((stage: any, idx: number) => (
                              <div key={stage.id} className="text-center">
                                <div className="bg-blue-100 text-blue-800 rounded-full px-2 py-1 text-xs font-medium mb-1">
                                  {idx + 1}. {stage.name}
                                </div>
                                <div className="text-xs text-gray-600">{stage.assignedRole}</div>
                                <div className="text-xs text-gray-500">{stage.slaHours}h SLA</div>
                              </div>
                            ))}
                          </div>
                        </div>
                        
                        <div className="grid grid-cols-3 gap-4 text-sm">
                          <div>
                            <div className="text-gray-600">Avg Completion</div>
                            <div className="font-bold">{template.metrics.averageCompletionTime} days</div>
                          </div>
                          <div>
                            <div className="text-gray-600">Approval Rate</div>
                            <div className="font-bold">{template.metrics.approvalRate}%</div>
                          </div>
                          <div>
                            <div className="text-gray-600">SLA Compliance</div>
                            <div className="font-bold">{template.metrics.slaComplianceRate}%</div>
                          </div>
                        </div>
                        
                        <div className="flex justify-end gap-2 mt-3">
                          <Button size="sm" variant="outline">
                            <Edit className="h-3 w-3 mr-1" />
                            Edit Template
                          </Button>
                          <Button size="sm" variant="outline">
                            <Target className="h-3 w-3 mr-1" />
                            View Metrics
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* Active Workflows */}
              <Card>
                <CardHeader>
                  <CardTitle>Active Workflows</CardTitle>
                  <CardDescription>Currently running document workflows</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {workflowData.activeWorkflows.map((workflow: any) => (
                      <div key={workflow.id} className="border rounded-lg p-4">
                        <div className="flex justify-between items-start mb-3">
                          <div className="flex-1">
                            <h4 className="font-medium">{workflow.documentTitle}</h4>
                            <div className="text-sm text-gray-600">{workflow.currentStage.replace('_', ' ')}</div>
                          </div>
                          
                          <div className="text-right">
                            <Badge className={getPriorityColor(workflow.priority)}>
                              {workflow.priority}
                            </Badge>
                            <div className="text-sm text-gray-500 mt-1">
                              {workflow.slaStatus.replace('_', ' ')}
                            </div>
                          </div>
                        </div>
                        
                        <div className="mb-3">
                          <div className="flex justify-between text-sm mb-1">
                            <span>Progress</span>
                            <span>{workflow.progress}%</span>
                          </div>
                          <Progress value={workflow.progress} />
                        </div>
                        
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm text-gray-600">
                          <div>
                            <span className="font-medium">Assigned to:</span>
                            <br />
                            {workflow.assignedTo}
                          </div>
                          <div>
                            <span className="font-medium">Started:</span>
                            <br />
                            {format(new Date(workflow.startedAt), 'MMM dd')}
                          </div>
                          <div>
                            <span className="font-medium">Due:</span>
                            <br />
                            {format(new Date(workflow.dueAt), 'MMM dd')}
                          </div>
                          <div>
                            <span className="font-medium">Template:</span>
                            <br />
                            {workflow.templateId.replace('-', ' ')}
                          </div>
                        </div>
                        
                        <div className="flex justify-end gap-2 mt-3">
                          <Button size="sm" variant="outline">
                            <Eye className="h-3 w-3 mr-1" />
                            View Details
                          </Button>
                          <Button size="sm">
                            Take Action
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </>
          )}
        </TabsContent>

        <TabsContent value="search" className="space-y-6">
          {/* Search Interface */}
          <Card>
            <CardHeader>
              <CardTitle>Document Search</CardTitle>
              <CardDescription>Search documents with OCR and metadata</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex gap-4 mb-6">
                <div className="flex-1">
                  <Input
                    placeholder="Search documents, content, or metadata..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="text-lg"
                  />
                </div>
                <Button>
                  <Search className="h-4 w-4 mr-2" />
                  Search
                </Button>
              </div>
              
              {searchResults && (
                <div className="space-y-4">
                  <div className="text-sm text-gray-600">
                    Found {searchResults.totalResults} results in {searchResults.searchTime} seconds
                  </div>
                  
                  {searchResults.results.map((result: any) => (
                    <div key={result.id} className="border rounded-lg p-4">
                      <div className="flex justify-between items-start mb-2">
                        <div className="flex-1">
                          <h4 className="font-medium text-blue-600">{result.title}</h4>
                          <div className="text-sm text-gray-600">
                            {result.category} - {result.subcategory}
                          </div>
                        </div>
                        
                        <div className="text-right">
                          <div className="text-sm font-medium">{result.relevanceScore}% match</div>
                          <div className="text-xs text-gray-500">{result.matchType.replace('_', ' ')}</div>
                        </div>
                      </div>
                      
                      <div className="space-y-2 mb-3">
                        {result.highlights.map((highlight: string, idx: number) => (
                          <div key={idx} className="text-sm" dangerouslySetInnerHTML={{ __html: highlight }} />
                        ))}
                      </div>
                      
                      <div className="text-xs text-gray-500">
                        OCR Confidence: {result.ocrConfidence}% | 
                        Size: {result.metadata.fileSize} | 
                        Modified: {format(new Date(result.metadata.lastModified), 'MMM dd, yyyy')}
                      </div>
                      
                      <div className="flex justify-end gap-2 mt-2">
                        <Button size="sm" variant="outline">
                          <Eye className="h-3 w-3 mr-1" />
                          View
                        </Button>
                        <Button size="sm" variant="outline">
                          <Download className="h-3 w-3 mr-1" />
                          Download
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="automation" className="space-y-6">
          {workflowData && (
            <Card>
              <CardHeader>
                <CardTitle>Automation Statistics</CardTitle>
                <CardDescription>Workflow automation performance and metrics</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                  <div className="text-center">
                    <div className="text-2xl font-bold text-blue-600">{workflowData.automationStats.totalRulesActive}</div>
                    <div className="text-sm text-gray-600">Active Rules</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-green-600">{workflowData.automationStats.rulesTriggeredToday}</div>
                    <div className="text-sm text-gray-600">Triggered Today</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-purple-600">{workflowData.automationStats.timesSaved}h</div>
                    <div className="text-sm text-gray-600">Time Saved/Month</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-orange-600">{workflowData.automationStats.documentsProcessed.toLocaleString()}</div>
                    <div className="text-sm text-gray-600">Documents Processed</div>
                  </div>
                </div>
                
                <div className="mt-6 p-4 bg-green-50 rounded-lg">
                  <div className="flex items-center gap-2 mb-2">
                    <CheckCircle className="h-5 w-5 text-green-600" />
                    <span className="font-medium text-green-800">Automation Success Rate</span>
                  </div>
                  <div className="text-2xl font-bold text-green-600 mb-2">
                    {workflowData.automationStats.automationSuccessRate}%
                  </div>
                  <Progress value={workflowData.automationStats.automationSuccessRate} className="h-2" />
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}