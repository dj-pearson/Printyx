import { useState } from 'react';
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
} from '@/components/ui/form';
import { useToast } from '@/hooks/use-toast';
import { useAuthContext } from '@/providers/AuthProvider';
import { Printer, ArrowLeft, Mail } from 'lucide-react';
import { Link } from 'wouter';

const forgotPasswordSchema = z.object({
  email: z.string().email('Please enter a valid email address'),
});

type ForgotPasswordForm = z.infer<typeof forgotPasswordSchema>;

export default function ForgotPassword() {
  const { toast } = useToast();
  const { resetPassword } = useAuthContext();
  const [isSuccess, setIsSuccess] = useState(false);

  const form = useForm<ForgotPasswordForm>({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: {
      email: '',
    },
  });

  const forgotPasswordMutation = useMutation({
    mutationFn: async (data: ForgotPasswordForm) => {
      // Use Supabase's built-in password reset
      await resetPassword(data.email);
    },
    onSuccess: () => {
      setIsSuccess(true);
      toast({
        title: 'Check your email',
        description: "If an account exists with that email, we've sent reset instructions.",
      });
    },
    onError: (error: any) => {
      // Supabase doesn't reveal if email exists, so we show success message anyway
      // Only show error for actual errors (network, etc.)
      if (error.message?.includes('rate limit')) {
        toast({
          title: 'Too many requests',
          description: 'Please wait a few minutes before trying again.',
          variant: 'destructive',
        });
      } else {
        // Still show success to prevent email enumeration
        setIsSuccess(true);
        toast({
          title: 'Check your email',
          description: "If an account exists with that email, we've sent reset instructions.",
        });
      }
    },
  });

  const onSubmit = async (data: ForgotPasswordForm) => {
    await forgotPasswordMutation.mutateAsync(data);
  };

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
            <CardTitle>Forgot Password?</CardTitle>
            <CardDescription>
              {isSuccess
                ? 'Check your inbox for reset instructions'
                : "Enter your email and we'll send you reset instructions"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isSuccess ? (
              <div className="space-y-4">
                <div className="bg-green-50 border border-green-200 rounded-lg p-4 text-center">
                  <Mail className="h-12 w-12 text-green-600 mx-auto mb-3" />
                  <p className="text-sm text-green-800 font-medium mb-2">Email Sent Successfully</p>
                  <p className="text-sm text-green-700">
                    If an account with email <strong>{form.getValues('email')}</strong> exists,
                    you'll receive password reset instructions shortly.
                  </p>
                </div>

                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <p className="text-sm text-blue-800 mb-2">
                    <strong>Didn't receive the email?</strong>
                  </p>
                  <ul className="text-sm text-blue-700 space-y-1">
                    <li>Check your spam/junk folder</li>
                    <li>Make sure you entered the correct email</li>
                    <li>Wait a few minutes and check again</li>
                  </ul>
                </div>

                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => {
                    setIsSuccess(false);
                    form.reset();
                  }}
                >
                  Try a different email
                </Button>

                <Link href="/login">
                  <Button variant="ghost" className="w-full">
                    <ArrowLeft className="mr-2 h-4 w-4" />
                    Back to Login
                  </Button>
                </Link>
              </div>
            ) : (
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                  <FormField
                    control={form.control}
                    name="email"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Email Address</FormLabel>
                        <FormControl>
                          <Input type="email" placeholder="Enter your email" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <Button
                    type="submit"
                    className="w-full"
                    disabled={forgotPasswordMutation.isPending}
                  >
                    {forgotPasswordMutation.isPending ? 'Sending...' : 'Send Reset Link'}
                  </Button>

                  <Link href="/login">
                    <Button variant="ghost" className="w-full">
                      <ArrowLeft className="mr-2 h-4 w-4" />
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
