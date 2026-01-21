import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import {
  Key,
  CheckCircle,
  XCircle,
  AlertCircle,
  Eye,
  EyeOff,
  Loader2,
  ExternalLink,
} from 'lucide-react';

// Schema for Apollo API key form
const apolloKeySchema = z.object({
  apiKey: z.string().min(10, 'API key must be at least 10 characters').trim(),
});

type ApolloKeyFormData = z.infer<typeof apolloKeySchema>;

interface ApolloCredentialStatus {
  configured: boolean;
  id?: string;
  status?: string;
  createdAt?: string;
  updatedAt?: string;
  apiKeyMasked?: string;
  metadata?: Record<string, any>;
}

interface VerifyResponse {
  valid: boolean;
  message?: string;
  error?: string;
  responseTimeMs?: number;
}

export function ApolloCredentialManager() {
  const { toast } = useToast();
  const [showApiKey, setShowApiKey] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [verifyResult, setVerifyResult] = useState<VerifyResponse | null>(null);

  // Fetch current credential status
  const { data: credentialStatus, isLoading } = useQuery<ApolloCredentialStatus>({
    queryKey: ['/api/apollo/credentials'],
  });

  // Setup form
  const form = useForm<ApolloKeyFormData>({
    resolver: zodResolver(apolloKeySchema),
    defaultValues: {
      apiKey: '',
    },
  });

  // Save mutation
  const saveMutation = useMutation({
    mutationFn: async (data: ApolloKeyFormData) => {
      return await apiRequest('/api/apollo/credentials', 'POST', { apiKey: data.apiKey });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/apollo/credentials'] });
      form.reset();
      setVerifyResult(null);
      toast({
        title: 'Success',
        description: 'Apollo.io API key saved successfully',
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to save API key',
        variant: 'destructive',
      });
    },
  });

  // Verify mutation
  const verifyMutation = useMutation({
    mutationFn: async (apiKey?: string) => {
      return await apiRequest<VerifyResponse>(
        '/api/apollo/credentials/verify',
        'POST',
        apiKey ? { apiKey } : {},
      );
    },
    onSuccess: (data) => {
      setVerifyResult(data);
      if (data.valid) {
        toast({
          title: 'Verification Successful',
          description: data.message || 'API key is valid',
        });
      } else {
        toast({
          title: 'Verification Failed',
          description: data.error || 'Invalid API key',
          variant: 'destructive',
        });
      }
    },
    onError: (error: any) => {
      setVerifyResult({ valid: false, error: error.message });
      toast({
        title: 'Verification Error',
        description: error.message || 'Failed to verify API key',
        variant: 'destructive',
      });
    },
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: async () => {
      if (!credentialStatus?.id) throw new Error('No credential to delete');
      return await apiRequest(`/api/apollo/credentials/${credentialStatus.id}`, 'DELETE');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/apollo/credentials'] });
      setVerifyResult(null);
      toast({
        title: 'Success',
        description: 'Apollo.io credentials removed successfully',
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to remove credentials',
        variant: 'destructive',
      });
    },
  });

  const handleSave = async (data: ApolloKeyFormData) => {
    saveMutation.mutate(data);
  };

  const handleVerify = async (apiKey?: string) => {
    setIsVerifying(true);
    await verifyMutation.mutateAsync(apiKey);
    setIsVerifying(false);
  };

  const handleVerifyBeforeSave = async () => {
    const apiKey = form.getValues('apiKey');
    if (!apiKey) {
      toast({
        title: 'Error',
        description: 'Please enter an API key first',
        variant: 'destructive',
      });
      return;
    }
    await handleVerify(apiKey);
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Key className="h-5 w-5" />
            Apollo.io API Configuration
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card data-testid="apollo-credential-card">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Key className="h-5 w-5" />
            <CardTitle>Apollo.io API Configuration</CardTitle>
          </div>
          {credentialStatus?.configured && (
            <Badge
              variant={credentialStatus.status === 'active' ? 'default' : 'secondary'}
              data-testid="apollo-status-badge"
            >
              {credentialStatus.status === 'active' ? (
                <>
                  <CheckCircle className="h-3 w-3 mr-1" /> Configured
                </>
              ) : (
                <>
                  <AlertCircle className="h-3 w-3 mr-1" /> {credentialStatus.status}
                </>
              )}
            </Badge>
          )}
        </div>
        <CardDescription>
          Configure your company's Apollo.io API key to enable lead enrichment features.
          <a
            href="https://app.apollo.io/#/settings/integrations/api"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center ml-1 text-primary hover:underline"
          >
            Get your API key <ExternalLink className="h-3 w-3 ml-1" />
          </a>
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Current Status */}
        {credentialStatus?.configured && (
          <div className="space-y-3">
            <div className="flex items-center justify-between p-4 border rounded-lg bg-muted/50">
              <div className="space-y-1">
                <p className="text-sm font-medium">Current API Key</p>
                <p className="text-sm text-muted-foreground font-mono" data-testid="api-key-masked">
                  {credentialStatus.apiKeyMasked || 'Not available'}
                </p>
                {credentialStatus.updatedAt && (
                  <p className="text-xs text-muted-foreground">
                    Last updated: {new Date(credentialStatus.updatedAt).toLocaleDateString()}
                  </p>
                )}
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleVerify()}
                  disabled={isVerifying}
                  data-testid="button-verify-current"
                >
                  {isVerifying ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" /> Verifying...
                    </>
                  ) : (
                    <>
                      <CheckCircle className="h-4 w-4 mr-2" /> Test Connection
                    </>
                  )}
                </Button>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => {
                    if (
                      confirm(
                        'Are you sure you want to remove your Apollo.io API key? This will disable lead enrichment features.',
                      )
                    ) {
                      deleteMutation.mutate();
                    }
                  }}
                  disabled={deleteMutation.isPending}
                  data-testid="button-delete"
                >
                  {deleteMutation.isPending ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" /> Removing...
                    </>
                  ) : (
                    'Remove Key'
                  )}
                </Button>
              </div>
            </div>

            {/* Verification Result */}
            {verifyResult && (
              <Alert
                variant={verifyResult.valid ? 'default' : 'destructive'}
                data-testid="verify-result"
              >
                {verifyResult.valid ? (
                  <CheckCircle className="h-4 w-4" />
                ) : (
                  <XCircle className="h-4 w-4" />
                )}
                <AlertTitle>{verifyResult.valid ? 'Success' : 'Failed'}</AlertTitle>
                <AlertDescription>
                  {verifyResult.valid
                    ? `API key is valid (responded in ${verifyResult.responseTimeMs}ms)`
                    : verifyResult.error}
                </AlertDescription>
              </Alert>
            )}
          </div>
        )}

        {/* Add/Update Form */}
        <div className="space-y-4">
          <h3 className="font-medium">
            {credentialStatus?.configured ? 'Update API Key' : 'Add API Key'}
          </h3>

          <Form {...form}>
            <form onSubmit={form.handleSubmit(handleSave)} className="space-y-4">
              <FormField
                control={form.control}
                name="apiKey"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Apollo.io API Key</FormLabel>
                    <FormControl>
                      <div className="flex gap-2">
                        <div className="relative flex-1">
                          <Input
                            {...field}
                            type={showApiKey ? 'text' : 'password'}
                            placeholder="apollo_xxxxxxxxxxxxx"
                            className="pr-10 font-mono"
                            data-testid="input-api-key"
                          />
                          <button
                            type="button"
                            onClick={() => setShowApiKey(!showApiKey)}
                            className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                          >
                            {showApiKey ? (
                              <EyeOff className="h-4 w-4" />
                            ) : (
                              <Eye className="h-4 w-4" />
                            )}
                          </button>
                        </div>
                      </div>
                    </FormControl>
                    <FormDescription>
                      Your API key will be encrypted and stored securely. Only your company has
                      access to this key.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleVerifyBeforeSave}
                  disabled={isVerifying || !form.watch('apiKey')}
                  data-testid="button-verify-new"
                >
                  {isVerifying ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" /> Verifying...
                    </>
                  ) : (
                    <>
                      <CheckCircle className="h-4 w-4 mr-2" /> Verify
                    </>
                  )}
                </Button>
                <Button type="submit" disabled={saveMutation.isPending} data-testid="button-save">
                  {saveMutation.isPending ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" /> Saving...
                    </>
                  ) : (
                    <>
                      <Key className="h-4 w-4 mr-2" /> Save API Key
                    </>
                  )}
                </Button>
              </div>
            </form>
          </Form>
        </div>

        {/* Help Text */}
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Need Help?</AlertTitle>
          <AlertDescription className="space-y-2">
            <p>To get your Apollo.io API key:</p>
            <ol className="list-decimal list-inside space-y-1 text-sm">
              <li>Log in to your Apollo.io account</li>
              <li>Go to Settings → Integrations → API</li>
              <li>Copy your API key</li>
              <li>Paste it above and click "Verify" to test it</li>
              <li>Click "Save API Key" to enable lead enrichment</li>
            </ol>
          </AlertDescription>
        </Alert>
      </CardContent>
    </Card>
  );
}
