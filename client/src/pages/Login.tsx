import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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
import { config } from '@/lib/config';
import { sanitizeEmail, getSafeRedirectRoute } from '@/lib/validations';
import { formatAuthError } from '@/lib/auth-utils';
import { Printer, ArrowLeft, Eye, EyeOff, Loader2, Shield, Zap, BarChart3 } from 'lucide-react';
import { GoogleIcon } from '@/components/icons/GoogleIcon';
import { AppleIcon } from '@/components/icons/AppleIcon';
import { useTranslation } from '@/hooks/useTranslation';

const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
});

type LoginForm = z.infer<typeof loginSchema>;

export default function Login() {
  const { t } = useTranslation();
  const { toast } = useToast();
  const { login, isAuthenticated, isLoading: authLoading } = useAuthContext();
  const queryClient = useQueryClient();
  const [isLoading, setIsLoading] = useState(false);
  const [oauthLoading, setOauthLoading] = useState<'google' | 'apple' | null>(null);
  const [showPassword, setShowPassword] = useState(false);

  const oauthEnabled =
    !!config.supabase.url &&
    !!config.supabase.anonKey &&
    !config.supabase.url.includes('placeholder') &&
    !config.supabase.anonKey.includes('placeholder');

  const startOAuth = async (provider: 'google' | 'apple') => {
    if (!oauthEnabled) {
      toast({
        title: 'OAuth not configured',
        description: 'Social sign-in is not available at this time. Please use email and password.',
        variant: 'destructive',
      });
      return;
    }

    setOauthLoading(provider);
    try {
      // Use the OAuth proxy edge function for self-hosted Supabase
      const functionsUrl = config.supabase.functionsUrl;
      const lastRoute = localStorage.getItem('printyx_last_route');
      const redirectTo = lastRoute || '/dashboard';

      const oauthUrl = `${functionsUrl}/oauth-proxy?action=authorize&provider=${provider}&redirect_to=${encodeURIComponent(redirectTo)}`;
      window.location.href = oauthUrl;
    } catch (error: any) {
      toast({
        title: `Sign in with ${provider === 'google' ? 'Google' : 'Apple'} failed`,
        description: formatAuthError(error),
        variant: 'destructive',
      });
      setOauthLoading(null);
    }
  };

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
      // SECURITY: Sanitize email input
      const sanitizedEmail = sanitizeEmail(data.email);
      await login(sanitizedEmail, data.password);
    },
    onSuccess: () => {
      toast({
        title: 'Login successful',
        description: 'Welcome back!',
      });
      queryClient.invalidateQueries({ queryKey: ['supabase-auth-user'] });
      const redirectTo = getSafeRedirectRoute();
      window.location.replace(redirectTo);
    },
    onError: (error: any) => {
      toast({
        title: 'Login failed',
        description: formatAuthError(error),
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
    <div className="min-h-screen flex">
      {/* Left Panel - Branding & Features */}
      <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden bg-gradient-to-br from-slate-900 via-blue-950 to-indigo-950">
        {/* Animated background shapes */}
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute -top-40 -left-40 w-80 h-80 bg-blue-500/10 rounded-full blur-3xl animate-pulse" />
          <div className="absolute top-1/3 -right-20 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl animate-pulse [animation-delay:2s]" />
          <div className="absolute -bottom-32 left-1/4 w-72 h-72 bg-cyan-500/10 rounded-full blur-3xl animate-pulse [animation-delay:4s]" />
          {/* Grid pattern overlay */}
          <div
            className="absolute inset-0 opacity-[0.03]"
            style={{
              backgroundImage:
                'linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)',
              backgroundSize: '60px 60px',
            }}
          />
        </div>

        <div className="relative z-10 flex flex-col justify-between p-12 w-full">
          {/* Logo */}
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 bg-white/10 backdrop-blur-sm border border-white/20 rounded-xl flex items-center justify-center">
              <Printer className="text-white h-6 w-6" />
            </div>
            <span className="text-2xl font-bold text-white tracking-tight">Printyx</span>
          </div>

          {/* Central content */}
          <div className="space-y-8">
            <div>
              <h2 className="text-4xl font-bold text-white leading-tight">
                The Modern Platform
                <br />
                for Copier Dealers
              </h2>
              <p className="mt-4 text-lg text-blue-200/70 max-w-md">
                Streamline operations, boost revenue, and deliver exceptional service with
                intelligent automation.
              </p>
            </div>

            {/* Feature highlights */}
            <div className="space-y-5">
              <div className="flex items-start gap-4 group">
                <div className="flex-shrink-0 w-10 h-10 bg-blue-500/20 border border-blue-400/20 rounded-lg flex items-center justify-center group-hover:bg-blue-500/30 transition-colors">
                  <Zap className="h-5 w-5 text-blue-400" />
                </div>
                <div>
                  <h3 className="text-white font-semibold">AI-Powered Automation</h3>
                  <p className="text-sm text-blue-200/50 mt-0.5">
                    Predictive maintenance, smart routing, and automated billing
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-4 group">
                <div className="flex-shrink-0 w-10 h-10 bg-emerald-500/20 border border-emerald-400/20 rounded-lg flex items-center justify-center group-hover:bg-emerald-500/30 transition-colors">
                  <BarChart3 className="h-5 w-5 text-emerald-400" />
                </div>
                <div>
                  <h3 className="text-white font-semibold">Real-Time Analytics</h3>
                  <p className="text-sm text-blue-200/50 mt-0.5">
                    Live dashboards, fleet monitoring, and financial insights
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-4 group">
                <div className="flex-shrink-0 w-10 h-10 bg-violet-500/20 border border-violet-400/20 rounded-lg flex items-center justify-center group-hover:bg-violet-500/30 transition-colors">
                  <Shield className="h-5 w-5 text-violet-400" />
                </div>
                <div>
                  <h3 className="text-white font-semibold">Enterprise Security</h3>
                  <p className="text-sm text-blue-200/50 mt-0.5">
                    Multi-tenant isolation, RBAC, and SOC 2 compliance
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Bottom */}
          <div className="flex items-center gap-2 text-sm text-blue-200/30">
            <div className="w-2 h-2 rounded-full bg-emerald-400/60" />
            <span>All systems operational</span>
          </div>
        </div>
      </div>

      {/* Right Panel - Login Form */}
      <div className="w-full lg:w-1/2 flex flex-col bg-white">
        {/* Top bar */}
        <div className="flex items-center justify-between p-6">
          <a
            href="/"
            className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-gray-900 transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Homepage
          </a>
          {/* Mobile logo */}
          <div className="flex items-center gap-2 lg:hidden">
            <div className="w-8 h-8 bg-slate-900 rounded-lg flex items-center justify-center">
              <Printer className="text-white h-4 w-4" />
            </div>
            <span className="font-bold text-gray-900">Printyx</span>
          </div>
        </div>

        {/* Form container */}
        <div className="flex-1 flex items-center justify-center px-6 py-12 sm:px-12">
          <div className="w-full max-w-sm">
            {/* Header */}
            <div className="mb-8">
              <h1 className="text-2xl font-bold text-gray-900 tracking-tight">
                {t('auth.login.title')}
              </h1>
              <p className="mt-2 text-sm text-gray-500">{t('auth.login.subtitle')}</p>
            </div>

            {/* OAuth buttons */}
            <div className="space-y-3">
              <Button
                type="button"
                variant="outline"
                className="w-full h-11 border-gray-200 bg-white hover:bg-gray-50 text-gray-700 font-medium transition-all"
                disabled={!oauthEnabled || oauthLoading !== null}
                onClick={() => startOAuth('google')}
              >
                {oauthLoading === 'google' ? (
                  <Loader2 className="h-4 w-4 mr-3 animate-spin" />
                ) : (
                  <GoogleIcon className="h-5 w-5 mr-3" />
                )}
                {oauthLoading === 'google' ? 'Redirecting...' : t('auth.login.continueWithGoogle')}
              </Button>
              <Button
                type="button"
                variant="outline"
                className="w-full h-11 border-gray-200 bg-white hover:bg-gray-50 text-gray-700 font-medium transition-all"
                disabled={!oauthEnabled || oauthLoading !== null}
                onClick={() => startOAuth('apple')}
              >
                {oauthLoading === 'apple' ? (
                  <Loader2 className="h-4 w-4 mr-3 animate-spin" />
                ) : (
                  <AppleIcon className="h-5 w-5 mr-3" />
                )}
                {oauthLoading === 'apple' ? 'Redirecting...' : t('auth.login.continueWithApple')}
              </Button>
            </div>

            {/* Divider */}
            <div className="relative my-6">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-gray-200" />
              </div>
              <div className="relative flex justify-center">
                <span className="bg-white px-3 text-xs font-medium text-gray-400 uppercase tracking-wider">
                  {t('auth.login.or')}
                </span>
              </div>
            </div>

            {/* Email/Password Form */}
            <Form {...form}>
              <form
                onSubmit={form.handleSubmit(onSubmit)}
                className="space-y-4"
                aria-label="Sign in form"
              >
                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-sm font-medium text-gray-700">
                        {t('auth.login.emailLabel')}
                      </FormLabel>
                      <FormControl>
                        <Input
                          placeholder={t('auth.login.emailPlaceholder')}
                          className="h-11 border-gray-200 focus:border-blue-500 focus:ring-blue-500/20"
                          autoComplete="email"
                          {...field}
                        />
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
                        <FormLabel className="text-sm font-medium text-gray-700">
                          {t('auth.login.passwordLabel')}
                        </FormLabel>
                        <a
                          href="/forgot-password"
                          className="text-xs text-blue-600 hover:text-blue-700 font-medium transition-colors"
                        >
                          {t('auth.login.forgotPassword')}
                        </a>
                      </div>
                      <FormControl>
                        <div className="relative">
                          <Input
                            type={showPassword ? 'text' : 'password'}
                            placeholder={t('auth.login.passwordPlaceholder')}
                            className="h-11 border-gray-200 focus:border-blue-500 focus:ring-blue-500/20 pr-10"
                            autoComplete="current-password"
                            {...field}
                          />
                          <button
                            type="button"
                            onClick={() => setShowPassword(!showPassword)}
                            aria-label={
                              showPassword
                                ? t('auth.login.hidePassword')
                                : t('auth.login.showPassword')
                            }
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                            tabIndex={-1}
                          >
                            {showPassword ? (
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
                  className="w-full h-11 bg-slate-900 hover:bg-slate-800 text-white font-medium transition-all mt-2"
                  disabled={isLoading || loginMutation.isPending}
                >
                  {isLoading || loginMutation.isPending ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      {t('auth.login.signingIn')}
                    </>
                  ) : (
                    t('auth.login.signIn')
                  )}
                </Button>
              </form>
            </Form>

            {/* Sign up link */}
            <p className="mt-8 text-center text-sm text-gray-500">
              {t('auth.login.noAccount')}{' '}
              <a
                href="/signup"
                className="text-blue-600 hover:text-blue-700 font-semibold transition-colors"
              >
                {t('auth.login.signUp')}
              </a>
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 text-center text-xs text-gray-400">
          By signing in, you agree to our{' '}
          <a href="/terms" className="text-gray-500 hover:text-gray-700 underline">
            Terms
          </a>{' '}
          and{' '}
          <a href="/privacy" className="text-gray-500 hover:text-gray-700 underline">
            Privacy Policy
          </a>
        </div>
      </div>
    </div>
  );
}
