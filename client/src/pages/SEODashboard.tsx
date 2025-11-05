import React, { useState } from 'react';
import { MainLayout } from '@/components/layout/main-layout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';
import {
  BarChart3,
  Search,
  TrendingUp,
  AlertCircle,
  CheckCircle,
  Globe,
  FileText,
  Image,
  Link as LinkIcon,
  Shield,
  Smartphone,
  Zap,
  Target,
  Users,
  Settings,
  Code,
  Layout,
  Activity,
  Database,
  Eye,
  BrainCircuit,
  ListChecks,
  ExternalLink,
} from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface SeoSettings {
  id?: string;
  siteUrl: string;
  siteName?: string;
  defaultTitle?: string;
  defaultDescription?: string;
  defaultKeywords?: string;
  robotsTxt?: string;
  llmsTxt?: string;
  sitemapUrl?: string;
  monitoringEnabled?: boolean;
  monitoringFrequency?: string;
}

interface AuditResult {
  id: string;
  url: string;
  status: string;
  overallScore?: number;
  technicalScore?: number;
  contentScore?: number;
  performanceScore?: number;
  criticalIssues?: number;
  highIssues?: number;
  mediumIssues?: number;
  lowIssues?: number;
  issues?: Array<{
    category: string;
    severity: string;
    message: string;
    fix?: string;
  }>;
  recommendations?: string[];
  createdAt: string;
}

interface Keyword {
  id: string;
  keyword: string;
  targetUrl?: string;
  currentPosition?: number;
  targetPosition?: number;
  searchVolume?: number;
  difficulty?: number;
  impressions?: number;
  clicks?: number;
  ctr?: number;
  isActive: boolean;
  priority: number;
}

export default function SEODashboard() {
  const [activeTab, setActiveTab] = useState('audit');
  const [auditUrl, setAuditUrl] = useState('');
  const [crawlUrl, setCrawlUrl] = useState('');
  const [isRunningAudit, setIsRunningAudit] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch SEO settings
  const { data: settings } = useQuery<SeoSettings>({
    queryKey: ['/api/seo/settings'],
  });

  // Fetch audit history
  const { data: auditHistory = [] } = useQuery<AuditResult[]>({
    queryKey: ['/api/seo/audit/history'],
  });

  // Fetch keywords
  const { data: keywords = [] } = useQuery<Keyword[]>({
    queryKey: ['/api/seo/keywords'],
  });

  // Run audit mutation
  const runAuditMutation = useMutation({
    mutationFn: async (url: string) => {
      const response = await fetch('/api/seo/audit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ url }),
      });
      if (!response.ok) throw new Error('Failed to run audit');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/seo/audit/history'] });
      toast({
        title: 'Audit completed',
        description: 'SEO audit has been completed successfully.',
      });
      setIsRunningAudit(false);
    },
    onError: (error: any) => {
      toast({
        title: 'Audit failed',
        description: error.message,
        variant: 'destructive',
      });
      setIsRunningAudit(false);
    },
  });

  // Save settings mutation
  const saveSettingsMutation = useMutation({
    mutationFn: async (data: SeoSettings) => {
      const response = await fetch('/api/seo/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(data),
      });
      if (!response.ok) throw new Error('Failed to save settings');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/seo/settings'] });
      toast({
        title: 'Settings saved',
        description: 'SEO settings have been saved successfully.',
      });
    },
  });

  const handleRunAudit = () => {
    if (!auditUrl) {
      toast({
        title: 'URL required',
        description: 'Please enter a URL to audit.',
        variant: 'destructive',
      });
      return;
    }
    setIsRunningAudit(true);
    runAuditMutation.mutate(auditUrl);
  };

  const latestAudit = auditHistory[0];

  return (
    <MainLayout
      title="SEO Management"
      description="Comprehensive SEO analysis, monitoring, and optimization tools"
    >
      <div className="container mx-auto p-6 space-y-6">
        {/* KPI Summary */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Overall Score</CardTitle>
              <BarChart3 className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{latestAudit?.overallScore || '-'}/100</div>
              <p className="text-xs text-muted-foreground">
                {latestAudit ? 'Latest audit' : 'No audits yet'}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Keywords Tracked</CardTitle>
              <Target className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{keywords.length}</div>
              <p className="text-xs text-muted-foreground">
                {keywords.filter((k) => k.isActive).length} active
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Critical Issues</CardTitle>
              <AlertCircle className="h-4 w-4 text-red-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{latestAudit?.criticalIssues || 0}</div>
              <p className="text-xs text-muted-foreground">Requires attention</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Performance</CardTitle>
              <Zap className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {latestAudit?.performanceScore || '-'}/100
              </div>
              <p className="text-xs text-muted-foreground">Core Web Vitals</p>
            </CardContent>
          </Card>
        </div>

        {/* Main Tabs */}
        <Card>
          <CardHeader>
            <CardTitle>SEO Management Tools</CardTitle>
            <CardDescription>
              Comprehensive SEO analysis and optimization across 22 specialized areas
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
              <ScrollArea className="w-full whitespace-nowrap">
                <TabsList className="inline-flex h-auto flex-wrap">
                  <TabsTrigger value="audit" className="gap-2">
                    <CheckCircle className="h-4 w-4" />
                    Audit
                  </TabsTrigger>
                  <TabsTrigger value="keywords" className="gap-2">
                    <Target className="h-4 w-4" />
                    Keywords
                  </TabsTrigger>
                  <TabsTrigger value="competitors" className="gap-2">
                    <Users className="h-4 w-4" />
                    Competitors
                  </TabsTrigger>
                  <TabsTrigger value="pages" className="gap-2">
                    <FileText className="h-4 w-4" />
                    Pages
                  </TabsTrigger>
                  <TabsTrigger value="monitoring" className="gap-2">
                    <Activity className="h-4 w-4" />
                    Monitoring
                  </TabsTrigger>
                  <TabsTrigger value="meta" className="gap-2">
                    <Code className="h-4 w-4" />
                    Meta Tags
                  </TabsTrigger>
                  <TabsTrigger value="robots" className="gap-2">
                    <FileText className="h-4 w-4" />
                    robots.txt
                  </TabsTrigger>
                  <TabsTrigger value="sitemap" className="gap-2">
                    <Layout className="h-4 w-4" />
                    Sitemap
                  </TabsTrigger>
                  <TabsTrigger value="llms" className="gap-2">
                    <BrainCircuit className="h-4 w-4" />
                    llms.txt
                  </TabsTrigger>
                  <TabsTrigger value="structured" className="gap-2">
                    <Database className="h-4 w-4" />
                    Structured Data
                  </TabsTrigger>
                  <TabsTrigger value="performance" className="gap-2">
                    <Zap className="h-4 w-4" />
                    Performance
                  </TabsTrigger>
                  <TabsTrigger value="crawler" className="gap-2">
                    <Globe className="h-4 w-4" />
                    Site Crawler
                  </TabsTrigger>
                  <TabsTrigger value="images" className="gap-2">
                    <Image className="h-4 w-4" />
                    Images
                  </TabsTrigger>
                  <TabsTrigger value="links" className="gap-2">
                    <LinkIcon className="h-4 w-4" />
                    Links
                  </TabsTrigger>
                  <TabsTrigger value="broken" className="gap-2">
                    <AlertCircle className="h-4 w-4" />
                    Broken Links
                  </TabsTrigger>
                  <TabsTrigger value="redirects" className="gap-2">
                    <ExternalLink className="h-4 w-4" />
                    Redirects
                  </TabsTrigger>
                  <TabsTrigger value="duplicate" className="gap-2">
                    <ListChecks className="h-4 w-4" />
                    Duplicate Content
                  </TabsTrigger>
                  <TabsTrigger value="security" className="gap-2">
                    <Shield className="h-4 w-4" />
                    Security
                  </TabsTrigger>
                  <TabsTrigger value="mobile" className="gap-2">
                    <Smartphone className="h-4 w-4" />
                    Mobile
                  </TabsTrigger>
                  <TabsTrigger value="content" className="gap-2">
                    <FileText className="h-4 w-4" />
                    Content
                  </TabsTrigger>
                  <TabsTrigger value="semantic" className="gap-2">
                    <BrainCircuit className="h-4 w-4" />
                    Semantic
                  </TabsTrigger>
                  <TabsTrigger value="settings" className="gap-2">
                    <Settings className="h-4 w-4" />
                    Settings
                  </TabsTrigger>
                </TabsList>
              </ScrollArea>

              {/* Audit Tab */}
              <TabsContent value="audit" className="space-y-4 mt-4">
                <Card>
                  <CardHeader>
                    <CardTitle>Run SEO Audit</CardTitle>
                    <CardDescription>
                      Perform a comprehensive SEO audit of any URL
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex gap-2">
                      <Input
                        placeholder="https://example.com"
                        value={auditUrl}
                        onChange={(e) => setAuditUrl(e.target.value)}
                        className="flex-1"
                      />
                      <Button onClick={handleRunAudit} disabled={isRunningAudit}>
                        {isRunningAudit ? 'Running...' : 'Run Audit'}
                      </Button>
                    </div>

                    {latestAudit && (
                      <div className="space-y-4">
                        <Separator />
                        <div>
                          <h3 className="font-semibold mb-2">Latest Audit Results</h3>
                          <p className="text-sm text-muted-foreground mb-4">
                            {latestAudit.url} -{' '}
                            {new Date(latestAudit.createdAt).toLocaleString()}
                          </p>
                          <div className="grid grid-cols-4 gap-4 mb-4">
                            <div>
                              <Label>Overall</Label>
                              <div className="flex items-center gap-2">
                                <Progress value={latestAudit.overallScore} className="flex-1" />
                                <span className="text-sm font-medium">
                                  {latestAudit.overallScore}
                                </span>
                              </div>
                            </div>
                            <div>
                              <Label>Technical</Label>
                              <div className="flex items-center gap-2">
                                <Progress value={latestAudit.technicalScore} className="flex-1" />
                                <span className="text-sm font-medium">
                                  {latestAudit.technicalScore}
                                </span>
                              </div>
                            </div>
                            <div>
                              <Label>Content</Label>
                              <div className="flex items-center gap-2">
                                <Progress value={latestAudit.contentScore} className="flex-1" />
                                <span className="text-sm font-medium">
                                  {latestAudit.contentScore}
                                </span>
                              </div>
                            </div>
                            <div>
                              <Label>Performance</Label>
                              <div className="flex items-center gap-2">
                                <Progress value={latestAudit.performanceScore} className="flex-1" />
                                <span className="text-sm font-medium">
                                  {latestAudit.performanceScore}
                                </span>
                              </div>
                            </div>
                          </div>

                          <div className="grid grid-cols-4 gap-2 mb-4">
                            <Badge variant="destructive">
                              {latestAudit.criticalIssues} Critical
                            </Badge>
                            <Badge className="bg-orange-100 text-orange-800">
                              {latestAudit.highIssues} High
                            </Badge>
                            <Badge variant="secondary">{latestAudit.mediumIssues} Medium</Badge>
                            <Badge variant="outline">{latestAudit.lowIssues} Low</Badge>
                          </div>

                          {latestAudit.issues && latestAudit.issues.length > 0 && (
                            <div>
                              <h4 className="font-medium mb-2">Issues Found</h4>
                              <ScrollArea className="h-48">
                                <div className="space-y-2">
                                  {latestAudit.issues.map((issue, idx) => (
                                    <Card key={idx}>
                                      <CardContent className="p-3">
                                        <div className="flex items-start gap-2">
                                          <Badge
                                            variant={
                                              issue.severity === 'critical'
                                                ? 'destructive'
                                                : issue.severity === 'high'
                                                  ? 'default'
                                                  : 'secondary'
                                            }
                                          >
                                            {issue.severity}
                                          </Badge>
                                          <div className="flex-1">
                                            <p className="text-sm font-medium">{issue.category}</p>
                                            <p className="text-sm text-muted-foreground">
                                              {issue.message}
                                            </p>
                                            {issue.fix && (
                                              <p className="text-sm text-green-600 mt-1">
                                                Fix: {issue.fix}
                                              </p>
                                            )}
                                          </div>
                                        </div>
                                      </CardContent>
                                    </Card>
                                  ))}
                                </div>
                              </ScrollArea>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Keywords Tab */}
              <TabsContent value="keywords" className="space-y-4 mt-4">
                <Card>
                  <CardHeader>
                    <CardTitle>Keyword Tracking</CardTitle>
                    <CardDescription>Track and monitor keyword rankings</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      {keywords.length === 0 ? (
                        <p className="text-sm text-muted-foreground">
                          No keywords tracked yet. Add keywords to start monitoring rankings.
                        </p>
                      ) : (
                        <ScrollArea className="h-96">
                          {keywords.map((keyword) => (
                            <Card key={keyword.id} className="mb-2">
                              <CardContent className="p-4">
                                <div className="flex justify-between items-center">
                                  <div className="flex-1">
                                    <p className="font-medium">{keyword.keyword}</p>
                                    <p className="text-sm text-muted-foreground">
                                      {keyword.targetUrl}
                                    </p>
                                  </div>
                                  <div className="flex gap-4">
                                    <div className="text-center">
                                      <Label className="text-xs">Position</Label>
                                      <p className="text-lg font-bold">
                                        {keyword.currentPosition || '-'}
                                      </p>
                                    </div>
                                    <div className="text-center">
                                      <Label className="text-xs">Volume</Label>
                                      <p className="text-sm">{keyword.searchVolume || '-'}</p>
                                    </div>
                                    <div className="text-center">
                                      <Label className="text-xs">CTR</Label>
                                      <p className="text-sm">{keyword.ctr || '-'}%</p>
                                    </div>
                                  </div>
                                </div>
                              </CardContent>
                            </Card>
                          ))}
                        </ScrollArea>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Settings Tab */}
              <TabsContent value="settings" className="space-y-4 mt-4">
                <Card>
                  <CardHeader>
                    <CardTitle>SEO Settings</CardTitle>
                    <CardDescription>Configure global SEO settings for your site</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="siteUrl">Site URL</Label>
                        <Input
                          id="siteUrl"
                          placeholder="https://example.com"
                          defaultValue={settings?.siteUrl}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="siteName">Site Name</Label>
                        <Input
                          id="siteName"
                          placeholder="My Website"
                          defaultValue={settings?.siteName}
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="defaultTitle">Default Title</Label>
                      <Input
                        id="defaultTitle"
                        placeholder="Default page title"
                        defaultValue={settings?.defaultTitle}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="defaultDescription">Default Meta Description</Label>
                      <Textarea
                        id="defaultDescription"
                        placeholder="Default meta description for pages"
                        rows={3}
                        defaultValue={settings?.defaultDescription}
                      />
                    </div>

                    <div className="flex items-center justify-between">
                      <div className="space-y-0.5">
                        <Label>Automated Monitoring</Label>
                        <p className="text-sm text-muted-foreground">
                          Enable automated SEO monitoring
                        </p>
                      </div>
                      <Switch defaultChecked={settings?.monitoringEnabled} />
                    </div>

                    <Button>Save Settings</Button>
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Placeholder tabs for remaining 19 tabs */}
              {[
                'competitors',
                'pages',
                'monitoring',
                'meta',
                'robots',
                'sitemap',
                'llms',
                'structured',
                'performance',
                'crawler',
                'images',
                'links',
                'broken',
                'redirects',
                'duplicate',
                'security',
                'mobile',
                'content',
                'semantic',
              ].map((tab) => (
                <TabsContent key={tab} value={tab} className="space-y-4 mt-4">
                  <Card>
                    <CardHeader>
                      <CardTitle className="capitalize">{tab} Analysis</CardTitle>
                      <CardDescription>
                        {tab.charAt(0).toUpperCase() + tab.slice(1)} SEO analysis and optimization
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <p className="text-sm text-muted-foreground">
                        {tab.charAt(0).toUpperCase() + tab.slice(1)} features coming soon...
                      </p>
                    </CardContent>
                  </Card>
                </TabsContent>
              ))}
            </Tabs>
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  );
}
