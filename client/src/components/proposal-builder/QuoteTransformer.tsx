import React, { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  FileText,
  ArrowRight,
  DollarSign,
  Building2,
  User,
  Package,
  Calendar,
  CheckCircle,
  AlertCircle,
  Settings,
  Palette,
  Eye,
  Download
} from 'lucide-react';

interface QuoteData {
  id: string;
  proposalNumber: string;
  title: string;
  businessRecordId: string;
  contactId?: string;
  status: string;
  subtotal: string;
  totalAmount: string;
  validUntil?: string;
  lineItems: Array<{
    id: string;
    productName: string;
    description?: string;
    quantity: number;
    unitPrice: string;
    totalPrice: string;
    itemType: string;
  }>;
  customerNotes?: string;
  internalNotes?: string;
  createdAt: string;
}

interface BusinessRecord {
  id: string;
  name: string;
  address?: string;
  city?: string;
  state?: string;
  zipCode?: string;
  industry?: string;
}

interface Contact {
  id: string;
  firstName: string;
  lastName: string;
  email?: string;
  phone?: string;
  title?: string;
}

interface ProposalSection {
  id: string;
  type: string;
  title: string;
  content: string;
  isIncluded: boolean;
  isRequired: boolean;
  order: number;
}

interface TransformationSettings {
  includeCompanyIntro: boolean;
  includeExecutiveSummary: boolean;
  includeValueProposition: boolean;
  includeImplementationPlan: boolean;
  includeTermsAndConditions: boolean;
  includeTeamIntroduction: boolean;
  includeGuarantees: boolean;
  customSections: string[];
}

const defaultSections: ProposalSection[] = [
  {
    id: 'cover_page',
    type: 'cover_page',
    title: 'Cover Page',
    content: '',
    isIncluded: true,
    isRequired: true,
    order: 1
  },
  {
    id: 'executive_summary',
    type: 'executive_summary',
    title: 'Executive Summary',
    content: 'This proposal presents a comprehensive solution tailored to meet your specific business requirements.',
    isIncluded: true,
    isRequired: false,
    order: 2
  },
  {
    id: 'company_introduction',
    type: 'company_introduction',
    title: 'About Our Company',
    content: 'We are a leading provider of business solutions with over [X] years of experience serving companies like yours.',
    isIncluded: true,
    isRequired: false,
    order: 3
  },
  {
    id: 'solution_overview',
    type: 'solution_overview',
    title: 'Proposed Solution',
    content: 'Based on our analysis of your requirements, we recommend the following solution:',
    isIncluded: true,
    isRequired: false,
    order: 4
  },
  {
    id: 'pricing_breakdown',
    type: 'pricing_breakdown',
    title: 'Investment Summary',
    content: '',
    isIncluded: true,
    isRequired: true,
    order: 5
  },
  {
    id: 'implementation_timeline',
    type: 'implementation_timeline',
    title: 'Implementation Plan',
    content: 'Our proven implementation process ensures a smooth transition and rapid return on investment.',
    isIncluded: false,
    isRequired: false,
    order: 6
  },
  {
    id: 'value_proposition',
    type: 'value_proposition',
    title: 'Why Choose Us',
    content: 'Here are the key benefits and value propositions that set us apart from the competition.',
    isIncluded: false,
    isRequired: false,
    order: 7
  },
  {
    id: 'team_introduction',
    type: 'team_introduction',
    title: 'Your Dedicated Team',
    content: 'Meet the experienced professionals who will be working on your project.',
    isIncluded: false,
    isRequired: false,
    order: 8
  },
  {
    id: 'guarantees_warranties',
    type: 'guarantees_warranties',
    title: 'Guarantees & Warranties',
    content: 'We stand behind our solutions with comprehensive warranties and service level agreements.',
    isIncluded: false,
    isRequired: false,
    order: 9
  },
  {
    id: 'terms_conditions',
    type: 'terms_conditions',
    title: 'Terms & Conditions',
    content: 'This proposal is subject to the following terms and conditions.',
    isIncluded: true,
    isRequired: false,
    order: 10
  },
  {
    id: 'next_steps',
    type: 'next_steps',
    title: 'Next Steps',
    content: 'We look forward to moving forward with this exciting opportunity. Here are the next steps in our process.',
    isIncluded: true,
    isRequired: false,
    order: 11
  }
];

export default function QuoteTransformer({ 
  quoteId, 
  onTransformComplete 
}: {
  quoteId: string;
  onTransformComplete: (proposalData: any) => void;
}) {
  const [sections, setSections] = useState<ProposalSection[]>(defaultSections);
  const [transformationSettings, setTransformationSettings] = useState<TransformationSettings>({
    includeCompanyIntro: true,
    includeExecutiveSummary: true,
    includeValueProposition: false,
    includeImplementationPlan: false,
    includeTermsAndConditions: true,
    includeTeamIntroduction: false,
    includeGuarantees: false,
    customSections: []
  });
  const [activeTab, setActiveTab] = useState<'overview' | 'sections' | 'content' | 'preview'>('overview');

  // Fetch quote data
  const { data: quote, isLoading: quoteLoading } = useQuery<QuoteData>({
    queryKey: [`/api/proposals/${quoteId}`],
    enabled: !!quoteId
  });

  // Fetch business record data
  const { data: businessRecord } = useQuery<BusinessRecord>({
    queryKey: [`/api/business-records/${quote?.businessRecordId}`],
    enabled: !!quote?.businessRecordId
  });

  // Fetch contact data
  const { data: contact } = useQuery<Contact>({
    queryKey: [`/api/business-records/${quote?.businessRecordId}/contacts/${quote?.contactId}`],
    enabled: !!quote?.contactId
  });

  // Auto-populate content when quote data is loaded
  useEffect(() => {
    if (quote && businessRecord) {
      generateContentFromQuote();
    }
  }, [quote, businessRecord, contact]);

  const generateContentFromQuote = () => {
    const updatedSections = sections.map(section => {
      let content = section.content;

      switch (section.type) {
        case 'cover_page':
          content = `
            <div style="text-align: center; padding: 60px 0;">
              <h1 style="font-size: 48px; margin-bottom: 20px; color: #0066CC;">${quote!.title}</h1>
              <h2 style="font-size: 24px; margin-bottom: 40px; color: #666;">Professional Proposal</h2>
              <div style="margin-bottom: 40px;">
                <h3 style="font-size: 20px; margin-bottom: 10px;">Prepared for:</h3>
                <p style="font-size: 18px; font-weight: bold;">${businessRecord!.name}</p>
                ${contact ? `<p style="font-size: 16px;">${contact.firstName} ${contact.lastName}${contact.title ? `, ${contact.title}` : ''}</p>` : ''}
              </div>
              <div style="margin-top: 80px;">
                <p style="font-size: 16px; color: #666;">Proposal Date: ${new Date().toLocaleDateString()}</p>
                <p style="font-size: 16px; color: #666;">Quote Reference: ${quote!.proposalNumber}</p>
                ${quote!.validUntil ? `<p style="font-size: 16px; color: #666;">Valid Until: ${new Date(quote!.validUntil).toLocaleDateString()}</p>` : ''}
              </div>
            </div>
          `;
          break;

        case 'executive_summary':
          content = `
            <h2>Executive Summary</h2>
            <p>We are pleased to present this comprehensive proposal for ${businessRecord!.name}. This document outlines our recommended solution to address your business requirements with a total investment of <strong>$${parseFloat(quote!.totalAmount).toLocaleString()}</strong>.</p>
            <p>Our solution includes ${quote!.lineItems.length} carefully selected component${quote!.lineItems.length > 1 ? 's' : ''} designed to deliver immediate value and long-term benefits for your organization.</p>
            <h3>Key Benefits:</h3>
            <ul>
              <li>Professional-grade equipment and services</li>
              <li>Comprehensive support and maintenance</li>
              <li>Proven implementation methodology</li>
              <li>Competitive pricing with transparent terms</li>
            </ul>
          `;
          break;

        case 'solution_overview':
          const equipmentItems = quote!.lineItems.filter(item => item.itemType === 'equipment');
          const serviceItems = quote!.lineItems.filter(item => item.itemType === 'service');
          const accessoryItems = quote!.lineItems.filter(item => item.itemType === 'accessory');

          content = `
            <h2>Proposed Solution</h2>
            <p>Based on our analysis of ${businessRecord!.name}'s requirements, we have designed a comprehensive solution that includes:</p>
            
            ${equipmentItems.length > 0 ? `
            <h3>Equipment</h3>
            <ul>
              ${equipmentItems.map(item => `
                <li><strong>${item.productName}</strong> - Quantity: ${item.quantity} - $${parseFloat(item.totalPrice).toLocaleString()}
                  ${item.description ? `<br><em>${item.description}</em>` : ''}
                </li>
              `).join('')}
            </ul>` : ''}

            ${serviceItems.length > 0 ? `
            <h3>Services</h3>
            <ul>
              ${serviceItems.map(item => `
                <li><strong>${item.productName}</strong> - $${parseFloat(item.totalPrice).toLocaleString()}
                  ${item.description ? `<br><em>${item.description}</em>` : ''}
                </li>
              `).join('')}
            </ul>` : ''}

            ${accessoryItems.length > 0 ? `
            <h3>Accessories & Add-ons</h3>
            <ul>
              ${accessoryItems.map(item => `
                <li><strong>${item.productName}</strong> - Quantity: ${item.quantity} - $${parseFloat(item.totalPrice).toLocaleString()}
                  ${item.description ? `<br><em>${item.description}</em>` : ''}
                </li>
              `).join('')}
            </ul>` : ''}
          `;
          break;

        case 'pricing_breakdown':
          content = `
            <h2>Investment Summary</h2>
            <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0;">
              <table style="width: 100%; border-collapse: collapse;">
                <thead>
                  <tr style="border-bottom: 2px solid #dee2e6;">
                    <th style="text-align: left; padding: 12px 0;">Item</th>
                    <th style="text-align: center; padding: 12px 0;">Quantity</th>
                    <th style="text-align: right; padding: 12px 0;">Unit Price</th>
                    <th style="text-align: right; padding: 12px 0;">Total</th>
                  </tr>
                </thead>
                <tbody>
                  ${quote!.lineItems.map(item => `
                    <tr style="border-bottom: 1px solid #dee2e6;">
                      <td style="padding: 12px 0;">
                        <strong>${item.productName}</strong>
                        ${item.description ? `<br><small style="color: #666;">${item.description}</small>` : ''}
                      </td>
                      <td style="text-align: center; padding: 12px 0;">${item.quantity}</td>
                      <td style="text-align: right; padding: 12px 0;">$${parseFloat(item.unitPrice).toLocaleString()}</td>
                      <td style="text-align: right; padding: 12px 0;">$${parseFloat(item.totalPrice).toLocaleString()}</td>
                    </tr>
                  `).join('')}
                </tbody>
                <tfoot>
                  <tr style="border-top: 2px solid #0066CC; font-weight: bold;">
                    <td colspan="3" style="text-align: right; padding: 12px 0;">Total Investment:</td>
                    <td style="text-align: right; padding: 12px 0; font-size: 18px; color: #0066CC;">$${parseFloat(quote!.totalAmount).toLocaleString()}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
            ${quote!.validUntil ? `<p><em>This pricing is valid until ${new Date(quote!.validUntil).toLocaleDateString()}</em></p>` : ''}
          `;
          break;

        case 'next_steps':
          content = `
            <h2>Next Steps</h2>
            <p>We're excited about the opportunity to work with ${businessRecord!.name}. To move forward with this proposal:</p>
            <ol>
              <li><strong>Review & Approval:</strong> Please review this proposal and let us know if you have any questions or require modifications.</li>
              <li><strong>Contract Execution:</strong> Once approved, we'll prepare the formal contract documentation.</li>
              <li><strong>Implementation Planning:</strong> Our project team will schedule an implementation planning session.</li>
              <li><strong>Delivery & Installation:</strong> We'll coordinate delivery and installation at your convenience.</li>
              <li><strong>Training & Support:</strong> Our team will provide comprehensive training and ongoing support.</li>
            </ol>
            
            <div style="background: #e3f2fd; padding: 20px; border-left: 4px solid #0066CC; margin: 20px 0;">
              <h3 style="margin-top: 0;">Contact Information</h3>
              <p>For questions or to proceed with this proposal, please contact:</p>
              <p><strong>[Your Name]</strong><br>
              [Your Title]<br>
              [Your Phone]<br>
              [Your Email]</p>
            </div>
          `;
          break;

        default:
          // Keep existing content for other sections
          break;
      }

      return { ...section, content };
    });

    setSections(updatedSections);
  };

  const handleSectionToggle = (sectionId: string, isIncluded: boolean) => {
    setSections(prev => prev.map(section => 
      section.id === sectionId ? { ...section, isIncluded } : section
    ));
  };

  const handleContentChange = (sectionId: string, content: string) => {
    setSections(prev => prev.map(section => 
      section.id === sectionId ? { ...section, content } : section
    ));
  };

  const handleTransform = () => {
    const includedSections = sections
      .filter(section => section.isIncluded)
      .sort((a, b) => a.order - b.order);

    const proposalData = {
      sourceQuoteId: quoteId,
      title: `${quote?.title} - Professional Proposal`,
      businessRecordId: quote?.businessRecordId,
      contactId: quote?.contactId,
      sections: includedSections,
      totalAmount: quote?.totalAmount,
      validUntil: quote?.validUntil,
      transformedAt: new Date().toISOString()
    };

    onTransformComplete(proposalData);
  };

  if (quoteLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!quote) {
    return (
      <Card>
        <CardContent className="text-center py-8">
          <AlertCircle className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-semibold mb-2">Quote Not Found</h3>
          <p className="text-muted-foreground">The requested quote could not be loaded.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Quote to Proposal Transformer
              </CardTitle>
              <div className="flex items-center gap-4 mt-2 text-sm text-muted-foreground">
                <span>Quote: {quote.proposalNumber}</span>
                <ArrowRight className="h-4 w-4" />
                <span>Professional Proposal</span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="outline">{businessRecord?.name || 'Unknown Customer'}</Badge>
              <Badge variant="secondary">$${parseFloat(quote.totalAmount).toLocaleString()}</Badge>
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as any)}>
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="sections">Sections</TabsTrigger>
          <TabsTrigger value="content">Content</TabsTrigger>
          <TabsTrigger value="preview">Preview</TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Source Quote Info */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Source Quote</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Quote Number:</span>
                  <span className="font-medium">{quote.proposalNumber}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Title:</span>
                  <span className="font-medium">{quote.title}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Customer:</span>
                  <span className="font-medium">{businessRecord?.name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Contact:</span>
                  <span className="font-medium">
                    {contact ? `${contact.firstName} ${contact.lastName}` : 'N/A'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Total Amount:</span>
                  <span className="font-medium text-lg">${parseFloat(quote.totalAmount).toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Line Items:</span>
                  <span className="font-medium">{quote.lineItems.length}</span>
                </div>
                {quote.validUntil && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Valid Until:</span>
                    <span className="font-medium">{new Date(quote.validUntil).toLocaleDateString()}</span>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Transformation Settings */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Proposal Configuration</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <Label>Include Executive Summary</Label>
                    <Switch
                      checked={transformationSettings.includeExecutiveSummary}
                      onCheckedChange={(checked) => 
                        setTransformationSettings(prev => ({ ...prev, includeExecutiveSummary: checked }))
                      }
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <Label>Include Company Introduction</Label>
                    <Switch
                      checked={transformationSettings.includeCompanyIntro}
                      onCheckedChange={(checked) => 
                        setTransformationSettings(prev => ({ ...prev, includeCompanyIntro: checked }))
                      }
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <Label>Include Value Proposition</Label>
                    <Switch
                      checked={transformationSettings.includeValueProposition}
                      onCheckedChange={(checked) => 
                        setTransformationSettings(prev => ({ ...prev, includeValueProposition: checked }))
                      }
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <Label>Include Implementation Plan</Label>
                    <Switch
                      checked={transformationSettings.includeImplementationPlan}
                      onCheckedChange={(checked) => 
                        setTransformationSettings(prev => ({ ...prev, includeImplementationPlan: checked }))
                      }
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <Label>Include Terms & Conditions</Label>
                    <Switch
                      checked={transformationSettings.includeTermsAndConditions}
                      onCheckedChange={(checked) => 
                        setTransformationSettings(prev => ({ ...prev, includeTermsAndConditions: checked }))
                      }
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="sections">
          <Card>
            <CardHeader>
              <CardTitle>Configure Proposal Sections</CardTitle>
              <p className="text-sm text-muted-foreground">
                Select which sections to include in your proposal and customize their order
              </p>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {sections.map((section) => (
                  <div
                    key={section.id}
                    className={`flex items-center justify-between p-3 border rounded-lg ${
                      section.isIncluded ? 'bg-blue-50 border-blue-200' : 'bg-gray-50'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <Switch
                        checked={section.isIncluded}
                        onCheckedChange={(checked) => handleSectionToggle(section.id, checked)}
                        disabled={section.isRequired}
                      />
                      <div>
                        <h4 className="font-medium">{section.title}</h4>
                        <p className="text-sm text-muted-foreground">
                          Order: {section.order} {section.isRequired && '• Required'}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {section.isRequired && (
                        <Badge variant="secondary" className="text-xs">Required</Badge>
                      )}
                      <Badge variant={section.isIncluded ? "default" : "outline"} className="text-xs">
                        {section.isIncluded ? "Included" : "Excluded"}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="content">
          <div className="space-y-6">
            {sections
              .filter(section => section.isIncluded)
              .sort((a, b) => a.order - b.order)
              .map((section) => (
                <Card key={section.id}>
                  <CardHeader>
                    <CardTitle className="text-base">{section.title}</CardTitle>
                    <Badge variant="outline" className="w-fit text-xs">
                      {section.type.replace('_', ' ').toUpperCase()}
                    </Badge>
                  </CardHeader>
                  <CardContent>
                    <Label>Content</Label>
                    <Textarea
                      value={section.content}
                      onChange={(e) => handleContentChange(section.id, e.target.value)}
                      className="min-h-32 font-mono text-sm"
                      placeholder="Enter content for this section..."
                    />
                  </CardContent>
                </Card>
              ))}
          </div>
        </TabsContent>

        <TabsContent value="preview">
          <Card>
            <CardHeader>
              <CardTitle>Proposal Preview</CardTitle>
              <div className="flex gap-2">
                <Button variant="outline" size="sm">
                  <Eye className="h-4 w-4 mr-2" />
                  Full Preview
                </Button>
                <Button variant="outline" size="sm">
                  <Download className="h-4 w-4 mr-2" />
                  Export PDF
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-96">
                <div className="space-y-6">
                  {sections
                    .filter(section => section.isIncluded)
                    .sort((a, b) => a.order - b.order)
                    .map((section) => (
                      <div key={section.id} className="border-l-4 border-primary/20 pl-4">
                        <h3 className="font-semibold text-lg mb-2">{section.title}</h3>
                        <div 
                          className="prose prose-sm max-w-none"
                          dangerouslySetInnerHTML={{ __html: section.content }}
                        />
                      </div>
                    ))}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Action Buttons */}
      <div className="flex justify-between items-center">
        <div className="text-sm text-muted-foreground">
          {sections.filter(s => s.isIncluded).length} sections selected
        </div>
        <div className="flex gap-2">
          <Button variant="outline">
            <Settings className="h-4 w-4 mr-2" />
            Save Template
          </Button>
          <Button onClick={handleTransform}>
            <CheckCircle className="h-4 w-4 mr-2" />
            Create Proposal
          </Button>
        </div>
      </div>
    </div>
  );
}