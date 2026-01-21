import { useState, useEffect } from 'react';
import { useLocation } from 'wouter';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Check, AlertCircle, Loader2 } from 'lucide-react';

export default function OnboardingPage() {
  const [, navigate] = useLocation();
  const [step, setStep] = useState(0);
  const [subdomain, setSubdomain] = useState('');
  const [subdomainStatus, setSubdomainStatus] = useState<
    'idle' | 'checking' | 'available' | 'taken'
  >('idle');
  const [subdomainMessage, setSubdomainMessage] = useState('');
  const [completionPercentage, setCompletionPercentage] = useState(0);
  const [completedSteps, setCompletedSteps] = useState<Set<number>>(new Set());

  const steps = [
    { title: 'Company Subdomain', description: 'Choose your unique company subdomain' },
    { title: 'Company Profile', description: 'Setup your company information' },
    { title: 'Payment Method', description: 'Add billing information' },
    { title: 'Team Setup', description: 'Invite your team members' },
  ];

  // Check subdomain availability
  const checkSubdomain = async (value: string) => {
    setSubdomain(value);
    if (value.length < 3) {
      setSubdomainStatus('idle');
      return;
    }

    setSubdomainStatus('checking');
    try {
      const response = await fetch('/api/onboarding/check-subdomain', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subdomain: value }),
      });
      const data = await response.json();

      if (data.available) {
        setSubdomainStatus('available');
        setSubdomainMessage('✓ Available!');
      } else {
        setSubdomainStatus('taken');
        setSubdomainMessage(data.message || 'Already taken');
      }
    } catch (error) {
      setSubdomainMessage('Error checking availability');
    }
  };

  // Confirm subdomain and move to next step
  const confirmSubdomain = async () => {
    if (subdomainStatus !== 'available') return;

    try {
      const response = await fetch('/api/onboarding/confirm-subdomain', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subdomain }),
      });

      if (response.ok) {
        setCompletedSteps(new Set([...completedSteps, 0]));
        setStep(1);
      }
    } catch (error) {
      console.error('Error confirming subdomain:', error);
    }
  };

  // Mark step complete
  const completeStep = async (stepIndex: number) => {
    const stepMap = ['companyProfile', 'paymentMethod', 'teamSetup', 'integrationsSetup'];
    try {
      await fetch('/api/onboarding/update-step', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ step: stepMap[stepIndex] }),
      });

      const newCompleted = new Set([...completedSteps, stepIndex]);
      setCompletedSteps(newCompleted);
      setCompletionPercentage((newCompleted.size / steps.length) * 100);

      if (stepIndex === steps.length - 1) {
        // All steps complete
        setTimeout(() => navigate('/dashboard'), 1000);
      } else {
        setStep(stepIndex + 1);
      }
    } catch (error) {
      console.error('Error completing step:', error);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-8">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">Welcome to Printyx</h1>
          <p className="text-gray-600">Let's get your company set up and ready to go</p>
        </div>

        {/* Progress */}
        <div className="mb-8">
          <div className="flex justify-between items-center mb-2">
            <span className="text-sm font-medium text-gray-700">Setup Progress</span>
            <span className="text-sm font-bold text-blue-600">
              {Math.round(completionPercentage)}%
            </span>
          </div>
          <Progress value={completionPercentage} className="h-2" />
        </div>

        {/* Step List */}
        <div className="space-y-4 mb-8">
          {steps.map((stepItem, index) => (
            <Card
              key={index}
              className={`cursor-pointer transition-all ${
                index === step ? 'ring-2 ring-blue-500 shadow-lg' : ''
              } ${completedSteps.has(index) ? 'bg-green-50' : ''}`}
              onClick={() => (index < step ? setStep(index) : null)}
            >
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div
                      className={`w-8 h-8 rounded-full flex items-center justify-center font-bold ${
                        completedSteps.has(index)
                          ? 'bg-green-500 text-white'
                          : index === step
                            ? 'bg-blue-500 text-white'
                            : 'bg-gray-200 text-gray-600'
                      }`}
                    >
                      {completedSteps.has(index) ? <Check className="w-5 h-5" /> : index + 1}
                    </div>
                    <div>
                      <h3 className="font-semibold text-gray-900">{stepItem.title}</h3>
                      <p className="text-sm text-gray-600">{stepItem.description}</p>
                    </div>
                  </div>
                  {completedSteps.has(index) && <Check className="w-5 h-5 text-green-500" />}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Step Content */}
        <Card>
          <CardHeader>
            <CardTitle>{steps[step].title}</CardTitle>
            <CardDescription>{steps[step].description}</CardDescription>
          </CardHeader>
          <CardContent>
            {step === 0 && (
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Choose your subdomain
                  </label>
                  <div className="flex gap-2">
                    <Input
                      placeholder="my-company"
                      value={subdomain}
                      onChange={(e) => checkSubdomain(e.target.value)}
                      className="flex-1"
                    />
                    <span className="flex items-center text-gray-600">.printyx.net</span>
                  </div>
                  {subdomainStatus === 'checking' && (
                    <div className="mt-2 text-sm text-blue-600 flex items-center gap-1">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Checking availability...
                    </div>
                  )}
                  {subdomainStatus === 'available' && (
                    <div className="mt-2 text-sm text-green-600 flex items-center gap-1">
                      <Check className="w-4 h-4" />
                      {subdomainMessage}
                    </div>
                  )}
                  {subdomainStatus === 'taken' && (
                    <div className="mt-2 text-sm text-red-600 flex items-center gap-1">
                      <AlertCircle className="w-4 h-4" />
                      {subdomainMessage}
                    </div>
                  )}
                </div>
                <Button
                  onClick={confirmSubdomain}
                  disabled={subdomainStatus !== 'available'}
                  className="w-full"
                >
                  Confirm Subdomain
                </Button>
              </div>
            )}

            {step === 1 && (
              <div className="space-y-4">
                <Input placeholder="Company Name" />
                <Input placeholder="Website (optional)" />
                <Input placeholder="Industry" />
                <Button onClick={() => completeStep(1)} className="w-full">
                  Save & Continue
                </Button>
              </div>
            )}

            {step === 2 && (
              <div className="space-y-4">
                <p className="text-gray-600 mb-4">
                  You'll be able to add your payment method securely
                </p>
                <Button onClick={() => completeStep(2)} className="w-full">
                  I'll Setup Payment Later
                </Button>
              </div>
            )}

            {step === 3 && (
              <div className="space-y-4">
                <p className="text-gray-600 mb-4">Invite your team members to collaborate</p>
                <Input placeholder="Email address" />
                <Button onClick={() => completeStep(3)} className="w-full">
                  Complete Onboarding
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Skip Links */}
        <div className="mt-6 text-center">
          <button
            onClick={() => navigate('/dashboard')}
            className="text-sm text-gray-600 hover:text-gray-900 underline"
          >
            Skip setup and go to dashboard
          </button>
        </div>
      </div>
    </div>
  );
}
