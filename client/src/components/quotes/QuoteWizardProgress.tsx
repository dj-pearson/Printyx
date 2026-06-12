/**
 * Quote Wizard Progress Indicator
 *
 * QP-002: Multi-step progress indicator for quote creation wizard.
 */

import { Check } from 'lucide-react';

export interface WizardStep {
  id: string;
  label: string;
  description?: string;
}

interface QuoteWizardProgressProps {
  steps: WizardStep[];
  currentStep: number;
  onStepClick?: (step: number) => void;
}

export function QuoteWizardProgress({ steps, currentStep, onStepClick }: QuoteWizardProgressProps) {
  return (
    <nav aria-label="Quote creation progress" className="mb-6">
      <ol className="flex items-center">
        {steps.map((step, index) => {
          const isCompleted = index < currentStep;
          const isCurrent = index === currentStep;
          // QUOTE-019: every step is clickable — forward jumps included. The
          // parent's onStepClick validates prerequisites and explains what's
          // missing when a jump is invalid.
          const isClickable = !!onStepClick;

          return (
            <li
              key={step.id}
              className={`flex items-center ${index < steps.length - 1 ? 'flex-1' : ''}`}
            >
              <button
                type="button"
                onClick={isClickable ? () => onStepClick(index) : undefined}
                disabled={!isClickable}
                className={`flex items-center gap-2 ${isClickable ? 'cursor-pointer' : 'cursor-default'}`}
                aria-current={isCurrent ? 'step' : undefined}
              >
                {/* Step circle */}
                <div
                  className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium transition-colors ${
                    isCompleted
                      ? 'bg-blue-600 text-white'
                      : isCurrent
                        ? 'bg-blue-100 text-blue-600 ring-2 ring-blue-600'
                        : `bg-gray-100 text-gray-400 ${isClickable ? 'hover:bg-gray-200 hover:text-gray-600' : ''}`
                  }`}
                >
                  {isCompleted ? <Check className="h-4 w-4" /> : index + 1}
                </div>

                {/* Step label */}
                <div className="hidden sm:block">
                  <div
                    className={`text-sm font-medium ${
                      isCurrent ? 'text-blue-600' : isCompleted ? 'text-gray-900' : 'text-gray-400'
                    }`}
                  >
                    {step.label}
                  </div>
                  {step.description && (
                    <div className="text-xs text-gray-400">{step.description}</div>
                  )}
                </div>
              </button>

              {/* Connector line */}
              {index < steps.length - 1 && (
                <div
                  className={`flex-1 h-0.5 mx-3 ${isCompleted ? 'bg-blue-600' : 'bg-gray-200'}`}
                />
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

/** Default wizard steps for quote creation */
export const DEFAULT_QUOTE_STEPS: WizardStep[] = [
  { id: 'customer', label: 'Customer', description: 'Select customer & contact' },
  { id: 'products', label: 'Products', description: 'Add line items' },
  { id: 'pricing', label: 'Pricing', description: 'Adjust pricing & terms' },
  { id: 'review', label: 'Review', description: 'Review & submit' },
];
