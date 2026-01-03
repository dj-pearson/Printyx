import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  FormDescription,
} from '@/components/ui/form';
import { useToast } from '@/hooks/use-toast';
import { useAuthContext } from '@/providers/AuthProvider';
import { supabase } from '@/lib/supabase';
import { Printer, CheckCircle, AlertCircle, Eye, EyeOff, Loader2, ArrowLeft } from 'lucide-react';
import { Link, useLocation } from 'wouter';

// SECURITY: Match backend password requirements (12+ chars with special character)
const resetPasswordSchema = z
  .object({
    password: z
      .string()
      .min(12, 'Password must be at least 12 characters')
      .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
      .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
      .regex(/[0-9]/, 'Password must contain at least one number')
      .regex(/[^A-Za-z0-9]/, 'Password must contain at least one special character'),
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords don't match",
    path: ['confirmPassword'],
  });

type ResetPasswordForm = z.infer<typeof resetPasswordSchema>;

export default function ResetPassword() {
  const { toast } = useToast();
  const [, navigate] = useLocation();
  const { updatePassword, isAuthenticated, isLoading: authLoading } = useAuthContext();
  const [isSuccess, setIsSuccess] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isValidSession, setIsValidSession] = useState<boolean | null>(null);
  const [checkingSession, setCheckingSession] = useState(true);

  const form = useForm<ResetPasswordForm>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: {
      password: '',
      confirmPassword: '',
    },
  });

  // Check if user has a valid session from the password reset flow
  useEffect(() => {
    const checkSession = async () => {
      try {
        // Get current session
        const {
          data: { session },
          error,
        } = await supabase.auth.getSession();

        if (error) {
          console.error('Session check error:', error);
          setIsValidSession(false);
          setCheckingSession(false);
          return;
        }

        // User should have a session from the /auth/callback redirect
        if (session) {
          setIsValidSession(true);
        } else {
          setIsValidSession(false);
        }
      } catch (err) {
        console.error('Session check failed:', err);
        setIsValidSession(false);
      } finally {
        setCheckingSession(false);
      }
    };

    checkSession();
  }, []);

  const resetPasswordMutation = useMutation({
    mutationFn: async (data: ResetPasswordForm) => {
      // Use Supabase's updateUser to set new password
      await updatePassword(data.password);
    },
    onSuccess: () => {
      setIsSuccess(true);
      toast({
        title: 'Password reset successful',
        description: 'You can now login with your new password',
      });
      // Redirect to dashboard after 3 seconds (user is already logged in)
      setTimeout(() => {
        navigate('/');
      }, 3000);
    },
    onError: (error: any) => {
      toast({
        title: 'Reset failed',
        description: error.message || 'Please try requesting a new reset link',
        variant: 'destructive',
      });
    },
  });

  const onSubmit = async (data: ResetPasswordForm) => {
    await resetPasswordMutation.mutateAsync(data);
  };

  // Loading state while checking session
  if (checkingSession || authLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
        <div className="w-full max-w-md">
          {/* Back to Homepage Button */}
          <div className="mb-4">
            <Button
              variant="ghost"
              size="sm"
              asChild
              className="text-gray-700 hover:text-gray-900 hover:bg-white/50"
            >
              <a href="/">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Homepage
              </a>
            </Button>
          </div>

          <Card className="w-full">
            <CardContent className="pt-6 text-center">
              <Loader2 className="h-12 w-12 animate-spin text-primary mx-auto mb-4" />
              <p className="text-gray-600">Verifying your reset link...</p>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  // Invalid session state - user needs to request a new reset link
  if (!isValidSession) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
        <div className="w-full max-w-md">
          {/* Back to Homepage Button */}
          <div className="mb-4">
            <Button
              variant="ghost"
              size="sm"
              asChild
              className="text-gray-700 hover:text-gray-900 hover:bg-white/50"
            >
              <a href="/">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Homepage
              </a>
            </Button>
          </div>

          <Card className="w-full">
            <CardHeader className="text-center">
              <div className="flex items-center justify-center space-x-2 mb-4">
                <div className="w-10 h-10 bg-primary rounded-lg flex items-center justify-center">
                  <Printer className="text-white h-6 w-6" />
                </div>
                <h1 className="text-2xl font-bold text-gray-900">Printyx</h1>
              </div>
              <CardTitle>Invalid Reset Link</CardTitle>
              <CardDescription>This password reset link is invalid or has expired</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-center mb-4">
                <AlertCircle className="h-12 w-12 text-red-600 mx-auto mb-3" />
                <p className="text-sm text-red-800 font-medium mb-2">Link Invalid or Expired</p>
                <p className="text-sm text-red-700">
                  Password reset links expire after a short time and can only be used once.
                </p>
              </div>

              <Link href="/forgot-password">
                <Button className="w-full">Request New Reset Link</Button>
              </Link>

              <Link href="/login">
                <Button variant="ghost" className="w-full mt-2">
                  Back to Login
                </Button>
              </Link>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Back to Homepage Button */}
        <div className="mb-4">
          <Button
            variant="ghost"
            size="sm"
            asChild
            className="text-gray-700 hover:text-gray-900 hover:bg-white/50"
          >
            <a href="/">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Homepage
            </a>
          </Button>
        </div>

        <Card className="w-full">
          <CardHeader className="text-center">
            <div className="flex items-center justify-center space-x-2 mb-4">
              <div className="w-10 h-10 bg-primary rounded-lg flex items-center justify-center">
                <Printer className="text-white h-6 w-6" />
              </div>
              <h1 className="text-2xl font-bold text-gray-900">Printyx</h1>
            </div>
            <CardTitle>Reset Your Password</CardTitle>
            <CardDescription>
              {isSuccess
                ? 'Your password has been reset successfully'
                : 'Choose a strong password for your account'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isSuccess ? (
              <div className="space-y-4">
                <div className="bg-green-50 border border-green-200 rounded-lg p-4 text-center">
                  <CheckCircle className="h-12 w-12 text-green-600 mx-auto mb-3" />
                  <p className="text-sm text-green-800 font-medium mb-2">
                    Password Reset Successful!
                  </p>
                  <p className="text-sm text-green-700">Redirecting you to dashboard...</p>
                </div>

                <Link href="/">
                  <Button className="w-full">Go to Dashboard</Button>
                </Link>
              </div>
            ) : (
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                  <FormField
                    control={form.control}
                    name="password"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>New Password</FormLabel>
                        <FormControl>
                          <div className="relative">
                            <Input
                              type={showPassword ? 'text' : 'password'}
                              placeholder="Enter new password"
                              {...field}
                            />
                            <button
                              type="button"
                              onClick={() => setShowPassword(!showPassword)}
                              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
                            >
                              {showPassword ? (
                                <EyeOff className="h-4 w-4" />
                              ) : (
                                <Eye className="h-4 w-4" />
                              )}
                            </button>
                          </div>
                        </FormControl>
                        <FormDescription>
                          At least 12 characters with uppercase, lowercase, number, and special
                          character
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="confirmPassword"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Confirm Password</FormLabel>
                        <FormControl>
                          <div className="relative">
                            <Input
                              type={showConfirmPassword ? 'text' : 'password'}
                              placeholder="Confirm new password"
                              {...field}
                            />
                            <button
                              type="button"
                              onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
                            >
                              {showConfirmPassword ? (
                                <EyeOff className="h-4 w-4" />
                              ) : (
                                <Eye className="h-4 w-4" />
                              )}
                            </button>
                          </div>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <Button
                    type="submit"
                    className="w-full"
                    disabled={resetPasswordMutation.isPending}
                  >
                    {resetPasswordMutation.isPending ? 'Resetting...' : 'Reset Password'}
                  </Button>

                  <Link href="/login">
                    <Button variant="ghost" className="w-full">
                      Back to Login
                    </Button>
                  </Link>
                </form>
              </Form>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
