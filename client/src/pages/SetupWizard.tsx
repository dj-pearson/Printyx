import { useState, useEffect } from 'react';
import { useLocation } from 'wouter';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Label } from '@/components/ui/label';
import {
  Check,
  Building2,
  Users,
  Plug,
  Package,
  ChevronRight,
  SkipForward,
  ArrowLeft,
} from 'lucide-react';
import { apiRequest } from '@/lib/queryClient';
import { toast } from '@/hooks/use-toast';

interface WizardStep {
  id: string;
  title: string;
  description: string;
  icon: React.ReactNode;
}

const WIZARD_STEPS: WizardStep[] = [
  {
    id: 'company',
    title: 'Company Profile',
    description: 'Set up your company information',
    icon: <Building2 className="h-5 w-5" />,
  },
  {
    id: 'team',
    title: 'Team Invitation',
    description: 'Invite your team members',
    icon: <Users className="h-5 w-5" />,
  },
  {
    id: 'integrations',
    title: 'Integration Setup',
    description: 'Connect your tools and services',
    icon: <Plug className="h-5 w-5" />,
  },
  {
    id: 'catalog',
    title: 'Product Catalog Import',
    description: 'Import your product catalog',
    icon: <Package className="h-5 w-5" />,
  },
];

export default function SetupWizard() {
  const [, navigate] = useLocation();
  const [currentStep, setCurrentStep] = useState(0);
  const [completedSteps, setCompletedSteps] = useState<Set<number>>(new Set());

  // Form state for each step
  const [companyData, setCompanyData] = useState({
    name: '',
    website: '',
    industry: '',
    address: '',
    phone: '',
  });
  const [teamEmails, setTeamEmails] = useState(['']);
  const [selectedIntegrations, setSelectedIntegrations] = useState<Set<string>>(new Set());
  const [catalogMethod, setCatalogMethod] = useState<'csv' | 'manual' | 'skip'>('skip');

  // Load wizard progress from server
  const { data: wizardState } = useQuery({
    queryKey: ['/api/onboarding/wizard-state'],
    queryFn: async () => {
      try {
        return await apiRequest('/api/onboarding/wizard-state');
      } catch {
        return { currentStep: 0, completedSteps: [], completed: false };
      }
    },
  });

  useEffect(() => {
    if (wizardState) {
      if (wizardState.completed) {
        navigate('/dashboard');
        return;
      }
      if (wizardState.currentStep) {
        setCurrentStep(wizardState.currentStep);
      }
      if (wizardState.completedSteps?.length) {
        setCompletedSteps(new Set(wizardState.completedSteps));
      }
    }
  }, [wizardState, navigate]);

  // Save progress mutation
  const saveProgressMutation = useMutation({
    mutationFn: (data: { currentStep: number; completedSteps: number[]; completed: boolean }) =>
      apiRequest('/api/onboarding/wizard-state', 'POST', data),
  });

  const completionPercentage = (completedSteps.size / WIZARD_STEPS.length) * 100;

  const handleCompleteStep = (stepIndex: number) => {
    const newCompleted = new Set([...completedSteps, stepIndex]);
    setCompletedSteps(newCompleted);

    const isAllDone = newCompleted.size === WIZARD_STEPS.length;

    saveProgressMutation.mutate({
      currentStep: isAllDone ? WIZARD_STEPS.length : stepIndex + 1,
      completedSteps: Array.from(newCompleted),
      completed: isAllDone,
    });

    if (isAllDone) {
      toast({ title: 'Setup complete!', description: 'Your workspace is ready to use.' });
      setTimeout(() => navigate('/dashboard'), 1500);
    } else {
      // Find next incomplete step
      const nextStep = WIZARD_STEPS.findIndex((_, i) => i > stepIndex && !newCompleted.has(i));
      setCurrentStep(nextStep >= 0 ? nextStep : stepIndex + 1);
    }
  };

  const handleSkipStep = (stepIndex: number) => {
    const nextStep = stepIndex + 1;
    if (nextStep >= WIZARD_STEPS.length) {
      // Last step skipped, check if all required are done
      saveProgressMutation.mutate({
        currentStep: nextStep,
        completedSteps: Array.from(completedSteps),
        completed: true,
      });
      toast({ title: 'Setup complete!', description: 'You can always return to settings.' });
      setTimeout(() => navigate('/dashboard'), 1500);
    } else {
      setCurrentStep(nextStep);
      saveProgressMutation.mutate({
        currentStep: nextStep,
        completedSteps: Array.from(completedSteps),
        completed: false,
      });
    }
  };

  const handleSkipAll = () => {
    saveProgressMutation.mutate({
      currentStep: WIZARD_STEPS.length,
      completedSteps: Array.from(completedSteps),
      completed: true,
    });
    navigate('/dashboard');
  };

  const toggleIntegration = (id: string) => {
    const next = new Set(selectedIntegrations);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedIntegrations(next);
  };

  const addEmailField = () => setTeamEmails([...teamEmails, '']);
  const updateEmail = (index: number, value: string) => {
    const updated = [...teamEmails];
    updated[index] = value;
    setTeamEmails(updated);
  };
  const removeEmail = (index: number) => {
    if (teamEmails.length > 1) {
      setTeamEmails(teamEmails.filter((_, i) => i !== index));
    }
  };

  const availableIntegrations = [
    { id: 'quickbooks', name: 'QuickBooks', description: 'Accounting & invoicing' },
    { id: 'salesforce', name: 'Salesforce', description: 'CRM integration' },
    { id: 'email', name: 'Email (SMTP)', description: 'Email notifications' },
    { id: 'stripe', name: 'Stripe', description: 'Payment processing' },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4 sm:p-8">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-2">Welcome to Printyx</h1>
          <p className="text-gray-600">
            Let's get your workspace set up. You can skip any step and come back later.
          </p>
        </div>

        {/* Progress Indicator */}
        <div className="mb-8">
          <div className="flex justify-between items-center mb-2">
            <span className="text-sm font-medium text-gray-700">Setup Progress</span>
            <span className="text-sm font-bold text-blue-600">
              {Math.round(completionPercentage)}%
            </span>
          </div>
          <Progress value={completionPercentage} className="h-2" />
        </div>

        {/* Step Navigation */}
        <div className="grid grid-cols-4 gap-2 mb-8">
          {WIZARD_STEPS.map((wizardStep, index) => (
            <button
              key={wizardStep.id}
              onClick={() => setCurrentStep(index)}
              className={`flex flex-col items-center gap-1 p-2 rounded-lg transition-all text-center ${
                index === currentStep
                  ? 'bg-blue-100 ring-2 ring-blue-500'
                  : completedSteps.has(index)
                    ? 'bg-green-50'
                    : 'hover:bg-gray-100'
              }`}
            >
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center ${
                  completedSteps.has(index)
                    ? 'bg-green-500 text-white'
                    : index === currentStep
                      ? 'bg-blue-500 text-white'
                      : 'bg-gray-200 text-gray-600'
                }`}
              >
                {completedSteps.has(index) ? <Check className="h-4 w-4" /> : wizardStep.icon}
              </div>
              <span className="text-xs font-medium text-gray-700 hidden sm:block">
                {wizardStep.title}
              </span>
            </button>
          ))}
        </div>

        {/* Step Content */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              {WIZARD_STEPS[currentStep].icon}
              <div>
                <CardTitle>{WIZARD_STEPS[currentStep].title}</CardTitle>
                <CardDescription>{WIZARD_STEPS[currentStep].description}</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {/* Step 1: Company Profile */}
            {currentStep === 0 && (
              <div className="space-y-4">
                <div>
                  <Label>Company Name</Label>
                  <Input
                    placeholder="Acme Corporation"
                    value={companyData.name}
                    onChange={(e) => setCompanyData({ ...companyData, name: e.target.value })}
                  />
                </div>
                <div>
                  <Label>Website</Label>
                  <Input
                    placeholder="https://example.com"
                    value={companyData.website}
                    onChange={(e) => setCompanyData({ ...companyData, website: e.target.value })}
                  />
                </div>
                <div>
                  <Label>Industry</Label>
                  <Input
                    placeholder="e.g. Managed Print Services"
                    value={companyData.industry}
                    onChange={(e) => setCompanyData({ ...companyData, industry: e.target.value })}
                  />
                </div>
                <div>
                  <Label>Business Address</Label>
                  <Textarea
                    placeholder="123 Main St, City, State, ZIP"
                    value={companyData.address}
                    onChange={(e) => setCompanyData({ ...companyData, address: e.target.value })}
                    rows={2}
                  />
                </div>
                <div>
                  <Label>Phone</Label>
                  <Input
                    placeholder="(555) 123-4567"
                    value={companyData.phone}
                    onChange={(e) => setCompanyData({ ...companyData, phone: e.target.value })}
                  />
                </div>
              </div>
            )}

            {/* Step 2: Team Invitation */}
            {currentStep === 1 && (
              <div className="space-y-4">
                <p className="text-sm text-gray-600">
                  Invite team members by email. They'll receive an invitation to join your
                  workspace.
                </p>
                {teamEmails.map((email, index) => (
                  <div key={index} className="flex gap-2">
                    <Input
                      type="email"
                      placeholder="colleague@company.com"
                      value={email}
                      onChange={(e) => updateEmail(index, e.target.value)}
                    />
                    {teamEmails.length > 1 && (
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => removeEmail(index)}
                        className="shrink-0"
                      >
                        &times;
                      </Button>
                    )}
                  </div>
                ))}
                <Button variant="outline" size="sm" onClick={addEmailField}>
                  + Add another
                </Button>
              </div>
            )}

            {/* Step 3: Integration Setup */}
            {currentStep === 2 && (
              <div className="space-y-3">
                <p className="text-sm text-gray-600 mb-4">
                  Select integrations you'd like to connect. You can configure these in detail
                  later.
                </p>
                {availableIntegrations.map((integration) => (
                  <button
                    key={integration.id}
                    onClick={() => toggleIntegration(integration.id)}
                    className={`w-full flex items-center justify-between p-3 rounded-lg border transition-colors ${
                      selectedIntegrations.has(integration.id)
                        ? 'border-blue-500 bg-blue-50'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <div className="text-left">
                      <div className="font-medium text-gray-900">{integration.name}</div>
                      <div className="text-xs text-gray-500">{integration.description}</div>
                    </div>
                    {selectedIntegrations.has(integration.id) && (
                      <Check className="h-5 w-5 text-blue-500" />
                    )}
                  </button>
                ))}
              </div>
            )}

            {/* Step 4: Product Catalog Import */}
            {currentStep === 3 && (
              <div className="space-y-4">
                <p className="text-sm text-gray-600">
                  Import your product catalog to get started quickly.
                </p>
                <div className="space-y-3">
                  <button
                    onClick={() => setCatalogMethod('csv')}
                    className={`w-full flex items-center gap-3 p-4 rounded-lg border transition-colors ${
                      catalogMethod === 'csv'
                        ? 'border-blue-500 bg-blue-50'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <Package className="h-5 w-5 text-blue-600" />
                    <div className="text-left">
                      <div className="font-medium">Import from CSV</div>
                      <div className="text-xs text-gray-500">
                        Upload a CSV file with your products
                      </div>
                    </div>
                  </button>
                  <button
                    onClick={() => setCatalogMethod('manual')}
                    className={`w-full flex items-center gap-3 p-4 rounded-lg border transition-colors ${
                      catalogMethod === 'manual'
                        ? 'border-blue-500 bg-blue-50'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <Package className="h-5 w-5 text-green-600" />
                    <div className="text-left">
                      <div className="font-medium">Add Products Manually</div>
                      <div className="text-xs text-gray-500">
                        Add products one at a time after setup
                      </div>
                    </div>
                  </button>
                  <button
                    onClick={() => setCatalogMethod('skip')}
                    className={`w-full flex items-center gap-3 p-4 rounded-lg border transition-colors ${
                      catalogMethod === 'skip'
                        ? 'border-blue-500 bg-blue-50'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <SkipForward className="h-5 w-5 text-gray-600" />
                    <div className="text-left">
                      <div className="font-medium">Skip for Now</div>
                      <div className="text-xs text-gray-500">
                        You can import your catalog anytime
                      </div>
                    </div>
                  </button>
                </div>
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex items-center justify-between mt-6 pt-4 border-t">
              <div className="flex items-center gap-2">
                {currentStep > 0 && (
                  <Button variant="ghost" size="sm" onClick={() => setCurrentStep(currentStep - 1)}>
                    <ArrowLeft className="h-4 w-4 mr-1" />
                    Back
                  </Button>
                )}
              </div>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={() => handleSkipStep(currentStep)}>
                  <SkipForward className="h-4 w-4 mr-1" />
                  Skip
                </Button>
                <Button onClick={() => handleCompleteStep(currentStep)}>
                  {currentStep === WIZARD_STEPS.length - 1 ? 'Finish Setup' : 'Save & Continue'}
                  <ChevronRight className="h-4 w-4 ml-1" />
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Skip All */}
        <div className="mt-6 text-center">
          <button
            onClick={handleSkipAll}
            className="text-sm text-gray-500 hover:text-gray-700 underline"
          >
            Skip setup entirely and go to dashboard
          </button>
        </div>
      </div>
    </div>
  );
}
