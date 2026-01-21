import { useEffect, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';
import { Printer, CheckCircle, AlertCircle, Loader2 } from 'lucide-react';
import { useLocation } from 'wouter';

export default function VerifyEmail() {
  const { toast } = useToast();
  const [, navigate] = useLocation();
  const [isVerifying, setIsVerifying] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Get token from URL
  const urlParams = new URLSearchParams(window.location.search);
  const token = urlParams.get('token');

  const verifyMutation = useMutation({
    mutationFn: async (token: string) => {
      return await apiRequest('/api/auth/verify-email', 'POST', { token });
    },
    onSuccess: (data) => {
      toast({
        title: 'Email verified!',
        description: 'Your account is now active. Redirecting...',
      });
      // Redirect to dashboard after 2 seconds
      setTimeout(() => {
        navigate('/');
      }, 2000);
    },
    onError: (error: any) => {
      setError(error.message || 'Verification failed');
      setIsVerifying(false);
      toast({
        title: 'Verification failed',
        description: error.message || 'Invalid or expired verification link',
        variant: 'destructive',
      });
    },
  });

  useEffect(() => {
    if (!token) {
      setError('No verification token provided');
      setIsVerifying(false);
      return;
    }

    // Verify the token
    verifyMutation.mutate(token);
  }, [token]);

  if (!token || error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
        <div className="w-full max-w-md">
          <Card>
            <CardHeader className="text-center">
              <div className="flex items-center justify-center space-x-2 mb-4">
                <div className="w-10 h-10 bg-primary rounded-lg flex items-center justify-center">
                  <Printer className="text-white h-6 w-6" />
                </div>
                <h1 className="text-2xl font-bold text-gray-900">Printyx</h1>
              </div>
              <CardTitle>Verification Failed</CardTitle>
              <CardDescription>Unable to verify your email address</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center mb-4">
                <AlertCircle className="h-16 w-16 text-red-600 mx-auto mb-4" />
                <p className="text-sm text-red-800 font-medium mb-2">Verification Link Invalid</p>
                <p className="text-sm text-red-700 mb-2">
                  {error || 'The verification link is invalid or has expired.'}
                </p>
                <p className="text-xs text-red-600">Verification links expire after 24 hours.</p>
              </div>

              <div className="space-y-2">
                <Button variant="outline" className="w-full" onClick={() => navigate('/login')}>
                  Go to Login
                </Button>
                <p className="text-xs text-center text-muted-foreground">
                  Need a new link? Contact support or try signing up again.
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  if (isVerifying) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
        <div className="w-full max-w-md">
          <Card>
            <CardHeader className="text-center">
              <div className="flex items-center justify-center space-x-2 mb-4">
                <div className="w-10 h-10 bg-primary rounded-lg flex items-center justify-center">
                  <Printer className="text-white h-6 w-6" />
                </div>
                <h1 className="text-2xl font-bold text-gray-900">Printyx</h1>
              </div>
              <CardTitle>Verifying Your Email</CardTitle>
              <CardDescription>Please wait a moment...</CardDescription>
            </CardHeader>
            <CardContent className="text-center">
              <Loader2 className="h-16 w-16 animate-spin text-primary mx-auto mb-4" />
              <p className="text-sm text-muted-foreground">Verifying your email address...</p>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  // Success state (shown briefly before redirect)
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <Card>
          <CardHeader className="text-center">
            <div className="flex items-center justify-center space-x-2 mb-4">
              <div className="w-10 h-10 bg-primary rounded-lg flex items-center justify-center">
                <Printer className="text-white h-6 w-6" />
              </div>
              <h1 className="text-2xl font-bold text-gray-900">Printyx</h1>
            </div>
            <CardTitle>Email Verified!</CardTitle>
            <CardDescription>Your account is now active</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="bg-green-50 border border-green-200 rounded-lg p-6 text-center">
              <CheckCircle className="h-16 w-16 text-green-600 mx-auto mb-4" />
              <p className="text-sm text-green-800 font-medium mb-2">
                Success! Your email has been verified.
              </p>
              <p className="text-sm text-green-700">Redirecting you to the dashboard...</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
