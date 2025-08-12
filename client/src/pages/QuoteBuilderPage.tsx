import React, { useState } from 'react';
import { useLocation, useRoute } from 'wouter';
import MainLayout from '@/components/layout/main-layout';
import QuoteBuilder from '@/components/quote-builder/QuoteBuilder';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Calculator,
  ArrowLeft,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import ContextualHelp from '@/components/contextual/ContextualHelp';
import PageAlerts from '@/components/contextual/PageAlerts';

export default function QuoteBuilderPage() {
  const [, setLocation] = useLocation();
  const [match, params] = useRoute('/quotes/:quoteId');
  const quoteId = params?.quoteId;
  const isEditing = !!quoteId;

  // Check for proposal creation mode
  const urlParams = new URLSearchParams(window.location.search);
  const isProposalMode = urlParams.get('type') === 'proposal';
  const sourceQuoteId = urlParams.get('quoteId');
  const templateId = urlParams.get('templateId');

  const handleSave = (savedQuoteId: string) => {
    if (savedQuoteId === 'redirect-to-management') {
      setLocation('/quotes');
    } else {
      setLocation(`/quotes/${savedQuoteId}`);
    }
  };

  const handleCancel = () => {
    setLocation('/quotes');
  };

  const handleCreateProposal = (quoteId: string) => {
    // Navigate to proposal builder with quote data
    setLocation(`/proposal-builder?quoteId=${quoteId}`);
  };

  return (
    <MainLayout title={isProposalMode ? 'Create Proposal' : (isEditing ? 'Edit Quote' : 'Quote Builder')} description={isProposalMode ? `Creating proposal from quote ${sourceQuoteId} with template ${templateId}` : (isEditing ? 'Modify your existing quote with line-by-line product selection' : 'Create a comprehensive quote with line-by-line product selection')}>
      <div className="container mx-auto p-6 space-y-6">
        {/* Contextual Help */}
        <ContextualHelp page="quote-builder" />

        {/* In-context Page Alerts (business/performance) */}
        <PageAlerts categories={["business", "performance"]} className="mt-2" />
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => setLocation('/quotes')}
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Quotes
            </Button>
          </div>
        </div>

        {/* Quote Builder */}
        <QuoteBuilder
          initialQuoteId={quoteId}
          onSave={handleSave}
          onCancel={handleCancel}
          onCreateProposal={handleCreateProposal}
        />
      </div>
    </MainLayout>
  );
}