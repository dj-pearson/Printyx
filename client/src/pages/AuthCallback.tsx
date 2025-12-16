/**
 * Auth Callback Page
 *
 * Handles Supabase Auth redirects for:
 * - Email verification
 * - Password reset
 * - OAuth callbacks
 *
 * Route: /auth/callback
 */

import { useEffect, useState } from 'react';
import { useLocation } from 'wouter';
import { supabase } from '@/lib/supabase';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Printer, CheckCircle, XCircle, Loader2 } from 'lucide-react';
import { Link } from 'wouter';

type CallbackStatus = 'loading' | 'success' | 'error';
type CallbackType = 'verification' | 'recovery' | 'signup' | 'unknown';

export default function AuthCallback() {
  const [, setLocation] = useLocation();
  const [status, setStatus] = useState<CallbackStatus>('loading');
  const [callbackType, setCallbackType] = useState<CallbackType>('unknown');
  const [errorMessage, setErrorMessage] = useState<string>('');

  useEffect(() => {
    const handleAuthCallback = async () => {
      try {
        // Get the hash fragment from the URL
        const hashParams = new URLSearchParams(window.location.hash.substring(1));
        const queryParams = new URLSearchParams(window.location.search);

        // Determine callback type
        const type = hashParams.get('type') || queryParams.get('type');
        const accessToken = hashParams.get('access_token');
        const refreshToken = hashParams.get('refresh_token');
        const errorCode = hashParams.get('error_code') || queryParams.get('error_code');
        const errorDescription =
          hashParams.get('error_description') || queryParams.get('error_description');

        // Handle errors from Supabase
        if (errorCode || errorDescription) {
          setStatus('error');
          setErrorMessage(errorDescription || `Error code: ${errorCode}`);
          return;
        }

        // Determine the callback type for UI messaging
        if (type === 'recovery') {
          setCallbackType('recovery');
        } else if (type === 'signup' || type === 'email') {
          setCallbackType('verification');
        } else if (accessToken) {
          setCallbackType('signup');
        }

        // If we have tokens, set the session
        if (accessToken && refreshToken) {
          const { error } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          });

          if (error) {
            throw error;
          }

          setStatus('success');

          // For password recovery, redirect to reset password page
          if (type === 'recovery') {
            setTimeout(() => {
              setLocation('/reset-password');
            }, 2000);
            return;
          }

          // For email verification or signup, redirect to dashboard
          setTimeout(() => {
            setLocation('/');
          }, 2000);
          return;
        }

        // Try to exchange the code for a session (PKCE flow)
        const code = queryParams.get('code');
        if (code) {
          const { error } = await supabase.auth.exchangeCodeForSession(code);

          if (error) {
            throw error;
          }

          setStatus('success');

          // Redirect after successful code exchange
          setTimeout(() => {
            setLocation('/');
          }, 2000);
          return;
        }

        // If no tokens or code, try to get the session from URL (auto-confirm flow)
        const { data, error } = await supabase.auth.getSession();

        if (error) {
          throw error;
        }

        if (data.session) {
          setStatus('success');
          setTimeout(() => {
            setLocation('/');
          }, 2000);
        } else {
          // No session found, may need to check URL hash
          // Supabase sometimes puts session info in the hash
          const { data: hashData, error: hashError } = await supabase.auth.getSession();

          if (hashError) {
            throw hashError;
          }

          if (hashData.session) {
            setStatus('success');
            setTimeout(() => {
              setLocation('/');
            }, 2000);
          } else {
            setStatus('error');
            setErrorMessage('No valid session found. Please try again or contact support.');
          }
        }
      } catch (error) {
        console.error('Auth callback error:', error);
        setStatus('error');
        setErrorMessage(error instanceof Error ? error.message : 'An unexpected error occurred');
      }
    };

    handleAuthCallback();
  }, [setLocation]);

  const getTitle = () => {
    if (status === 'loading') {
      switch (callbackType) {
        case 'verification':
          return 'Verifying Email...';
        case 'recovery':
          return 'Verifying Reset Link...';
        default:
          return 'Processing...';
      }
    }

    if (status === 'success') {
      switch (callbackType) {
        case 'verification':
          return 'Email Verified!';
        case 'recovery':
          return 'Link Verified!';
        default:
          return 'Success!';
      }
    }

    return 'Verification Failed';
  };

  const getDescription = () => {
    if (status === 'loading') {
      return 'Please wait while we verify your request...';
    }

    if (status === 'success') {
      switch (callbackType) {
        case 'verification':
          return 'Your email has been verified. Redirecting to dashboard...';
        case 'recovery':
          return 'Your reset link is valid. Redirecting to set new password...';
        default:
          return 'Authentication successful. Redirecting...';
      }
    }

    return errorMessage || 'Something went wrong during verification.';
  };

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
            <CardTitle>{getTitle()}</CardTitle>
            <CardDescription>{getDescription()}</CardDescription>
          </CardHeader>
          <CardContent className="text-center">
            {status === 'loading' && (
              <div className="flex justify-center py-8">
                <Loader2 className="h-12 w-12 animate-spin text-primary" />
              </div>
            )}

            {status === 'success' && (
              <div className="py-8">
                <CheckCircle className="h-16 w-16 text-green-500 mx-auto mb-4" />
                <p className="text-sm text-muted-foreground">
                  You will be redirected automatically...
                </p>
              </div>
            )}

            {status === 'error' && (
              <div className="py-8">
                <XCircle className="h-16 w-16 text-red-500 mx-auto mb-4" />
                <div className="space-y-4">
                  <p className="text-sm text-red-600 bg-red-50 p-3 rounded-lg">{errorMessage}</p>
                  <div className="flex flex-col gap-2">
                    <Link href="/login">
                      <Button className="w-full">Go to Login</Button>
                    </Link>
                    <Link href="/signup">
                      <Button variant="outline" className="w-full">
                        Create Account
                      </Button>
                    </Link>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
