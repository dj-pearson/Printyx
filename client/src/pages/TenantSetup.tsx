import { useState } from 'react';
import { MainLayout } from '@/components/layout/main-layout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Copy, ExternalLink, Settings, Users, Globe, Shield } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

export default function TenantSetup() {
  const [companyName, setCompanyName] = useState('XYZ Company');
  const [slug, setSlug] = useState('xyz-company');
  const [plan, setPlan] = useState('professional');
  const { toast } = useToast();

  const createSlugFromName = (name: string) => {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '');
  };

  const handleCompanyNameChange = (value: string) => {
    setCompanyName(value);
    setSlug(createSlugFromName(value));
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast({
      title: "Copied!",
      description: `${label} copied to clipboard`,
    });
  };

  const openUrl = (url: string) => {
    window.open(url, '_blank');
  };

  const tenantUrls = {
    primary: `https://${slug}.printyx.net`, // Subdomain (Primary)
    primaryDev: `https://${slug}.replit.dev`, // Development subdomain
    current: `http://localhost:5000`, // Current development
  };

  return (
    <MainLayout 
      title="Multi-Tenant Setup" 
      description="Configure company-specific instances with subdomain or path-based routing"
    >
      <div className="space-y-6">

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Configuration Panel */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Settings className="h-5 w-5" />
              Tenant Configuration
            </CardTitle>
            <CardDescription>
              Set up your company's dedicated instance
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="companyName">Company Name</Label>
              <Input
                id="companyName"
                value={companyName}
                onChange={(e) => handleCompanyNameChange(e.target.value)}
                placeholder="Enter company name"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="slug">URL Slug</Label>
              <Input
                id="slug"
                value={slug}
                onChange={(e) => setSlug(e.target.value)}
                placeholder="url-friendly-name"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="plan">Plan</Label>
              <Select value={plan} onValueChange={setPlan}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="basic">Basic - $49/month</SelectItem>
                  <SelectItem value="professional">Professional - $99/month</SelectItem>
                  <SelectItem value="enterprise">Enterprise - $199/month</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <Button className="w-full" size="lg">
              Create Tenant Instance
            </Button>
          </CardContent>
        </Card>

        {/* URL Preview */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Globe className="h-5 w-5" />
              Access URLs
            </CardTitle>
            <CardDescription>
              Different ways to access your company instance
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-3">
              <div>
                <Label className="text-sm font-medium">Primary URL (Subdomain)</Label>
                <div className="flex items-center gap-2 mt-1">
                  <Input 
                    value={tenantUrls.primary} 
                    readOnly 
                    className="text-sm"
                  />
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => copyToClipboard(tenantUrls.primary, 'Primary URL')}
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => openUrl(tenantUrls.primary)}
                  >
                    <ExternalLink className="h-4 w-4" />
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground mt-1">Recommended for production use</p>
              </div>

              <div>
                <Label className="text-sm font-medium">Development URL (Replit)</Label>
                <div className="flex items-center gap-2 mt-1">
                  <Input 
                    value={tenantUrls.primaryDev} 
                    readOnly 
                    className="text-sm"
                  />
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => copyToClipboard(tenantUrls.primaryDev, 'Development URL')}
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => openUrl(tenantUrls.primaryDev)}
                  >
                    <ExternalLink className="h-4 w-4" />
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground mt-1">For testing and development</p>
              </div>

              <div>
                <Label className="text-sm font-medium">Local Development (Current)</Label>
                <div className="flex items-center gap-2 mt-1">
                  <Input 
                    value={tenantUrls.current} 
                    readOnly 
                    className="text-sm"
                  />
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => copyToClipboard(tenantUrls.current, 'Development URL')}
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => window.location.href = '/'}
                  >
                    <ExternalLink className="h-4 w-4" />
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground mt-1">Currently active environment</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Feature Overview */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Users className="h-5 w-5" />
              Isolated Data
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Each tenant has completely isolated data with row-level security
            </p>
            <Badge variant="secondary" className="mt-2">Multi-tenant</Badge>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Globe className="h-5 w-5" />
              Subdomain Routing
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Clean, professional subdomain URLs for each company tenant
            </p>
            <Badge variant="secondary" className="mt-2">Primary Method</Badge>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Shield className="h-5 w-5" />
              Role-based Access
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Comprehensive RBAC with department-level permissions
            </p>
            <Badge variant="secondary" className="mt-2">Secure</Badge>
          </CardContent>
        </Card>
      </div>

      {/* Current Status */}
      <Card>
        <CardHeader>
          <CardTitle>Current Demo Tenant Status</CardTitle>
          <CardDescription>
            You're currently viewing the Printyx Demo tenant instance
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <Label className="text-sm text-muted-foreground">Tenant ID</Label>
              <p className="font-mono text-sm">550e8400-e29b-41d4-a716-446655440000</p>
            </div>
            <div>
              <Label className="text-sm text-muted-foreground">Slug</Label>
              <p className="font-medium">printyx-demo</p>
            </div>
            <div>
              <Label className="text-sm text-muted-foreground">Plan</Label>
              <Badge>Enterprise</Badge>
            </div>
            <div>
              <Label className="text-sm text-muted-foreground">Status</Label>
              <Badge variant="secondary">Active</Badge>
            </div>
          </div>
        </CardContent>
      </Card>
      </div>
    </MainLayout>
  );
}