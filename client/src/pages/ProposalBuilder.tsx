import { useState, useEffect } from 'react';
import { useLocation } from 'wouter';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { 
  FileText, 
  FileSignature, 
  Palette, 
  Eye, 
  Send, 
  Plus,
  ArrowLeft,
  Settings,
  Layout,
  Image,
  Type,
  Users,
  Award,
  Calendar,
  DollarSign,
  CheckCircle,
  Search,
  SortAsc,
  SortDesc,
  Grid,
  Table as TableIcon
} from 'lucide-react';
import MainLayout from '@/components/layout/main-layout';

interface ProposalTemplate {
  id: string;
  name: string;
  category: string;
  description: string;
  isDefault: boolean;
  sections: ProposalSection[];
  styling: {
    primaryColor?: string;
    logoUrl?: string;
    fontFamily?: string;
  };
}

interface ProposalSection {
  id: string;
  type: string;
  title: string;
  displayOrder: number;
  isRequired: boolean;
  isVisible: boolean;
  icon: any;
  description: string;
}

const sectionTypes = [
  { type: 'cover_page', title: 'Cover Page', icon: FileText, description: 'Professional cover with logos and customer info', required: true },
  { type: 'executive_summary', title: 'Executive Summary', icon: Eye, description: 'High-level project overview and benefits', required: false },
  { type: 'company_intro', title: 'Company Introduction', icon: Users, description: 'About us, history, and credentials', required: false },
  { type: 'solution_overview', title: 'Solution Overview', icon: Layout, description: 'Detailed solution description and features', required: false },
  { type: 'pricing', title: 'Investment Summary', icon: DollarSign, description: 'Pricing breakdown and payment terms', required: true },
  { type: 'guarantees', title: 'Guarantees & Warranties', icon: Award, description: 'Service level agreements and guarantees', required: false },
  { type: 'team', title: 'Team Introduction', icon: Users, description: 'Key personnel and contact information', required: false },
  { type: 'terms', title: 'Terms & Conditions', icon: FileText, description: 'Legal terms and contract conditions', required: false },
  { type: 'next_steps', title: 'Next Steps', icon: Calendar, description: 'Implementation timeline and process', required: false },
];

const proposalTemplates: ProposalTemplate[] = [
  {
    id: '1',
    name: 'Enterprise Equipment Lease',
    category: 'equipment_lease',
    description: 'Comprehensive template for large equipment leasing proposals',
    isDefault: true,
    sections: sectionTypes.slice(0, 7).map((section, index) => ({
      id: `section-${index}`,
      type: section.type,
      title: section.title,
      displayOrder: index + 1,
      isRequired: section.required,
      isVisible: true,
      icon: section.icon,
      description: section.description,
    })),
    styling: {
      primaryColor: '#0066CC',
      fontFamily: 'Inter',
    }
  },
  {
    id: '2',
    name: 'Service Contract Standard',
    category: 'service_contract',
    description: 'Template for ongoing service and maintenance contracts',
    isDefault: false,
    sections: [
      sectionTypes[0], sectionTypes[1], sectionTypes[2], 
      sectionTypes[4], sectionTypes[5], sectionTypes[7], sectionTypes[8]
    ].map((section, index) => ({
      id: `section-${index}`,
      type: section.type,
      title: section.title,
      displayOrder: index + 1,
      isRequired: section.required,
      isVisible: true,
      icon: section.icon,
      description: section.description,
    })),
    styling: {
      primaryColor: '#28A745',
      fontFamily: 'Inter',
    }
  },
  {
    id: '3',
    name: 'Managed Services',
    category: 'managed_services',
    description: 'Comprehensive managed IT and print services proposal',
    isDefault: false,
    sections: sectionTypes.map((section, index) => ({
      id: `section-${index}`,
      type: section.type,
      title: section.title,
      displayOrder: index + 1,
      isRequired: section.required,
      isVisible: true,
      icon: section.icon,
      description: section.description,
    })),
    styling: {
      primaryColor: '#6C5CE7',
      fontFamily: 'Inter',
    }
  }
];

export default function ProposalBuilder() {
  const [, setLocation] = useLocation();
  const [selectedTemplate, setSelectedTemplate] = useState<ProposalTemplate | null>(null);
  const [selectedQuote, setSelectedQuote] = useState<string | null>(null);
  const [activeStep, setActiveStep] = useState<'quote' | 'template' | 'sections' | 'content' | 'preview'>('quote');
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('grid');
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState<'name' | 'customer' | 'amount' | 'date'>('date');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [proposalContent, setProposalContent] = useState({
    coverLetter: '',
    executiveSummary: '',
    companyIntroduction: '',
    solutionOverview: '',
    pricingDetails: '',
    termsAndConditions: '',
    nextSteps: ''
  });

  // Fetch existing quotes that can be converted to proposals
  const { data: quotes, isLoading: quotesLoading } = useQuery({
    queryKey: ['/api/proposals'],
    enabled: true,
  });

  // Fetch business records for customer mapping
  const { data: businessRecords } = useQuery({
    queryKey: ['/api/business-records'],
    enabled: true,
  });

  // Filter and sort quotes
  const filteredAndSortedQuotes = (quotes || [])
    .filter((quote: any) => {
      if (!searchTerm) return true;
      const customer = businessRecords?.find((br: any) => br.id === quote.businessRecordId)?.name || 'Unknown';
      return (
        quote.title?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        quote.proposalNumber?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        customer.toLowerCase().includes(searchTerm.toLowerCase())
      );
    })
    .sort((a: any, b: any) => {
      let aValue, bValue;
      
      switch (sortBy) {
        case 'name':
          aValue = a.title || '';
          bValue = b.title || '';
          break;
        case 'customer':
          aValue = businessRecords?.find((br: any) => br.id === a.businessRecordId)?.name || '';
          bValue = businessRecords?.find((br: any) => br.id === b.businessRecordId)?.name || '';
          break;
        case 'amount':
          aValue = parseFloat(a.totalAmount) || 0;
          bValue = parseFloat(b.totalAmount) || 0;
          break;
        case 'date':
          aValue = new Date(a.createdAt).getTime();
          bValue = new Date(b.createdAt).getTime();
          break;
        default:
          return 0;
      }
      
      if (sortOrder === 'asc') {
        return aValue > bValue ? 1 : -1;
      } else {
        return aValue < bValue ? 1 : -1;
      }
    });

  const handleQuoteSelect = (quoteId: string) => {
    setSelectedQuote(quoteId);
    setActiveStep('template');
  };

  const handleTemplateSelect = (template: ProposalTemplate) => {
    setSelectedTemplate(template);
    setActiveStep('sections');
  };

  const handleCreateProposal = () => {
    // Navigate to actual proposal creation with selected quote and template
    const params = new URLSearchParams();
    if (selectedQuote) params.set('quoteId', selectedQuote);
    if (selectedTemplate?.id) params.set('templateId', selectedTemplate.id);
    params.set('type', 'proposal');
    
    setLocation('/quotes/new?' + params.toString());
  };

  return (
    <MainLayout 
      title="Proposal Builder" 
      description="Create professional, customized proposals with templates and branding"
    >
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={() => setLocation('/quotes')}
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Quotes
            </Button>
            <div>
              <h1 className="text-2xl font-bold">Proposal Builder</h1>
              <p className="text-muted-foreground">Create professional proposals with customizable templates</p>
            </div>
          </div>
          
          {(selectedQuote || selectedTemplate) && (
            <div className="flex items-center gap-2">
              {selectedQuote && (
                <Badge variant="outline">
                  Quote: {(quotes || []).find((q: any) => q.id === selectedQuote)?.proposalNumber || selectedQuote}
                </Badge>
              )}
              {selectedTemplate && (
                <Badge variant="outline">
                  Template: {selectedTemplate.name}
                </Badge>
              )}
              {selectedQuote && selectedTemplate && (
                <Button onClick={handleCreateProposal}>
                  <Plus className="h-4 w-4 mr-2" />
                  Create Proposal
                </Button>
              )}
            </div>
          )}
        </div>

        {/* Progress Steps */}
        <div className="flex items-center justify-center space-x-8">
          {[
            { key: 'quote', label: 'Select Quote', icon: FileText },
            { key: 'template', label: 'Select Template', icon: FileSignature },
            { key: 'sections', label: 'Configure Sections', icon: Layout },
            { key: 'content', label: 'Add Content', icon: Type },
            { key: 'preview', label: 'Preview & Send', icon: Eye },
          ].map((step, index) => {
            const Icon = step.icon;
            const isActive = step.key === activeStep;
            const isCompleted = ['quote', 'template', 'sections', 'content', 'preview'].indexOf(activeStep) > 
                              ['quote', 'template', 'sections', 'content', 'preview'].indexOf(step.key);
            
            return (
              <div key={step.key} className="flex items-center">
                <div className={`flex items-center gap-2 ${isActive ? 'text-primary' : isCompleted ? 'text-green-600' : 'text-muted-foreground'}`}>
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                    isActive ? 'bg-primary text-white' : 
                    isCompleted ? 'bg-green-600 text-white' : 
                    'bg-muted'
                  }`}>
                    <Icon className="h-4 w-4" />
                  </div>
                  <span className="font-medium">{step.label}</span>
                </div>
                {index < 4 && <div className="w-8 h-px bg-border ml-4" />}
              </div>
            );
          })}
        </div>

        <Separator />

        {/* Quote Selection */}
        {activeStep === 'quote' && (
          <div className="space-y-6">
            <div className="text-center">
              <h2 className="text-xl font-semibold">Select a Quote to Convert</h2>
              <p className="text-muted-foreground">Choose an existing quote to transform into a professional proposal</p>
            </div>

            {/* Search and Filter Controls */}
            <div className="flex flex-col sm:flex-row gap-4 items-center justify-between">
              <div className="relative flex-1 max-w-md">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search quotes, customers, or quote numbers..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
              
              <div className="flex items-center gap-2">
                <Select value={sortBy} onValueChange={(value: any) => setSortBy(value)}>
                  <SelectTrigger className="w-[140px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="name">Sort by Name</SelectItem>
                    <SelectItem value="customer">Sort by Customer</SelectItem>
                    <SelectItem value="amount">Sort by Amount</SelectItem>
                    <SelectItem value="date">Sort by Date</SelectItem>
                  </SelectContent>
                </Select>
                
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
                >
                  {sortOrder === 'asc' ? <SortAsc className="h-4 w-4" /> : <SortDesc className="h-4 w-4" />}
                </Button>
                
                <div className="flex border rounded">
                  <Button
                    variant={viewMode === 'grid' ? 'default' : 'ghost'}
                    size="sm"
                    onClick={() => setViewMode('grid')}
                    className="rounded-r-none"
                  >
                    <Grid className="h-4 w-4" />
                  </Button>
                  <Button
                    variant={viewMode === 'table' ? 'default' : 'ghost'}
                    size="sm"
                    onClick={() => setViewMode('table')}
                    className="rounded-l-none"
                  >
                    <TableIcon className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>

            {quotesLoading ? (
              <div className="text-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
                <p className="text-muted-foreground mt-2">Loading quotes...</p>
              </div>
            ) : filteredAndSortedQuotes.length > 0 ? (
              viewMode === 'grid' ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {filteredAndSortedQuotes.map((quote: any) => {
                    const customer = businessRecords?.find((br: any) => br.id === quote.businessRecordId);
                    return (
                    <Card 
                      key={quote.id} 
                      className={`cursor-pointer transition-all hover:shadow-lg ${
                        selectedQuote === quote.id ? 'ring-2 ring-primary' : ''
                      }`}
                      onClick={() => handleQuoteSelect(quote.id)}
                    >
                      <CardHeader className="pb-3">
                        <div className="flex items-center justify-between">
                          <CardTitle className="text-lg">{quote.proposalNumber}</CardTitle>
                          <Badge variant={quote.status === 'sent' ? 'default' : 'secondary'}>
                            {quote.status}
                          </Badge>
                        </div>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-3">
                          <div>
                            <h3 className="text-lg font-semibold text-primary">{quote.title}</h3>
                            <p className="text-sm text-muted-foreground">
                              Customer: {customer?.name || 'Unknown Customer'}
                            </p>
                          </div>
                          
                          <div className="flex items-center justify-between text-sm">
                            <span className="text-muted-foreground">Total Amount:</span>
                            <span className="font-semibold text-lg">${quote.totalAmount}</span>
                          </div>
                          
                          <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <Calendar className="h-4 w-4" />
                            <span>Created {new Date(quote.createdAt).toLocaleDateString()}</span>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                    );
                  })}
                </div>
              ) : (
                <Card>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Quote Number</TableHead>
                        <TableHead>Quote Name</TableHead>
                        <TableHead>Customer</TableHead>
                        <TableHead>Total Amount</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Created</TableHead>
                        <TableHead>Action</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredAndSortedQuotes.map((quote: any) => {
                        const customer = businessRecords?.find((br: any) => br.id === quote.businessRecordId);
                        return (
                          <TableRow 
                            key={quote.id}
                            className={`cursor-pointer ${selectedQuote === quote.id ? 'bg-primary/10' : ''}`}
                            onClick={() => handleQuoteSelect(quote.id)}
                          >
                            <TableCell className="font-medium">{quote.proposalNumber}</TableCell>
                            <TableCell className="font-semibold text-primary">{quote.title}</TableCell>
                            <TableCell>{customer?.name || 'Unknown Customer'}</TableCell>
                            <TableCell className="font-semibold">${quote.totalAmount}</TableCell>
                            <TableCell>
                              <Badge variant={quote.status === 'sent' ? 'default' : 'secondary'}>
                                {quote.status}
                              </Badge>
                            </TableCell>
                            <TableCell>{new Date(quote.createdAt).toLocaleDateString()}</TableCell>
                            <TableCell>
                              <Button 
                                size="sm" 
                                variant={selectedQuote === quote.id ? 'default' : 'outline'}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleQuoteSelect(quote.id);
                                }}
                              >
                                {selectedQuote === quote.id ? 'Selected' : 'Select'}
                              </Button>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </Card>
              )
            ) : (
              <Card>
                <CardContent className="text-center py-12">
                  <div className="space-y-4">
                    <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mx-auto">
                      <FileText className="h-8 w-8 text-muted-foreground" />
                    </div>
                    <h3 className="text-lg font-semibold">No Quotes Available</h3>
                    <p className="text-muted-foreground max-w-md mx-auto">
                      You need to create a quote first before building a proposal. Quotes contain the pricing and product information that form the foundation of your proposal.
                    </p>
                    <Button onClick={() => setLocation('/quotes/new')}>
                      <Plus className="h-4 w-4 mr-2" />
                      Create New Quote
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        )}

        {/* Template Selection */}
        {activeStep === 'template' && (
          <div className="space-y-6">
            <div className="text-center">
              <h2 className="text-xl font-semibold">Choose a Proposal Template</h2>
              <p className="text-muted-foreground">
                {selectedQuote && (
                  <>Selected Quote: {(quotes || []).find((q: any) => q.id === selectedQuote)?.proposalNumber} - </>
                )}
                Start with a professional template tailored to your proposal type
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {proposalTemplates.map((template) => (
                <Card 
                  key={template.id} 
                  className={`cursor-pointer transition-all hover:shadow-lg ${
                    selectedTemplate?.id === template.id ? 'ring-2 ring-primary' : ''
                  }`}
                  onClick={() => handleTemplateSelect(template)}
                >
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-lg">{template.name}</CardTitle>
                      {template.isDefault && (
                        <Badge variant="secondary">Default</Badge>
                      )}
                    </div>
                    <Badge variant="outline" className="w-fit">
                      {template.category.replace('_', ' ').toUpperCase()}
                    </Badge>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground mb-4">
                      {template.description}
                    </p>
                    
                    <div className="space-y-3">
                      <div className="flex items-center gap-2 text-sm">
                        <Layout className="h-4 w-4" />
                        <span>{template.sections.length} sections included</span>
                      </div>
                      
                      <div className="flex items-center gap-2 text-sm">
                        <Palette className="h-4 w-4" />
                        <div 
                          className="w-4 h-4 rounded border"
                          style={{ backgroundColor: template.styling.primaryColor }}
                        />
                        <span>Branded styling</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>

            <div className="flex justify-between items-center">
              <Button 
                variant="outline" 
                onClick={() => setActiveStep('quote')}
              >
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Quote Selection
              </Button>
              <Button variant="outline" className="gap-2">
                <Plus className="h-4 w-4" />
                Create Custom Template
              </Button>
            </div>
          </div>
        )}

        {/* Section Configuration */}
        {activeStep === 'sections' && selectedTemplate && (
          <div className="space-y-6">
            <div className="text-center">
              <h2 className="text-xl font-semibold">Configure Proposal Sections</h2>
              <p className="text-muted-foreground">Customize which sections to include in your proposal</p>
            </div>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileSignature className="h-5 w-5" />
                  {selectedTemplate.name} Sections
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {selectedTemplate.sections.map((section, index) => {
                    const Icon = section.icon;
                    return (
                      <div 
                        key={section.id}
                        className="flex items-center justify-between p-4 border rounded-lg"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 bg-primary/10 rounded-lg flex items-center justify-center">
                            <Icon className="h-4 w-4 text-primary" />
                          </div>
                          <div>
                            <h4 className="font-medium">{section.title}</h4>
                            <p className="text-sm text-muted-foreground">{section.description}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {section.isRequired && (
                            <Badge variant="destructive" className="text-xs">Required</Badge>
                          )}
                          <Badge variant={section.isVisible ? "default" : "secondary"} className="text-xs">
                            {section.isVisible ? "Included" : "Hidden"}
                          </Badge>
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div className="flex justify-between mt-6">
                  <Button 
                    variant="outline" 
                    onClick={() => setActiveStep('template')}
                  >
                    <ArrowLeft className="h-4 w-4 mr-2" />
                    Back to Templates
                  </Button>
                  <Button onClick={() => setActiveStep('content')}>
                    Continue to Content
                    <ArrowLeft className="h-4 w-4 ml-2 rotate-180" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Content Management Step */}
        {activeStep === 'content' && selectedTemplate && (
          <div className="space-y-6">
            <div className="text-center">
              <h2 className="text-xl font-semibold">Add Content to Your Proposal</h2>
              <p className="text-muted-foreground">
                Customize the content for each section of your {selectedTemplate.name.toLowerCase()} proposal
              </p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {selectedTemplate.sections
                .filter(section => section.isVisible)
                .map((section) => {
                  const Icon = section.icon;
                  const fieldKey = section.title.toLowerCase().replace(/\s+/g, '').replace(/&/g, 'And') as keyof typeof proposalContent;
                  
                  return (
                    <Card key={section.id}>
                      <CardHeader className="pb-3">
                        <CardTitle className="flex items-center gap-2 text-base">
                          <div className="w-8 h-8 bg-primary/10 rounded-lg flex items-center justify-center">
                            <Icon className="h-4 w-4 text-primary" />
                          </div>
                          {section.title}
                          {section.isRequired && (
                            <Badge variant="destructive" className="text-xs ml-auto">Required</Badge>
                          )}
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-3">
                          <p className="text-sm text-muted-foreground">{section.description}</p>
                          <div>
                            <Label htmlFor={fieldKey}>Content</Label>
                            <Textarea
                              id={fieldKey}
                              placeholder={`Enter content for ${section.title.toLowerCase()}...`}
                              value={proposalContent[fieldKey] || ''}
                              onChange={(e) => setProposalContent(prev => ({
                                ...prev,
                                [fieldKey]: e.target.value
                              }))}
                              className="min-h-24"
                            />
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
            </div>

            <div className="flex justify-between">
              <Button 
                variant="outline" 
                onClick={() => setActiveStep('sections')}
              >
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Sections
              </Button>
              <Button onClick={() => setActiveStep('preview')}>
                Continue to Preview
                <ArrowLeft className="h-4 w-4 ml-2 rotate-180" />
              </Button>
            </div>
          </div>
        )}

        {/* Preview Step */}
        {activeStep === 'preview' && selectedTemplate && (
          <div className="space-y-6">
            <div className="text-center">
              <h2 className="text-xl font-semibold">Preview Your Proposal</h2>
              <p className="text-muted-foreground">
                Review your proposal before sending to {businessRecords?.find((br: any) => br.id === (quotes || []).find((q: any) => q.id === selectedQuote)?.businessRecordId)?.name || 'the customer'}
              </p>
            </div>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <span>Proposal Preview</span>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm">
                      <Eye className="h-4 w-4 mr-2" />
                      Preview PDF
                    </Button>
                    <Button size="sm">
                      <Send className="h-4 w-4 mr-2" />
                      Send Proposal
                    </Button>
                  </div>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-6">
                  {/* Quote Information */}
                  {selectedQuote && (
                    <div className="bg-muted/50 p-4 rounded-lg">
                      <h3 className="font-semibold mb-2">Source Quote Information</h3>
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                          <span className="text-muted-foreground">Quote:</span> {(quotes || []).find((q: any) => q.id === selectedQuote)?.proposalNumber}
                        </div>
                        <div>
                          <span className="text-muted-foreground">Quote Name:</span> {(quotes || []).find((q: any) => q.id === selectedQuote)?.title}
                        </div>
                        <div>
                          <span className="text-muted-foreground">Customer:</span> {businessRecords?.find((br: any) => br.id === (quotes || []).find((q: any) => q.id === selectedQuote)?.businessRecordId)?.name}
                        </div>
                        <div>
                          <span className="text-muted-foreground">Amount:</span> ${(quotes || []).find((q: any) => q.id === selectedQuote)?.totalAmount}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Content Sections */}
                  {selectedTemplate.sections
                    .filter(section => section.isVisible)
                    .map((section) => {
                      const Icon = section.icon;
                      const fieldKey = section.title.toLowerCase().replace(/\s+/g, '').replace(/&/g, 'And') as keyof typeof proposalContent;
                      const content = proposalContent[fieldKey];
                      
                      return (
                        <div key={section.id} className="border-l-4 border-primary/20 pl-4">
                          <div className="flex items-center gap-2 mb-2">
                            <Icon className="h-5 w-5 text-primary" />
                            <h3 className="font-semibold">{section.title}</h3>
                          </div>
                          <div className="text-sm text-muted-foreground">
                            {content || (
                              <span className="italic">No content added for this section</span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                </div>
              </CardContent>
            </Card>

            <div className="flex justify-between">
              <Button 
                variant="outline" 
                onClick={() => setActiveStep('content')}
              >
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Content
              </Button>
              <Button onClick={handleCreateProposal}>
                <Send className="h-4 w-4 mr-2" />
                Create Final Proposal
              </Button>
            </div>
          </div>
        )}
      </div>
    </MainLayout>
  );
}