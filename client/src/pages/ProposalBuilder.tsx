import { useState, useEffect } from 'react';
import { useLocation } from 'wouter';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
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
  CheckCircle
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

  // Fetch existing quotes that can be converted to proposals
  const { data: quotes, isLoading: quotesLoading } = useQuery({
    queryKey: ['/api/proposals'],
    enabled: true,
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
                  Quote: {quotes?.find(q => q.id === selectedQuote)?.proposalNumber || selectedQuote}
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

            {quotesLoading ? (
              <div className="text-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
                <p className="text-muted-foreground mt-2">Loading quotes...</p>
              </div>
            ) : quotes && quotes.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {quotes.map((quote: any) => (
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
                          <p className="text-sm font-medium">{quote.title}</p>
                          <p className="text-sm text-muted-foreground">
                            Customer: {quotes.find((br: any) => br.id === quote.businessRecordId)?.name || 'Unknown'}
                          </p>
                        </div>
                        
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-muted-foreground">Total Amount:</span>
                          <span className="font-semibold">${quote.totalAmount}</span>
                        </div>
                        
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <Calendar className="h-4 w-4" />
                          <span>Created {new Date(quote.createdAt).toLocaleDateString()}</span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
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
                  <>Selected Quote: {quotes?.find(q => q.id === selectedQuote)?.proposalNumber} - </>
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

        {/* Coming Soon Steps */}
        {(activeStep === 'content' || activeStep === 'preview') && (
          <Card>
            <CardContent className="text-center py-12">
              <div className="space-y-4">
                <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto">
                  <Settings className="h-8 w-8 text-primary" />
                </div>
                <h3 className="text-lg font-semibold">Coming Soon</h3>
                <p className="text-muted-foreground max-w-md mx-auto">
                  This step is part of the comprehensive proposal builder system. 
                  The template selection and section configuration demonstrate the foundation for the full system.
                </p>
                <div className="flex gap-2 justify-center">
                  <Button 
                    variant="outline" 
                    onClick={() => setActiveStep('quote')}
                  >
                    Back to Quote Selection
                  </Button>
                  <Button onClick={handleCreateProposal}>
                    Create Proposal with Current Quote Builder
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </MainLayout>
  );
}