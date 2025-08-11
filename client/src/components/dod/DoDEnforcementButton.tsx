import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2, CheckCircle2, AlertTriangle } from 'lucide-react';

interface DoDEnforcementButtonProps {
  recordId: string;
  validationType: 'quote-to-proposal' | 'proposal-to-contract' | 'po-to-warehouse' | 'service-completion';
  onValidClick: () => void;
  children: React.ReactNode;
  disabled?: boolean;
  variant?: "default" | "destructive" | "outline" | "secondary" | "ghost" | "link";
  size?: "default" | "sm" | "lg" | "icon";
  className?: string;
}

export default function DoDEnforcementButton({
  recordId,
  validationType,
  onValidClick,
  children,
  disabled = false,
  variant = "default",
  size = "default",
  className = ""
}: DoDEnforcementButtonProps) {
  const [validationState, setValidationState] = useState<'idle' | 'checking' | 'passed' | 'failed'>('idle');
  const [validationErrors, setValidationErrors] = useState<string[]>([]);

  const handleClick = async () => {
    if (!recordId) {
      onValidClick();
      return;
    }

    setValidationState('checking');
    
    try {
      const response = await fetch(`/api/validate/${validationType}/${recordId}`, {
        headers: {
          'x-tenant-id': localStorage.getItem('currentTenantId') || '',
        },
      });
      
      const result = await response.json();

      if (result.valid) {
        setValidationState('passed');
        setValidationErrors([]);
        // Brief success indication then proceed
        setTimeout(() => {
          setValidationState('idle');
          onValidClick();
        }, 500);
      } else {
        setValidationState('failed');
        setValidationErrors(result.errors || ['Validation failed']);
        
        // Show validation errors in alert
        const errorMessage = result.errors?.join('\n') || 'Please complete all required fields before proceeding.';
        alert(`Cannot proceed:\n\n${errorMessage}`);
        
        // Reset state after showing error
        setTimeout(() => setValidationState('idle'), 2000);
      }
    } catch (error) {
      console.error('DoD validation error:', error);
      setValidationState('failed');
      alert('Unable to validate requirements. Please try again.');
      setTimeout(() => setValidationState('idle'), 2000);
    }
  };

  const getButtonContent = () => {
    switch (validationState) {
      case 'checking':
        return (
          <>
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            Validating...
          </>
        );
      case 'passed':
        return (
          <>
            <CheckCircle2 className="h-4 w-4 mr-2 text-green-600" />
            {children}
          </>
        );
      case 'failed':
        return (
          <>
            <AlertTriangle className="h-4 w-4 mr-2 text-red-600" />
            {children}
          </>
        );
      default:
        return children;
    }
  };

  const isButtonDisabled = disabled || validationState === 'checking';

  return (
    <div className="flex flex-col items-end gap-1">
      <Button
        onClick={handleClick}
        disabled={isButtonDisabled}
        variant={validationState === 'failed' ? 'destructive' : variant}
        size={size}
        className={className}
      >
        {getButtonContent()}
      </Button>
      
      {validationState === 'failed' && validationErrors.length > 0 && (
        <div className="text-xs text-red-600 max-w-xs">
          <Badge variant="destructive" className="text-xs">
            {validationErrors.length} issue{validationErrors.length !== 1 ? 's' : ''} found
          </Badge>
        </div>
      )}
    </div>
  );
}