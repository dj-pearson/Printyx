/**
 * Password Strength Indicator Component
 *
 * Provides real-time visual feedback on password strength
 * Shows requirements and progress as user types
 */

import { useMemo } from 'react';
import { calculatePasswordStrength, type PasswordStrength } from '@/lib/validations';
import { Check, X } from 'lucide-react';
import { cn } from '@/lib/utils';

interface PasswordStrengthIndicatorProps {
  password: string;
  className?: string;
}

export function PasswordStrengthIndicator({ password, className }: PasswordStrengthIndicatorProps) {
  const strength = useMemo(() => calculatePasswordStrength(password), [password]);

  // Don't show indicator if password is empty
  if (!password) {
    return null;
  }

  return (
    <div className={cn('space-y-3', className)}>
      {/* Strength Bar */}
      <div className="space-y-1">
        <div className="flex justify-between items-center">
          <span className="text-xs font-medium text-gray-700">Password Strength</span>
          <span
            className={cn(
              'text-xs font-semibold',
              strength.level === 'very-weak' && 'text-red-600',
              strength.level === 'weak' && 'text-orange-600',
              strength.level === 'fair' && 'text-yellow-600',
              strength.level === 'good' && 'text-blue-600',
              strength.level === 'strong' && 'text-green-600',
            )}
          >
            {strength.level === 'very-weak' && 'Very Weak'}
            {strength.level === 'weak' && 'Weak'}
            {strength.level === 'fair' && 'Fair'}
            {strength.level === 'good' && 'Good'}
            {strength.level === 'strong' && 'Strong'}
          </span>
        </div>

        {/* Progress Bar */}
        <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
          <div
            className={cn(
              'h-full transition-all duration-300',
              strength.level === 'very-weak' && 'w-1/5 bg-red-500',
              strength.level === 'weak' && 'w-2/5 bg-orange-500',
              strength.level === 'fair' && 'w-3/5 bg-yellow-500',
              strength.level === 'good' && 'w-4/5 bg-blue-500',
              strength.level === 'strong' && 'w-full bg-green-500',
            )}
          />
        </div>
      </div>

      {/* Requirements Checklist */}
      <div className="space-y-1.5">
        <PasswordRequirement met={password.length >= 12} text="At least 12 characters" />
        <PasswordRequirement met={/[A-Z]/.test(password)} text="One uppercase letter" />
        <PasswordRequirement met={/[a-z]/.test(password)} text="One lowercase letter" />
        <PasswordRequirement met={/[0-9]/.test(password)} text="One number" />
        <PasswordRequirement
          met={/[^A-Za-z0-9]/.test(password)}
          text="One special character (!@#$%^&*)"
        />
      </div>
    </div>
  );
}

interface PasswordRequirementProps {
  met: boolean;
  text: string;
}

function PasswordRequirement({ met, text }: PasswordRequirementProps) {
  return (
    <div className="flex items-center gap-2 text-xs">
      {met ? (
        <Check className="h-4 w-4 text-green-600 flex-shrink-0" />
      ) : (
        <X className="h-4 w-4 text-gray-400 flex-shrink-0" />
      )}
      <span className={cn(met ? 'text-green-700' : 'text-gray-600')}>{text}</span>
    </div>
  );
}

/**
 * Compact version of password strength indicator
 * Shows only the progress bar, no requirements list
 */
export function PasswordStrengthCompact({ password, className }: PasswordStrengthIndicatorProps) {
  const strength = useMemo(() => calculatePasswordStrength(password), [password]);

  if (!password) {
    return null;
  }

  return (
    <div className={cn('flex items-center gap-2', className)}>
      <div className="flex-1 h-1.5 bg-gray-200 rounded-full overflow-hidden">
        <div
          className={cn(
            'h-full transition-all duration-300',
            strength.level === 'very-weak' && 'w-1/5 bg-red-500',
            strength.level === 'weak' && 'w-2/5 bg-orange-500',
            strength.level === 'fair' && 'w-3/5 bg-yellow-500',
            strength.level === 'good' && 'w-4/5 bg-blue-500',
            strength.level === 'strong' && 'w-full bg-green-500',
          )}
        />
      </div>
      <span
        className={cn(
          'text-xs font-medium',
          strength.level === 'very-weak' && 'text-red-600',
          strength.level === 'weak' && 'text-orange-600',
          strength.level === 'fair' && 'text-yellow-600',
          strength.level === 'good' && 'text-blue-600',
          strength.level === 'strong' && 'text-green-600',
        )}
      >
        {strength.level === 'very-weak' && 'Very Weak'}
        {strength.level === 'weak' && 'Weak'}
        {strength.level === 'fair' && 'Fair'}
        {strength.level === 'good' && 'Good'}
        {strength.level === 'strong' && 'Strong'}
      </span>
    </div>
  );
}

export default PasswordStrengthIndicator;
