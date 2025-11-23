/**
 * Integration Marketplace Dashboard
 * Modern SaaS integration marketplace showcasing all available integrations
 * Competitive differentiator vs E-Automate's limited integrations
 */

import React, { useState } from 'react';
import MainLayout from '@/components/layout/main-layout';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Search,
  Filter,
  CheckCircle2,
  Circle,
  Clock,
  Star,
  TrendingUp,
  Zap,
  DollarSign,
  MessageSquare,
  Calendar,
  Users,
  Package,
  Mail,
  Phone,
  Database,
  BarChart3,
  Settings,
  ExternalLink,
  ChevronRight,
  Sparkles,
  Shield,
  Rocket
} from 'lucide-react';

interface Integration {
  id: string;
  name: string;
  provider: string;
  category: string;
  description: string;
  longDescription: string;
  icon: React.ComponentType<any>;
  status: 'connected' | 'available' | 'coming-soon';
  featured: boolean;
  popular: boolean;
  connections?: number;
  features: string[];
  benefits: string[];
  pricingModel?: string;
  documentationUrl?: string;
  supportUrl?: string;
}

const integrations: Integration[] = [
  // Accounting & ERP
  {
    id: 'quickbooks',
    name: 'QuickBooks Online',
    provider: 'quickbooks',
    category: 'accounting',
    description: 'Sync invoices, payments, and customer data with QuickBooks',
    longDescription: 'Automate your accounting workflows with bi-directional sync between Printyx and QuickBooks Online. Eliminate manual data entry and keep your books accurate.',
    icon: DollarSign,
    status: 'available',
    featured: true,
    popular: true,
    connections: 245,
    features: [
      'Automatic invoice sync',
      'Payment tracking',
      'Customer data sync',
      'Chart of accounts mapping',
      'Real-time reconciliation'
    ],
    benefits: [
      'Save 10+ hours per month on data entry',
      'Eliminate accounting errors',
      'Real-time financial visibility'
    ],
    pricingModel: 'Included',
    documentationUrl: '/docs/integrations/quickbooks',
    supportUrl: '/support/quickbooks'
  },
  {
    id: 'salesforce',
    name: 'Salesforce',
    provider: 'salesforce',
    category: 'crm',
    description: 'Bi-directional sync with Salesforce CRM for leads, contacts, and opportunities',
    longDescription: 'Connect your Salesforce org to Printyx for unified customer data. Sync leads, contacts, opportunities, and activities in real-time.',
    icon: Users,
    status: 'available',
    featured: true,
    popular: true,
    connections: 189,
    features: [
      'Lead and contact sync',
      'Opportunity management',
      'Activity tracking',
      'Custom field mapping',
      'Automated workflows'
    ],
    benefits: [
      'Unified customer view',
      'No duplicate data entry',
      'Better sales pipeline visibility'
    ],
    pricingModel: 'Included',
    documentationUrl: '/docs/integrations/salesforce'
  },
  {
    id: 'e-automate',
    name: 'E-Automate',
    provider: 'e-automate',
    category: 'erp',
    description: 'Migrate data from E-Automate or maintain parallel sync during transition',
    longDescription: 'Seamlessly migrate from E-Automate to Printyx or run both systems in parallel. Import customers, contracts, equipment, and service history.',
    icon: Database,
    status: 'available',
    featured: false,
    popular: false,
    connections: 42,
    features: [
      'One-time data import',
      'Customer migration',
      'Contract transfer',
      'Equipment history',
      'Service records'
    ],
    benefits: [
      'Easy migration path',
      'Zero data loss',
      'Gradual transition support'
    ],
    pricingModel: 'Migration fee applies'
  },
  {
    id: 'connectwise',
    name: 'ConnectWise',
    provider: 'connectwise',
    category: 'erp',
    description: 'Integration with ConnectWise PSA for ticketing and project management',
    longDescription: 'Connect your ConnectWise PSA to synchronize service tickets, time entries, and project data with Printyx.',
    icon: Settings,
    status: 'available',
    featured: false,
    popular: false,
    features: [
      'Ticket synchronization',
      'Time entry tracking',
      'Project management',
      'Resource planning'
    ],
    benefits: [
      'Unified service delivery',
      'Accurate time tracking',
      'Better resource utilization'
    ],
    pricingModel: 'Included'
  },

  // Payments
  {
    id: 'stripe',
    name: 'Stripe',
    provider: 'stripe',
    category: 'payments',
    description: 'Accept credit card payments and manage subscriptions',
    longDescription: 'Process payments securely with Stripe. Accept credit cards, ACH transfers, and manage recurring subscriptions automatically.',
    icon: DollarSign,
    status: 'available',
    featured: true,
    popular: true,
    connections: 312,
    features: [
      'Credit card processing',
      'ACH payments',
      'Recurring billing',
      'Payment portal',
      'Dispute management'
    ],
    benefits: [
      'Faster payment collection',
      'Automated subscriptions',
      'Lower processing fees'
    ],
    pricingModel: 'Stripe fees apply',
    documentationUrl: '/docs/integrations/stripe'
  },

  // Communication
  {
    id: 'twilio',
    name: 'Twilio',
    provider: 'twilio',
    category: 'communication',
    description: 'Send SMS notifications and reminders to customers',
    longDescription: 'Automate customer communication with Twilio SMS. Send appointment reminders, service notifications, and payment alerts.',
    icon: Phone,
    status: 'available',
    featured: false,
    popular: true,
    connections: 156,
    features: [
      'SMS notifications',
      'Two-way messaging',
      'Appointment reminders',
      'Service alerts',
      'Payment reminders'
    ],
    benefits: [
      'Better customer engagement',
      'Reduced no-shows',
      'Faster response times'
    ],
    pricingModel: 'Twilio usage fees apply'
  },
  {
    id: 'sendgrid',
    name: 'SendGrid',
    provider: 'sendgrid',
    category: 'communication',
    description: 'Professional email delivery for invoices, quotes, and notifications',
    longDescription: 'Send transactional emails reliably with SendGrid. Deliver invoices, quotes, service notifications, and marketing campaigns.',
    icon: Mail,
    status: 'available',
    featured: false,
    popular: true,
    connections: 198,
    features: [
      'Email delivery',
      'Template management',
      'Delivery tracking',
      'Bounce handling',
      'Email analytics'
    ],
    benefits: [
      '99%+ delivery rate',
      'Professional email templates',
      'Detailed analytics'
    ],
    pricingModel: 'SendGrid fees apply'
  },
  {
    id: 'slack',
    name: 'Slack',
    provider: 'slack',
    category: 'communication',
    description: 'Team notifications and alerts in Slack channels',
    longDescription: 'Get instant notifications in Slack for important events like new service calls, urgent tickets, and equipment failures.',
    icon: MessageSquare,
    status: 'available',
    featured: false,
    popular: false,
    connections: 87,
    features: [
      'Real-time notifications',
      'Channel routing',
      'Mention support',
      'Custom alerts',
      'Bot commands'
    ],
    benefits: [
      'Faster team response',
      'Centralized communication',
      'Better coordination'
    ],
    pricingModel: 'Included'
  },
  {
    id: 'mailchimp',
    name: 'Mailchimp',
    provider: 'mailchimp',
    category: 'marketing',
    description: 'Email marketing campaigns and customer segmentation',
    longDescription: 'Run targeted email campaigns with Mailchimp. Segment customers, track engagement, and automate marketing workflows.',
    icon: Mail,
    status: 'available',
    featured: false,
    popular: false,
    features: [
      'Email campaigns',
      'Customer segmentation',
      'Automation workflows',
      'Analytics & reporting',
      'A/B testing'
    ],
    benefits: [
      'Better marketing ROI',
      'Automated nurturing',
      'Customer insights'
    ],
    pricingModel: 'Mailchimp fees apply'
  },

  // Calendars
  {
    id: 'google-calendar',
    name: 'Google Calendar',
    provider: 'google-calendar',
    category: 'calendar',
    description: 'Sync service appointments and technician schedules',
    longDescription: 'Integrate with Google Calendar for seamless scheduling. Sync technician calendars, appointments, and availability in real-time.',
    icon: Calendar,
    status: 'available',
    featured: false,
    popular: true,
    connections: 234,
    features: [
      'Calendar sync',
      'Appointment scheduling',
      'Availability management',
      'Conflict detection',
      'Mobile calendar access'
    ],
    benefits: [
      'No scheduling conflicts',
      'Mobile access',
      'Automatic reminders'
    ],
    pricingModel: 'Included'
  },
  {
    id: 'microsoft-calendar',
    name: 'Microsoft 365',
    provider: 'microsoft-calendar',
    category: 'calendar',
    description: 'Outlook calendar integration for appointments and schedules',
    longDescription: 'Connect with Microsoft 365 to sync calendars, emails, and contacts. Full integration with Outlook and Teams.',
    icon: Calendar,
    status: 'available',
    featured: false,
    popular: true,
    connections: 176,
    features: [
      'Outlook calendar sync',
      'Email integration',
      'Contact sync',
      'Teams integration',
      'Availability tracking'
    ],
    benefits: [
      'Enterprise-grade security',
      'Full Office 365 integration',
      'Teams collaboration'
    ],
    pricingModel: 'Included'
  },

  // Data Enrichment
  {
    id: 'apollo',
    name: 'Apollo.io',
    provider: 'apollo',
    category: 'data-enrichment',
    description: 'Enrich lead data with company information and contact details',
    longDescription: 'Automatically enrich leads with Apollo.io. Get company information, employee counts, revenue data, and verified contact details.',
    icon: TrendingUp,
    status: 'available',
    featured: false,
    popular: false,
    connections: 45,
    features: [
      'Company data enrichment',
      'Contact discovery',
      'Email verification',
      'Technographic data',
      'Intent signals'
    ],
    benefits: [
      'Better lead qualification',
      'Accurate contact data',
      'Higher conversion rates'
    ],
    pricingModel: 'Apollo credits required'
  },
  {
    id: 'zoominfo',
    name: 'ZoomInfo',
    provider: 'zoominfo',
    category: 'data-enrichment',
    description: 'B2B contact database and intelligence platform',
    longDescription: 'Access ZoomInfo\'s extensive B2B database. Find decision-makers, get direct dials, and enrich your CRM with verified data.',
    icon: Database,
    status: 'available',
    featured: false,
    popular: false,
    connections: 23,
    features: [
      'Contact database access',
      'Direct dial numbers',
      'Email addresses',
      'Org chart mapping',
      'Buying signals'
    ],
    benefits: [
      'Reach decision-makers',
      'Verified contact data',
      'Competitive intelligence'
    ],
    pricingModel: 'ZoomInfo subscription required'
  },

  // Print Management
  {
    id: 'print-audit',
    name: 'Print Audit',
    provider: 'print-audit',
    category: 'print-management',
    description: 'Automated meter reading collection from Print Audit',
    longDescription: 'Connect with Print Audit for automatic meter collection. Sync meter readings, toner levels, and device status in real-time.',
    icon: Package,
    status: 'available',
    featured: false,
    popular: true,
    connections: 134,
    features: [
      'Automatic meter collection',
      'Toner level monitoring',
      'Device status tracking',
      'Usage analytics',
      'Alerts & notifications'
    ],
    benefits: [
      'Eliminate manual meter reads',
      'Proactive supply ordering',
      'Accurate billing'
    ],
    pricingModel: 'Print Audit license required'
  },
  {
    id: 'printfleet',
    name: 'PrintFleet',
    provider: 'printfleet',
    category: 'print-management',
    description: 'Fleet monitoring and meter collection via PrintFleet',
    longDescription: 'Integrate with PrintFleet for comprehensive fleet monitoring. Track meters, supplies, alerts, and device health across your entire fleet.',
    icon: BarChart3,
    status: 'available',
    featured: false,
    popular: true,
    connections: 98,
    features: [
      'Fleet monitoring',
      'Meter collection',
      'Supply level tracking',
      'Alert management',
      'Reporting & analytics'
    ],
    benefits: [
      'Complete fleet visibility',
      'Proactive maintenance',
      'Reduced service costs'
    ],
    pricingModel: 'PrintFleet license required'
  },
  {
    id: 'fmaudit',
    name: 'FM Audit',
    provider: 'fmaudit',
    category: 'print-management',
    description: 'Enterprise print management and meter collection',
    longDescription: 'Connect with FM Audit for enterprise-grade fleet management. Monitor thousands of devices, collect meters, and optimize print infrastructure.',
    icon: Shield,
    status: 'available',
    featured: false,
    popular: false,
    connections: 67,
    features: [
      'Enterprise fleet management',
      'Automated meter collection',
      'Supply forecasting',
      'Cost optimization',
      'Security monitoring'
    ],
    benefits: [
      'Enterprise scalability',
      'Cost reduction insights',
      'Security compliance'
    ],
    pricingModel: 'FM Audit license required'
  }
];

const categories = [
  { id: 'all', name: 'All Integrations', icon: Rocket },
  { id: 'accounting', name: 'Accounting & ERP', icon: DollarSign },
  { id: 'crm', name: 'CRM', icon: Users },
  { id: 'payments', name: 'Payments', icon: DollarSign },
  { id: 'communication', name: 'Communication', icon: MessageSquare },
  { id: 'calendar', name: 'Calendar', icon: Calendar },
  { id: 'data-enrichment', name: 'Data Enrichment', icon: TrendingUp },
  { id: 'print-management', name: 'Print Management', icon: Package },
  { id: 'marketing', name: 'Marketing', icon: Mail }
];

export default function IntegrationMarketplaceDashboard() {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  const filteredIntegrations = integrations.filter((integration) => {
    const matchesSearch =
      integration.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      integration.description.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesCategory =
      selectedCategory === 'all' || integration.category === selectedCategory;

    const matchesStatus =
      statusFilter === 'all' || integration.status === statusFilter;

    return matchesSearch && matchesCategory && matchesStatus;
  });

  const featuredIntegrations = integrations.filter(i => i.featured);
  const popularIntegrations = integrations.filter(i => i.popular && !i.featured).slice(0, 3);

  const stats = {
    total: integrations.length,
    connected: integrations.filter(i => i.status === 'connected').length,
    available: integrations.filter(i => i.status === 'available').length,
    totalConnections: integrations.reduce((sum, i) => sum + (i.connections || 0), 0)
  };

  return (
    <MainLayout
      title="Integration Marketplace"
      description="Connect Printyx with your favorite business tools"
    >
      <div className="container mx-auto p-6 space-y-8">

        {/* Hero Section */}
        <div className="text-center max-w-4xl mx-auto">
          <Badge variant="secondary" className="mb-4">
            <Sparkles className="h-3 w-3 mr-1" />
            {stats.total}+ Integrations Available
          </Badge>
          <h1 className="text-5xl font-bold mb-4">
            Integration Marketplace
          </h1>
          <p className="text-xl text-muted-foreground mb-8">
            Connect Printyx with the tools you already use. Build a powerful, automated workflow
            across your entire business ecosystem.
          </p>

          {/* Search Bar */}
          <div className="flex gap-4 max-w-2xl mx-auto mb-8">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search integrations..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
            <Button variant="outline">
              <Filter className="h-4 w-4 mr-2" />
              Filters
            </Button>
          </div>

          {/* Quick Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            <Card>
              <CardContent className="p-4 text-center">
                <div className="text-3xl font-bold text-blue-600">{stats.total}</div>
                <p className="text-sm text-muted-foreground">Total Integrations</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 text-center">
                <div className="text-3xl font-bold text-green-600">{stats.connected}</div>
                <p className="text-sm text-muted-foreground">Connected</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 text-center">
                <div className="text-3xl font-bold text-purple-600">{stats.available}</div>
                <p className="text-sm text-muted-foreground">Available</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 text-center">
                <div className="text-3xl font-bold text-orange-600">{stats.totalConnections.toLocaleString()}</div>
                <p className="text-sm text-muted-foreground">Active Connections</p>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Featured Integrations */}
        {featuredIntegrations.length > 0 && searchQuery === '' && selectedCategory === 'all' && (
          <div>
            <div className="flex items-center gap-2 mb-4">
              <Star className="h-5 w-5 text-yellow-500 fill-yellow-500" />
              <h2 className="text-2xl font-bold">Featured Integrations</h2>
            </div>
            <div className="grid md:grid-cols-3 gap-6 mb-8">
              {featuredIntegrations.map((integration) => (
                <IntegrationCard key={integration.id} integration={integration} featured />
              ))}
            </div>
          </div>
        )}

        {/* Category Tabs */}
        <Tabs value={selectedCategory} onValueChange={setSelectedCategory}>
          <TabsList className="grid grid-cols-3 md:grid-cols-9 mb-6">
            {categories.map((category) => {
              const Icon = category.icon;
              return (
                <TabsTrigger key={category.id} value={category.id} className="flex items-center gap-2">
                  <Icon className="h-4 w-4" />
                  <span className="hidden md:inline">{category.name}</span>
                  <span className="md:hidden">{category.name.split(' ')[0]}</span>
                </TabsTrigger>
              );
            })}
          </TabsList>

          {/* Results Count */}
          <div className="flex items-center justify-between mb-4">
            <p className="text-sm text-muted-foreground">
              Showing {filteredIntegrations.length} integration{filteredIntegrations.length !== 1 ? 's' : ''}
            </p>
            <div className="flex gap-2">
              <Button
                variant={statusFilter === 'all' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setStatusFilter('all')}
              >
                All
              </Button>
              <Button
                variant={statusFilter === 'connected' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setStatusFilter('connected')}
              >
                Connected
              </Button>
              <Button
                variant={statusFilter === 'available' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setStatusFilter('available')}
              >
                Available
              </Button>
            </div>
          </div>

          {/* Integration Grid */}
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredIntegrations.map((integration) => (
              <IntegrationCard key={integration.id} integration={integration} />
            ))}
          </div>

          {/* Empty State */}
          {filteredIntegrations.length === 0 && (
            <div className="text-center py-12">
              <Package className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">No integrations found</h3>
              <p className="text-muted-foreground mb-4">
                Try adjusting your search or filters
              </p>
              <Button onClick={() => { setSearchQuery(''); setSelectedCategory('all'); setStatusFilter('all'); }}>
                Clear Filters
              </Button>
            </div>
          )}
        </Tabs>

        {/* CTA Section */}
        <Card className="bg-gradient-to-r from-blue-600 to-purple-600 text-white border-0">
          <CardContent className="p-8 text-center">
            <h2 className="text-3xl font-bold mb-4">Need a Custom Integration?</h2>
            <p className="text-lg mb-6 text-white/90">
              We can build custom integrations to connect Printyx with your proprietary systems
              or industry-specific tools.
            </p>
            <div className="flex justify-center gap-4">
              <Button size="lg" variant="secondary">
                <MessageSquare className="mr-2 h-5 w-5" />
                Contact Sales
              </Button>
              <Button size="lg" variant="outline" className="text-white border-white hover:bg-white/20">
                <ExternalLink className="mr-2 h-5 w-5" />
                API Documentation
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  );
}

function IntegrationCard({ integration, featured = false }: { integration: Integration; featured?: boolean }) {
  const Icon = integration.icon;
  const statusColors = {
    connected: 'text-green-600 bg-green-50 border-green-200',
    available: 'text-blue-600 bg-blue-50 border-blue-200',
    'coming-soon': 'text-gray-600 bg-gray-50 border-gray-200'
  };

  const statusIcons = {
    connected: CheckCircle2,
    available: Circle,
    'coming-soon': Clock
  };

  const StatusIcon = statusIcons[integration.status];

  return (
    <Card className={`group hover:shadow-lg transition-all ${featured ? 'border-yellow-200' : ''}`}>
      <CardHeader>
        <div className="flex items-start justify-between">
          <div className="p-3 bg-blue-50 rounded-lg group-hover:bg-blue-100 transition-colors">
            <Icon className="h-6 w-6 text-blue-600" />
          </div>
          <div className="flex flex-col items-end gap-2">
            <Badge className={statusColors[integration.status]}>
              <StatusIcon className="h-3 w-3 mr-1" />
              {integration.status === 'connected' ? 'Connected' :
               integration.status === 'available' ? 'Available' : 'Coming Soon'}
            </Badge>
            {integration.popular && (
              <Badge variant="secondary">
                <TrendingUp className="h-3 w-3 mr-1" />
                Popular
              </Badge>
            )}
          </div>
        </div>
        <CardTitle className="mt-4">{integration.name}</CardTitle>
        <CardDescription>{integration.description}</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {integration.connections && (
            <div className="flex items-center text-sm text-muted-foreground">
              <Users className="h-4 w-4 mr-2" />
              {integration.connections.toLocaleString()} active connections
            </div>
          )}

          {integration.features && integration.features.length > 0 && (
            <div>
              <p className="text-sm font-semibold mb-2">Key Features:</p>
              <ul className="space-y-1">
                {integration.features.slice(0, 3).map((feature, index) => (
                  <li key={index} className="flex items-start text-sm text-muted-foreground">
                    <CheckCircle2 className="h-4 w-4 mr-2 text-green-600 flex-shrink-0 mt-0.5" />
                    {feature}
                  </li>
                ))}
              </ul>
              {integration.features.length > 3 && (
                <p className="text-sm text-muted-foreground mt-2">
                  +{integration.features.length - 3} more features
                </p>
              )}
            </div>
          )}
        </div>
      </CardContent>
      <CardFooter className="flex gap-2">
        {integration.status === 'connected' ? (
          <>
            <Button variant="outline" className="flex-1">
              <Settings className="h-4 w-4 mr-2" />
              Configure
            </Button>
            <Button variant="ghost" size="icon">
              <ExternalLink className="h-4 w-4" />
            </Button>
          </>
        ) : integration.status === 'available' ? (
          <>
            <Button className="flex-1">
              <Zap className="h-4 w-4 mr-2" />
              Connect
            </Button>
            <Button variant="ghost" size="icon">
              <ChevronRight className="h-4 w-4" />
            </Button>
          </>
        ) : (
          <Button variant="outline" className="flex-1" disabled>
            <Clock className="h-4 w-4 mr-2" />
            Coming Soon
          </Button>
        )}
      </CardFooter>
    </Card>
  );
}
