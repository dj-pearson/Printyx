import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { 
  BookOpen, 
  CheckCircle, 
  ArrowRight, 
  Clock, 
  AlertTriangle,
  Users,
  Target,
  FileText,
  Settings
} from 'lucide-react';

interface SOPStep {
  step: number;
  title: string;
  description: string;
  timeEstimate: string;
  requirements: string[];
  tips?: string[];
  warnings?: string[];
}

interface SOPData {
  title: string;
  description: string;
  estimatedTime: string;
  requiredRole: string[];
  steps: SOPStep[];
  relatedProcesses: string[];
  dodRequirements: string[];
}

const SOPs: Record<string, SOPData> = {
  'lead-to-quote': {
    title: 'Lead to Quote Conversion',
    description: 'Complete process for converting qualified leads into professional quotes',
    estimatedTime: '2-4 hours',
    requiredRole: ['sales', 'sales_rep', 'sales_manager'],
    dodRequirements: [
      'Customer needs assessment completed',
      'Equipment requirements documented',
      'Pricing approved by manager',
      'Quote valid until date set',
      'Customer contact information verified'
    ],
    steps: [
      {
        step: 1,
        title: 'Lead Qualification',
        description: 'Verify lead meets minimum criteria for quote generation',
        timeEstimate: '15-30 min',
        requirements: [
          'Contact information verified',
          'Business type confirmed',
          'Budget range discussed',
          'Timeline requirements understood'
        ],
        tips: [
          'Use discovery questions to understand pain points',
          'Document specific requirements in lead notes'
        ]
      },
      {
        step: 2,
        title: 'Needs Assessment',
        description: 'Conduct detailed assessment of customer requirements',
        timeEstimate: '30-60 min',
        requirements: [
          'Monthly volume estimates',
          'Color vs. black & white ratio',
          'Special features needed',
          'Location and space constraints'
        ],
        tips: [
          'Ask about current equipment problems',
          'Understand workflow and user base'
        ]
      },
      {
        step: 3,
        title: 'Solution Design',
        description: 'Match customer needs with appropriate equipment and services',
        timeEstimate: '45-90 min',
        requirements: [
          'Equipment models selected',
          'Service plan recommended',
          'Installation requirements noted',
          'Training needs identified'
        ],
        warnings: [
          'Verify equipment availability before quoting',
          'Check for any special shipping requirements'
        ]
      },
      {
        step: 4,
        title: 'Quote Generation',
        description: 'Create professional quote with all necessary details',
        timeEstimate: '30-45 min',
        requirements: [
          'All line items priced correctly',
          'Terms and conditions included',
          'Valid until date set (14-30 days)',
          'Manager approval if required'
        ],
        tips: [
          'Include alternative options when possible',
          'Clearly explain lease vs. purchase options'
        ]
      }
    ],
    relatedProcesses: [
      'Quote to Proposal',
      'Customer Follow-up',
      'Equipment Availability Check'
    ]
  },
  'quote-to-proposal': {
    title: 'Quote to Proposal Conversion',
    description: 'Convert accepted quotes into detailed proposals for contract execution',
    estimatedTime: '1-2 hours',
    requiredRole: ['sales', 'sales_manager', 'proposal_specialist'],
    dodRequirements: [
      'Quote formally accepted by customer',
      'Financing terms finalized',
      'Delivery timeline confirmed',
      'Installation requirements documented',
      'Legal terms reviewed'
    ],
    steps: [
      {
        step: 1,
        title: 'Quote Acceptance Verification',
        description: 'Confirm customer acceptance and readiness to proceed',
        timeEstimate: '15-20 min',
        requirements: [
          'Written or verbal acceptance confirmed',
          'Decision maker authorization verified',
          'Purchase order received (if required)',
          'Financing pre-approval completed'
        ]
      },
      {
        step: 2,
        title: 'Proposal Documentation',
        description: 'Create comprehensive proposal with all contract details',
        timeEstimate: '45-75 min',
        requirements: [
          'Detailed equipment specifications',
          'Service level agreements defined',
          'Installation timeline and requirements',
          'Training plan outlined',
          'Warranty and support terms'
        ],
        tips: [
          'Use customer-specific branding when possible',
          'Include implementation timeline',
          'Highlight unique value propositions'
        ]
      },
      {
        step: 3,
        title: 'Legal and Compliance Review',
        description: 'Ensure all legal requirements and company policies are met',
        timeEstimate: '20-30 min',
        requirements: [
          'Contract terms comply with company policy',
          'Credit approval completed',
          'Insurance requirements verified',
          'Compliance documents prepared'
        ],
        warnings: [
          'All custom terms must be approved by legal',
          'Verify customer insurance meets minimum requirements'
        ]
      }
    ],
    relatedProcesses: [
      'Proposal to Contract',
      'Credit Approval Process',
      'Installation Scheduling'
    ]
  },
  'proposal-to-contract': {
    title: 'Proposal to Contract Execution',
    description: 'Finalize signed contracts from approved proposals',
    estimatedTime: '30-60 min',
    requiredRole: ['sales_manager', 'contract_admin', 'legal'],
    dodRequirements: [
      'Proposal formally approved',
      'Contract terms finalized',
      'Signatures obtained',
      'Installation scheduled',
      'Equipment ordered'
    ],
    steps: [
      {
        step: 1,
        title: 'Contract Preparation',
        description: 'Prepare final contract documents for signature',
        timeEstimate: '20-30 min',
        requirements: [
          'All proposal terms transferred to contract',
          'Legal review completed',
          'Pricing and terms locked in',
          'Installation dates confirmed'
        ]
      },
      {
        step: 2,
        title: 'Signature Collection',
        description: 'Obtain all required signatures and approvals',
        timeEstimate: '10-20 min',
        requirements: [
          'Customer signatures obtained',
          'Company authorization completed',
          'Witness signatures (if required)',
          'Date and execution location recorded'
        ],
        tips: [
          'Use electronic signature tools when possible',
          'Verify signer authority before proceeding'
        ]
      },
      {
        step: 3,
        title: 'Contract Activation',
        description: 'Activate contract and initiate fulfillment processes',
        timeEstimate: '10-15 min',
        requirements: [
          'Contract stored in system',
          'Equipment order initiated',
          'Installation team notified',
          'Customer success handoff completed'
        ]
      }
    ],
    relatedProcesses: [
      'Equipment Ordering',
      'Installation Scheduling',
      'Customer Onboarding'
    ]
  }
};

interface SOPModalProps {
  processType: string;
  trigger?: React.ReactNode;
  className?: string;
}

export default function SOPModal({ processType, trigger, className }: SOPModalProps) {
  const [isOpen, setIsOpen] = useState(false);
  const sop = SOPs[processType];

  if (!sop) {
    return (
      <Button variant="ghost" size="sm" disabled>
        <BookOpen className="h-4 w-4 mr-2" />
        SOP Not Available
      </Button>
    );
  }

  const defaultTrigger = (
    <Button variant="outline" size="sm" className={className}>
      <BookOpen className="h-4 w-4 mr-2" />
      View SOP
    </Button>
  );

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        {trigger || defaultTrigger}
      </DialogTrigger>
      <DialogContent className="max-w-4xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <BookOpen className="h-5 w-5" />
            {sop.title}
          </DialogTitle>
          <DialogDescription>
            {sop.description}
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="max-h-[70vh] pr-4">
          <div className="space-y-6">
            {/* Process Overview */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Target className="h-5 w-5" />
                  Process Overview
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="flex items-center gap-2">
                    <Clock className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm">
                      <strong>Time:</strong> {sop.estimatedTime}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Users className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm">
                      <strong>Roles:</strong> {sop.requiredRole.join(', ')}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <FileText className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm">
                      <strong>Steps:</strong> {sop.steps.length}
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Definition of Done */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center gap-2">
                  <CheckCircle className="h-5 w-5 text-green-600" />
                  Definition of Done
                </CardTitle>
                <CardDescription>
                  All requirements must be met before proceeding to next stage
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {sop.dodRequirements.map((requirement, index) => (
                    <div key={index} className="flex items-center gap-2">
                      <CheckCircle className="h-4 w-4 text-green-600" />
                      <span className="text-sm">{requirement}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Process Steps */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold flex items-center gap-2">
                <Settings className="h-5 w-5" />
                Process Steps
              </h3>
              
              {sop.steps.map((step, index) => (
                <Card key={step.step}>
                  <CardHeader className="pb-3">
                    <CardTitle className="flex items-center gap-3">
                      <Badge variant="outline" className="w-8 h-8 rounded-full flex items-center justify-center">
                        {step.step}
                      </Badge>
                      {step.title}
                      <Badge variant="secondary" className="ml-auto">
                        {step.timeEstimate}
                      </Badge>
                    </CardTitle>
                    <CardDescription>{step.description}</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {/* Requirements */}
                    <div>
                      <h5 className="font-medium text-sm mb-2">Requirements:</h5>
                      <div className="space-y-1">
                        {step.requirements.map((req, idx) => (
                          <div key={idx} className="flex items-center gap-2 text-sm">
                            <CheckCircle className="h-3 w-3 text-green-600 flex-shrink-0" />
                            <span>{req}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Tips */}
                    {step.tips && step.tips.length > 0 && (
                      <div>
                        <h5 className="font-medium text-sm mb-2 text-blue-600">Tips:</h5>
                        <div className="space-y-1">
                          {step.tips.map((tip, idx) => (
                            <div key={idx} className="flex items-start gap-2 text-sm text-blue-700">
                              <ArrowRight className="h-3 w-3 mt-0.5 flex-shrink-0" />
                              <span>{tip}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Warnings */}
                    {step.warnings && step.warnings.length > 0 && (
                      <div>
                        <h5 className="font-medium text-sm mb-2 text-amber-600">Warnings:</h5>
                        <div className="space-y-1">
                          {step.warnings.map((warning, idx) => (
                            <div key={idx} className="flex items-start gap-2 text-sm text-amber-700">
                              <AlertTriangle className="h-3 w-3 mt-0.5 flex-shrink-0" />
                              <span>{warning}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>

            {/* Related Processes */}
            {sop.relatedProcesses.length > 0 && (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg">Related Processes</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-wrap gap-2">
                    {sop.relatedProcesses.map((process, index) => (
                      <Badge key={index} variant="outline">
                        {process}
                      </Badge>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}