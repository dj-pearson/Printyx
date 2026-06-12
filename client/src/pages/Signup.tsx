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
  FormDescription,
} from '@/components/ui/form';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { useToast } from '@/hooks/use-toast';
import { useAuthContext } from '@/providers/AuthProvider';
import { PasswordStrengthIndicator } from '@/components/auth/PasswordStrengthIndicator';
import { sanitizeEmail, sanitizeInput, PasswordSchema, EmailSchema } from '@/lib/validations';
import { formatAuthError } from '@/lib/auth-utils';
import { Printer, ArrowRight, ArrowLeft, CheckCircle, Eye, EyeOff, Mail } from 'lucide-react';
import { Link } from 'wouter';

const signupSchema = z
  .object({
    // Company information
    companyName: z.string().min(2, 'Company name is required'),
    industry: z.string().optional(),
    companySize: z.string().optional(),
    website: z.string().url('Please enter a valid URL').optional().or(z.literal('')),

    // Admin user
    firstName: z.string().min(1, 'First name is required'),
    lastName: z.string().min(1, 'Last name is required'),
    email: EmailSchema, // SECURITY: Use shared email schema with sanitization
    password: PasswordSchema, // SECURITY: Use shared password schema with complexity requirements
    confirmPassword: z.string(),
    phone: z.string().optional(),

    // Company details
    address: z.string().optional(),
    city: z.string().optional(),
    state: z.string().optional(),
    zip: z.string().optional(),
    country: z.string(),
    timezone: z.string(),

    // Plan selection
    planSlug: z.string(),
    billingCycle: z.enum(['monthly', 'annual']),

    // Terms acceptance
    acceptedTerms: z.boolean().refine((val) => val === true, 'You must accept the terms'),
    acceptedPrivacy: z
      .boolean()
      .refine((val) => val === true, 'You must accept the privacy policy'),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords don't match",
    path: ['confirmPassword'],
  });

type SignupForm = z.infer<typeof signupSchema>;

const INDUSTRIES = [
  'Copier Dealer',
  'Office Equipment',
  'Managed Print Services',
  'Document Management',
  'IT Services',
  'Other',
];

const COMPANY_SIZES = ['1-10 employees', '11-50 employees', '51-200 employees', '200+ employees'];

const TIMEZONES = [
  'America/New_York',
  'America/Chicago',
  'America/Denver',
  'America/Los_Angeles',
  'America/Phoenix',
  'America/Anchorage',
  'Pacific/Honolulu',
];

export default function Signup() {
  const { toast } = useToast();
  const { signup } = useAuthContext();
  const [currentStep, setCurrentStep] = useState(1);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [signupEmail, setSignupEmail] = useState('');

  const form = useForm<SignupForm>({
    resolver: zodResolver(signupSchema),
    defaultValues: {
      companyName: '',
      industry: '',
      companySize: '',
      website: '',
      firstName: '',
      lastName: '',
      email: '',
      password: '',
      confirmPassword: '',
      phone: '',
      address: '',
      city: '',
      state: '',
      zip: '',
      country: 'US',
      timezone: 'America/New_York',
      planSlug: 'starter',
      billingCycle: 'monthly',
      acceptedTerms: false,
      acceptedPrivacy: false,
    },
    mode: 'onChange',
  });

  const signupMutation = useMutation({
    mutationFn: async (data: SignupForm) => {
      // SECURITY: Sanitize all text inputs
      const metadata = {
        companyName: sanitizeInput(data.companyName),
        industry: data.industry ? sanitizeInput(data.industry) : undefined,
        companySize: data.companySize,
        website: data.website,
        firstName: sanitizeInput(data.firstName),
        lastName: sanitizeInput(data.lastName),
        phone: data.phone,
        address: data.address ? sanitizeInput(data.address) : undefined,
        city: data.city ? sanitizeInput(data.city) : undefined,
        state: data.state,
        zip: data.zip,
        country: data.country,
        timezone: data.timezone,
        planSlug: data.planSlug,
        billingCycle: data.billingCycle,
      };

      // SECURITY: Email is already sanitized by EmailSchema transform
      await signup(data.email, data.password, metadata);
      return { email: data.email };
    },
    onSuccess: (data) => {
      setSignupEmail(data.email);
      setIsSuccess(true);
      toast({
        title: 'Account created!',
        description: 'Please check your email to verify your account.',
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Signup failed',
        description: formatAuthError(error),
        variant: 'destructive',
      });
    },
  });

  const onSubmit = async (data: SignupForm) => {
    await signupMutation.mutateAsync(data);
  };

  const nextStep = async () => {
    const fieldsToValidate = getFieldsForStep(currentStep);
    const isValid = await form.trigger(fieldsToValidate as any);

    if (isValid) {
      setCurrentStep((prev) => Math.min(prev + 1, 5));
    }
  };

  const prevStep = () => {
    setCurrentStep((prev) => Math.max(prev - 1, 1));
  };

  const getFieldsForStep = (step: number): (keyof SignupForm)[] => {
    switch (step) {
      case 1:
        return ['companyName', 'industry', 'companySize', 'website'];
      case 2:
        return ['firstName', 'lastName', 'email', 'password', 'confirmPassword', 'phone'];
      case 3:
        return ['address', 'city', 'state', 'zip', 'country', 'timezone'];
      case 4:
        return ['planSlug', 'billingCycle'];
      case 5:
        return ['acceptedTerms', 'acceptedPrivacy'];
      default:
        return [];
    }
  };

  if (isSuccess) {
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
              <CardTitle>Check Your Email</CardTitle>
              <CardDescription>We've sent you a verification link</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="bg-green-50 border border-green-200 rounded-lg p-6 text-center mb-4">
                <Mail className="h-16 w-16 text-green-600 mx-auto mb-4" />
                <p className="text-sm text-green-800 font-medium mb-2">
                  Account Created Successfully!
                </p>
                <p className="text-sm text-green-700 mb-4">
                  We've sent a verification email to:
                  <br />
                  <strong>{signupEmail}</strong>
                </p>
                <p className="text-xs text-green-600">
                  Click the link in the email to activate your account.
                </p>
              </div>

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
                <p className="text-sm text-blue-800 mb-2">
                  <strong>Didn't receive the email?</strong>
                </p>
                <ul className="text-sm text-blue-700 space-y-1">
                  <li>• Check your spam/junk folder</li>
                  <li>• Wait a few minutes and check again</li>
                  <li>• Make sure you entered the correct email</li>
                </ul>
              </div>

              <Link href="/login">
                <Button className="w-full">Go to Login</Button>
              </Link>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4 py-8">
      <div className="w-full max-w-2xl">
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

        <Card>
          <CardHeader className="text-center">
            <div className="flex items-center justify-center space-x-2 mb-4">
              <div className="w-10 h-10 bg-primary rounded-lg flex items-center justify-center">
                <Printer className="text-white h-6 w-6" />
              </div>
              <h1 className="text-2xl font-bold text-gray-900">Printyx</h1>
            </div>
            <CardTitle>Create Your Account</CardTitle>
            <CardDescription>
              Start your 14-day free trial - no credit card required
            </CardDescription>

            {/* Progress Indicator */}
            <div className="flex items-center justify-center space-x-2 mt-6">
              {[1, 2, 3, 4, 5].map((step) => (
                <div
                  key={step}
                  className={`h-2 rounded-full transition-all ${
                    step === currentStep
                      ? 'w-8 bg-primary'
                      : step < currentStep
                        ? 'w-2 bg-primary'
                        : 'w-2 bg-gray-300'
                  }`}
                />
              ))}
            </div>
            <p className="text-xs text-muted-foreground mt-2">Step {currentStep} of 5</p>
          </CardHeader>

          <CardContent>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                {/* Step 1: Company Information */}
                {currentStep === 1 && (
                  <div className="space-y-4">
                    <h3 className="font-semibold text-lg">Company Information</h3>

                    <FormField
                      control={form.control}
                      name="companyName"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Company Name *</FormLabel>
                          <FormControl>
                            <Input placeholder="Acme Copier Solutions" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="industry"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Industry</FormLabel>
                          <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Select industry" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {INDUSTRIES.map((industry) => (
                                <SelectItem key={industry} value={industry}>
                                  {industry}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="companySize"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Company Size</FormLabel>
                          <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Select company size" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {COMPANY_SIZES.map((size) => (
                                <SelectItem key={size} value={size}>
                                  {size}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="website"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Website</FormLabel>
                          <FormControl>
                            <Input placeholder="https://www.example.com" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                )}

                {/* Step 2: Admin User */}
                {currentStep === 2 && (
                  <div className="space-y-4">
                    <h3 className="font-semibold text-lg">Your Information</h3>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <FormField
                        control={form.control}
                        name="firstName"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>First Name *</FormLabel>
                            <FormControl>
                              <Input placeholder="John" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="lastName"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Last Name *</FormLabel>
                            <FormControl>
                              <Input placeholder="Doe" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    <FormField
                      control={form.control}
                      name="email"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Email Address *</FormLabel>
                          <FormControl>
                            <Input type="email" placeholder="john@example.com" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="phone"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Phone Number</FormLabel>
                          <FormControl>
                            <Input type="tel" placeholder="(555) 123-4567" {...field} />
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
                          <FormLabel>Password *</FormLabel>
                          <FormControl>
                            <div className="relative">
                              <Input
                                type={showPassword ? 'text' : 'password'}
                                placeholder="Create a strong password"
                                {...field}
                              />
                              <button
                                type="button"
                                onClick={() => setShowPassword(!showPassword)}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
                                aria-label={showPassword ? 'Hide password' : 'Show password'}
                                aria-pressed={showPassword}
                              >
                                {showPassword ? (
                                  <EyeOff className="h-4 w-4" aria-hidden="true" />
                                ) : (
                                  <Eye className="h-4 w-4" aria-hidden="true" />
                                )}
                              </button>
                            </div>
                          </FormControl>
                          {/* Real-time password strength indicator */}
                          <PasswordStrengthIndicator
                            password={field.value || ''}
                            className="mt-2"
                          />
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="confirmPassword"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Confirm Password *</FormLabel>
                          <FormControl>
                            <div className="relative">
                              <Input
                                type={showConfirmPassword ? 'text' : 'password'}
                                placeholder="Confirm your password"
                                {...field}
                              />
                              <button
                                type="button"
                                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
                                aria-label={
                                  showConfirmPassword
                                    ? 'Hide confirm password'
                                    : 'Show confirm password'
                                }
                                aria-pressed={showConfirmPassword}
                              >
                                {showConfirmPassword ? (
                                  <EyeOff className="h-4 w-4" aria-hidden="true" />
                                ) : (
                                  <Eye className="h-4 w-4" aria-hidden="true" />
                                )}
                              </button>
                            </div>
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                )}

                {/* Step 3: Company Address */}
                {currentStep === 3 && (
                  <div className="space-y-4">
                    <h3 className="font-semibold text-lg">Company Address</h3>

                    <FormField
                      control={form.control}
                      name="address"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Street Address</FormLabel>
                          <FormControl>
                            <Input placeholder="123 Main Street" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <FormField
                        control={form.control}
                        name="city"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>City</FormLabel>
                            <FormControl>
                              <Input placeholder="New York" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="state"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>State</FormLabel>
                            <FormControl>
                              <Input placeholder="NY" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <FormField
                        control={form.control}
                        name="zip"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>ZIP Code</FormLabel>
                            <FormControl>
                              <Input placeholder="10001" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="country"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Country</FormLabel>
                            <FormControl>
                              <Input placeholder="US" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    <FormField
                      control={form.control}
                      name="timezone"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Timezone</FormLabel>
                          <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {TIMEZONES.map((tz) => (
                                <SelectItem key={tz} value={tz}>
                                  {tz.replace(/_/g, ' ')}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                )}

                {/* Step 4: Plan Selection */}
                {currentStep === 4 && (
                  <div className="space-y-4">
                    <h3 className="font-semibold text-lg">Choose Your Plan</h3>

                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
                      <p className="text-sm text-blue-800 font-medium">14-Day Free Trial</p>
                      <p className="text-xs text-blue-700 mt-1">
                        No credit card required. Full access to all features.
                      </p>
                    </div>

                    <FormField
                      control={form.control}
                      name="planSlug"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Select Plan</FormLabel>
                          <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="starter">
                                Starter - Best for getting started
                              </SelectItem>
                              <SelectItem value="professional">
                                Professional - Most popular
                              </SelectItem>
                              <SelectItem value="enterprise">
                                Enterprise - Advanced features
                              </SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="billingCycle"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Billing Cycle</FormLabel>
                          <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="monthly">Monthly</SelectItem>
                              <SelectItem value="annual">Annual (Save 20%)</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                      <p className="text-sm text-gray-700">
                        You can upgrade, downgrade, or cancel anytime.
                      </p>
                    </div>
                  </div>
                )}

                {/* Step 5: Terms & Create */}
                {currentStep === 5 && (
                  <div className="space-y-4">
                    <h3 className="font-semibold text-lg">Terms & Conditions</h3>

                    <FormField
                      control={form.control}
                      name="acceptedTerms"
                      render={({ field }) => (
                        <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4">
                          <FormControl>
                            <Checkbox checked={field.value} onCheckedChange={field.onChange} />
                          </FormControl>
                          <div className="space-y-1 leading-none">
                            <FormLabel>
                              I agree to the{' '}
                              <a
                                href="/terms"
                                target="_blank"
                                className="text-primary hover:underline"
                              >
                                Terms and Conditions
                              </a>
                            </FormLabel>
                            <FormMessage />
                          </div>
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="acceptedPrivacy"
                      render={({ field }) => (
                        <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4">
                          <FormControl>
                            <Checkbox checked={field.value} onCheckedChange={field.onChange} />
                          </FormControl>
                          <div className="space-y-1 leading-none">
                            <FormLabel>
                              I agree to the{' '}
                              <a
                                href="/privacy"
                                target="_blank"
                                className="text-primary hover:underline"
                              >
                                Privacy Policy
                              </a>
                            </FormLabel>
                            <FormMessage />
                          </div>
                        </FormItem>
                      )}
                    />

                    <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                      <p className="text-sm text-green-800 font-medium mb-2">
                        Ready to get started?
                      </p>
                      <p className="text-xs text-green-700">
                        Click "Create Account" to complete your registration. We'll send you a
                        verification email to activate your account.
                      </p>
                    </div>
                  </div>
                )}

                {/* Navigation Buttons */}
                <div className="flex justify-between pt-4 border-t">
                  {currentStep > 1 && (
                    <Button type="button" variant="outline" onClick={prevStep}>
                      <ArrowLeft className="mr-2 h-4 w-4" />
                      Previous
                    </Button>
                  )}

                  {currentStep < 5 ? (
                    <Button
                      type="button"
                      onClick={nextStep}
                      className={currentStep === 1 ? 'ml-auto' : ''}
                    >
                      Next
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </Button>
                  ) : (
                    <Button type="submit" disabled={signupMutation.isPending} className="ml-auto">
                      {signupMutation.isPending ? 'Creating Account...' : 'Create Account'}
                    </Button>
                  )}
                </div>

                <div className="text-center text-sm text-muted-foreground border-t pt-4">
                  Already have an account?{' '}
                  <Link href="/login" className="text-primary hover:underline">
                    Sign in
                  </Link>
                </div>
              </form>
            </Form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
