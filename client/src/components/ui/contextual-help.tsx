/**
 * Contextual Help Components
 *
 * UX-008: Add contextual help tooltips and onboarding hints for key workflows.
 *
 * Provides:
 * - HelpTooltip: Icon with hover tooltip for field-level help
 * - OnboardingHint: Dismissible hint card for workflow guidance
 * - FeatureCallout: One-time callout for new features
 */

import React, { useState, useEffect } from 'react';
import { HelpCircle, X, Lightbulb, Sparkles } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Button } from '@/components/ui/button';

/** HelpTooltip - Shows a help icon with hover tooltip */
interface HelpTooltipProps {
  content: string;
  side?: 'top' | 'right' | 'bottom' | 'left';
  className?: string;
}

export function HelpTooltip({ content, side = 'top', className }: HelpTooltipProps) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          className={`inline-flex items-center text-gray-400 hover:text-gray-600 ${className || ''}`}
          aria-label="Help"
        >
          <HelpCircle className="h-4 w-4" />
        </button>
      </TooltipTrigger>
      <TooltipContent side={side} className="max-w-xs text-sm">
        {content}
      </TooltipContent>
    </Tooltip>
  );
}

/** OnboardingHint - Dismissible hint card */
interface OnboardingHintProps {
  id: string; // Unique ID for localStorage persistence
  title: string;
  description: string;
  icon?: React.ReactNode;
}

export function OnboardingHint({ id, title, description, icon }: OnboardingHintProps) {
  const storageKey = `printyx_hint_dismissed_${id}`;
  const [dismissed, setDismissed] = useState(true);

  useEffect(() => {
    const wasDismissed = localStorage.getItem(storageKey);
    if (!wasDismissed) {
      setDismissed(false);
    }
  }, [storageKey]);

  const dismiss = () => {
    setDismissed(true);
    localStorage.setItem(storageKey, 'true');
  };

  if (dismissed) return null;

  return (
    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4 flex items-start gap-3">
      <div className="flex-shrink-0 text-blue-600">{icon || <Lightbulb className="h-5 w-5" />}</div>
      <div className="flex-1 min-w-0">
        <h4 className="text-sm font-medium text-blue-900">{title}</h4>
        <p className="text-sm text-blue-700 mt-0.5">{description}</p>
      </div>
      <button
        type="button"
        onClick={dismiss}
        className="flex-shrink-0 text-blue-400 hover:text-blue-600"
        aria-label="Dismiss hint"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}

/** FeatureCallout - One-time callout for new features */
interface FeatureCalloutProps {
  id: string;
  title: string;
  description: string;
}

export function FeatureCallout({ id, title, description }: FeatureCalloutProps) {
  const storageKey = `printyx_callout_seen_${id}`;
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const seen = localStorage.getItem(storageKey);
    if (!seen) {
      setVisible(true);
    }
  }, [storageKey]);

  const close = () => {
    setVisible(false);
    localStorage.setItem(storageKey, 'true');
  };

  if (!visible) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50 max-w-sm bg-white border border-purple-200 rounded-xl shadow-lg p-4 animate-in slide-in-from-bottom-4">
      <div className="flex items-start gap-3">
        <div className="flex-shrink-0 w-8 h-8 bg-purple-100 rounded-full flex items-center justify-center">
          <Sparkles className="h-4 w-4 text-purple-600" />
        </div>
        <div className="flex-1">
          <h4 className="text-sm font-semibold text-gray-900">{title}</h4>
          <p className="text-sm text-gray-600 mt-1">{description}</p>
          <Button
            variant="ghost"
            size="sm"
            onClick={close}
            className="mt-2 text-purple-600 hover:text-purple-700 px-0"
          >
            Got it
          </Button>
        </div>
        <button
          type="button"
          onClick={close}
          className="text-gray-400 hover:text-gray-600"
          aria-label="Close"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
