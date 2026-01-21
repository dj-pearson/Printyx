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

interface Competitor {
  id: string;
  domain: string;
  overallScore?: number;
  organicKeywords?: number;
  monthlyTraffic?: number;
  domainAuthority?: number;
  backlinks?: number;
  isActive: boolean;
}

interface PageScore {
  id: string;
  url: string;
  technicalScore?: number;
  contentScore?: number;
  performanceScore?: number;
  mobileScore?: number;
  lastChecked?: string;
}

interface Alert {
  id: string;
  type: string;
  severity: string;
  message: string;
  status: string;
  createdAt: string;
  resolvedAt?: string;
}

interface CrawlResult {
  id: string;
  url: string;
  statusCode: number;
  title?: string;
  metaDescription?: string;
  h1?: string;
  wordCount?: number;
  linksCount?: number;
  crawledAt: string;
}

interface ImageAnalysis {
  src: string;
  alt?: string;
  hasAltText: boolean;
  isOptimized: boolean;
  fileSize?: number;
  dimensions?: { width: number; height: number };
}

interface LinkAnalysis {
  url: string;
  text: string;
  type: 'internal' | 'external';
  isNofollow: boolean;
  statusCode?: number;
}

interface BrokenLink {
  url: string;
  statusCode: number;
  sourcePages: string[];
  recommendation: string;
}

interface RedirectChain {
  url: string;
  redirects: Array<{ from: string; to: string; statusCode: number }>;
  finalUrl: string;
  redirectCount: number;
}

interface DuplicateContent {
  url1: string;
  url2: string;
  similarityScore: number;
  duplicatedSections: string[];
}

interface SecurityAnalysis {
  url: string;
  https: boolean;
  hsts: boolean;
  csp: boolean;
  xFrameOptions: boolean;
  securityScore: number;
  recommendations: string[];
}

interface MobileAnalysis {
  url: string;
  hasViewport: boolean;
  isMobileFriendly: boolean;
  touchElementsSize: boolean;
  textReadability: boolean;
  mobileScore: number;
}

export default function SEODashboard() {
  const [activeTab, setActiveTab] = useState('audit');
  const [auditUrl, setAuditUrl] = useState('');
  const [crawlUrl, setCrawlUrl] = useState('');
  const [isRunningAudit, setIsRunningAudit] = useState(false);
  const [isRunningCrawl, setIsRunningCrawl] = useState(false);
  const [maxPages, setMaxPages] = useState('50');
  const [maxDepth, setMaxDepth] = useState('2');
  const [analyzeUrl, setAnalyzeUrl] = useState('');
  const [robotsTxtContent, setRobotsTxtContent] = useState('');
  const [llmsTxtContent, setLlmsTxtContent] = useState('');
  const [performanceDevice, setPerformanceDevice] = useState('mobile');

  // Analysis results state
  const [imageAnalysisResults, setImageAnalysisResults] = useState<ImageAnalysis[]>([]);
  const [linkAnalysisResults, setLinkAnalysisResults] = useState<LinkAnalysis[]>([]);
  const [brokenLinksResults, setBrokenLinksResults] = useState<BrokenLink[]>([]);
  const [redirectResults, setRedirectResults] = useState<RedirectChain[]>([]);
  const [duplicateContentResults, setDuplicateContentResults] = useState<DuplicateContent[]>([]);
  const [securityResults, setSecurityResults] = useState<SecurityAnalysis | null>(null);
  const [mobileResults, setMobileResults] = useState<MobileAnalysis | null>(null);
  const [performanceResults, setPerformanceResults] = useState<any>(null);
  const [structuredDataResults, setStructuredDataResults] = useState<any>(null);
  const [contentResults, setContentResults] = useState<any>(null);
  const [semanticResults, setSemanticResults] = useState<any>(null);

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

  // Fetch competitors
  const { data: competitors = [] } = useQuery<Competitor[]>({
    queryKey: ['/api/seo/competitors'],
  });

  // Fetch page scores
  const { data: pageScores = [] } = useQuery<PageScore[]>({
    queryKey: ['/api/seo/pages'],
  });

  // Fetch alerts
  const { data: alerts = [] } = useQuery<Alert[]>({
    queryKey: ['/api/seo/alerts'],
  });

  // Fetch crawl results
  const { data: crawlResults = [] } = useQuery<CrawlResult[]>({
    queryKey: ['/api/seo/crawl/results'],
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

  // Crawl website mutation
  const crawlMutation = useMutation({
    mutationFn: async (params: { url: string; maxPages: number; maxDepth: number }) => {
      const response = await fetch('/api/seo/crawl', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          startUrl: params.url,
          maxPages: params.maxPages,
          maxDepth: params.maxDepth,
        }),
      });
      if (!response.ok) throw new Error('Failed to crawl website');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/seo/crawl/results'] });
      toast({ title: 'Crawl completed', description: 'Website crawl completed successfully.' });
      setIsRunningCrawl(false);
    },
    onError: (error: any) => {
      toast({ title: 'Crawl failed', description: error.message, variant: 'destructive' });
      setIsRunningCrawl(false);
    },
  });

  // Save robots.txt mutation
  const saveRobotsMutation = useMutation({
    mutationFn: async (content: string) => {
      const response = await fetch('/api/seo/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ robotsTxt: content }),
      });
      if (!response.ok) throw new Error('Failed to save robots.txt');
      return response.json();
    },
    onSuccess: () => {
      toast({ title: 'Saved', description: 'robots.txt saved successfully.' });
    },
  });

  // Save llms.txt mutation
  const saveLlmsMutation = useMutation({
    mutationFn: async (content: string) => {
      const response = await fetch('/api/seo/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ llmsTxt: content }),
      });
      if (!response.ok) throw new Error('Failed to save llms.txt');
      return response.json();
    },
    onSuccess: () => {
      toast({ title: 'Saved', description: 'llms.txt saved successfully.' });
    },
  });

  // Image analysis mutation
  const analyzeImagesMutation = useMutation({
    mutationFn: async (url: string) => {
      const response = await fetch('/api/seo/images/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ url }),
      });
      if (!response.ok) throw new Error('Failed to analyze images');
      return response.json();
    },
    onSuccess: (data) => {
      setImageAnalysisResults(data.images || []);
      toast({
        title: 'Analysis complete',
        description: `Found ${data.images?.length || 0} images`,
      });
    },
  });

  // Links analysis mutation
  const analyzeLinksMutation = useMutation({
    mutationFn: async (url: string) => {
      const response = await fetch('/api/seo/links/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ url }),
      });
      if (!response.ok) throw new Error('Failed to analyze links');
      return response.json();
    },
    onSuccess: (data) => {
      setLinkAnalysisResults(data.links || []);
      toast({ title: 'Analysis complete', description: `Found ${data.links?.length || 0} links` });
    },
  });

  // Broken links check mutation
  const checkBrokenLinksMutation = useMutation({
    mutationFn: async (url: string) => {
      const response = await fetch('/api/seo/links/broken', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ url }),
      });
      if (!response.ok) throw new Error('Failed to check broken links');
      return response.json();
    },
    onSuccess: (data) => {
      setBrokenLinksResults(data.brokenLinks || []);
      toast({
        title: 'Check complete',
        description: `Found ${data.brokenLinks?.length || 0} broken links`,
      });
    },
  });

  // Redirect check mutation
  const checkRedirectsMutation = useMutation({
    mutationFn: async (url: string) => {
      const response = await fetch('/api/seo/redirects/check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ url }),
      });
      if (!response.ok) throw new Error('Failed to check redirects');
      return response.json();
    },
    onSuccess: (data) => {
      setRedirectResults(data.chains || []);
      toast({
        title: 'Check complete',
        description: `Found ${data.chains?.length || 0} redirect chains`,
      });
    },
  });

  // Duplicate content scan mutation
  const scanDuplicatesMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch('/api/seo/content/duplicates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
      });
      if (!response.ok) throw new Error('Failed to scan for duplicates');
      return response.json();
    },
    onSuccess: (data) => {
      setDuplicateContentResults(data.duplicates || []);
      toast({
        title: 'Scan complete',
        description: `Found ${data.duplicates?.length || 0} duplicate pairs`,
      });
    },
  });

  // Security analysis mutation
  const analyzeSecurityMutation = useMutation({
    mutationFn: async (url: string) => {
      const response = await fetch('/api/seo/security/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ url }),
      });
      if (!response.ok) throw new Error('Failed to analyze security');
      return response.json();
    },
    onSuccess: (data) => {
      setSecurityResults(data);
      toast({
        title: 'Analysis complete',
        description: `Security score: ${data.securityScore}/100`,
      });
    },
  });

  // Mobile analysis mutation
  const analyzeMobileMutation = useMutation({
    mutationFn: async (url: string) => {
      const response = await fetch('/api/seo/mobile/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ url }),
      });
      if (!response.ok) throw new Error('Failed to analyze mobile-friendliness');
      return response.json();
    },
    onSuccess: (data) => {
      setMobileResults(data);
      toast({ title: 'Analysis complete', description: `Mobile score: ${data.mobileScore}/100` });
    },
  });

  // Performance check mutation
  const checkPerformanceMutation = useMutation({
    mutationFn: async (params: { url: string; device: string }) => {
      const response = await fetch('/api/seo/performance/check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ url: params.url, device: params.device }),
      });
      if (!response.ok) throw new Error('Failed to check performance');
      return response.json();
    },
    onSuccess: (data) => {
      setPerformanceResults(data);
      toast({
        title: 'Check complete',
        description: `Performance score: ${data.performanceScore}/100`,
      });
    },
  });

  // Structured data validation mutation
  const validateStructuredDataMutation = useMutation({
    mutationFn: async (url: string) => {
      const response = await fetch('/api/seo/structured-data/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ url }),
      });
      if (!response.ok) throw new Error('Failed to validate structured data');
      return response.json();
    },
    onSuccess: (data) => {
      setStructuredDataResults(data);
      toast({
        title: 'Validation complete',
        description: `Found ${data.schemas?.length || 0} schemas`,
      });
    },
  });

  // Content optimization mutation
  const optimizeContentMutation = useMutation({
    mutationFn: async (url: string) => {
      const response = await fetch('/api/seo/content/optimize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ url }),
      });
      if (!response.ok) throw new Error('Failed to analyze content');
      return response.json();
    },
    onSuccess: (data) => {
      setContentResults(data);
      toast({ title: 'Analysis complete', description: 'Content optimization suggestions ready' });
    },
  });

  // Semantic analysis mutation
  const analyzeSemanticMutation = useMutation({
    mutationFn: async (keyword: string) => {
      const response = await fetch('/api/seo/semantic/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ keyword }),
      });
      if (!response.ok) throw new Error('Failed to analyze semantic keywords');
      return response.json();
    },
    onSuccess: (data) => {
      setSemanticResults(data);
      toast({
        title: 'Analysis complete',
        description: `Found ${data.relatedKeywords?.length || 0} related keywords`,
      });
    },
  });

  // Sitemap generation mutation
  const generateSitemapMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch('/api/seo/sitemap/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
      });
      if (!response.ok) throw new Error('Failed to generate sitemap');
      return response.json();
    },
    onSuccess: (data) => {
      toast({
        title: 'Sitemap generated',
        description: `Generated sitemap with ${data.pageCount || 0} pages`,
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

  const handleRunCrawl = () => {
    if (!crawlUrl) {
      toast({
        title: 'URL required',
        description: 'Please enter a URL to crawl.',
        variant: 'destructive',
      });
      return;
    }
    setIsRunningCrawl(true);
    crawlMutation.mutate({
      url: crawlUrl,
      maxPages: parseInt(maxPages) || 50,
      maxDepth: parseInt(maxDepth) || 2,
    });
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
              <div className="text-2xl font-bold">{latestAudit?.performanceScore || '-'}/100</div>
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
                    <CardDescription>Perform a comprehensive SEO audit of any URL</CardDescription>
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
                            {latestAudit.url} - {new Date(latestAudit.createdAt).toLocaleString()}
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

              {/* Competitors Tab */}
              <TabsContent value="competitors" className="space-y-4 mt-4">
                <Card>
                  <CardHeader>
                    <CardTitle>Competitor Analysis</CardTitle>
                    <CardDescription>Track and analyze competitor SEO performance</CardDescription>
                  </CardHeader>
                  <CardContent>
                    {competitors.length === 0 ? (
                      <p className="text-sm text-muted-foreground">
                        No competitors added yet. Add competitor domains to track their SEO
                        performance.
                      </p>
                    ) : (
                      <div className="space-y-2">
                        {competitors.map((competitor) => (
                          <Card key={competitor.id}>
                            <CardContent className="p-4">
                              <div className="flex justify-between items-center">
                                <div>
                                  <p className="font-medium">{competitor.domain}</p>
                                  <div className="flex gap-4 mt-2 text-sm text-muted-foreground">
                                    <span>Score: {competitor.overallScore || '-'}</span>
                                    <span>Keywords: {competitor.organicKeywords || '-'}</span>
                                    <span>DA: {competitor.domainAuthority || '-'}</span>
                                  </div>
                                </div>
                                <Badge variant={competitor.isActive ? 'default' : 'secondary'}>
                                  {competitor.isActive ? 'Active' : 'Inactive'}
                                </Badge>
                              </div>
                            </CardContent>
                          </Card>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Pages Tab */}
              <TabsContent value="pages" className="space-y-4 mt-4">
                <Card>
                  <CardHeader>
                    <CardTitle>Page Scores</CardTitle>
                    <CardDescription>SEO scores for individual pages on your site</CardDescription>
                  </CardHeader>
                  <CardContent>
                    {pageScores.length === 0 ? (
                      <p className="text-sm text-muted-foreground">
                        No pages analyzed yet. Run an audit or crawl to see page scores.
                      </p>
                    ) : (
                      <ScrollArea className="h-96">
                        {pageScores.map((page) => (
                          <Card key={page.id} className="mb-2">
                            <CardContent className="p-4">
                              <p className="font-medium text-sm mb-2">{page.url}</p>
                              <div className="grid grid-cols-4 gap-2">
                                <div>
                                  <Label className="text-xs">Technical</Label>
                                  <Progress value={page.technicalScore} className="h-2" />
                                  <span className="text-xs">{page.technicalScore}</span>
                                </div>
                                <div>
                                  <Label className="text-xs">Content</Label>
                                  <Progress value={page.contentScore} className="h-2" />
                                  <span className="text-xs">{page.contentScore}</span>
                                </div>
                                <div>
                                  <Label className="text-xs">Performance</Label>
                                  <Progress value={page.performanceScore} className="h-2" />
                                  <span className="text-xs">{page.performanceScore}</span>
                                </div>
                                <div>
                                  <Label className="text-xs">Mobile</Label>
                                  <Progress value={page.mobileScore} className="h-2" />
                                  <span className="text-xs">{page.mobileScore}</span>
                                </div>
                              </div>
                            </CardContent>
                          </Card>
                        ))}
                      </ScrollArea>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Monitoring Tab */}
              <TabsContent value="monitoring" className="space-y-4 mt-4">
                <Card>
                  <CardHeader>
                    <CardTitle>SEO Monitoring & Alerts</CardTitle>
                    <CardDescription>Monitor SEO metrics and receive alerts</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <Label>Automated Monitoring</Label>
                          <p className="text-sm text-muted-foreground">
                            Automatically check SEO metrics on a schedule
                          </p>
                        </div>
                        <Switch defaultChecked={settings?.monitoringEnabled} />
                      </div>
                      <Separator />
                      <div>
                        <h4 className="font-medium mb-2">Recent Alerts</h4>
                        {alerts.length === 0 ? (
                          <p className="text-sm text-muted-foreground">No alerts</p>
                        ) : (
                          <ScrollArea className="h-64">
                            {alerts.map((alert) => (
                              <Card key={alert.id} className="mb-2">
                                <CardContent className="p-3">
                                  <div className="flex items-start gap-2">
                                    <Badge
                                      variant={
                                        alert.severity === 'critical'
                                          ? 'destructive'
                                          : alert.severity === 'high'
                                            ? 'default'
                                            : 'secondary'
                                      }
                                    >
                                      {alert.severity}
                                    </Badge>
                                    <div className="flex-1">
                                      <p className="text-sm font-medium">{alert.type}</p>
                                      <p className="text-sm text-muted-foreground">
                                        {alert.message}
                                      </p>
                                      <p className="text-xs text-muted-foreground mt-1">
                                        {new Date(alert.createdAt).toLocaleString()}
                                      </p>
                                    </div>
                                    {alert.status === 'resolved' && (
                                      <CheckCircle className="h-4 w-4 text-green-500" />
                                    )}
                                  </div>
                                </CardContent>
                              </Card>
                            ))}
                          </ScrollArea>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Meta Tags Tab */}
              <TabsContent value="meta" className="space-y-4 mt-4">
                <Card>
                  <CardHeader>
                    <CardTitle>Meta Tags Configuration</CardTitle>
                    <CardDescription>Configure default meta tags for your site</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="metaTitle">Default Title Template</Label>
                      <Input
                        id="metaTitle"
                        placeholder="%s | Site Name"
                        defaultValue={settings?.defaultTitle}
                        onChange={(e) => {
                          if (settings) {
                            settings.defaultTitle = e.target.value;
                          }
                        }}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="metaDescription">Default Meta Description</Label>
                      <Textarea
                        id="metaDescription"
                        placeholder="Default description for pages without custom descriptions"
                        rows={3}
                        defaultValue={settings?.defaultDescription}
                        onChange={(e) => {
                          if (settings) {
                            settings.defaultDescription = e.target.value;
                          }
                        }}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="metaKeywords">Default Keywords</Label>
                      <Input
                        id="metaKeywords"
                        placeholder="keyword1, keyword2, keyword3"
                        defaultValue={settings?.defaultKeywords}
                        onChange={(e) => {
                          if (settings) {
                            settings.defaultKeywords = e.target.value;
                          }
                        }}
                      />
                    </div>
                    <Button
                      onClick={() => {
                        const titleElem = document.getElementById('metaTitle') as HTMLInputElement;
                        const descElem = document.getElementById(
                          'metaDescription',
                        ) as HTMLTextAreaElement;
                        const keywordsElem = document.getElementById(
                          'metaKeywords',
                        ) as HTMLInputElement;
                        saveSettingsMutation.mutate({
                          ...settings,
                          defaultTitle: titleElem?.value,
                          defaultDescription: descElem?.value,
                          defaultKeywords: keywordsElem?.value,
                        } as SeoSettings);
                      }}
                      disabled={saveSettingsMutation.isPending}
                    >
                      {saveSettingsMutation.isPending ? 'Saving...' : 'Save Meta Tags'}
                    </Button>
                  </CardContent>
                </Card>
              </TabsContent>

              {/* robots.txt Tab */}
              <TabsContent value="robots" className="space-y-4 mt-4">
                <Card>
                  <CardHeader>
                    <CardTitle>robots.txt Editor</CardTitle>
                    <CardDescription>Configure your robots.txt file</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <Textarea
                      placeholder="User-agent: *&#10;Disallow: /admin&#10;Allow: /&#10;&#10;Sitemap: https://example.com/sitemap.xml"
                      rows={15}
                      className="font-mono text-sm"
                      value={robotsTxtContent || settings?.robotsTxt || ''}
                      onChange={(e) => setRobotsTxtContent(e.target.value)}
                    />
                    <Button onClick={() => saveRobotsMutation.mutate(robotsTxtContent)}>
                      Save robots.txt
                    </Button>
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Sitemap Tab */}
              <TabsContent value="sitemap" className="space-y-4 mt-4">
                <Card>
                  <CardHeader>
                    <CardTitle>Sitemap Generator</CardTitle>
                    <CardDescription>Generate and manage XML sitemaps</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="sitemapUrl">Sitemap URL</Label>
                      <Input
                        id="sitemapUrl"
                        placeholder="https://example.com/sitemap.xml"
                        defaultValue={settings?.sitemapUrl}
                        onChange={(e) => {
                          if (settings) {
                            settings.sitemapUrl = e.target.value;
                          }
                        }}
                      />
                    </div>
                    <div className="flex gap-2">
                      <Button
                        onClick={() => generateSitemapMutation.mutate()}
                        disabled={generateSitemapMutation.isPending}
                      >
                        {generateSitemapMutation.isPending ? 'Generating...' : 'Generate Sitemap'}
                      </Button>
                      <Button
                        variant="outline"
                        onClick={() => {
                          toast({
                            title: 'Coming soon',
                            description:
                              'Google Search Console integration will be available soon.',
                          });
                        }}
                      >
                        Submit to Google
                      </Button>
                    </div>
                    <Separator />
                    <div>
                      <p className="text-sm text-muted-foreground">
                        Sitemap will include all crawled pages. Run a site crawl first to populate
                        the sitemap with your pages.
                      </p>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              {/* llms.txt Tab */}
              <TabsContent value="llms" className="space-y-4 mt-4">
                <Card>
                  <CardHeader>
                    <CardTitle>llms.txt Editor</CardTitle>
                    <CardDescription>
                      Configure llms.txt to help AI models understand your site
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <Textarea
                      placeholder="# About&#10;# This site provides...&#10;&#10;# Products&#10;# - Product 1: Description&#10;# - Product 2: Description"
                      rows={15}
                      className="font-mono text-sm"
                      value={llmsTxtContent || settings?.llmsTxt || ''}
                      onChange={(e) => setLlmsTxtContent(e.target.value)}
                    />
                    <Button onClick={() => saveLlmsMutation.mutate(llmsTxtContent)}>
                      Save llms.txt
                    </Button>
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Structured Data Tab */}
              <TabsContent value="structured" className="space-y-4 mt-4">
                <Card>
                  <CardHeader>
                    <CardTitle>Structured Data Validator</CardTitle>
                    <CardDescription>
                      Validate JSON-LD structured data on your pages
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex gap-2">
                      <Input
                        placeholder="https://example.com"
                        value={analyzeUrl}
                        onChange={(e) => setAnalyzeUrl(e.target.value)}
                      />
                      <Button
                        onClick={() => validateStructuredDataMutation.mutate(analyzeUrl)}
                        disabled={!analyzeUrl || validateStructuredDataMutation.isPending}
                      >
                        {validateStructuredDataMutation.isPending ? 'Validating...' : 'Validate'}
                      </Button>
                    </div>
                    {structuredDataResults &&
                      structuredDataResults.schemas &&
                      structuredDataResults.schemas.length > 0 && (
                        <div className="space-y-2">
                          <h4 className="font-medium">
                            Found {structuredDataResults.schemas.length} schemas
                          </h4>
                          <ScrollArea className="h-96">
                            {structuredDataResults.schemas.map((schema: any, idx: number) => (
                              <Card key={idx} className="mb-2">
                                <CardContent className="p-3">
                                  <div className="space-y-2">
                                    <div className="flex items-center justify-between">
                                      <Badge>{schema['@type'] || 'Schema'}</Badge>
                                      <Badge variant={schema.valid ? 'default' : 'destructive'}>
                                        {schema.valid ? 'Valid' : 'Invalid'}
                                      </Badge>
                                    </div>
                                    {schema.errors && schema.errors.length > 0 && (
                                      <div className="space-y-1">
                                        {schema.errors.map((err: string, i: number) => (
                                          <p key={i} className="text-xs text-red-600">
                                            • {err}
                                          </p>
                                        ))}
                                      </div>
                                    )}
                                  </div>
                                </CardContent>
                              </Card>
                            ))}
                          </ScrollArea>
                        </div>
                      )}
                    {(!structuredDataResults || !structuredDataResults.schemas) &&
                      !validateStructuredDataMutation.isPending && (
                        <div className="rounded-md bg-muted p-4">
                          <p className="text-sm text-muted-foreground">
                            Enter a URL to validate its structured data markup. The validator will
                            check for JSON-LD schemas including Organization, Product, Article, and
                            more.
                          </p>
                        </div>
                      )}
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Performance Tab */}
              <TabsContent value="performance" className="space-y-4 mt-4">
                <Card>
                  <CardHeader>
                    <CardTitle>Core Web Vitals</CardTitle>
                    <CardDescription>Monitor page performance and Core Web Vitals</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {performanceResults && (
                      <div className="grid grid-cols-3 gap-4">
                        <Card>
                          <CardHeader className="pb-2">
                            <CardTitle className="text-sm">LCP</CardTitle>
                          </CardHeader>
                          <CardContent>
                            <p className="text-2xl font-bold">
                              {performanceResults.lcp
                                ? `${(performanceResults.lcp / 1000).toFixed(2)}s`
                                : '-'}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              Largest Contentful Paint
                            </p>
                          </CardContent>
                        </Card>
                        <Card>
                          <CardHeader className="pb-2">
                            <CardTitle className="text-sm">FID</CardTitle>
                          </CardHeader>
                          <CardContent>
                            <p className="text-2xl font-bold">
                              {performanceResults.fid
                                ? `${performanceResults.fid.toFixed(0)}ms`
                                : '-'}
                            </p>
                            <p className="text-xs text-muted-foreground">First Input Delay</p>
                          </CardContent>
                        </Card>
                        <Card>
                          <CardHeader className="pb-2">
                            <CardTitle className="text-sm">CLS</CardTitle>
                          </CardHeader>
                          <CardContent>
                            <p className="text-2xl font-bold">
                              {performanceResults.cls ? performanceResults.cls.toFixed(3) : '-'}
                            </p>
                            <p className="text-xs text-muted-foreground">Cumulative Layout Shift</p>
                          </CardContent>
                        </Card>
                      </div>
                    )}
                    {!performanceResults && (
                      <div className="grid grid-cols-3 gap-4">
                        <Card>
                          <CardHeader className="pb-2">
                            <CardTitle className="text-sm">LCP</CardTitle>
                          </CardHeader>
                          <CardContent>
                            <p className="text-2xl font-bold">-</p>
                            <p className="text-xs text-muted-foreground">
                              Largest Contentful Paint
                            </p>
                          </CardContent>
                        </Card>
                        <Card>
                          <CardHeader className="pb-2">
                            <CardTitle className="text-sm">FID</CardTitle>
                          </CardHeader>
                          <CardContent>
                            <p className="text-2xl font-bold">-</p>
                            <p className="text-xs text-muted-foreground">First Input Delay</p>
                          </CardContent>
                        </Card>
                        <Card>
                          <CardHeader className="pb-2">
                            <CardTitle className="text-sm">CLS</CardTitle>
                          </CardHeader>
                          <CardContent>
                            <p className="text-2xl font-bold">-</p>
                            <p className="text-xs text-muted-foreground">Cumulative Layout Shift</p>
                          </CardContent>
                        </Card>
                      </div>
                    )}
                    <div className="flex gap-2">
                      <Input
                        placeholder="https://example.com"
                        value={analyzeUrl}
                        onChange={(e) => setAnalyzeUrl(e.target.value)}
                      />
                      <Select value={performanceDevice} onValueChange={setPerformanceDevice}>
                        <SelectTrigger className="w-32">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="mobile">Mobile</SelectItem>
                          <SelectItem value="desktop">Desktop</SelectItem>
                        </SelectContent>
                      </Select>
                      <Button
                        onClick={() =>
                          checkPerformanceMutation.mutate({
                            url: analyzeUrl,
                            device: performanceDevice,
                          })
                        }
                        disabled={!analyzeUrl || checkPerformanceMutation.isPending}
                      >
                        {checkPerformanceMutation.isPending ? 'Checking...' : 'Check'}
                      </Button>
                    </div>
                    {performanceResults && (
                      <div className="rounded-md bg-muted p-4">
                        <p className="text-sm">
                          <strong>Performance Score:</strong> {performanceResults.performanceScore}
                          /100
                        </p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Site Crawler Tab */}
              <TabsContent value="crawler" className="space-y-4 mt-4">
                <Card>
                  <CardHeader>
                    <CardTitle>Site Crawler</CardTitle>
                    <CardDescription>
                      Crawl your website to discover pages and issues
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-3 gap-2">
                      <Input
                        placeholder="https://example.com"
                        value={crawlUrl}
                        onChange={(e) => setCrawlUrl(e.target.value)}
                        className="col-span-1"
                      />
                      <Input
                        type="number"
                        placeholder="Max Pages"
                        value={maxPages}
                        onChange={(e) => setMaxPages(e.target.value)}
                      />
                      <Input
                        type="number"
                        placeholder="Max Depth"
                        value={maxDepth}
                        onChange={(e) => setMaxDepth(e.target.value)}
                      />
                    </div>
                    <Button onClick={handleRunCrawl} disabled={isRunningCrawl}>
                      {isRunningCrawl ? 'Crawling...' : 'Start Crawl'}
                    </Button>
                    <Separator />
                    {crawlResults.length > 0 && (
                      <div>
                        <h4 className="font-medium mb-2">
                          Crawl Results ({crawlResults.length} pages)
                        </h4>
                        <ScrollArea className="h-64">
                          {crawlResults.map((result) => (
                            <Card key={result.id} className="mb-2">
                              <CardContent className="p-3">
                                <div className="flex items-start justify-between">
                                  <div className="flex-1">
                                    <p className="text-sm font-medium">{result.url}</p>
                                    <p className="text-xs text-muted-foreground">{result.title}</p>
                                  </div>
                                  <Badge
                                    variant={result.statusCode === 200 ? 'default' : 'destructive'}
                                  >
                                    {result.statusCode}
                                  </Badge>
                                </div>
                              </CardContent>
                            </Card>
                          ))}
                        </ScrollArea>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Images Tab */}
              <TabsContent value="images" className="space-y-4 mt-4">
                <Card>
                  <CardHeader>
                    <CardTitle>Image Analysis</CardTitle>
                    <CardDescription>Analyze images for SEO optimization</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex gap-2">
                      <Input
                        placeholder="https://example.com"
                        value={analyzeUrl}
                        onChange={(e) => setAnalyzeUrl(e.target.value)}
                      />
                      <Button
                        onClick={() => analyzeImagesMutation.mutate(analyzeUrl)}
                        disabled={!analyzeUrl || analyzeImagesMutation.isPending}
                      >
                        {analyzeImagesMutation.isPending ? 'Analyzing...' : 'Analyze Images'}
                      </Button>
                    </div>
                    {imageAnalysisResults.length > 0 && (
                      <div className="space-y-2">
                        <h4 className="font-medium">Found {imageAnalysisResults.length} images</h4>
                        <ScrollArea className="h-96">
                          {imageAnalysisResults.map((img, idx) => (
                            <Card key={idx} className="mb-2">
                              <CardContent className="p-3">
                                <div className="flex items-start gap-2">
                                  <Image className="h-4 w-4 mt-1" />
                                  <div className="flex-1">
                                    <p className="text-sm font-medium truncate">{img.src}</p>
                                    <div className="flex gap-2 mt-1">
                                      <Badge variant={img.hasAltText ? 'default' : 'destructive'}>
                                        {img.hasAltText ? 'Has Alt' : 'Missing Alt'}
                                      </Badge>
                                      <Badge variant={img.isOptimized ? 'default' : 'secondary'}>
                                        {img.isOptimized ? 'Optimized' : 'Needs Optimization'}
                                      </Badge>
                                      {img.fileSize && (
                                        <span className="text-xs text-muted-foreground">
                                          {(img.fileSize / 1024).toFixed(1)}KB
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              </CardContent>
                            </Card>
                          ))}
                        </ScrollArea>
                      </div>
                    )}
                    {imageAnalysisResults.length === 0 && !analyzeImagesMutation.isPending && (
                      <div className="rounded-md bg-muted p-4">
                        <p className="text-sm text-muted-foreground">
                          Enter a URL to analyze all images on the page. We'll check for alt text,
                          file sizes, dimensions, and optimization opportunities.
                        </p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Links Tab */}
              <TabsContent value="links" className="space-y-4 mt-4">
                <Card>
                  <CardHeader>
                    <CardTitle>Link Analysis</CardTitle>
                    <CardDescription>Analyze internal and external links</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex gap-2">
                      <Input
                        placeholder="https://example.com"
                        value={analyzeUrl}
                        onChange={(e) => setAnalyzeUrl(e.target.value)}
                      />
                      <Button
                        onClick={() => analyzeLinksMutation.mutate(analyzeUrl)}
                        disabled={!analyzeUrl || analyzeLinksMutation.isPending}
                      >
                        {analyzeLinksMutation.isPending ? 'Analyzing...' : 'Analyze Links'}
                      </Button>
                    </div>
                    {linkAnalysisResults.length > 0 && (
                      <div className="space-y-2">
                        <h4 className="font-medium">Found {linkAnalysisResults.length} links</h4>
                        <ScrollArea className="h-96">
                          {linkAnalysisResults.map((link, idx) => (
                            <Card key={idx} className="mb-2">
                              <CardContent className="p-3">
                                <div className="flex items-start gap-2">
                                  <LinkIcon className="h-4 w-4 mt-1" />
                                  <div className="flex-1">
                                    <p className="text-sm font-medium truncate">{link.url}</p>
                                    <p className="text-xs text-muted-foreground">{link.text}</p>
                                    <div className="flex gap-2 mt-1">
                                      <Badge
                                        variant={link.type === 'internal' ? 'default' : 'secondary'}
                                      >
                                        {link.type}
                                      </Badge>
                                      {link.isNofollow && <Badge variant="outline">nofollow</Badge>}
                                      {link.statusCode && (
                                        <Badge
                                          variant={
                                            link.statusCode === 200 ? 'default' : 'destructive'
                                          }
                                        >
                                          {link.statusCode}
                                        </Badge>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              </CardContent>
                            </Card>
                          ))}
                        </ScrollArea>
                      </div>
                    )}
                    {linkAnalysisResults.length === 0 && !analyzeLinksMutation.isPending && (
                      <div className="rounded-md bg-muted p-4">
                        <p className="text-sm text-muted-foreground">
                          Analyze all links on a page to identify internal vs external links,
                          nofollow attributes, and link health.
                        </p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Broken Links Tab */}
              <TabsContent value="broken" className="space-y-4 mt-4">
                <Card>
                  <CardHeader>
                    <CardTitle>Broken Link Checker</CardTitle>
                    <CardDescription>Find and fix broken links on your site</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex gap-2">
                      <Input
                        placeholder="https://example.com"
                        value={analyzeUrl}
                        onChange={(e) => setAnalyzeUrl(e.target.value)}
                      />
                      <Button
                        onClick={() => checkBrokenLinksMutation.mutate(analyzeUrl)}
                        disabled={!analyzeUrl || checkBrokenLinksMutation.isPending}
                      >
                        {checkBrokenLinksMutation.isPending ? 'Checking...' : 'Check Links'}
                      </Button>
                    </div>
                    {brokenLinksResults.length > 0 && (
                      <div className="space-y-2">
                        <h4 className="font-medium text-red-600">
                          Found {brokenLinksResults.length} broken links
                        </h4>
                        <ScrollArea className="h-96">
                          {brokenLinksResults.map((link, idx) => (
                            <Card key={idx} className="mb-2 border-red-200">
                              <CardContent className="p-3">
                                <div className="space-y-2">
                                  <div className="flex items-start justify-between">
                                    <p className="text-sm font-medium truncate flex-1">
                                      {link.url}
                                    </p>
                                    <Badge variant="destructive">{link.statusCode}</Badge>
                                  </div>
                                  <p className="text-xs text-muted-foreground">
                                    Found on {link.sourcePages.length} page(s)
                                  </p>
                                  <p className="text-sm text-green-600">{link.recommendation}</p>
                                </div>
                              </CardContent>
                            </Card>
                          ))}
                        </ScrollArea>
                      </div>
                    )}
                    {brokenLinksResults.length === 0 && !checkBrokenLinksMutation.isPending && (
                      <div className="rounded-md bg-muted p-4">
                        <p className="text-sm text-muted-foreground">
                          Check all links on a page for broken or dead links. We'll identify 404s,
                          500s, and provide recommendations for fixes.
                        </p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Redirects Tab */}
              <TabsContent value="redirects" className="space-y-4 mt-4">
                <Card>
                  <CardHeader>
                    <CardTitle>Redirect Chain Detector</CardTitle>
                    <CardDescription>Detect and optimize redirect chains</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex gap-2">
                      <Input
                        placeholder="https://example.com"
                        value={analyzeUrl}
                        onChange={(e) => setAnalyzeUrl(e.target.value)}
                      />
                      <Button
                        onClick={() => checkRedirectsMutation.mutate(analyzeUrl)}
                        disabled={!analyzeUrl || checkRedirectsMutation.isPending}
                      >
                        {checkRedirectsMutation.isPending ? 'Checking...' : 'Check Redirects'}
                      </Button>
                    </div>
                    {redirectResults.length > 0 && (
                      <div className="space-y-2">
                        <h4 className="font-medium">
                          Found {redirectResults.length} redirect chains
                        </h4>
                        <ScrollArea className="h-96">
                          {redirectResults.map((chain, idx) => (
                            <Card key={idx} className="mb-2">
                              <CardContent className="p-3">
                                <div className="space-y-2">
                                  <div className="flex items-start justify-between">
                                    <p className="text-sm font-medium">{chain.url}</p>
                                    <Badge>{chain.redirectCount} redirects</Badge>
                                  </div>
                                  <div className="space-y-1">
                                    {chain.redirects.map((r, i) => (
                                      <div key={i} className="text-xs">
                                        <span className="text-muted-foreground">{r.from}</span>
                                        <span className="mx-2">→</span>
                                        <Badge variant="outline" className="text-xs">
                                          {r.statusCode}
                                        </Badge>
                                        <span className="mx-2">→</span>
                                        <span>{r.to}</span>
                                      </div>
                                    ))}
                                  </div>
                                  <p className="text-xs font-medium">Final: {chain.finalUrl}</p>
                                </div>
                              </CardContent>
                            </Card>
                          ))}
                        </ScrollArea>
                      </div>
                    )}
                    {redirectResults.length === 0 && !checkRedirectsMutation.isPending && (
                      <div className="rounded-md bg-muted p-4">
                        <p className="text-sm text-muted-foreground">
                          Follow redirect chains to identify unnecessary redirects that slow down
                          page load times and harm SEO.
                        </p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Duplicate Content Tab */}
              <TabsContent value="duplicate" className="space-y-4 mt-4">
                <Card>
                  <CardHeader>
                    <CardTitle>Duplicate Content Checker</CardTitle>
                    <CardDescription>Identify duplicate content across your site</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <Button
                      onClick={() => scanDuplicatesMutation.mutate()}
                      disabled={scanDuplicatesMutation.isPending}
                    >
                      {scanDuplicatesMutation.isPending ? 'Scanning...' : 'Scan for Duplicates'}
                    </Button>
                    {duplicateContentResults.length > 0 && (
                      <div className="space-y-2">
                        <h4 className="font-medium">
                          Found {duplicateContentResults.length} duplicate pairs
                        </h4>
                        <ScrollArea className="h-96">
                          {duplicateContentResults.map((dup, idx) => (
                            <Card key={idx} className="mb-2">
                              <CardContent className="p-3">
                                <div className="space-y-2">
                                  <div className="flex items-center justify-between">
                                    <span className="text-xs">Similarity</span>
                                    <Badge>{dup.similarityScore}%</Badge>
                                  </div>
                                  <p className="text-sm truncate">{dup.url1}</p>
                                  <p className="text-sm truncate">{dup.url2}</p>
                                </div>
                              </CardContent>
                            </Card>
                          ))}
                        </ScrollArea>
                      </div>
                    )}
                    {duplicateContentResults.length === 0 && !scanDuplicatesMutation.isPending && (
                      <div className="rounded-md bg-muted p-4">
                        <p className="text-sm text-muted-foreground">
                          Scan your site to find pages with duplicate or very similar content.
                          Duplicate content can harm your SEO rankings.
                        </p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Security Tab */}
              <TabsContent value="security" className="space-y-4 mt-4">
                <Card>
                  <CardHeader>
                    <CardTitle>Security Analysis</CardTitle>
                    <CardDescription>
                      Check security headers and HTTPS configuration
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex gap-2">
                      <Input
                        placeholder="https://example.com"
                        value={analyzeUrl}
                        onChange={(e) => setAnalyzeUrl(e.target.value)}
                      />
                      <Button
                        onClick={() => analyzeSecurityMutation.mutate(analyzeUrl)}
                        disabled={!analyzeUrl || analyzeSecurityMutation.isPending}
                      >
                        {analyzeSecurityMutation.isPending ? 'Checking...' : 'Check Security'}
                      </Button>
                    </div>
                    {securityResults && (
                      <div className="space-y-4">
                        <div className="flex items-center justify-between">
                          <span className="font-medium">Security Score</span>
                          <Badge
                            variant={
                              securityResults.securityScore >= 80 ? 'default' : 'destructive'
                            }
                          >
                            {securityResults.securityScore}/100
                          </Badge>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                          <Card>
                            <CardContent className="p-4">
                              <div className="flex items-center gap-2">
                                <Shield
                                  className={`h-5 w-5 ${securityResults.https ? 'text-green-500' : 'text-red-500'}`}
                                />
                                <span className="text-sm">HTTPS</span>
                              </div>
                            </CardContent>
                          </Card>
                          <Card>
                            <CardContent className="p-4">
                              <div className="flex items-center gap-2">
                                <Shield
                                  className={`h-5 w-5 ${securityResults.hsts ? 'text-green-500' : 'text-muted-foreground'}`}
                                />
                                <span className="text-sm">HSTS</span>
                              </div>
                            </CardContent>
                          </Card>
                          <Card>
                            <CardContent className="p-4">
                              <div className="flex items-center gap-2">
                                <Shield
                                  className={`h-5 w-5 ${securityResults.csp ? 'text-green-500' : 'text-muted-foreground'}`}
                                />
                                <span className="text-sm">CSP</span>
                              </div>
                            </CardContent>
                          </Card>
                          <Card>
                            <CardContent className="p-4">
                              <div className="flex items-center gap-2">
                                <Shield
                                  className={`h-5 w-5 ${securityResults.xFrameOptions ? 'text-green-500' : 'text-muted-foreground'}`}
                                />
                                <span className="text-sm">X-Frame-Options</span>
                              </div>
                            </CardContent>
                          </Card>
                        </div>
                        {securityResults.recommendations.length > 0 && (
                          <div className="space-y-2">
                            <h4 className="font-medium">Recommendations</h4>
                            {securityResults.recommendations.map((rec, idx) => (
                              <p key={idx} className="text-sm text-muted-foreground">
                                • {rec}
                              </p>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                    {!securityResults && !analyzeSecurityMutation.isPending && (
                      <div className="grid grid-cols-2 gap-4">
                        <Card>
                          <CardContent className="p-4">
                            <div className="flex items-center gap-2">
                              <Shield className="h-5 w-5 text-muted-foreground" />
                              <span className="text-sm">HTTPS</span>
                            </div>
                          </CardContent>
                        </Card>
                        <Card>
                          <CardContent className="p-4">
                            <div className="flex items-center gap-2">
                              <Shield className="h-5 w-5 text-muted-foreground" />
                              <span className="text-sm">HSTS</span>
                            </div>
                          </CardContent>
                        </Card>
                        <Card>
                          <CardContent className="p-4">
                            <div className="flex items-center gap-2">
                              <Shield className="h-5 w-5 text-muted-foreground" />
                              <span className="text-sm">CSP</span>
                            </div>
                          </CardContent>
                        </Card>
                        <Card>
                          <CardContent className="p-4">
                            <div className="flex items-center gap-2">
                              <Shield className="h-5 w-5 text-muted-foreground" />
                              <span className="text-sm">X-Frame-Options</span>
                            </div>
                          </CardContent>
                        </Card>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Mobile Tab */}
              <TabsContent value="mobile" className="space-y-4 mt-4">
                <Card>
                  <CardHeader>
                    <CardTitle>Mobile-Friendliness</CardTitle>
                    <CardDescription>Analyze mobile usability and responsiveness</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex gap-2">
                      <Input
                        placeholder="https://example.com"
                        value={analyzeUrl}
                        onChange={(e) => setAnalyzeUrl(e.target.value)}
                      />
                      <Button
                        onClick={() => analyzeMobileMutation.mutate(analyzeUrl)}
                        disabled={!analyzeUrl || analyzeMobileMutation.isPending}
                      >
                        {analyzeMobileMutation.isPending ? 'Checking...' : 'Check Mobile'}
                      </Button>
                    </div>
                    {mobileResults && (
                      <div className="space-y-4">
                        <div className="flex items-center justify-between">
                          <span className="font-medium">Mobile Score</span>
                          <Badge
                            variant={mobileResults.mobileScore >= 80 ? 'default' : 'destructive'}
                          >
                            {mobileResults.mobileScore}/100
                          </Badge>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <Label>Viewport Configured</Label>
                            <p className="text-sm font-medium">
                              {mobileResults.hasViewport ? '✓ Yes' : '✗ No'}
                            </p>
                          </div>
                          <div>
                            <Label>Mobile-Friendly</Label>
                            <p className="text-sm font-medium">
                              {mobileResults.isMobileFriendly ? '✓ Yes' : '✗ No'}
                            </p>
                          </div>
                          <div>
                            <Label>Touch Elements</Label>
                            <p className="text-sm font-medium">
                              {mobileResults.touchElementsSize ? '✓ Proper Size' : '✗ Too Small'}
                            </p>
                          </div>
                          <div>
                            <Label>Text Readability</Label>
                            <p className="text-sm font-medium">
                              {mobileResults.textReadability ? '✓ Readable' : '✗ Issues'}
                            </p>
                          </div>
                        </div>
                      </div>
                    )}
                    {!mobileResults && !analyzeMobileMutation.isPending && (
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <Label>Viewport Configured</Label>
                          <p className="text-sm text-muted-foreground">-</p>
                        </div>
                        <div>
                          <Label>Mobile-Friendly</Label>
                          <p className="text-sm text-muted-foreground">-</p>
                        </div>
                        <div>
                          <Label>Touch Elements</Label>
                          <p className="text-sm text-muted-foreground">-</p>
                        </div>
                        <div>
                          <Label>Text Readability</Label>
                          <p className="text-sm text-muted-foreground">-</p>
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Content Tab */}
              <TabsContent value="content" className="space-y-4 mt-4">
                <Card>
                  <CardHeader>
                    <CardTitle>Content Optimization</CardTitle>
                    <CardDescription>AI-powered content optimization suggestions</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex gap-2">
                      <Input
                        placeholder="https://example.com"
                        value={analyzeUrl}
                        onChange={(e) => setAnalyzeUrl(e.target.value)}
                      />
                      <Button
                        onClick={() => optimizeContentMutation.mutate(analyzeUrl)}
                        disabled={!analyzeUrl || optimizeContentMutation.isPending}
                      >
                        {optimizeContentMutation.isPending ? 'Analyzing...' : 'Analyze Content'}
                      </Button>
                    </div>
                    {contentResults && (
                      <div className="space-y-4">
                        <div className="rounded-md bg-muted p-4">
                          <p className="text-sm">
                            <strong>Word Count:</strong> {contentResults.wordCount || 'N/A'}
                          </p>
                          <p className="text-sm">
                            <strong>Reading Time:</strong> {contentResults.readingTime || 'N/A'}
                          </p>
                          <p className="text-sm">
                            <strong>Keyword Density:</strong>{' '}
                            {contentResults.keywordDensity || 'N/A'}
                          </p>
                        </div>
                        {contentResults.suggestions && contentResults.suggestions.length > 0 && (
                          <div className="space-y-2">
                            <h4 className="font-medium">Optimization Suggestions</h4>
                            <ScrollArea className="h-64">
                              {contentResults.suggestions.map((suggestion: string, idx: number) => (
                                <p key={idx} className="text-sm text-muted-foreground mb-2">
                                  • {suggestion}
                                </p>
                              ))}
                            </ScrollArea>
                          </div>
                        )}
                      </div>
                    )}
                    {!contentResults && !optimizeContentMutation.isPending && (
                      <div className="rounded-md bg-muted p-4">
                        <p className="text-sm text-muted-foreground">
                          Get AI-powered suggestions for improving your content for SEO, including
                          keyword usage, readability, structure, and more.
                        </p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Semantic Tab */}
              <TabsContent value="semantic" className="space-y-4 mt-4">
                <Card>
                  <CardHeader>
                    <CardTitle>Semantic Keyword Analysis</CardTitle>
                    <CardDescription>
                      Discover related keywords and semantic clusters
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex gap-2">
                      <Input
                        placeholder="Enter primary keyword"
                        value={analyzeUrl}
                        onChange={(e) => setAnalyzeUrl(e.target.value)}
                      />
                      <Button
                        onClick={() => analyzeSemanticMutation.mutate(analyzeUrl)}
                        disabled={!analyzeUrl || analyzeSemanticMutation.isPending}
                      >
                        {analyzeSemanticMutation.isPending ? 'Analyzing...' : 'Analyze'}
                      </Button>
                    </div>
                    {semanticResults &&
                      semanticResults.relatedKeywords &&
                      semanticResults.relatedKeywords.length > 0 && (
                        <div className="space-y-2">
                          <h4 className="font-medium">
                            Related Keywords ({semanticResults.relatedKeywords.length})
                          </h4>
                          <ScrollArea className="h-96">
                            <div className="flex flex-wrap gap-2">
                              {semanticResults.relatedKeywords.map((kw: any, idx: number) => (
                                <Badge key={idx} variant="secondary">
                                  {kw.keyword || kw}
                                </Badge>
                              ))}
                            </div>
                          </ScrollArea>
                        </div>
                      )}
                    {(!semanticResults || !semanticResults.relatedKeywords) &&
                      !analyzeSemanticMutation.isPending && (
                        <div className="rounded-md bg-muted p-4">
                          <p className="text-sm text-muted-foreground">
                            Discover semantically related keywords and create keyword clusters to
                            improve your content strategy and topical authority.
                          </p>
                        </div>
                      )}
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  );
}
