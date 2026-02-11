import { useState, useEffect } from 'react';
import { useLocation } from 'wouter';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
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
  Table as TableIcon,
  Wand2,
  Brush,
  Download,
  Save,
  Copy,
  Layers,
} from 'lucide-react';
import MainLayout from '@/components/layout/main-layout';
import ProposalVisualBuilder from '@/components/proposal-builder/ProposalVisualBuilder';
import QuoteTransformer from '@/components/proposal-builder/QuoteTransformer';
import BrandManager from '@/components/proposal-builder/BrandManager';
import RichTextEditor from '@/components/proposal-builder/RichTextEditor';
import DoDValidationBanner from '@/components/dod/DoDValidationBanner';
import DoDEnforcementButton from '@/components/dod/DoDEnforcementButton';
import ProcessHelpBanner from '@/components/training/ProcessHelpBanner';

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
  {
    type: 'cover_page',
    title: 'Cover Page',
    icon: FileText,
    description: 'Professional cover with logos and customer info',
    required: true,
  },
  {
    type: 'executive_summary',
    title: 'Executive Summary',
    icon: Eye,
    description: 'High-level project overview and benefits',
    required: false,
  },
  {
    type: 'company_intro',
    title: 'Company Introduction',
    icon: Users,
    description: 'About us, history, and credentials',
    required: false,
  },
  {
    type: 'solution_overview',
    title: 'Solution Overview',
    icon: Layout,
    description: 'Detailed solution description and features',
    required: false,
  },
  {
    type: 'pricing',
    title: 'Investment Summary',
    icon: DollarSign,
    description: 'Pricing breakdown and payment terms',
    required: true,
  },
  {
    type: 'guarantees',
    title: 'Guarantees & Warranties',
    icon: Award,
    description: 'Service level agreements and guarantees',
    required: false,
  },
  {
    type: 'team',
    title: 'Team Introduction',
    icon: Users,
    description: 'Key personnel and contact information',
    required: false,
  },
  {
    type: 'terms',
    title: 'Terms & Conditions',
    icon: FileText,
    description: 'Legal terms and contract conditions',
    required: false,
  },
  {
    type: 'next_steps',
    title: 'Next Steps',
    icon: Calendar,
    description: 'Implementation timeline and process',
    required: false,
  },
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
    },
  },
  {
    id: '2',
    name: 'Service Contract Standard',
    category: 'service_contract',
    description: 'Template for ongoing service and maintenance contracts',
    isDefault: false,
    sections: [
      sectionTypes[0],
      sectionTypes[1],
      sectionTypes[2],
      sectionTypes[4],
      sectionTypes[5],
      sectionTypes[7],
      sectionTypes[8],
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
    },
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
    },
  },
];

export default function ProposalBuilder() {
  const [, setLocation] = useLocation();
  const [selectedTemplate, setSelectedTemplate] = useState<ProposalTemplate | null>(null);
  const [selectedQuote, setSelectedQuote] = useState<string | null>(null);
  const [activeStep, setActiveStep] = useState<
    'quote' | 'template' | 'transform' | 'visual' | 'preview'
  >('quote');
  const [agingFilterDays, setAgingFilterDays] = useState<number | null>(null);

  // Check for quote ID in URL parameters
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const quoteIdFromUrl = urlParams.get('quoteId');
    const filter = urlParams.get('filter');
    const days = urlParams.get('days');

    if (quoteIdFromUrl) {
      setSelectedQuote(quoteIdFromUrl);
      // If quote is pre-selected from URL, skip to template selection
      setActiveStep('template');
    }

    if (filter === 'aging' && days) {
      const parsed = parseInt(days, 10);
      if (!Number.isNaN(parsed)) setAgingFilterDays(parsed);
    }
  }, []);
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('grid');
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState<'name' | 'customer' | 'amount' | 'date'>('date');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [showBrandManager, setShowBrandManager] = useState(false);
  const [showVisualBuilder, setShowVisualBuilder] = useState(false);
  const [showQuoteTransformer, setShowQuoteTransformer] = useState(false);
  const [transformedProposal, setTransformedProposal] = useState<any>(null);
  const [proposalContent, setProposalContent] = useState({
    coverLetter: '',
    executiveSummary: '',
    companyIntroduction: '',
    solutionOverview: '',
    pricingDetails: '',
    termsAndConditions: '',
    nextSteps: '',
  });

  // Fetch existing quotes that can be converted to proposals
  const { data: quotes, isLoading: quotesLoading } = useQuery({
    queryKey: ['/api/proposals'],
    queryFn: async () => {
      const response = await apiRequest('/api/proposals', 'GET');
      // Ensure response is an array before mapping
      if (!Array.isArray(response)) {
        console.warn('Proposals response is not an array:', response);
        return [];
      }
      return response.map((proposal: any) => ({
        ...proposal,
        id: proposal.id,
        quoteNumber: proposal.quoteNumber || proposal.quoteNumber || '',
        businessRecordId: proposal.business_record_id || proposal.businessRecordId || '',
        createdAt: proposal.createdAt || proposal.createdAt || '',
      }));
    },
    enabled: true,
  });

  // Fetch business records for customer mapping
  const { data: businessRecords } = useQuery({
    queryKey: ['/api/business-records'],
    queryFn: async () => {
      const response = await apiRequest('/api/business-records', 'GET');
      // Ensure response is an array before mapping
      if (!Array.isArray(response)) {
        console.warn('Business records response is not an array:', response);
        return [];
      }
      return response.map((record: any) => ({
        ...record,
        id: record.id,
        businessName: record.businessName || record.businessName || '',
        businessRecordType: record.business_record_type || record.businessRecordType || '',
      }));
    },
    enabled: true,
  });

  // Filter and sort quotes
  const filteredAndSortedQuotes = (quotes || [])
    .filter((quote: any) => {
      if (!searchTerm) return true;
      const customer =
        businessRecords?.find((br: any) => br.id === quote.businessRecordId)?.name || 'Unknown';
      return (
        quote.title?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        quote.proposalNumber?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        customer.toLowerCase().includes(searchTerm.toLowerCase())
      );
    })
    .filter((quote: any) => {
      if (agingFilterDays == null) return true;
      const created = quote.createdAt ? new Date(quote.createdAt) : null;
      if (!created) return false;
      const msPerDay = 24 * 60 * 60 * 1000;
      const ageDays = Math.floor((Date.now() - created.getTime()) / msPerDay);
      return ageDays > agingFilterDays;
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
    setActiveStep('transform');
  };

  const handleTransformQuote = () => {
    if (selectedQuote) {
      setShowQuoteTransformer(true);
    }
  };

  const handleTransformComplete = (proposalData: any) => {
    setTransformedProposal(proposalData);
    setShowQuoteTransformer(false);
    setActiveStep('visual');
  };

  const handleOpenVisualBuilder = () => {
    setShowVisualBuilder(true);
  };

  const handleOpenBrandManager = () => {
    setShowBrandManager(true);
  };

  const handleSaveBrand = (brandProfile: any) => {
    console.log('Brand profile saved:', brandProfile);
    setShowBrandManager(false);
    // In a real implementation, save to backend
  };

  const handleSaveProposal = (proposalData: any) => {
    console.log('Proposal saved:', proposalData);
    setShowVisualBuilder(false);
    // In a real implementation, save to backend and redirect
  };

  const handleCreateProposal = async () => {
    // DoD Validation: Check if proposal is ready for contract generation
    if (selectedQuote) {
      try {
        const validation = await fetch(`/api/validate/proposal-to-contract/${selectedQuote}`, {
          headers: {
            'x-tenant-id': localStorage.getItem('currentTenantId') || '',
          },
        });
        const validationResult = await validation.json();

        if (!validationResult.valid) {
          // Show error toast with validation issues
          console.error('Proposal validation failed:', validationResult.errors);
          alert(
            `Cannot create contract. Please fix the following issues:\n${validationResult.errors.join('\n')}`,
          );
          return;
        }

        console.log('Proposal validation passed, proceeding to contracts...');
      } catch (error) {
        console.error('DoD validation error:', error);
        alert('Unable to validate proposal. Please try again.');
        return;
      }
    }

    // Proceed to Contracts/eSign step after building proposal
    const params = new URLSearchParams();
    if (selectedQuote) params.set('quoteId', selectedQuote);
    if (selectedTemplate?.id) params.set('templateId', selectedTemplate.id);
    params.set('from', 'proposal-builder');
    setLocation('/contracts?' + params.toString());
  };

  return (
    <MainLayout
      title="Proposal Builder"
      description="Create professional, customized proposals with templates and branding"
    >
      <div className="space-y-4 sm:space-y-6">
        {/* Process Help Banner */}
        <ProcessHelpBanner
          processType="quote-to-proposal"
          currentStage="documentation"
          nextStage="legal-review"
          estimatedTime="1-2 hours"
        />

        {agingFilterDays != null && (
          <div className="p-3 bg-blue-50 border border-blue-200 rounded text-sm text-blue-800 flex items-center justify-between">
            <span>Showing proposals aging greater than {agingFilterDays} days</span>
            <Button variant="outline" size="sm" onClick={() => setLocation('/proposal-builder')}>
              Clear Filter
            </Button>
          </div>
        )}

        {/* DoD Validation Banner */}
        {selectedQuote && activeStep === 'preview' && (
          <DoDValidationBanner
            recordId={selectedQuote}
            validationType="proposal-to-contract"
            enabled={true}
          />
        )}
        {/* Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex flex-col gap-4 w-full sm:w-auto">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setLocation('/quotes')}
              className="w-fit touch-manipulation active:scale-[0.98]"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Quotes
            </Button>
            <div>
              <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground mb-1">
                <span>Quotes</span>
                <ArrowLeft className="h-3 w-3 rotate-180" />
                <span className="text-primary font-medium">Proposal Builder</span>
                {selectedQuote && (
                  <>
                    <ArrowLeft className="h-3 w-3 rotate-180" />
                    <span className="truncate max-w-[200px]">
                      Quote #
                      {(quotes || []).find((q: any) => q.id === selectedQuote)?.proposalNumber}
                    </span>
                  </>
                )}
              </div>
              <h1 className="text-xl sm:text-2xl font-bold">Proposal Builder</h1>
              <p className="text-sm sm:text-base text-muted-foreground">
                Create professional proposals with customizable templates
              </p>
            </div>
          </div>

          {(selectedQuote || selectedTemplate) && (
            <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
              {selectedQuote && (
                <Badge variant="outline" className="text-xs truncate max-w-[200px]">
                  Quote:{' '}
                  {(quotes || []).find((q: any) => q.id === selectedQuote)?.proposalNumber ||
                    selectedQuote}
                </Badge>
              )}
              {selectedTemplate && (
                <Badge variant="outline" className="text-xs truncate max-w-[200px]">
                  Template: {selectedTemplate.name}
                </Badge>
              )}
              {selectedQuote && selectedTemplate && (
                <DoDEnforcementButton
                  recordId={selectedQuote}
                  validationType="quote-to-proposal"
                  onValidClick={() => {
                    setActiveStep('transform');
                  }}
                  className="touch-manipulation active:scale-[0.98] min-h-[44px]"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Create Proposal
                </DoDEnforcementButton>
              )}
            </div>
          )}
        </div>

        {/* Progress Steps */}
        <div className="overflow-x-auto -mx-4 px-4 sm:mx-0 sm:px-0">
          <div className="flex items-center justify-start sm:justify-center space-x-4 sm:space-x-8 min-w-max sm:min-w-0 pb-2">
            {[
              { key: 'quote', label: 'Select Quote', icon: FileText },
              { key: 'template', label: 'Select Template', icon: FileSignature },
              { key: 'transform', label: 'Transform Quote', icon: Wand2 },
              { key: 'visual', label: 'Visual Builder', icon: Brush },
              { key: 'preview', label: 'Preview & Export', icon: Eye },
            ].map((step, index) => {
              const Icon = step.icon;
              const isActive = step.key === activeStep;
              const isCompleted =
                ['quote', 'template', 'transform', 'visual', 'preview'].indexOf(activeStep) >
                ['quote', 'template', 'transform', 'visual', 'preview'].indexOf(step.key);

              return (
                <div key={step.key} className="flex items-center">
                  <div
                    className={`flex items-center gap-2 ${isActive ? 'text-primary' : isCompleted ? 'text-green-600' : 'text-muted-foreground'}`}
                  >
                    <div
                      className={`w-8 h-8 sm:w-10 sm:h-10 rounded-full flex items-center justify-center flex-shrink-0 ${
                        isActive
                          ? 'bg-primary text-white'
                          : isCompleted
                            ? 'bg-green-600 text-white'
                            : 'bg-muted'
                      }`}
                    >
                      <Icon className="h-4 w-4 sm:h-5 sm:w-5" />
                    </div>
                    <span className="font-medium text-xs sm:text-sm whitespace-nowrap">
                      {step.label}
                    </span>
                  </div>
                  {index < 4 && (
                    <div className="w-4 sm:w-8 h-px bg-border ml-2 sm:ml-4 flex-shrink-0" />
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Quick Actions */}
        <div className="flex flex-wrap justify-center gap-2">
          <Button
            variant="outline"
            onClick={handleOpenBrandManager}
            className="touch-manipulation active:scale-[0.98] min-h-[44px]"
          >
            <Palette className="h-4 w-4 mr-2" />
            <span className="hidden sm:inline">Brand Manager</span>
            <span className="sm:hidden">Brand</span>
          </Button>
          <Button
            variant="outline"
            onClick={handleOpenVisualBuilder}
            className="touch-manipulation active:scale-[0.98] min-h-[44px]"
          >
            <Layers className="h-4 w-4 mr-2" />
            <span className="hidden sm:inline">Visual Builder</span>
            <span className="sm:hidden">Builder</span>
          </Button>
          <Button variant="outline" className="touch-manipulation active:scale-[0.98] min-h-[44px]">
            <Copy className="h-4 w-4 mr-2" />
            Templates
          </Button>
        </div>

        <Separator />

        {/* DoD Validation Banner */}
        {selectedQuote && (
          <DoDValidationBanner
            recordId={selectedQuote}
            validationType="quote-to-proposal"
            enabled={true}
          />
        )}

        {/* Quote Selection */}
        {activeStep === 'quote' && (
          <div className="space-y-6">
            <div className="text-center">
              <h2 className="text-xl font-semibold">Select a Quote to Convert</h2>
              <p className="text-muted-foreground">
                {selectedQuote
                  ? 'You can change your quote selection or continue with the pre-selected quote'
                  : 'Choose an existing quote to transform into a professional proposal'}
              </p>
            </div>

            {/* Search and Filter Controls */}
            <div className="flex flex-col gap-4">
              <div className="relative w-full">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                <Input
                  placeholder="Search quotes, customers, or quote numbers..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 touch-manipulation min-h-[44px]"
                />
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <Select value={sortBy} onValueChange={(value: any) => setSortBy(value)}>
                  <SelectTrigger className="w-full sm:w-[140px] min-h-[44px] touch-manipulation">
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
                  className="touch-manipulation active:scale-[0.98] min-h-[44px] min-w-[44px]"
                >
                  {sortOrder === 'asc' ? (
                    <SortAsc className="h-4 w-4" />
                  ) : (
                    <SortDesc className="h-4 w-4" />
                  )}
                </Button>

                <div className="flex border rounded ml-auto">
                  <Button
                    variant={viewMode === 'grid' ? 'default' : 'ghost'}
                    size="sm"
                    onClick={() => setViewMode('grid')}
                    className="rounded-r-none touch-manipulation active:scale-[0.98] min-h-[44px] min-w-[44px]"
                  >
                    <Grid className="h-4 w-4" />
                  </Button>
                  <Button
                    variant={viewMode === 'table' ? 'default' : 'ghost'}
                    size="sm"
                    onClick={() => setViewMode('table')}
                    className="rounded-l-none touch-manipulation active:scale-[0.98] min-h-[44px] min-w-[44px]"
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
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
                  {filteredAndSortedQuotes.map((quote: any) => {
                    const customer = businessRecords?.find(
                      (br: any) => br.id === quote.businessRecordId,
                    );
                    return (
                      <Card
                        key={quote.id}
                        className={`cursor-pointer transition-all hover:shadow-lg touch-manipulation active:scale-[0.98] ${
                          selectedQuote === quote.id ? 'ring-2 ring-primary' : ''
                        }`}
                        onClick={() => handleQuoteSelect(quote.id)}
                      >
                        <CardHeader className="pb-3 p-4 sm:p-6">
                          <div className="flex items-center justify-between gap-2">
                            <CardTitle className="text-base sm:text-lg truncate">
                              {quote.proposalNumber}
                            </CardTitle>
                            <Badge
                              variant={quote.status === 'sent' ? 'default' : 'secondary'}
                              className="text-xs flex-shrink-0"
                            >
                              {quote.status}
                            </Badge>
                          </div>
                        </CardHeader>
                        <CardContent className="p-4 sm:p-6 pt-0">
                          <div className="space-y-3">
                            <div>
                              <h3 className="text-base sm:text-lg font-semibold text-primary break-words">
                                {quote.title}
                              </h3>
                              <p className="text-sm text-muted-foreground break-words">
                                Customer: {customer?.name || 'Unknown Customer'}
                              </p>
                            </div>

                            <div className="flex items-center justify-between text-sm">
                              <span className="text-muted-foreground">Total Amount:</span>
                              <span className="font-semibold text-base sm:text-lg">
                                ${quote.totalAmount}
                              </span>
                            </div>

                            <div className="flex items-center gap-2 text-xs sm:text-sm text-muted-foreground">
                              <Calendar className="h-4 w-4 flex-shrink-0" />
                              <span>Created {new Date(quote.createdAt).toLocaleDateString()}</span>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              ) : (
                <Card className="overflow-hidden">
                  <div className="overflow-x-auto">
                    <Table className="min-w-[800px]">
                      <TableHeader>
                        <TableRow>
                          <TableHead className="whitespace-nowrap">Quote Number</TableHead>
                          <TableHead className="whitespace-nowrap">Quote Name</TableHead>
                          <TableHead className="whitespace-nowrap">Customer</TableHead>
                          <TableHead className="whitespace-nowrap">Total Amount</TableHead>
                          <TableHead className="whitespace-nowrap">Status</TableHead>
                          <TableHead className="whitespace-nowrap">Created</TableHead>
                          <TableHead className="whitespace-nowrap">Action</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredAndSortedQuotes.map((quote: any) => {
                          const customer = businessRecords?.find(
                            (br: any) => br.id === quote.businessRecordId,
                          );
                          return (
                            <TableRow
                              key={quote.id}
                              className={`cursor-pointer touch-manipulation ${selectedQuote === quote.id ? 'bg-primary/10' : ''}`}
                              onClick={() => handleQuoteSelect(quote.id)}
                            >
                              <TableCell className="font-medium whitespace-nowrap">
                                {quote.proposalNumber}
                              </TableCell>
                              <TableCell className="font-semibold text-primary">
                                {quote.title}
                              </TableCell>
                              <TableCell className="whitespace-nowrap">
                                {customer?.name || 'Unknown Customer'}
                              </TableCell>
                              <TableCell className="font-semibold whitespace-nowrap">
                                ${quote.totalAmount}
                              </TableCell>
                              <TableCell>
                                <Badge
                                  variant={quote.status === 'sent' ? 'default' : 'secondary'}
                                  className="text-xs"
                                >
                                  {quote.status}
                                </Badge>
                              </TableCell>
                              <TableCell className="whitespace-nowrap">
                                {new Date(quote.createdAt).toLocaleDateString()}
                              </TableCell>
                              <TableCell>
                                <Button
                                  size="sm"
                                  variant={selectedQuote === quote.id ? 'default' : 'outline'}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleQuoteSelect(quote.id);
                                  }}
                                  className="touch-manipulation active:scale-[0.98] min-h-[40px] whitespace-nowrap"
                                >
                                  {selectedQuote === quote.id ? 'Selected' : 'Select'}
                                </Button>
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>
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
                      You need to create a quote first before building a proposal. Quotes contain
                      the pricing and product information that form the foundation of your proposal.
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
            {/* Selected Quote Banner */}
            {selectedQuote && (
              <Card className="border-blue-200 bg-blue-50">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <CheckCircle className="h-5 w-5 text-blue-600" />
                      <div>
                        <h4 className="font-medium text-blue-900">
                          Selected Quote:{' '}
                          {(quotes || []).find((q: any) => q.id === selectedQuote)?.proposalNumber}
                        </h4>
                        <p className="text-sm text-blue-700">
                          {(quotes || []).find((q: any) => q.id === selectedQuote)?.title} - $
                          {(quotes || []).find((q: any) => q.id === selectedQuote)?.totalAmount}
                        </p>
                      </div>
                    </div>
                    <Button variant="outline" size="sm" onClick={() => setActiveStep('quote')}>
                      <ArrowLeft className="h-4 w-4 mr-2" />
                      Change Quote
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}

            <div className="text-center">
              <h2 className="text-xl font-semibold">Choose a Proposal Template</h2>
              <p className="text-muted-foreground">
                Start with a professional template tailored to your proposal type
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
              {proposalTemplates.map((template) => (
                <Card
                  key={template.id}
                  className={`cursor-pointer transition-all hover:shadow-lg touch-manipulation active:scale-[0.98] ${
                    selectedTemplate?.id === template.id ? 'ring-2 ring-primary' : ''
                  }`}
                  onClick={() => handleTemplateSelect(template)}
                >
                  <CardHeader className="pb-3 p-4 sm:p-6">
                    <div className="flex items-center justify-between gap-2">
                      <CardTitle className="text-base sm:text-lg break-words">
                        {template.name}
                      </CardTitle>
                      {template.isDefault && (
                        <Badge variant="secondary" className="text-xs flex-shrink-0">
                          Default
                        </Badge>
                      )}
                    </div>
                    <Badge variant="outline" className="w-fit text-xs">
                      {template.category.replace('_', ' ').toUpperCase()}
                    </Badge>
                  </CardHeader>
                  <CardContent className="p-4 sm:p-6 pt-0">
                    <p className="text-sm text-muted-foreground mb-4 break-words">
                      {template.description}
                    </p>

                    <div className="space-y-3">
                      <div className="flex items-center gap-2 text-xs sm:text-sm">
                        <Layout className="h-4 w-4 flex-shrink-0" />
                        <span>{template.sections.length} sections included</span>
                      </div>

                      <div className="flex items-center gap-2 text-xs sm:text-sm">
                        <Palette className="h-4 w-4 flex-shrink-0" />
                        <div
                          className="w-4 h-4 rounded border flex-shrink-0"
                          style={{ backgroundColor: template.styling.primaryColor }}
                        />
                        <span>Branded styling</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>

            <div className="flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-4">
              <Button
                variant="outline"
                onClick={() => setActiveStep('quote')}
                className="touch-manipulation active:scale-[0.98] min-h-[44px]"
              >
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Quote Selection
              </Button>
              <div className="flex flex-col sm:flex-row gap-2">
                <Button
                  variant="outline"
                  className="gap-2 touch-manipulation active:scale-[0.98] min-h-[44px]"
                >
                  <Plus className="h-4 w-4" />
                  Create Custom Template
                </Button>
                {selectedTemplate && (
                  <Button
                    onClick={() => setActiveStep('transform')}
                    className="touch-manipulation active:scale-[0.98] min-h-[44px]"
                  >
                    Continue to Transform
                    <ArrowLeft className="h-4 w-4 ml-2 rotate-180" />
                  </Button>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Transform Step */}
        {activeStep === 'transform' && selectedQuote && selectedTemplate && (
          <div className="space-y-6">
            <div className="text-center">
              <h2 className="text-xl font-semibold">Transform Quote to Proposal</h2>
              <p className="text-muted-foreground">
                Convert your quote data into a professional proposal with intelligent content
                generation
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
              {/* Source Quote Preview */}
              <Card>
                <CardHeader className="p-4 sm:p-6">
                  <CardTitle className="text-base">Source Quote</CardTitle>
                </CardHeader>
                <CardContent className="p-4 sm:p-6 pt-0">
                  <div className="space-y-3">
                    <div className="flex justify-between gap-4">
                      <span className="text-muted-foreground text-sm">Quote:</span>
                      <span className="font-medium text-sm truncate">
                        {(quotes || []).find((q: any) => q.id === selectedQuote)?.proposalNumber}
                      </span>
                    </div>
                    <div className="flex justify-between gap-4">
                      <span className="text-muted-foreground text-sm">Title:</span>
                      <span className="font-medium text-sm truncate">
                        {(quotes || []).find((q: any) => q.id === selectedQuote)?.title}
                      </span>
                    </div>
                    <div className="flex justify-between gap-4">
                      <span className="text-muted-foreground text-sm">Amount:</span>
                      <span className="font-medium text-base sm:text-lg">
                        ${(quotes || []).find((q: any) => q.id === selectedQuote)?.totalAmount}
                      </span>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Target Template Preview */}
              <Card>
                <CardHeader className="p-4 sm:p-6">
                  <CardTitle className="text-base">Target Template</CardTitle>
                </CardHeader>
                <CardContent className="p-4 sm:p-6 pt-0">
                  <div className="space-y-3">
                    <div className="flex justify-between gap-4">
                      <span className="text-muted-foreground text-sm">Template:</span>
                      <span className="font-medium text-sm truncate">{selectedTemplate.name}</span>
                    </div>
                    <div className="flex justify-between gap-4">
                      <span className="text-muted-foreground text-sm">Category:</span>
                      <span className="font-medium text-sm truncate">
                        {selectedTemplate.category}
                      </span>
                    </div>
                    <div className="flex justify-between gap-4">
                      <span className="text-muted-foreground text-sm">Sections:</span>
                      <span className="font-medium text-sm">
                        {selectedTemplate.sections.length}
                      </span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Transformation Features */}
            <Card>
              <CardHeader>
                <CardTitle>AI-Powered Transformation Features</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
                  <div className="flex items-start sm:items-center gap-3 p-3 sm:p-4 border rounded-lg bg-blue-50">
                    <CheckCircle className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5 sm:mt-0" />
                    <div>
                      <h4 className="font-medium text-sm sm:text-base">Auto-populate pricing</h4>
                      <p className="text-xs sm:text-sm text-muted-foreground">
                        Import all line items and totals
                      </p>
                    </div>
                  </div>
                  <div className="flex items-start sm:items-center gap-3 p-3 sm:p-4 border rounded-lg bg-green-50">
                    <CheckCircle className="h-5 w-5 text-green-600 flex-shrink-0 mt-0.5 sm:mt-0" />
                    <div>
                      <h4 className="font-medium text-sm sm:text-base">Generate content</h4>
                      <p className="text-xs sm:text-sm text-muted-foreground">
                        AI-written sections and descriptions
                      </p>
                    </div>
                  </div>
                  <div className="flex items-start sm:items-center gap-3 p-3 sm:p-4 border rounded-lg bg-purple-50">
                    <CheckCircle className="h-5 w-5 text-purple-600 flex-shrink-0 mt-0.5 sm:mt-0" />
                    <div>
                      <h4 className="font-medium text-sm sm:text-base">Brand consistency</h4>
                      <p className="text-xs sm:text-sm text-muted-foreground">
                        Apply your brand styling automatically
                      </p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <div className="flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-4">
              <Button
                variant="outline"
                onClick={() => setActiveStep('template')}
                className="touch-manipulation active:scale-[0.98] min-h-[44px]"
              >
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Template
              </Button>
              <Button
                onClick={handleTransformQuote}
                className="touch-manipulation active:scale-[0.98] min-h-[44px]"
              >
                <Wand2 className="h-4 w-4 mr-2" />
                Transform Quote
              </Button>
            </div>
          </div>
        )}

        {/* Visual Builder Step */}
        {activeStep === 'visual' && (
          <div className="space-y-6">
            <div className="text-center">
              <h2 className="text-xl font-semibold">Visual Proposal Builder</h2>
              <p className="text-muted-foreground">
                Use the advanced visual editor to create a stunning professional proposal
              </p>
            </div>

            <Card>
              <CardHeader>
                <CardTitle>Drag & Drop Visual Editor</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  <div className="p-4 border rounded-lg text-center">
                    <Layers className="h-8 w-8 mx-auto mb-2 text-primary" />
                    <h4 className="font-medium text-sm sm:text-base">Drag & Drop Sections</h4>
                    <p className="text-xs sm:text-sm text-muted-foreground">
                      Reorder sections with intuitive drag-and-drop
                    </p>
                  </div>
                  <div className="p-4 border rounded-lg text-center">
                    <Type className="h-8 w-8 mx-auto mb-2 text-primary" />
                    <h4 className="font-medium text-sm sm:text-base">Rich Text Editor</h4>
                    <p className="text-xs sm:text-sm text-muted-foreground">
                      Professional formatting with real-time preview
                    </p>
                  </div>
                  <div className="p-4 border rounded-lg text-center">
                    <Palette className="h-8 w-8 mx-auto mb-2 text-primary" />
                    <h4 className="font-medium text-sm sm:text-base">Brand Customization</h4>
                    <p className="text-xs sm:text-sm text-muted-foreground">
                      Apply colors, fonts, and styling to match your brand
                    </p>
                  </div>
                </div>

                <div className="flex justify-center">
                  <Button
                    onClick={handleOpenVisualBuilder}
                    size="lg"
                    className="touch-manipulation active:scale-[0.98] min-h-[44px] w-full sm:w-auto"
                  >
                    <Brush className="h-5 w-5 mr-2" />
                    Open Visual Builder
                  </Button>
                </div>
              </CardContent>
            </Card>

            <div className="flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-4">
              <Button
                variant="outline"
                onClick={() => setActiveStep('transform')}
                className="touch-manipulation active:scale-[0.98] min-h-[44px]"
              >
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Transform
              </Button>
              <Button
                onClick={() => setActiveStep('preview')}
                className="touch-manipulation active:scale-[0.98] min-h-[44px]"
              >
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
                Review your proposal before sending to{' '}
                {businessRecords?.find(
                  (br: any) =>
                    br.id ===
                    (quotes || []).find((q: any) => q.id === selectedQuote)?.businessRecordId,
                )?.name || 'the customer'}
              </p>
            </div>

            <Card>
              <CardHeader className="p-4 sm:p-6">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                  <CardTitle className="text-base sm:text-lg">Proposal Preview</CardTitle>
                  <div className="flex flex-wrap gap-2 w-full sm:w-auto">
                    <Button
                      variant="outline"
                      size="sm"
                      className="touch-manipulation active:scale-[0.98] min-h-[44px] flex-1 sm:flex-initial"
                    >
                      <Eye className="h-4 w-4 mr-2" />
                      Preview PDF
                    </Button>
                    <Button
                      size="sm"
                      className="touch-manipulation active:scale-[0.98] min-h-[44px] flex-1 sm:flex-initial"
                    >
                      <Send className="h-4 w-4 mr-2" />
                      Send Proposal
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-6">
                  {/* Quote Information */}
                  {selectedQuote && (
                    <div className="bg-muted/50 p-4 rounded-lg">
                      <h3 className="font-semibold mb-2 text-sm sm:text-base">
                        Source Quote Information
                      </h3>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 text-xs sm:text-sm">
                        <div className="break-words">
                          <span className="text-muted-foreground">Quote:</span>{' '}
                          {(quotes || []).find((q: any) => q.id === selectedQuote)?.proposalNumber}
                        </div>
                        <div className="break-words">
                          <span className="text-muted-foreground">Quote Name:</span>{' '}
                          {(quotes || []).find((q: any) => q.id === selectedQuote)?.title}
                        </div>
                        <div className="break-words">
                          <span className="text-muted-foreground">Customer:</span>{' '}
                          {
                            businessRecords?.find(
                              (br: any) =>
                                br.id ===
                                (quotes || []).find((q: any) => q.id === selectedQuote)
                                  ?.businessRecordId,
                            )?.name
                          }
                        </div>
                        <div className="break-words">
                          <span className="text-muted-foreground">Amount:</span> $
                          {(quotes || []).find((q: any) => q.id === selectedQuote)?.totalAmount}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Content Sections */}
                  {selectedTemplate.sections
                    .filter((section) => section.isVisible)
                    .map((section) => {
                      const Icon = section.icon;
                      const fieldKey = section.title
                        .toLowerCase()
                        .replace(/\s+/g, '')
                        .replace(/&/g, 'And') as keyof typeof proposalContent;
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

            <div className="flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-4">
              <Button
                variant="outline"
                onClick={() => setActiveStep('visual')}
                className="touch-manipulation active:scale-[0.98] min-h-[44px]"
              >
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Visual Builder
              </Button>
              <div className="flex flex-col sm:flex-row gap-2">
                <Button
                  variant="outline"
                  className="touch-manipulation active:scale-[0.98] min-h-[44px]"
                >
                  <Download className="h-4 w-4 mr-2" />
                  Export PDF
                </Button>
                <DoDEnforcementButton
                  recordId={selectedQuote || ''}
                  validationType="quote-to-proposal"
                  onValidClick={() => {
                    const params = new URLSearchParams();
                    if (selectedQuote) params.set('quoteId', selectedQuote);
                    if (selectedTemplate?.id) params.set('templateId', selectedTemplate.id);
                    params.set('from', 'proposal-builder');
                    setLocation('/contracts?' + params.toString());
                  }}
                  className="touch-manipulation active:scale-[0.98] min-h-[44px]"
                >
                  <Send className="h-4 w-4 mr-2" />
                  Send for Contract
                </DoDEnforcementButton>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Brand Manager Dialog */}
      <Dialog open={showBrandManager} onOpenChange={setShowBrandManager}>
        <DialogContent className="max-w-full max-h-full w-full h-full sm:w-screen sm:h-screen p-0 m-0">
          <BrandManager onSave={handleSaveBrand} onClose={() => setShowBrandManager(false)} />
        </DialogContent>
      </Dialog>

      {/* Visual Builder Dialog */}
      <Dialog open={showVisualBuilder} onOpenChange={setShowVisualBuilder}>
        <DialogContent className="max-w-full max-h-full w-full h-full sm:w-screen sm:h-screen p-0 m-0">
          <ProposalVisualBuilder
            quoteData={
              selectedQuote ? (quotes || []).find((q: any) => q.id === selectedQuote) : undefined
            }
            onSave={handleSaveProposal}
            onPreview={() => console.log('Preview')}
          />
        </DialogContent>
      </Dialog>

      {/* Quote Transformer Dialog */}
      <Dialog open={showQuoteTransformer} onOpenChange={setShowQuoteTransformer}>
        <DialogContent className="w-full max-w-[95vw] sm:max-w-[600px] max-h-[90vh] overflow-y-auto p-4 sm:p-6">
          <DialogHeader>
            <DialogTitle className="text-base sm:text-lg">Transform Quote to Proposal</DialogTitle>
          </DialogHeader>
          {selectedQuote && (
            <QuoteTransformer
              quoteId={selectedQuote}
              onTransformComplete={handleTransformComplete}
            />
          )}
        </DialogContent>
      </Dialog>
    </MainLayout>
  );
}
