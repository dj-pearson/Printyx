import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Star,
  Send,
  Save,
  Clock,
  CheckCircle,
  AlertTriangle,
  MessageSquare,
  ThumbsUp,
  ThumbsDown,
  ArrowLeft,
  ArrowRight,
  Loader2,
  Award,
  TrendingUp,
  Target,
  Check,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  FormDescription,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { format } from 'date-fns';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';

// Types matching the actual API schema (snake_case from database)
type SatisfactionSurvey = {
  id: string;
  survey_type: string;
  status: 'invited' | 'started' | 'completed' | 'expired' | 'skipped';
  tenant_id: string;
  customer_id: string;
  template_id: string;
  invitation_sent_at?: string;
  started_at?: string;
  completed_at?: string;
  expires_at?: string;
  overall_score?: number;
  nps_score?: number;
  related_service_request_id?: string;
  related_maintenance_appointment_id?: string;
  created_at: string;
  updated_at: string;
};

type SatisfactionQuestion = {
  id: string;
  template_id: string;
  question_text: string;
  question_type:
    | 'rating_scale'
    | 'yes_no'
    | 'multiple_choice'
    | 'text_short'
    | 'text_long'
    | 'nps_score';
  is_required: boolean;
  order_index: number;
  rating_scale?: {
    min: number;
    max: number;
    labels: string[];
  };
  multiple_choice_options?: string[];
  category?: string;
  weight: string;
  created_at: string;
  updated_at: string;
};

type SatisfactionResponse = {
  id: string;
  survey_id: string;
  question_id: string;
  rating_value?: number;
  text_value?: string;
  selected_options?: string[];
  boolean_value?: boolean;
  time_spent_seconds?: number;
  response_order?: number;
  answered_at: string;
};

type SatisfactionTemplate = {
  id: string;
  tenant_id: string;
  name: string;
  description?: string;
  survey_type: string;
  is_active: boolean;
  is_default: boolean;
};

type SurveyData = {
  survey: SatisfactionSurvey;
  questions: SatisfactionQuestion[];
  existingResponses: SatisfactionResponse[];
};

// API Response wrapper
type SurveyApiResponse = {
  success: boolean;
  data: SurveyData;
};

// Form validation schema for responses (matching API snake_case)
const satisfactionResponseSchema = z.object({
  responses: z.array(
    z.object({
      question_id: z.string(),
      rating_value: z.number().optional(),
      text_value: z.string().optional(),
      selected_options: z.array(z.string()).optional(),
      boolean_value: z.boolean().optional(),
      time_spent_seconds: z.number().optional(),
      response_order: z.number().optional(),
    }),
  ),
});

type SatisfactionResponseForm = z.infer<typeof satisfactionResponseSchema>;

interface CustomerSatisfactionFormProps {
  surveyId: string;
  isOpen: boolean;
  onClose: () => void;
  onComplete?: (result: any) => void;
}

export const CustomerSatisfactionForm = ({
  surveyId,
  isOpen,
  onClose,
  onComplete,
}: CustomerSatisfactionFormProps) => {
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [startTime, setStartTime] = useState<number>(Date.now());
  const [questionStartTime, setQuestionStartTime] = useState<number>(Date.now());
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Get survey data
  const {
    data: surveyData,
    isLoading,
    error,
  } = useQuery({
    queryKey: ['/api/customer-portal/satisfaction/surveys', surveyId],
    queryFn: () => apiRequest(`/api/customer-portal/satisfaction/surveys/${surveyId}`),
    enabled: isOpen && !!surveyId,
  });

  // Start survey mutation
  const startSurveyMutation = useMutation({
    mutationFn: () =>
      apiRequest(`/api/customer-portal/satisfaction/surveys/${surveyId}/start`, {
        method: 'POST',
      }),
    onSuccess: () => {
      // Invalidate the current survey to refetch its updated status
      queryClient.invalidateQueries({
        queryKey: ['/api/customer-portal/satisfaction/surveys', surveyId],
      });
      // Also invalidate the surveys list for immediate UI feedback
      queryClient.invalidateQueries({ queryKey: ['/api/customer-portal/satisfaction/surveys'] });
    },
  });

  // Submit responses mutation
  const submitResponsesMutation = useMutation({
    mutationFn: (responses: any) =>
      apiRequest(`/api/customer-portal/satisfaction/surveys/${surveyId}/submit`, {
        method: 'POST',
        body: JSON.stringify({ responses }),
      }),
    onSuccess: (result) => {
      toast({
        title: 'Survey Completed',
        description:
          'Thank you for your feedback! Your responses have been submitted successfully.',
      });
      queryClient.invalidateQueries({ queryKey: ['/api/customer-portal/satisfaction/surveys'] });
      onComplete?.(result);
      onClose();
    },
    onError: (error) => {
      toast({
        title: 'Submission Failed',
        description: 'There was an error submitting your responses. Please try again.',
        variant: 'destructive',
      });
    },
  });

  const form = useForm<SatisfactionResponseForm>({
    resolver: zodResolver(satisfactionResponseSchema),
    defaultValues: {
      responses: [],
    },
  });

  // Initialize form with existing responses
  useEffect(() => {
    if (surveyData?.data?.existingResponses && surveyData.data.questions) {
      const responses = surveyData.data.questions.map((question: SatisfactionQuestion) => {
        const existingResponse = surveyData.data.existingResponses.find(
          (r: SatisfactionResponse) => r.question_id === question.id,
        );
        return {
          question_id: question.id,
          rating_value: existingResponse?.rating_value,
          text_value: existingResponse?.text_value || '',
          selected_options: existingResponse?.selected_options || [],
          boolean_value: existingResponse?.boolean_value,
          time_spent_seconds: existingResponse?.time_spent_seconds,
          response_order: existingResponse?.response_order,
        };
      });
      form.setValue('responses', responses);
    }
  }, [surveyData, form]);

  // Start survey when opened
  useEffect(() => {
    if (isOpen && surveyData?.data?.survey?.status === 'invited') {
      startSurveyMutation.mutate();
    }
  }, [isOpen, surveyData]);

  if (isLoading) {
    return (
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="max-w-4xl">
          <div className="flex items-center justify-center p-8">
            <Loader2 className="h-6 w-6 animate-spin mr-2" />
            Loading survey...
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  if (error || !surveyData?.data) {
    return (
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center">
              <AlertTriangle className="h-5 w-5 text-red-500 mr-2" />
              Survey Unavailable
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-gray-600">
              {error?.message || 'This survey is no longer available or has expired.'}
            </p>
            <Button onClick={onClose} className="w-full">
              Close
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  const { survey, questions } = surveyData.data as SurveyData;
  const currentQuestion = questions[currentQuestionIndex];
  const progress = ((currentQuestionIndex + 1) / questions.length) * 100;
  const isLastQuestion = currentQuestionIndex === questions.length - 1;

  const handleNext = () => {
    // Check if current question is required and not answered
    if (currentQuestion.is_required && !isCurrentQuestionAnswered()) {
      toast({
        title: 'Response Required',
        description: 'Please answer this required question before proceeding.',
        variant: 'destructive',
      });
      return;
    }

    if (currentQuestionIndex < questions.length - 1) {
      // Record time spent on current question
      const timeSpent = Math.round((Date.now() - questionStartTime) / 1000);
      const currentResponses = form.getValues('responses');
      currentResponses[currentQuestionIndex] = {
        ...currentResponses[currentQuestionIndex],
        time_spent_seconds: timeSpent,
        response_order: currentQuestionIndex + 1,
      };
      form.setValue('responses', currentResponses);

      setCurrentQuestionIndex((prev) => prev + 1);
      setQuestionStartTime(Date.now());
    }
  };

  const handlePrevious = () => {
    if (currentQuestionIndex > 0) {
      setCurrentQuestionIndex((prev) => prev - 1);
      setQuestionStartTime(Date.now());
    }
  };

  const handleSubmit = async () => {
    // Check if all required questions are answered
    if (!areAllRequiredQuestionsAnswered()) {
      toast({
        title: 'Missing Required Responses',
        description: 'Please answer all required questions before submitting the survey.',
        variant: 'destructive',
      });
      return;
    }

    setIsSubmitting(true);
    try {
      // Record time spent on final question
      const timeSpent = Math.round((Date.now() - questionStartTime) / 1000);
      const currentResponses = form.getValues('responses');
      currentResponses[currentQuestionIndex] = {
        ...currentResponses[currentQuestionIndex],
        time_spent_seconds: timeSpent,
        response_order: currentQuestionIndex + 1,
      };

      // Filter out empty responses and validate
      const validResponses = currentResponses.filter((response) => {
        return (
          response.rating_value !== undefined ||
          (response.text_value && response.text_value.trim() !== '') ||
          response.selected_options?.length ||
          response.boolean_value !== undefined
        );
      });

      await submitResponsesMutation.mutateAsync(validResponses);
    } catch (error) {
      console.error('Submit error:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const updateResponse = (field: string, value: any) => {
    const currentResponses = form.getValues('responses');
    currentResponses[currentQuestionIndex] = {
      ...currentResponses[currentQuestionIndex],
      [field]: value,
    };
    form.setValue('responses', currentResponses);
  };

  const getCurrentResponse = () => {
    return form.getValues('responses')[currentQuestionIndex] || {};
  };

  const renderQuestionInput = () => {
    const currentResponse = getCurrentResponse();

    switch (currentQuestion.question_type) {
      case 'rating_scale':
        const scale = currentQuestion.rating_scale || { min: 1, max: 5, labels: [] };
        return (
          <div className="space-y-6">
            <div className="flex justify-center">
              <div className="flex items-center space-x-2 sm:space-x-3">
                {Array.from({ length: scale.max - scale.min + 1 }, (_, i) => {
                  const value = scale.min + i;
                  const isSelected = currentResponse.rating_value === value;
                  return (
                    <button
                      key={value}
                      type="button"
                      onClick={() => updateResponse('rating_value', value)}
                      className={`
                        flex items-center justify-center w-14 h-14 sm:w-12 sm:h-12 rounded-full border-2 
                        transition-all duration-200 font-semibold touch-target
                        ${
                          isSelected
                            ? 'bg-blue-500 border-blue-500 text-white scale-110'
                            : 'bg-white border-gray-300 text-gray-700 hover:border-blue-300 hover:scale-105'
                        }
                      `}
                      data-testid={`rating-${value}`}
                    >
                      {value}
                    </button>
                  );
                })}
              </div>
            </div>
            {scale.labels.length > 0 && (
              <div className="flex justify-between text-sm text-gray-500">
                <span>{scale.labels[0]}</span>
                <span>{scale.labels[scale.labels.length - 1]}</span>
              </div>
            )}
          </div>
        );

      case 'nps_score':
        return (
          <div className="space-y-6">
            <div className="text-center">
              <p className="text-sm text-gray-600 mb-4">
                How likely are you to recommend our service to a friend or colleague?
              </p>
              <div className="flex justify-center flex-wrap gap-2 sm:gap-3">
                {Array.from({ length: 11 }, (_, i) => {
                  const isSelected = currentResponse.rating_value === i;
                  return (
                    <button
                      key={i}
                      type="button"
                      onClick={() => updateResponse('rating_value', i)}
                      className={`
                        flex items-center justify-center w-12 h-12 sm:w-10 sm:h-10 rounded-lg border-2 
                        transition-all duration-200 font-semibold text-sm touch-target
                        ${
                          isSelected
                            ? 'bg-blue-500 border-blue-500 text-white'
                            : 'bg-white border-gray-300 text-gray-700 hover:border-blue-300'
                        }
                      `}
                      data-testid={`nps-${i}`}
                    >
                      {i}
                    </button>
                  );
                })}
              </div>
              <div className="flex justify-between text-xs text-gray-500 mt-2">
                <span>Not at all likely</span>
                <span>Extremely likely</span>
              </div>
            </div>
          </div>
        );

      case 'yes_no':
        return (
          <div className="flex justify-center space-x-6">
            <button
              type="button"
              onClick={() => updateResponse('boolean_value', true)}
              className={`
                flex items-center space-x-2 px-6 py-3 rounded-lg border-2 transition-all
                ${
                  currentResponse.boolean_value === true
                    ? 'bg-green-500 border-green-500 text-white'
                    : 'bg-white border-gray-300 text-gray-700 hover:border-green-300'
                }
              `}
              data-testid="yes-option"
            >
              <ThumbsUp className="h-4 w-4" />
              <span>Yes</span>
            </button>
            <button
              type="button"
              onClick={() => updateResponse('boolean_value', false)}
              className={`
                flex items-center space-x-2 px-6 py-3 rounded-lg border-2 transition-all
                ${
                  currentResponse.boolean_value === false
                    ? 'bg-red-500 border-red-500 text-white'
                    : 'bg-white border-gray-300 text-gray-700 hover:border-red-300'
                }
              `}
              data-testid="no-option"
            >
              <ThumbsDown className="h-4 w-4" />
              <span>No</span>
            </button>
          </div>
        );

      case 'multiple_choice':
        return (
          <div className="space-y-3">
            {currentQuestion.multiple_choice_options?.map((option, index) => {
              const isSelected = currentResponse.selected_options?.includes(option) || false;
              return (
                <button
                  key={index}
                  type="button"
                  onClick={() => {
                    const current = currentResponse.selected_options || [];
                    const updated = isSelected
                      ? current.filter((o) => o !== option)
                      : [...current, option];
                    updateResponse('selected_options', updated);
                  }}
                  className={`
                    w-full text-left p-4 rounded-lg border-2 transition-all
                    flex items-center space-x-3
                    ${
                      isSelected
                        ? 'bg-blue-50 border-blue-500 text-blue-800'
                        : 'bg-white border-gray-300 text-gray-700 hover:border-blue-300'
                    }
                  `}
                  data-testid={`option-${index}`}
                >
                  <div
                    className={`
                    w-5 h-5 rounded border-2 flex items-center justify-center
                    ${isSelected ? 'bg-blue-500 border-blue-500' : 'border-gray-300'}
                  `}
                  >
                    {isSelected && <Check className="h-3 w-3 text-white" />}
                  </div>
                  <span>{option}</span>
                </button>
              );
            })}
          </div>
        );

      case 'text_short':
        return (
          <Input
            value={currentResponse.text_value || ''}
            onChange={(e) => updateResponse('text_value', e.target.value)}
            placeholder="Enter your response..."
            className="w-full"
            data-testid="text-short-input"
          />
        );

      case 'text_long':
        return (
          <Textarea
            value={currentResponse.text_value || ''}
            onChange={(e) => updateResponse('text_value', e.target.value)}
            placeholder="Enter your detailed response..."
            className="w-full min-h-[120px]"
            data-testid="text-long-input"
          />
        );

      default:
        return <div>Unsupported question type</div>;
    }
  };

  const isQuestionAnswered = (question: SatisfactionQuestion, response: any) => {
    if (!response) return false;

    switch (question.question_type) {
      case 'rating_scale':
      case 'nps_score':
        return response.rating_value !== undefined && response.rating_value !== null;

      case 'yes_no':
        return response.boolean_value !== undefined && response.boolean_value !== null;

      case 'multiple_choice':
        return response.selected_options && response.selected_options.length > 0;

      case 'text_short':
      case 'text_long':
        return response.text_value && response.text_value.trim() !== '';

      default:
        return false;
    }
  };

  const isCurrentQuestionAnswered = () => {
    const response = getCurrentResponse();
    return isQuestionAnswered(currentQuestion, response);
  };

  const areAllRequiredQuestionsAnswered = () => {
    const responses = form.getValues('responses');

    for (let i = 0; i < questions.length; i++) {
      const question = questions[i];
      if (question.is_required) {
        const response = responses[i];
        if (!isQuestionAnswered(question, response)) {
          return false;
        }
      }
    }

    return true;
  };

  const isCurrentQuestionRequired = () => {
    return currentQuestion.is_required === true;
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <div>
              <DialogTitle className="flex items-center">
                <MessageSquare className="h-5 w-5 text-blue-500 mr-2" />
                {survey.templateName || 'Customer Satisfaction Survey'}
              </DialogTitle>
              <p className="text-sm text-gray-600 mt-1">
                Question {currentQuestionIndex + 1} of {questions.length}
              </p>
            </div>
            <Badge variant="outline" className="text-xs">
              {Math.round(progress)}% Complete
            </Badge>
          </div>
        </DialogHeader>

        <div className="space-y-6">
          {/* Progress Bar */}
          <Progress value={progress} className="w-full" />

          {/* Current Question */}
          <Card className="border-l-4 border-l-blue-500">
            <CardHeader>
              <CardTitle className="text-lg leading-relaxed">
                {currentQuestion.question_text}
              </CardTitle>
              {currentQuestion.is_required && (
                <div className="flex items-center text-sm text-red-600">
                  <span className="mr-1">*</span>
                  Required
                </div>
              )}
              {currentQuestion.category && (
                <Badge variant="secondary" className="w-fit text-xs">
                  {currentQuestion.category}
                </Badge>
              )}
            </CardHeader>
            <CardContent>{renderQuestionInput()}</CardContent>
          </Card>

          {/* Navigation */}
          <div className="flex items-center justify-between pt-4 border-t">
            <Button
              variant="outline"
              onClick={handlePrevious}
              disabled={currentQuestionIndex === 0}
              data-testid="button-previous"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Previous
            </Button>

            <div className="flex items-center space-x-2">
              {questions.map((_, index) => (
                <div
                  key={index}
                  className={`w-2 h-2 rounded-full ${
                    index < currentQuestionIndex
                      ? 'bg-green-500'
                      : index === currentQuestionIndex
                        ? 'bg-blue-500'
                        : 'bg-gray-300'
                  }`}
                />
              ))}
            </div>

            {isLastQuestion ? (
              <Button
                onClick={handleSubmit}
                disabled={isSubmitting || !areAllRequiredQuestionsAnswered()}
                className="bg-green-600 hover:bg-green-700"
                data-testid="button-submit"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Submitting...
                  </>
                ) : (
                  <>
                    <Send className="h-4 w-4 mr-2" />
                    Submit Survey
                  </>
                )}
              </Button>
            ) : (
              <Button onClick={handleNext} disabled={false} data-testid="button-next">
                Next
                <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default CustomerSatisfactionForm;
