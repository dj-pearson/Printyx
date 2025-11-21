/**
 * Custom hook for consistent form validation and error handling
 */

import { useForm, UseFormProps, UseFormReturn, FieldValues } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useToast } from "./use-toast";
import { useCallback } from "react";

interface UseValidatedFormOptions<T extends FieldValues> extends Omit<UseFormProps<T>, 'resolver'> {
  schema: z.ZodSchema<T>;
  onSubmit?: (data: T) => void | Promise<void>;
  onError?: (errors: any) => void;
  successMessage?: string;
  errorMessage?: string;
  resetOnSuccess?: boolean;
}

interface UseValidatedFormReturn<T extends FieldValues> extends UseFormReturn<T> {
  handleValidatedSubmit: (e?: React.BaseSyntheticEvent) => Promise<void>;
  isSubmitting: boolean;
  hasErrors: boolean;
  getFieldError: (fieldName: keyof T) => string | undefined;
  validateField: (fieldName: keyof T, value: any) => boolean;
  resetWithDefaults: () => void;
}

export function useValidatedForm<T extends FieldValues>({
  schema,
  onSubmit,
  onError,
  successMessage,
  errorMessage = "Please check the form for errors and try again",
  resetOnSuccess = false,
  ...formOptions
}: UseValidatedFormOptions<T>): UseValidatedFormReturn<T> {
  const { toast } = useToast();

  const form = useForm<T>({
    resolver: zodResolver(schema),
    mode: "onChange", // Validate on every change for real-time feedback
    ...formOptions,
  });

  const {
    handleSubmit,
    formState: { errors, isSubmitting },
    reset,
    trigger,
    clearErrors,
  } = form;

  // Enhanced error getter with fallback messages
  const getFieldError = useCallback((fieldName: keyof T): string | undefined => {
    const error = errors[fieldName];
    if (error?.message) return error.message as string;
    if (typeof error === "string") return error;
    return undefined;
  }, [errors]);

  // Real-time field validation
  const validateField = useCallback((fieldName: keyof T, value: any): boolean => {
    try {
      const fieldSchema = schema.shape?.[fieldName as string];
      if (fieldSchema) {
        fieldSchema.parse(value);
        clearErrors(fieldName);
        return true;
      }
      return true;
    } catch {
      trigger(fieldName);
      return false;
    }
  }, [schema, trigger, clearErrors]);

  // Reset with schema defaults
  const resetWithDefaults = useCallback(() => {
    try {
      const defaults = schema.parse({});
      reset(defaults);
    } catch {
      reset();
    }
  }, [schema, reset]);

  // Enhanced submit handler with consistent error handling
  const handleValidatedSubmit = useCallback(async (e?: React.BaseSyntheticEvent) => {
    e?.preventDefault();
    
    await handleSubmit(
      async (data: T) => {
        try {
          await onSubmit?.(data);
          
          if (successMessage) {
            toast({
              title: "Success",
              description: successMessage,
            });
          }
          
          if (resetOnSuccess) {
            resetWithDefaults();
          }
        } catch (error) {
          console.error("Form submission error:", error);
          toast({
            title: "Error",
            description: error instanceof Error ? error.message : errorMessage,
            variant: "destructive",
          });
        }
      },
      (formErrors) => {
        // Handle validation errors
        const errorCount = Object.keys(formErrors).length;
        const firstError = Object.values(formErrors)[0] as any;
        
        toast({
          title: "Validation Error",
          description: errorCount === 1 
            ? firstError?.message || errorMessage
            : `Please fix ${errorCount} validation errors`,
          variant: "destructive",
        });
        
        onError?.(formErrors);
      }
    )(e);
  }, [handleSubmit, onSubmit, onError, successMessage, errorMessage, resetOnSuccess, toast, resetWithDefaults]);

  return {
    ...form,
    handleValidatedSubmit,
    isSubmitting,
    hasErrors: Object.keys(errors).length > 0,
    getFieldError,
    validateField,
    resetWithDefaults,
  };
}

// Specialized hooks for common form patterns

export function useCreateForm<T extends FieldValues>(options: UseValidatedFormOptions<T>) {
  return useValidatedForm({
    resetOnSuccess: true,
    successMessage: "Created successfully",
    errorMessage: "Failed to create. Please check the form and try again.",
    ...options,
  });
}

export function useUpdateForm<T extends FieldValues>(options: UseValidatedFormOptions<T>) {
  return useValidatedForm({
    resetOnSuccess: false,
    successMessage: "Updated successfully",
    errorMessage: "Failed to update. Please check the form and try again.",
    ...options,
  });
}

export function useSearchForm<T extends FieldValues>(options: UseValidatedFormOptions<T>) {
  return useValidatedForm({
    resetOnSuccess: false,
    mode: "onChange",
    errorMessage: "Invalid search criteria",
    ...options,
  });
}

// Hook for multi-step forms
export function useMultiStepForm<T extends FieldValues>({
  steps,
  ...options
}: UseValidatedFormOptions<T> & {
  steps: { schema: z.ZodSchema<any>; title: string }[];
}) {
  const form = useValidatedForm(options);
  
  const validateStep = async (stepIndex: number) => {
    const stepSchema = steps[stepIndex]?.schema;
    if (!stepSchema) return true;
    
    try {
      const formData = form.getValues();
      stepSchema.parse(formData);
      return true;
    } catch {
      await form.trigger();
      return false;
    }
  };
  
  return {
    ...form,
    steps,
    validateStep,
  };
}