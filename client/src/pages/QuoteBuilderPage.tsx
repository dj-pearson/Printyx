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

export default function QuoteBuilderPage() {
  const [, setLocation] = useLocation();
  const [match, params] = useRoute('/quotes/:quoteId');
  const quoteId = params?.quoteId;
  const isEditing = !!quoteId;

  const handleSave = (savedQuoteId: string) => {
    setLocation(`/quotes/${savedQuoteId}`);
  };

  const handleCancel = () => {
    setLocation('/quotes');
  };

  return (
    <MainLayout>
      <div className="container mx-auto p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => navigate('/quotes')}
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Quotes
            </Button>
            <div>
              <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
                <Calculator className="h-8 w-8" />
                {isEditing ? 'Edit Quote' : 'Quote Builder'}
              </h1>
              <p className="text-muted-foreground">
                {isEditing 
                  ? 'Modify your existing quote with line-by-line product selection'
                  : 'Create a comprehensive quote with line-by-line product selection'
                }
              </p>
            </div>
          </div>
        </div>

        {/* Quote Builder */}
        <QuoteBuilder
          initialQuoteId={quoteId}
          onSave={handleSave}
          onCancel={handleCancel}
        />
      </div>
    </MainLayout>
  );
}