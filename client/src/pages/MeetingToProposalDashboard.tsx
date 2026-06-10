/**
 * AI Meeting Notes to Proposal Pipeline
 * Turn meeting transcripts into professional proposals with AI
 * Major competitive advantage - E-Automate has nothing like this
 */

import React, { useState } from 'react';
import MainLayout from '@/components/layout/main-layout';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Mic,
  FileText,
  Sparkles,
  Upload,
  Download,
  Eye,
  Edit,
  Send,
  CheckCircle2,
  Clock,
  Zap,
  Brain,
  Target,
  DollarSign,
  Calendar,
  Users,
  ArrowRight,
  Plus,
} from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

interface ProposalPipeline {
  id: string;
  customerName: string;
  meetingDate: Date;
  meetingNotes: string;
  extractedRequirements: string[];
  proposedSolution: string;
  pricing: number;
  status: 'draft' | 'review' | 'sent' | 'accepted';
  createdAt: Date;
}

const mockPipelines: ProposalPipeline[] = [
  {
    id: '1',
    customerName: 'Acme Corporation',
    meetingDate: new Date('2025-11-20'),
    meetingNotes: 'Customer needs 5 MFPs for new office. Budget $25k. Timeline: ASAP.',
    extractedRequirements: [
      '5 multifunction printers',
      'Color and B&W capabilities',
      'Network scanning to email',
      'Mobile printing support',
      '$25,000 budget',
      'Immediate installation',
    ],
    proposedSolution: 'Canon imageRUNNER ADVANCE DX C5760i (x5)',
    pricing: 24500,
    status: 'review',
    createdAt: new Date('2025-11-20T14:30:00'),
  },
  {
    id: '2',
    customerName: 'TechStart Inc',
    meetingDate: new Date('2025-11-19'),
    meetingNotes: 'Startup looking for managed print services. 15 employees. Hybrid work.',
    extractedRequirements: [
      '2-3 printers for office',
      'Managed print services',
      '15 employees (hybrid)',
      'Low upfront cost',
      'Include supplies and service',
    ],
    proposedSolution: 'MPS Package - 3 Devices + Supplies + Service',
    pricing: 495,
    status: 'sent',
    createdAt: new Date('2025-11-19T10:15:00'),
  },
];

export default function MeetingToProposalDashboard() {
  const [pipelines, setPipelines] = useState(mockPipelines);
  const [activeTab, setActiveTab] = useState('create');
  const [meetingNotes, setMeetingNotes] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);

  const stats = {
    total: pipelines.length,
    draft: pipelines.filter((p) => p.status === 'draft').length,
    sent: pipelines.filter((p) => p.status === 'sent').length,
    accepted: pipelines.filter((p) => p.status === 'accepted').length,
    totalValue: pipelines.reduce((sum, p) => sum + p.pricing, 0),
  };

  const processNotes = () => {
    setIsProcessing(true);
    // Simulate AI processing
    setTimeout(() => {
      setIsProcessing(false);
      setActiveTab('pipeline');
    }, 2000);
  };

  return (
    <MainLayout
      title="Meeting to Proposal AI"
      description="Turn meeting notes into professional proposals instantly"
    >
      <div className="container mx-auto p-6 space-y-6">
        {/* Header */}
        <div className="text-center max-w-3xl mx-auto mb-8">
          <Badge variant="secondary" className="mb-4">
            <Sparkles className="h-3 w-3 mr-1" />
            AI-Powered
          </Badge>
          <h1 className="text-4xl font-bold mb-4">Meeting Notes → Professional Proposal</h1>
          <p className="text-xl text-muted-foreground">
            Upload meeting notes or transcripts, and our AI automatically generates a complete,
            professional proposal ready to send.
          </p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Proposals</p>
                  <p className="text-3xl font-bold">{stats.total}</p>
                </div>
                <FileText className="h-8 w-8 text-blue-600" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">In Progress</p>
                  <p className="text-3xl font-bold text-orange-600">{stats.draft}</p>
                </div>
                <Clock className="h-8 w-8 text-orange-600" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Sent</p>
                  <p className="text-3xl font-bold text-green-600">{stats.sent}</p>
                </div>
                <Send className="h-8 w-8 text-green-600" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Total Value</p>
                  <p className="text-3xl font-bold text-purple-600">
                    ${(stats.totalValue / 1000).toFixed(0)}k
                  </p>
                </div>
                <DollarSign className="h-8 w-8 text-purple-600" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Main Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid grid-cols-2 w-full max-w-md mx-auto">
            <TabsTrigger value="create">
              <Plus className="h-4 w-4 mr-2" />
              Create New
            </TabsTrigger>
            <TabsTrigger value="pipeline">
              <FileText className="h-4 w-4 mr-2" />
              Pipeline ({pipelines.length})
            </TabsTrigger>
          </TabsList>

          {/* Create Tab */}
          <TabsContent value="create" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Upload Meeting Notes</CardTitle>
                <CardDescription>
                  Paste your meeting notes or upload a transcript file. Our AI will extract customer
                  requirements and generate a proposal automatically.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label htmlFor="notes">Meeting Notes or Transcript</Label>
                  <Textarea
                    id="notes"
                    placeholder="Paste meeting notes here...

Example:
- Customer: ABC Corp
- Meeting Date: Nov 23, 2025
- Attendees: John (CEO), Sarah (CFO)
- Requirements: 10 color MFPs, budget $50k, need by end of month
- Pain Points: Current printers breaking down, high maintenance costs
- Decision Timeline: 2 weeks"
                    className="min-h-[300px] font-mono text-sm"
                    value={meetingNotes}
                    onChange={(e) => setMeetingNotes(e.target.value)}
                  />
                </div>

                <div className="flex gap-4">
                  <Button variant="outline" className="flex-1">
                    <Upload className="h-4 w-4 mr-2" />
                    Upload File
                  </Button>
                  <Button variant="outline" className="flex-1">
                    <Mic className="h-4 w-4 mr-2" />
                    Record Meeting
                  </Button>
                </div>
              </CardContent>
              <CardFooter>
                <Button
                  className="w-full"
                  size="lg"
                  onClick={processNotes}
                  disabled={!meetingNotes || isProcessing}
                >
                  {isProcessing ? (
                    <>
                      <Brain className="h-5 w-5 mr-2 animate-pulse" />
                      AI is analyzing meeting...
                    </>
                  ) : (
                    <>
                      <Sparkles className="h-5 w-5 mr-2" />
                      Generate Proposal with AI
                    </>
                  )}
                </Button>
              </CardFooter>
            </Card>

            {/* How it Works */}
            <Card className="bg-gradient-to-r from-purple-50 to-blue-50 border-purple-200">
              <CardHeader>
                <CardTitle>How It Works</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid md:grid-cols-4 gap-6">
                  <div className="text-center">
                    <div className="w-12 h-12 bg-purple-600 rounded-full flex items-center justify-center text-white font-bold text-xl mx-auto mb-3">
                      1
                    </div>
                    <Mic className="h-8 w-8 mx-auto mb-2 text-purple-600" />
                    <h3 className="font-semibold mb-1">Upload Notes</h3>
                    <p className="text-sm text-muted-foreground">
                      Paste or upload meeting transcript
                    </p>
                  </div>
                  <div className="text-center">
                    <div className="w-12 h-12 bg-blue-600 rounded-full flex items-center justify-center text-white font-bold text-xl mx-auto mb-3">
                      2
                    </div>
                    <Brain className="h-8 w-8 mx-auto mb-2 text-blue-600" />
                    <h3 className="font-semibold mb-1">AI Analysis</h3>
                    <p className="text-sm text-muted-foreground">
                      Extract requirements & pain points
                    </p>
                  </div>
                  <div className="text-center">
                    <div className="w-12 h-12 bg-green-600 rounded-full flex items-center justify-center text-white font-bold text-xl mx-auto mb-3">
                      3
                    </div>
                    <FileText className="h-8 w-8 mx-auto mb-2 text-green-600" />
                    <h3 className="font-semibold mb-1">Generate Proposal</h3>
                    <p className="text-sm text-muted-foreground">Professional document created</p>
                  </div>
                  <div className="text-center">
                    <div className="w-12 h-12 bg-orange-600 rounded-full flex items-center justify-center text-white font-bold text-xl mx-auto mb-3">
                      4
                    </div>
                    <Send className="h-8 w-8 mx-auto mb-2 text-orange-600" />
                    <h3 className="font-semibold mb-1">Send</h3>
                    <p className="text-sm text-muted-foreground">Review and email to customer</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Pipeline Tab */}
          <TabsContent value="pipeline" className="space-y-4">
            {pipelines.map((pipeline) => (
              <Card key={pipeline.id} className="hover:shadow-md transition-shadow">
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-3 mb-2">
                        <CardTitle>{pipeline.customerName}</CardTitle>
                        <Badge
                          variant={
                            pipeline.status === 'accepted'
                              ? 'default'
                              : pipeline.status === 'sent'
                                ? 'secondary'
                                : 'outline'
                          }
                        >
                          {pipeline.status.charAt(0).toUpperCase() + pipeline.status.slice(1)}
                        </Badge>
                      </div>
                      <CardDescription>
                        Meeting: {pipeline.meetingDate.toLocaleDateString()}
                      </CardDescription>
                    </div>
                    <div className="text-right">
                      <p className="text-2xl font-bold text-green-600">
                        ${pipeline.pricing.toLocaleString()}
                      </p>
                      <p className="text-sm text-muted-foreground">Proposal Value</p>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div>
                      <h4 className="font-semibold mb-2 flex items-center gap-2">
                        <Target className="h-4 w-4" />
                        Extracted Requirements
                      </h4>
                      <div className="grid md:grid-cols-2 gap-2">
                        {pipeline.extractedRequirements.map((req, idx) => (
                          <div key={idx} className="flex items-start gap-2 text-sm">
                            <CheckCircle2 className="h-4 w-4 text-green-600 flex-shrink-0 mt-0.5" />
                            <span>{req}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                    <div>
                      <h4 className="font-semibold mb-2 flex items-center gap-2">
                        <Sparkles className="h-4 w-4" />
                        Proposed Solution
                      </h4>
                      <p className="text-sm text-muted-foreground">{pipeline.proposedSolution}</p>
                    </div>
                  </div>
                </CardContent>
                <CardFooter className="flex gap-2">
                  <Button variant="outline" size="sm">
                    <Eye className="h-4 w-4 mr-2" />
                    Preview
                  </Button>
                  <Button variant="outline" size="sm">
                    <Edit className="h-4 w-4 mr-2" />
                    Edit
                  </Button>
                  {/* PROP-007: dead "Download PDF" removed (this dashboard is mock;
                      PROP-009 gates/removes it). */}
                  {pipeline.status === 'draft' || pipeline.status === 'review' ? (
                    <Button size="sm" className="ml-auto">
                      <Send className="h-4 w-4 mr-2" />
                      Send to Customer
                    </Button>
                  ) : (
                    <Badge variant="secondary" className="ml-auto">
                      {pipeline.status === 'sent' ? 'Awaiting Response' : 'Accepted'}
                    </Badge>
                  )}
                </CardFooter>
              </Card>
            ))}

            {pipelines.length === 0 && (
              <Card className="p-12 text-center">
                <FileText className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
                <h3 className="text-xl font-semibold mb-2">No Proposals Yet</h3>
                <p className="text-muted-foreground mb-6">
                  Create your first AI-generated proposal from meeting notes
                </p>
                <Button onClick={() => setActiveTab('create')}>
                  <Plus className="h-4 w-4 mr-2" />
                  Create First Proposal
                </Button>
              </Card>
            )}
          </TabsContent>
        </Tabs>

        {/* Benefits */}
        <Card className="bg-gradient-to-r from-blue-600 to-purple-600 text-white border-0">
          <CardContent className="p-8">
            <h2 className="text-2xl font-bold mb-4 text-center">Transform Your Sales Process</h2>
            <div className="grid md:grid-cols-3 gap-6">
              <div className="text-center">
                <Zap className="h-12 w-12 mx-auto mb-3" />
                <h3 className="font-bold mb-2">10x Faster</h3>
                <p className="text-sm text-white/90">Generate proposals in minutes, not hours</p>
              </div>
              <div className="text-center">
                <Target className="h-12 w-12 mx-auto mb-3" />
                <h3 className="font-bold mb-2">100% Accurate</h3>
                <p className="text-sm text-white/90">Never miss a customer requirement</p>
              </div>
              <div className="text-center">
                <DollarSign className="h-12 w-12 mx-auto mb-3" />
                <h3 className="font-bold mb-2">Higher Win Rate</h3>
                <p className="text-sm text-white/90">Professional proposals win more deals</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  );
}
