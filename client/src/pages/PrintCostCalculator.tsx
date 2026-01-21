import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { ArrowLeft, ArrowRight, Calculator, Loader2 } from 'lucide-react';
import { FleetInformationStep } from '@/components/calculator/FleetInformationStep';
import { OptionalCostsStep } from '@/components/calculator/OptionalCostsStep';
import { BusinessContextStep } from '@/components/calculator/BusinessContextStep';
import { CalculatorResults } from '@/components/calculator/CalculatorResults';
import { EmailCaptureModal } from '@/components/calculator/EmailCaptureModal';
import type { FleetInputs, CalculatorSession } from '@/components/calculator/types';
import { v4 as uuidv4 } from 'uuid';

const STEPS = [
  { id: 1, title: 'Fleet Information', description: 'Tell us about your devices' },
  { id: 2, title: 'Current Costs', description: 'Optional cost details' },
  { id: 3, title: 'Business Context', description: 'Your organization' },
];

export default function PrintCostCalculator() {
  const [currentStep, setCurrentStep] = useState(1);
  const [formData, setFormData] = useState<Partial<FleetInputs>>({
    deviceCount: 5,
    deviceTypes: [],
    colorRatio: 20,
  });
  const [sessionData, setSessionData] = useState<CalculatorSession | null>(null);
  const [showEmailModal, setShowEmailModal] = useState(false);
  const [visitorId] = useState(() => localStorage.getItem('calculator_visitor_id') || uuidv4());

  // Save visitor ID
  if (!localStorage.getItem('calculator_visitor_id')) {
    localStorage.setItem('calculator_visitor_id', visitorId);
  }

  // Calculate results mutation
  const calculateMutation = useMutation({
    mutationFn: async (data: FleetInputs) => {
      const response = await fetch('/api/public/calculator/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...data,
          visitorId,
          sourceUrl: window.location.href,
          referrer: document.referrer,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to calculate results');
      }

      return response.json();
    },
    onSuccess: (data: CalculatorSession) => {
      setSessionData(data);
      // Track analytics
      trackEvent('calculation_complete', {
        deviceCount: formData.deviceCount,
        industry: formData.industry,
        annualTCO: data.results.annualTCO,
      });
    },
  });

  const trackEvent = async (eventType: string, eventData: Record<string, any>) => {
    try {
      await fetch('/api/public/calculator/track/event', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          visitorId,
          sessionKey: sessionData?.sessionKey,
          eventType,
          eventCategory: 'engagement',
          eventData,
        }),
      });
    } catch (error) {
      console.error('Failed to track event:', error);
    }
  };

  const handleDataChange = (newData: Partial<FleetInputs>) => {
    setFormData((prev) => ({ ...prev, ...newData }));
  };

  const handleNext = () => {
    if (currentStep < STEPS.length) {
      setCurrentStep(currentStep + 1);
      trackEvent('step_complete', { step: currentStep });
    } else {
      handleCalculate();
    }
  };

  const handleBack = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleCalculate = () => {
    const completeData = formData as FleetInputs;
    calculateMutation.mutate(completeData);
  };

  const handleViewResults = () => {
    // Show results without email capture (free preview)
    trackEvent('view_results_preview', {});
  };

  const handleDownloadPDF = () => {
    // Trigger email capture modal
    setShowEmailModal(true);
    trackEvent('pdf_download_attempt', {});
  };

  const isStepValid = () => {
    if (currentStep === 1) {
      return (
        formData.deviceCount &&
        formData.deviceCount > 0 &&
        formData.deviceTypes &&
        formData.deviceTypes.length > 0 &&
        formData.fleetAge &&
        formData.monthlyPageVolume !== undefined
      );
    }

    if (currentStep === 2) {
      // Optional step, always valid
      return true;
    }

    if (currentStep === 3) {
      return (
        formData.employeeCount &&
        formData.employeeCount > 0 &&
        formData.industry &&
        formData.painPoints &&
        formData.painPoints.length > 0
      );
    }

    return false;
  };

  const progress = (currentStep / STEPS.length) * 100;

  // Show results if we have session data
  if (sessionData) {
    return (
      <div className="container mx-auto px-4 py-8 max-w-7xl">
        <div className="mb-6">
          <Button
            variant="ghost"
            onClick={() => {
              setSessionData(null);
              setCurrentStep(1);
            }}
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Start New Analysis
          </Button>
        </div>

        <CalculatorResults
          session={sessionData}
          onDownloadPDF={handleDownloadPDF}
          onBookDemo={() => trackEvent('book_demo_click', {})}
        />

        <EmailCaptureModal
          open={showEmailModal}
          onClose={() => setShowEmailModal(false)}
          sessionKey={sessionData.sessionKey}
          onSuccess={() => {
            setShowEmailModal(false);
            trackEvent('email_captured', {});
          }}
        />
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      {/* Header */}
      <div className="text-center mb-8">
        <div className="flex justify-center mb-4">
          <div className="bg-blue-100 p-4 rounded-full">
            <Calculator className="h-12 w-12 text-blue-600" />
          </div>
        </div>
        <h1 className="text-4xl font-bold mb-2">Print Fleet Cost Calculator</h1>
        <p className="text-xl text-gray-600">
          Discover hidden costs and identify savings opportunities in 5 minutes
        </p>
      </div>

      {/* Progress bar */}
      <div className="mb-8">
        <div className="flex justify-between mb-2">
          {STEPS.map((step) => (
            <div key={step.id} className="flex-1 text-center">
              <div
                className={`font-medium ${
                  step.id <= currentStep ? 'text-blue-600' : 'text-gray-400'
                }`}
              >
                {step.title}
              </div>
              <div className="text-xs text-gray-500">{step.description}</div>
            </div>
          ))}
        </div>
        <Progress value={progress} className="h-2" />
      </div>

      {/* Form Card */}
      <Card>
        <CardHeader>
          <CardTitle>
            Step {currentStep} of {STEPS.length}
          </CardTitle>
          <CardDescription>{STEPS[currentStep - 1].description}</CardDescription>
        </CardHeader>
        <CardContent>
          {currentStep === 1 && (
            <FleetInformationStep data={formData} onChange={handleDataChange} />
          )}
          {currentStep === 2 && <OptionalCostsStep data={formData} onChange={handleDataChange} />}
          {currentStep === 3 && <BusinessContextStep data={formData} onChange={handleDataChange} />}

          {/* Navigation buttons */}
          <div className="flex justify-between mt-8 pt-6 border-t">
            <Button variant="outline" onClick={handleBack} disabled={currentStep === 1}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back
            </Button>

            {currentStep < STEPS.length ? (
              <Button onClick={handleNext} disabled={!isStepValid()}>
                Next
                <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
            ) : (
              <Button
                onClick={handleCalculate}
                disabled={!isStepValid() || calculateMutation.isPending}
              >
                {calculateMutation.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Calculating...
                  </>
                ) : (
                  <>
                    Calculate Results
                    <Calculator className="h-4 w-4 ml-2" />
                  </>
                )}
              </Button>
            )}
          </div>

          {calculateMutation.isError && (
            <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-md text-red-600 text-sm">
              Failed to calculate results. Please try again.
            </div>
          )}
        </CardContent>
      </Card>

      {/* Trust signals */}
      <div className="mt-8 text-center text-sm text-gray-500">
        <p>✓ Free analysis • ✓ No credit card required • ✓ Instant results</p>
        <p className="mt-2">
          Join 892 print managers who've identified an average of $18K in annual savings
        </p>
      </div>
    </div>
  );
}
