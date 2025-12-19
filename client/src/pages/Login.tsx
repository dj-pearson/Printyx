import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
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
import { Printer, ArrowLeft } from 'lucide-react';

const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
});

type LoginForm = z.infer<typeof loginSchema>;

export default function Login() {
  const { toast } = useToast();
  const { login, isAuthenticated, isLoading: authLoading } = useAuthContext();
  const queryClient = useQueryClient();
  const [isLoading, setIsLoading] = useState(false);

  // Redirect authenticated users to dashboard
  useEffect(() => {
    if (!authLoading && isAuthenticated) {
      window.location.replace('/');
    }
  }, [isAuthenticated, authLoading]);

  const form = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: '',
      password: '',
    },
  });

  const loginMutation = useMutation({
    mutationFn: async (data: LoginForm) => {
      await login(data.email, data.password);
    },
    onSuccess: () => {
      toast({
        title: 'Login successful',
        description: 'Welcome back!',
      });
      // Invalidate Supabase auth query to fetch fresh user data
      queryClient.invalidateQueries({ queryKey: ['supabase-auth-user'] });

      // Restore last visited route or go to dashboard
      const lastRoute = localStorage.getItem('printyx_last_route');
      // Exclude auth pages and API routes from redirect targets
      const invalidRoutes = [
        '/login',
        '/signup',
        '/forgot-password',
        '/reset-password',
        '/auth/callback',
      ];
      const isValidRoute =
        lastRoute && !invalidRoutes.includes(lastRoute) && !lastRoute.startsWith('/api/');
      const redirectTo = isValidRoute ? lastRoute : '/';

      // Clear the stored route after using it
      localStorage.removeItem('printyx_last_route');

      // Use location.replace for smooth transition without back button issue
      window.location.replace(redirectTo);
    },
    onError: (error: any) => {
      toast({
        title: 'Login failed',
        description: error.message || 'Invalid email or password',
        variant: 'destructive',
      });
    },
  });

  const onSubmit = async (data: LoginForm) => {
    setIsLoading(true);
    try {
      await loginMutation.mutateAsync(data);
    } finally {
      setIsLoading(false);
    }
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

        {/* Login Form */}
        <Card className="w-full">
          <CardHeader className="text-center">
            <div className="flex items-center justify-center space-x-2 mb-4">
              <div className="w-10 h-10 bg-primary rounded-lg flex items-center justify-center">
                <Printer className="text-white h-6 w-6" />
              </div>
              <h1 className="text-2xl font-bold text-gray-900">Printyx</h1>
            </div>
            <CardTitle>Sign In</CardTitle>
            <CardDescription>
              Enter your credentials to access the copier management platform
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Email</FormLabel>
                      <FormControl>
                        <Input placeholder="Enter your email" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="password"
                  render={({ field }) => (
                    <FormItem>
                      <div className="flex items-center justify-between">
                        <FormLabel>Password</FormLabel>
                        <a href="/forgot-password" className="text-sm text-primary hover:underline">
                          Forgot password?
                        </a>
                      </div>
                      <FormControl>
                        <Input type="password" placeholder="Enter your password" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <Button
                  type="submit"
                  className="w-full"
                  disabled={isLoading || loginMutation.isPending}
                >
                  {isLoading || loginMutation.isPending ? 'Signing in...' : 'Sign In'}
                </Button>

                <div className="text-center text-sm text-muted-foreground border-t pt-4 mt-4">
                  Don't have an account?{' '}
                  <a href="/signup" className="text-primary hover:underline font-medium">
                    Sign up for free
                  </a>
                </div>
              </form>
            </Form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
