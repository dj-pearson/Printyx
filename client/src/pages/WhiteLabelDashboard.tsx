import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Palette, Mail, Eye, Settings, Sparkles, Check, X } from 'lucide-react';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';

export default function WhiteLabelDashboard() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState('branding');

  const { data: config, isLoading } = useQuery({
    queryKey: ['/api/white-label/config'],
  });

  const updateMutation = useMutation({
    mutationFn: (data: any) =>
      apiRequest('/api/white-label/config', {
        method: 'PUT',
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      toast({ title: 'Settings Saved', description: 'White-label configuration updated successfully' });
      queryClient.invalidateQueries({ queryKey: ['/api/white-label/config'] });
    },
  });

  const [formData, setFormData] = useState({
    companyName: '',
    companyTagline: '',
    logoUrl: '',
    colorPrimary: '#6366f1',
    colorSecondary: '#8b5cf6',
    colorAccent: '#ec4899',
    welcomeTitle: '',
    welcomeMessage: '',
    supportEmail: '',
    supportPhone: '',
    customDomain: '',
    features: {
      enableServiceRequests: true,
      enableSupplyOrdering: true,
      enableMeterSubmission: true,
      enableInvoicePayments: true,
      enableEquipmentMonitoring: true,
    },
  });

  // Update form data when config loads
  useState(() => {
    if (config) {
      setFormData({
        companyName: config.companyName || '',
        companyTagline: config.companyTagline || '',
        logoUrl: config.logoUrl || '',
        colorPrimary: config.colorPrimary || '#6366f1',
        colorSecondary: config.colorSecondary || '#8b5cf6',
        colorAccent: config.colorAccent || '#ec4899',
        welcomeTitle: config.welcomeTitle || '',
        welcomeMessage: config.welcomeMessage || '',
        supportEmail: config.supportEmail || '',
        supportPhone: config.supportPhone || '',
        customDomain: config.customDomain || '',
        features: config.features || formData.features,
      });
    }
  });

  const handleSave = () => {
    updateMutation.mutate(formData);
  };

  if (isLoading) {
    return <div className="container mx-auto p-6">Loading...</div>;
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Sparkles className="h-8 w-8 text-purple-500" />
            White-Label Portal
          </h1>
          <p className="text-muted-foreground mt-1">
            Brand the customer portal as your own with custom logo, colors, and domain
          </p>
        </div>
        <Button onClick={handleSave} disabled={updateMutation.isPending}>
          {updateMutation.isPending ? 'Saving...' : 'Save Changes'}
        </Button>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="branding">Branding</TabsTrigger>
          <TabsTrigger value="portal">Portal Settings</TabsTrigger>
          <TabsTrigger value="preview">Preview</TabsTrigger>
        </TabsList>

        <TabsContent value="branding" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Palette className="h-5 w-5" />
                Company Branding
              </CardTitle>
              <CardDescription>Customize your brand identity</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Company Name *</Label>
                  <Input
                    value={formData.companyName}
                    onChange={(e) => setFormData({ ...formData, companyName: e.target.value })}
                    placeholder="Acme Copiers Inc."
                  />
                </div>
                <div className="space-y-2">
                  <Label>Tagline</Label>
                  <Input
                    value={formData.companyTagline}
                    onChange={(e) => setFormData({ ...formData, companyTagline: e.target.value })}
                    placeholder="Your trusted copier partner"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Logo URL</Label>
                <Input
                  value={formData.logoUrl}
                  onChange={(e) => setFormData({ ...formData, logoUrl: e.target.value })}
                  placeholder="https://example.com/logo.png"
                />
                <p className="text-xs text-muted-foreground">
                  Recommended: PNG or SVG, max height 50px, transparent background
                </p>
              </div>

              <div className="space-y-2">
                <Label>Custom Domain</Label>
                <Input
                  value={formData.customDomain}
                  onChange={(e) => setFormData({ ...formData, customDomain: e.target.value })}
                  placeholder="portal.acmecopiers.com"
                />
                {config?.customDomainVerified ? (
                  <Badge variant="default" className="gap-1">
                    <Check className="h-3 w-3" /> Verified
                  </Badge>
                ) : (
                  <Badge variant="secondary" className="gap-1">
                    <X className="h-3 w-3" /> Not Verified
                  </Badge>
                )}
              </div>

              <div className="border-t pt-4">
                <h3 className="font-semibold mb-3">Color Scheme</h3>
                <div className="grid grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label>Primary Color</Label>
                    <div className="flex gap-2">
                      <Input
                        type="color"
                        value={formData.colorPrimary}
                        onChange={(e) => setFormData({ ...formData, colorPrimary: e.target.value })}
                        className="w-20 h-10 p-1"
                      />
                      <Input
                        value={formData.colorPrimary}
                        onChange={(e) => setFormData({ ...formData, colorPrimary: e.target.value })}
                        className="flex-1"
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Secondary Color</Label>
                    <div className="flex gap-2">
                      <Input
                        type="color"
                        value={formData.colorSecondary}
                        onChange={(e) => setFormData({ ...formData, colorSecondary: e.target.value })}
                        className="w-20 h-10 p-1"
                      />
                      <Input
                        value={formData.colorSecondary}
                        onChange={(e) => setFormData({ ...formData, colorSecondary: e.target.value })}
                        className="flex-1"
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Accent Color</Label>
                    <div className="flex gap-2">
                      <Input
                        type="color"
                        value={formData.colorAccent}
                        onChange={(e) => setFormData({ ...formData, colorAccent: e.target.value })}
                        className="w-20 h-10 p-1"
                      />
                      <Input
                        value={formData.colorAccent}
                        onChange={(e) => setFormData({ ...formData, colorAccent: e.target.value })}
                        className="flex-1"
                      />
                    </div>
                  </div>
                </div>
              </div>

              <div className="border-t pt-4">
                <h3 className="font-semibold mb-3">Contact Information</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Support Email</Label>
                    <Input
                      type="email"
                      value={formData.supportEmail}
                      onChange={(e) => setFormData({ ...formData, supportEmail: e.target.value })}
                      placeholder="support@acmecopiers.com"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Support Phone</Label>
                    <Input
                      value={formData.supportPhone}
                      onChange={(e) => setFormData({ ...formData, supportPhone: e.target.value })}
                      placeholder="(555) 123-4567"
                    />
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="portal" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Settings className="h-5 w-5" />
                Portal Configuration
              </CardTitle>
              <CardDescription>Customize portal welcome and features</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Welcome Title</Label>
                <Input
                  value={formData.welcomeTitle}
                  onChange={(e) => setFormData({ ...formData, welcomeTitle: e.target.value })}
                  placeholder="Welcome to Your Customer Portal"
                />
              </div>

              <div className="space-y-2">
                <Label>Welcome Message</Label>
                <Textarea
                  value={formData.welcomeMessage}
                  onChange={(e) => setFormData({ ...formData, welcomeMessage: e.target.value })}
                  placeholder="Access your equipment status, submit service requests, and manage your account."
                  rows={4}
                />
              </div>

              <div className="border-t pt-4">
                <h3 className="font-semibold mb-3">Portal Features</h3>
                <div className="space-y-3">
                  {[
                    { key: 'enableServiceRequests', label: 'Service Requests', desc: 'Allow customers to submit service requests' },
                    { key: 'enableSupplyOrdering', label: 'Supply Ordering', desc: 'Enable automatic supply ordering' },
                    { key: 'enableMeterSubmission', label: 'Meter Submission', desc: 'Allow meter reading uploads' },
                    { key: 'enableInvoicePayments', label: 'Invoice Payments', desc: 'Enable online payment processing' },
                    { key: 'enableEquipmentMonitoring', label: 'Equipment Monitoring', desc: 'Show real-time device status' },
                  ].map((feature) => (
                    <div key={feature.key} className="flex items-center justify-between p-3 border rounded-lg">
                      <div>
                        <div className="font-medium">{feature.label}</div>
                        <div className="text-sm text-muted-foreground">{feature.desc}</div>
                      </div>
                      <Switch
                        checked={formData.features[feature.key as keyof typeof formData.features]}
                        onCheckedChange={(checked) =>
                          setFormData({
                            ...formData,
                            features: { ...formData.features, [feature.key]: checked },
                          })
                        }
                      />
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="preview" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Eye className="h-5 w-5" />
                Portal Preview
              </CardTitle>
              <CardDescription>See how your portal will look to customers</CardDescription>
            </CardHeader>
            <CardContent>
              <div
                className="border rounded-lg p-6"
                style={{
                  backgroundColor: '#ffffff',
                  borderColor: formData.colorPrimary,
                }}
              >
                <div
                  className="text-center p-4 rounded-t-lg"
                  style={{ backgroundColor: formData.colorPrimary }}
                >
                  {formData.logoUrl ? (
                    <img src={formData.logoUrl} alt="Logo" className="h-12 mx-auto" />
                  ) : (
                    <h2 className="text-2xl font-bold text-white">{formData.companyName || 'Your Company'}</h2>
                  )}
                  {formData.companyTagline && (
                    <p className="text-white/90 text-sm mt-1">{formData.companyTagline}</p>
                  )}
                </div>

                <div className="p-6">
                  <h3 className="text-xl font-semibold mb-2">
                    {formData.welcomeTitle || 'Welcome to Your Customer Portal'}
                  </h3>
                  <p className="text-muted-foreground mb-4">
                    {formData.welcomeMessage || 'Access your account and manage your services.'}
                  </p>

                  <div className="grid grid-cols-2 gap-3 mt-4">
                    <Button style={{ backgroundColor: formData.colorPrimary }}>
                      Service Requests
                    </Button>
                    <Button
                      variant="outline"
                      style={{ borderColor: formData.colorSecondary, color: formData.colorSecondary }}
                    >
                      View Invoices
                    </Button>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
