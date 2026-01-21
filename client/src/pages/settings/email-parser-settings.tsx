import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, Mail, CheckCircle2, XCircle, AlertCircle, RefreshCw } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface EmailParserConfig {
  enabled: boolean;
  emailAddress: string;
  protocol: string;
  host: string;
  port: number;
  username: string;
  tls: boolean;
  pollInterval: number;
  autoAssignTechnician: boolean;
  sendConfirmationEmail: boolean;
  lastCheckAt?: string;
  lastSuccessAt?: string;
  lastErrorAt?: string;
  lastError?: string;
  totalEmailsProcessed: number;
  totalTicketsCreated: number;
}

interface EmailParserStats {
  enabled: boolean;
  lastCheckAt?: string;
  lastSuccessAt?: string;
  lastErrorAt?: string;
  lastError?: string;
  totalEmailsProcessed: number;
  totalTicketsCreated: number;
  last30Days: {
    total: number;
    success: number;
    failed: number;
    skipped: number;
    successRate: string;
  };
}

interface ProcessedEmail {
  id: string;
  from: string;
  subject: string;
  processingStatus: string;
  processedAt: string;
  ticketId?: string;
  processingError?: string;
}

export default function EmailParserSettings() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [formData, setFormData] = useState<Partial<EmailParserConfig>>({
    protocol: 'imap',
    port: 993,
    tls: true,
    pollInterval: 60,
    autoAssignTechnician: true,
    sendConfirmationEmail: true,
  });
  const [showPassword, setShowPassword] = useState(false);

  // Fetch configuration
  const { data: config, isLoading: configLoading } = useQuery<EmailParserConfig>({
    queryKey: ['email-parser-config'],
    queryFn: async () => {
      const response = await fetch('/api/email-parser/config', {
        credentials: 'include',
      });
      if (!response.ok) throw new Error('Failed to fetch config');
      return response.json();
    },
  });

  // Fetch statistics
  const { data: stats, isLoading: statsLoading } = useQuery<EmailParserStats>({
    queryKey: ['email-parser-stats'],
    queryFn: async () => {
      const response = await fetch('/api/email-parser/stats', {
        credentials: 'include',
      });
      if (!response.ok) throw new Error('Failed to fetch stats');
      return response.json();
    },
    refetchInterval: 60000, // Refresh every minute
  });

  // Fetch processed emails
  const { data: emailsData, isLoading: emailsLoading } = useQuery<{
    emails: ProcessedEmail[];
    pagination: any;
  }>({
    queryKey: ['email-parser-emails'],
    queryFn: async () => {
      const response = await fetch('/api/email-parser/processed-emails?limit=20', {
        credentials: 'include',
      });
      if (!response.ok) throw new Error('Failed to fetch emails');
      return response.json();
    },
  });

  // Update form when config loads
  useEffect(() => {
    if (config) {
      setFormData(config);
    }
  }, [config]);

  // Save configuration mutation
  const saveConfigMutation = useMutation({
    mutationFn: async (data: Partial<EmailParserConfig>) => {
      const response = await fetch('/api/email-parser/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(data),
      });
      if (!response.ok) throw new Error('Failed to save configuration');
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: 'Configuration saved',
        description: 'Email parser settings updated successfully',
      });
      queryClient.invalidateQueries({ queryKey: ['email-parser-config'] });
      queryClient.invalidateQueries({ queryKey: ['email-parser-stats'] });
    },
    onError: (error: Error) => {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  // Test connection mutation
  const testConnectionMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch('/api/email-parser/test-connection', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          host: formData.host,
          port: formData.port,
          username: formData.username,
          password: (formData as any).password,
          tls: formData.tls,
        }),
      });
      if (!response.ok) throw new Error('Connection test failed');
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: 'Connection successful',
        description: 'IMAP connection test passed',
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Connection failed',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  // Toggle enabled mutation
  const toggleEnabledMutation = useMutation({
    mutationFn: async (enabled: boolean) => {
      const endpoint = enabled ? '/api/email-parser/enable' : '/api/email-parser/disable';
      const response = await fetch(endpoint, {
        method: 'POST',
        credentials: 'include',
      });
      if (!response.ok) throw new Error('Failed to toggle monitoring');
      return response.json();
    },
    onSuccess: (_, enabled) => {
      toast({
        title: enabled ? 'Monitoring enabled' : 'Monitoring disabled',
        description: enabled
          ? 'Email monitoring has been started'
          : 'Email monitoring has been stopped',
      });
      queryClient.invalidateQueries({ queryKey: ['email-parser-config'] });
      queryClient.invalidateQueries({ queryKey: ['email-parser-stats'] });
    },
    onError: (error: Error) => {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const handleSave = () => {
    saveConfigMutation.mutate(formData);
  };

  const handleTestConnection = () => {
    testConnectionMutation.mutate();
  };

  const handleToggleEnabled = (enabled: boolean) => {
    toggleEnabledMutation.mutate(enabled);
  };

  if (configLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  const statusBadge = stats?.enabled ? (
    <Badge className="bg-green-500">
      <CheckCircle2 className="h-3 w-3 mr-1" />
      Enabled
    </Badge>
  ) : (
    <Badge variant="secondary">
      <XCircle className="h-3 w-3 mr-1" />
      Disabled
    </Badge>
  );

  const getSuccessRate = () => {
    if (!stats?.last30Days) return '0%';
    return stats.last30Days.successRate;
  };

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">AI Email-to-Ticket Parser</h1>
          <p className="text-muted-foreground">
            Automatically convert customer service emails into tickets using AI
          </p>
        </div>
        {statusBadge}
      </div>

      <Tabs defaultValue="configuration" className="space-y-6">
        <TabsList>
          <TabsTrigger value="configuration">Configuration</TabsTrigger>
          <TabsTrigger value="statistics">Statistics</TabsTrigger>
          <TabsTrigger value="processed-emails">Processed Emails</TabsTrigger>
        </TabsList>

        <TabsContent value="configuration" className="space-y-6">
          {/* Status Card */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Monitoring Status</CardTitle>
                  <CardDescription>
                    Email monitoring is currently {config?.enabled ? 'enabled' : 'disabled'}
                  </CardDescription>
                </div>
                <Switch
                  checked={config?.enabled || false}
                  onCheckedChange={handleToggleEnabled}
                  disabled={toggleEnabledMutation.isPending}
                />
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-sm text-muted-foreground">Last Check</Label>
                  <p className="text-sm font-medium">
                    {config?.lastCheckAt ? new Date(config.lastCheckAt).toLocaleString() : 'Never'}
                  </p>
                </div>
                <div>
                  <Label className="text-sm text-muted-foreground">Total Processed</Label>
                  <p className="text-sm font-medium">{config?.totalEmailsProcessed || 0} emails</p>
                </div>
              </div>

              {config?.lastError && (
                <Alert variant="destructive" className="mt-4">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    Last error: {config.lastError} ({' '}
                    {config.lastErrorAt && new Date(config.lastErrorAt).toLocaleString()})
                  </AlertDescription>
                </Alert>
              )}
            </CardContent>
          </Card>

          {/* Email Configuration */}
          <Card>
            <CardHeader>
              <CardTitle>Email Account Configuration</CardTitle>
              <CardDescription>Configure IMAP access to your service email inbox</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="emailAddress">Email Address</Label>
                  <Input
                    id="emailAddress"
                    type="email"
                    placeholder="service@company.com"
                    value={formData.emailAddress || ''}
                    onChange={(e) => setFormData({ ...formData, emailAddress: e.target.value })}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="protocol">Protocol</Label>
                  <Input id="protocol" value="IMAP" disabled className="bg-muted" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="host">IMAP Host</Label>
                  <Input
                    id="host"
                    placeholder="imap.gmail.com"
                    value={formData.host || ''}
                    onChange={(e) => setFormData({ ...formData, host: e.target.value })}
                  />
                  <p className="text-xs text-muted-foreground">
                    Gmail: imap.gmail.com | Outlook: outlook.office365.com
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="port">Port</Label>
                  <Input
                    id="port"
                    type="number"
                    placeholder="993"
                    value={formData.port || 993}
                    onChange={(e) => setFormData({ ...formData, port: parseInt(e.target.value) })}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="username">Username</Label>
                  <Input
                    id="username"
                    placeholder="service@company.com"
                    value={formData.username || ''}
                    onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="password">Password / App Password</Label>
                  <Input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    placeholder="••••••••"
                    onChange={(e) => setFormData({ ...formData, password: e.target.value } as any)}
                  />
                  <p className="text-xs text-muted-foreground">
                    Gmail requires an App Password (not your regular password)
                  </p>
                </div>
              </div>

              <div className="flex items-center space-x-2">
                <Switch
                  id="tls"
                  checked={formData.tls !== false}
                  onCheckedChange={(checked) => setFormData({ ...formData, tls: checked })}
                />
                <Label htmlFor="tls">Use TLS/SSL (Recommended)</Label>
              </div>

              <div className="flex gap-2">
                <Button
                  onClick={handleTestConnection}
                  variant="outline"
                  disabled={testConnectionMutation.isPending}
                >
                  {testConnectionMutation.isPending && (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  )}
                  Test Connection
                </Button>

                <Button onClick={handleSave} disabled={saveConfigMutation.isPending}>
                  {saveConfigMutation.isPending && (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  )}
                  Save Configuration
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Settings */}
          <Card>
            <CardHeader>
              <CardTitle>Parser Settings</CardTitle>
              <CardDescription>Configure how emails are processed</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="pollInterval">Poll Interval (seconds)</Label>
                <Input
                  id="pollInterval"
                  type="number"
                  min="30"
                  max="600"
                  value={formData.pollInterval || 60}
                  onChange={(e) =>
                    setFormData({ ...formData, pollInterval: parseInt(e.target.value) })
                  }
                />
                <p className="text-xs text-muted-foreground">
                  How often to check for new emails (30-600 seconds)
                </p>
              </div>

              <div className="flex items-center space-x-2">
                <Switch
                  id="autoAssign"
                  checked={formData.autoAssignTechnician !== false}
                  onCheckedChange={(checked) =>
                    setFormData({ ...formData, autoAssignTechnician: checked })
                  }
                />
                <Label htmlFor="autoAssign">Auto-assign tickets to technicians</Label>
              </div>

              <div className="flex items-center space-x-2">
                <Switch
                  id="confirmEmail"
                  checked={formData.sendConfirmationEmail !== false}
                  onCheckedChange={(checked) =>
                    setFormData({ ...formData, sendConfirmationEmail: checked })
                  }
                />
                <Label htmlFor="confirmEmail">Send confirmation emails to customers</Label>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="statistics" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-medium">Emails Processed (30 days)</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">{stats?.last30Days?.total || 0}</div>
                <p className="text-xs text-muted-foreground mt-2">
                  Success rate: {getSuccessRate()}
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-medium">Tickets Created</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-green-600">
                  {stats?.last30Days?.success || 0}
                </div>
                <p className="text-xs text-muted-foreground mt-2">Successfully processed</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-medium">Failed</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-red-600">
                  {stats?.last30Days?.failed || 0}
                </div>
                <p className="text-xs text-muted-foreground mt-2">Parsing failures</p>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Recent Activity</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Last Successful Check</span>
                  <span className="text-sm font-medium">
                    {stats?.lastSuccessAt
                      ? new Date(stats.lastSuccessAt).toLocaleString()
                      : 'Never'}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Last Check</span>
                  <span className="text-sm font-medium">
                    {stats?.lastCheckAt ? new Date(stats.lastCheckAt).toLocaleString() : 'Never'}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Total Emails Processed</span>
                  <span className="text-sm font-medium">{stats?.totalEmailsProcessed || 0}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Total Tickets Created</span>
                  <span className="text-sm font-medium">{stats?.totalTicketsCreated || 0}</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="processed-emails" className="space-y-6">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Processed Emails</CardTitle>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    queryClient.invalidateQueries({ queryKey: ['email-parser-emails'] })
                  }
                >
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Refresh
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {emailsLoading ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin" />
                </div>
              ) : (
                <div className="space-y-2">
                  {emailsData?.emails && emailsData.emails.length > 0 ? (
                    emailsData.emails.map((email) => (
                      <div
                        key={email.id}
                        className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors"
                      >
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <Mail className="h-4 w-4 text-muted-foreground shrink-0" />
                            <p className="font-medium truncate">{email.from}</p>
                            {email.processingStatus === 'success' ? (
                              <Badge variant="default" className="bg-green-500 shrink-0">
                                <CheckCircle2 className="h-3 w-3 mr-1" />
                                Success
                              </Badge>
                            ) : (
                              <Badge variant="destructive" className="shrink-0">
                                <XCircle className="h-3 w-3 mr-1" />
                                Failed
                              </Badge>
                            )}
                          </div>
                          <p className="text-sm text-muted-foreground truncate mt-1">
                            {email.subject}
                          </p>
                          {email.processingError && (
                            <p className="text-xs text-destructive mt-1">{email.processingError}</p>
                          )}
                        </div>
                        <div className="text-right shrink-0 ml-4">
                          <p className="text-sm text-muted-foreground">
                            {new Date(email.processedAt).toLocaleString()}
                          </p>
                          {email.ticketId && (
                            <p className="text-xs text-blue-600">Ticket: {email.ticketId}</p>
                          )}
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="text-center py-8 text-muted-foreground">
                      No emails processed yet
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
