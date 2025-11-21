import React from 'react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  BookOpen, 
  HelpCircle, 
  ArrowRight, 
  CheckCircle,
  AlertTriangle,
  Clock
} from 'lucide-react';
import SOPModal from './SOPModal';

interface ProcessHelpBannerProps {
  processType: 'lead-to-quote' | 'quote-to-proposal' | 'proposal-to-contract';
  currentStage?: string;
  nextStage?: string;
  estimatedTime?: string;
  className?: string;
}

const processInfo = {
  'lead-to-quote': {
    title: 'Lead to Quote Process',
    description: 'Convert qualified leads into professional quotes',
    stages: ['qualification', 'assessment', 'solution-design', 'quote-generation'],
    color: 'blue'
  },
  'quote-to-proposal': {
    title: 'Quote to Proposal Process', 
    description: 'Transform accepted quotes into detailed proposals',
    stages: ['acceptance-verification', 'documentation', 'legal-review'],
    color: 'green'
  },
  'proposal-to-contract': {
    title: 'Proposal to Contract Process',
    description: 'Execute signed contracts from approved proposals',
    stages: ['contract-preparation', 'signature-collection', 'contract-activation'],
    color: 'purple'
  }
};

export default function ProcessHelpBanner({ 
  processType, 
  currentStage, 
  nextStage, 
  estimatedTime,
  className = ''
}: ProcessHelpBannerProps) {
  const process = processInfo[processType];
  
  const getColorClasses = (color: string) => {
    switch (color) {
      case 'blue':
        return {
          bg: 'bg-blue-50 border-blue-200',
          text: 'text-blue-800',
          icon: 'text-blue-600',
          button: 'border-blue-300 text-blue-700 hover:bg-blue-100'
        };
      case 'green':
        return {
          bg: 'bg-green-50 border-green-200',
          text: 'text-green-800',
          icon: 'text-green-600',
          button: 'border-green-300 text-green-700 hover:bg-green-100'
        };
      case 'purple':
        return {
          bg: 'bg-purple-50 border-purple-200',
          text: 'text-purple-800',
          icon: 'text-purple-600',
          button: 'border-purple-300 text-purple-700 hover:bg-purple-100'
        };
      default:
        return {
          bg: 'bg-gray-50 border-gray-200',
          text: 'text-gray-800',
          icon: 'text-gray-600',
          button: 'border-gray-300 text-gray-700 hover:bg-gray-100'
        };
    }
  };

  const colors = getColorClasses(process.color);

  return (
    <Alert className={`${colors.bg} ${className}`}>
      <div className="flex items-start justify-between w-full">
        <div className="flex items-start gap-3 flex-1">
          <HelpCircle className={`h-5 w-5 mt-0.5 ${colors.icon}`} />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <h4 className={`font-semibold ${colors.text}`}>
                {process.title}
              </h4>
              {estimatedTime && (
                <Badge variant="outline" className="text-xs">
                  <Clock className="h-3 w-3 mr-1" />
                  {estimatedTime}
                </Badge>
              )}
            </div>
            <AlertDescription className={`${colors.text} mb-3`}>
              {process.description}. Follow the structured process to ensure all requirements are met.
            </AlertDescription>
            
            {/* Progress Indicator */}
            {currentStage && (
              <div className="flex items-center gap-2 mb-3">
                <span className="text-sm font-medium">Current Stage:</span>
                <Badge variant="secondary" className="capitalize">
                  {currentStage.replace('-', ' ')}
                </Badge>
                {nextStage && (
                  <>
                    <ArrowRight className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm">Next:</span>
                    <Badge variant="outline" className="capitalize">
                      {nextStage.replace('-', ' ')}
                    </Badge>
                  </>
                )}
              </div>
            )}

            {/* Quick Tips */}
            <div className="space-y-1">
              <div className="flex items-center gap-2 text-sm">
                <CheckCircle className={`h-4 w-4 ${colors.icon}`} />
                <span className={colors.text}>
                  Follow the Definition of Done (DoD) requirements for each stage
                </span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <AlertTriangle className={`h-4 w-4 ${colors.icon}`} />
                <span className={colors.text}>
                  Ensure all validations pass before proceeding to next stage
                </span>
              </div>
            </div>
          </div>
        </div>
        
        <div className="flex items-center gap-2 ml-4">
          <SOPModal 
            processType={processType}
            trigger={
              <Button 
                variant="outline" 
                size="sm"
                className={colors.button}
              >
                <BookOpen className="h-4 w-4 mr-2" />
                View SOP
              </Button>
            }
          />
        </div>
      </div>
    </Alert>
  );
}