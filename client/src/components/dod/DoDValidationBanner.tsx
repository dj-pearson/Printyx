import { useState, useEffect } from 'react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { X, AlertTriangle, CheckCircle2, ExternalLink } from 'lucide-react';

interface ValidationError {
  field: string;
  message: string;
  action?: string;
  actionLink?: string;
}

interface DoDValidationBannerProps {
  recordId: string;
  validationType: 'quote-to-proposal' | 'proposal-to-contract' | 'po-to-warehouse' | 'service-completion';
  onValidationPass?: () => void;
  onValidationFail?: (errors: ValidationError[]) => void;
  enabled?: boolean;
}

export default function DoDValidationBanner({ 
  recordId, 
  validationType, 
  onValidationPass, 
  onValidationFail,
  enabled = true 
}: DoDValidationBannerProps) {
  const [validationStatus, setValidationStatus] = useState<'checking' | 'passed' | 'failed' | 'hidden'>('hidden');
  const [validationErrors, setValidationErrors] = useState<ValidationError[]>([]);
  const [showBanner, setShowBanner] = useState(false);

  const checkValidation = async () => {
    if (!enabled || !recordId) return;

    setValidationStatus('checking');
    setShowBanner(true);

    try {
      const response = await fetch(`/api/validate/${validationType}/${recordId}`, {
        headers: {
          'x-tenant-id': localStorage.getItem('currentTenantId') || '',
        },
      });
      
      const result = await response.json();

      if (result.valid) {
        setValidationStatus('passed');
        setValidationErrors([]);
        onValidationPass?.();
        
        // Auto-hide success banner after 3 seconds
        setTimeout(() => {
          setShowBanner(false);
          setValidationStatus('hidden');
        }, 3000);
      } else {
        setValidationStatus('failed');
        setValidationErrors(result.errors || []);
        onValidationFail?.(result.errors || []);
      }
    } catch (error) {
      console.error('DoD validation error:', error);
      setValidationStatus('failed');
      setValidationErrors([{ field: 'system', message: 'Unable to validate requirements. Please try again.' }]);
      onValidationFail?.([{ field: 'system', message: 'Validation system error' }]);
    }
  };

  useEffect(() => {
    if (enabled && recordId) {
      checkValidation();
    }
  }, [recordId, validationType, enabled]);

  const getValidationTitle = () => {
    switch (validationType) {
      case 'quote-to-proposal':
        return 'Quote Validation for Proposal Creation';
      case 'proposal-to-contract':
        return 'Proposal Validation for Contract Generation';
      case 'po-to-warehouse':
        return 'Purchase Order Validation for Warehouse Release';
      case 'service-completion':
        return 'Service Ticket Validation for Completion';
      default:
        return 'Validation Check';
    }
  };

  const getStatusColor = () => {
    switch (validationStatus) {
      case 'checking':
        return 'blue';
      case 'passed':
        return 'green';
      case 'failed':
        return 'red';
      default:
        return 'gray';
    }
  };

  if (!showBanner || validationStatus === 'hidden') {
    return null;
  }

  return (
    <Alert className={`border-l-4 ${
      validationStatus === 'passed' ? 'border-green-500 bg-green-50' :
      validationStatus === 'failed' ? 'border-red-500 bg-red-50' :
      'border-blue-500 bg-blue-50'
    }`}>
      <div className="flex items-start justify-between">
        <div className="flex items-start space-x-3 flex-1">
          {validationStatus === 'checking' && (
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600 mt-1"></div>
          )}
          {validationStatus === 'passed' && (
            <CheckCircle2 className="h-4 w-4 text-green-600 mt-1" />
          )}
          {validationStatus === 'failed' && (
            <AlertTriangle className="h-4 w-4 text-red-600 mt-1" />
          )}
          
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <h4 className="font-semibold text-sm">{getValidationTitle()}</h4>
              <Badge variant={
                validationStatus === 'passed' ? 'default' :
                validationStatus === 'failed' ? 'destructive' :
                'secondary'
              }>
                {validationStatus === 'checking' ? 'Checking...' :
                 validationStatus === 'passed' ? 'Passed' :
                 validationStatus === 'failed' ? 'Failed' : 'Unknown'}
              </Badge>
            </div>
            
            <AlertDescription>
              {validationStatus === 'checking' && 'Verifying all requirements are met...'}
              {validationStatus === 'passed' && 'All requirements satisfied. Ready to proceed to next stage.'}
              {validationStatus === 'failed' && (
                <div>
                  <p className="mb-2">The following requirements must be completed before proceeding:</p>
                  <ul className="space-y-1">
                    {validationErrors.map((error, index) => (
                      <li key={index} className="flex items-center justify-between text-sm">
                        <span>• {error.message}</span>
                        {error.actionLink && (
                          <Button 
                            variant="link" 
                            size="sm" 
                            className="h-auto p-0 text-blue-600"
                            onClick={() => window.location.href = error.actionLink!}
                          >
                            {error.action || 'Fix'}
                            <ExternalLink className="h-3 w-3 ml-1" />
                          </Button>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </AlertDescription>
          </div>
        </div>
        
        <div className="flex items-center gap-2 ml-4">
          {validationStatus === 'failed' && (
            <Button 
              variant="outline" 
              size="sm" 
              onClick={checkValidation}
              className="text-xs"
            >
              Re-check
            </Button>
          )}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowBanner(false)}
            className="h-6 w-6 p-0"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </Alert>
  );
}