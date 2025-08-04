/**
 * Enhanced form field components with consistent validation display
 */

import React from "react";
import { Control, FieldPath, FieldValues } from "react-hook-form";
import {
  FormControl,
  FormField as ShadcnFormField,
  FormItem,
  FormLabel,
  FormMessage,
  FormDescription,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { cn } from "@/lib/utils";

interface BaseFormFieldProps<T extends FieldValues> {
  control: Control<T>;
  name: FieldPath<T>;
  label: string;
  description?: string;
  required?: boolean;
  className?: string;
}

interface TextFieldProps<T extends FieldValues> extends BaseFormFieldProps<T> {
  type?: "text" | "email" | "password" | "number" | "tel" | "url";
  placeholder?: string;
  disabled?: boolean;
  maxLength?: number;
  autoComplete?: string;
}

export function TextField<T extends FieldValues>({
  control,
  name,
  label,
  description,
  required,
  className,
  type = "text",
  placeholder,
  disabled,
  maxLength,
  autoComplete,
}: TextFieldProps<T>) {
  return (
    <ShadcnFormField
      control={control}
      name={name}
      render={({ field, fieldState }) => (
        <FormItem className={className}>
          <FormLabel>
            {label}
            {required && <span className="text-destructive ml-1">*</span>}
          </FormLabel>
          <FormControl>
            <Input
              {...field}
              type={type}
              placeholder={placeholder}
              disabled={disabled}
              maxLength={maxLength}
              autoComplete={autoComplete}
              className={cn(
                fieldState.error && "border-destructive focus:border-destructive"
              )}
            />
          </FormControl>
          {description && <FormDescription>{description}</FormDescription>}
          <FormMessage />
        </FormItem>
      )}
    />
  );
}

interface TextAreaFieldProps<T extends FieldValues> extends BaseFormFieldProps<T> {
  placeholder?: string;
  disabled?: boolean;
  rows?: number;
  maxLength?: number;
}

export function TextAreaField<T extends FieldValues>({
  control,
  name,
  label,
  description,
  required,
  className,
  placeholder,
  disabled,
  rows = 3,
  maxLength,
}: TextAreaFieldProps<T>) {
  return (
    <ShadcnFormField
      control={control}
      name={name}
      render={({ field, fieldState }) => (
        <FormItem className={className}>
          <FormLabel>
            {label}
            {required && <span className="text-destructive ml-1">*</span>}
          </FormLabel>
          <FormControl>
            <Textarea
              {...field}
              placeholder={placeholder}
              disabled={disabled}
              rows={rows}
              maxLength={maxLength}
              className={cn(
                fieldState.error && "border-destructive focus:border-destructive"
              )}
            />
          </FormControl>
          {description && <FormDescription>{description}</FormDescription>}
          <FormMessage />
        </FormItem>
      )}
    />
  );
}

interface SelectOption {
  value: string;
  label: string;
  disabled?: boolean;
}

interface SelectFieldProps<T extends FieldValues> extends BaseFormFieldProps<T> {
  placeholder?: string;
  options: SelectOption[];
  disabled?: boolean;
}

export function SelectField<T extends FieldValues>({
  control,
  name,
  label,
  description,
  required,
  className,
  placeholder = "Select an option",
  options,
  disabled,
}: SelectFieldProps<T>) {
  return (
    <ShadcnFormField
      control={control}
      name={name}
      render={({ field }) => (
        <FormItem className={className}>
          <FormLabel>
            {label}
            {required && <span className="text-destructive ml-1">*</span>}
          </FormLabel>
          <Select
            onValueChange={field.onChange}
            defaultValue={field.value}
            disabled={disabled}
          >
            <FormControl>
              <SelectTrigger>
                <SelectValue placeholder={placeholder} />
              </SelectTrigger>
            </FormControl>
            <SelectContent>
              {options.map((option) => (
                <SelectItem
                  key={option.value}
                  value={option.value}
                  disabled={option.disabled}
                >
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {description && <FormDescription>{description}</FormDescription>}
          <FormMessage />
        </FormItem>
      )}
    />
  );
}

interface CheckboxFieldProps<T extends FieldValues> extends BaseFormFieldProps<T> {
  disabled?: boolean;
}

export function CheckboxField<T extends FieldValues>({
  control,
  name,
  label,
  description,
  className,
  disabled,
}: CheckboxFieldProps<T>) {
  return (
    <ShadcnFormField
      control={control}
      name={name}
      render={({ field }) => (
        <FormItem className={cn("flex flex-row items-start space-x-3 space-y-0", className)}>
          <FormControl>
            <Checkbox
              checked={field.value}
              onCheckedChange={field.onChange}
              disabled={disabled}
            />
          </FormControl>
          <div className="space-y-1 leading-none">
            <FormLabel className="cursor-pointer">{label}</FormLabel>
            {description && <FormDescription>{description}</FormDescription>}
          </div>
          <FormMessage />
        </FormItem>
      )}
    />
  );
}

interface RadioOption {
  value: string;
  label: string;
  description?: string;
  disabled?: boolean;
}

interface RadioFieldProps<T extends FieldValues> extends BaseFormFieldProps<T> {
  options: RadioOption[];
  disabled?: boolean;
  orientation?: "horizontal" | "vertical";
}

export function RadioField<T extends FieldValues>({
  control,
  name,
  label,
  description,
  required,
  className,
  options,
  disabled,
  orientation = "vertical",
}: RadioFieldProps<T>) {
  return (
    <ShadcnFormField
      control={control}
      name={name}
      render={({ field }) => (
        <FormItem className={className}>
          <FormLabel>
            {label}
            {required && <span className="text-destructive ml-1">*</span>}
          </FormLabel>
          <FormControl>
            <RadioGroup
              onValueChange={field.onChange}
              defaultValue={field.value}
              className={cn(
                orientation === "horizontal" && "flex flex-row space-x-4"
              )}
              disabled={disabled}
            >
              {options.map((option) => (
                <div key={option.value} className="flex items-center space-x-2">
                  <RadioGroupItem
                    value={option.value}
                    id={`${String(name)}-${option.value}`}
                    disabled={option.disabled}
                  />
                  <label
                    htmlFor={`${String(name)}-${option.value}`}
                    className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                  >
                    {option.label}
                  </label>
                  {option.description && (
                    <FormDescription className="mt-0 ml-6">
                      {option.description}
                    </FormDescription>
                  )}
                </div>
              ))}
            </RadioGroup>
          </FormControl>
          {description && <FormDescription>{description}</FormDescription>}
          <FormMessage />
        </FormItem>
      )}
    />
  );
}

interface DateFieldProps<T extends FieldValues> extends BaseFormFieldProps<T> {
  placeholder?: string;
  disabled?: boolean;
  min?: string;
  max?: string;
}

export function DateField<T extends FieldValues>({
  control,
  name,
  label,
  description,
  required,
  className,
  placeholder,
  disabled,
  min,
  max,
}: DateFieldProps<T>) {
  return (
    <ShadcnFormField
      control={control}
      name={name}
      render={({ field, fieldState }) => (
        <FormItem className={className}>
          <FormLabel>
            {label}
            {required && <span className="text-destructive ml-1">*</span>}
          </FormLabel>
          <FormControl>
            <Input
              {...field}
              type="date"
              placeholder={placeholder}
              disabled={disabled}
              min={min}
              max={max}
              className={cn(
                fieldState.error && "border-destructive focus:border-destructive"
              )}
            />
          </FormControl>
          {description && <FormDescription>{description}</FormDescription>}
          <FormMessage />
        </FormItem>
      )}
    />
  );
}

interface CurrencyFieldProps<T extends FieldValues> extends BaseFormFieldProps<T> {
  placeholder?: string;
  disabled?: boolean;
  min?: number;
  max?: number;
  currency?: string;
}

export function CurrencyField<T extends FieldValues>({
  control,
  name,
  label,
  description,
  required,
  className,
  placeholder,
  disabled,
  min = 0,
  max,
  currency = "USD",
}: CurrencyFieldProps<T>) {
  return (
    <ShadcnFormField
      control={control}
      name={name}
      render={({ field, fieldState }) => (
        <FormItem className={className}>
          <FormLabel>
            {label}
            {required && <span className="text-destructive ml-1">*</span>}
          </FormLabel>
          <FormControl>
            <div className="relative">
              <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground">
                $
              </span>
              <Input
                {...field}
                type="number"
                placeholder={placeholder}
                disabled={disabled}
                min={min}
                max={max}
                step="0.01"
                className={cn(
                  "pl-8",
                  fieldState.error && "border-destructive focus:border-destructive"
                )}
              />
            </div>
          </FormControl>
          {description && <FormDescription>{description}</FormDescription>}
          <FormMessage />
        </FormItem>
      )}
    />
  );
}