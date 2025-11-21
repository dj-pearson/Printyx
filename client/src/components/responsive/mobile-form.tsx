import { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface MobileFormProps {
  children: ReactNode;
  title?: string;
  onSubmit?: (e: React.FormEvent) => void;
  submitText?: string;
  cancelText?: string;
  onCancel?: () => void;
  isLoading?: boolean;
  className?: string;
}

export default function MobileForm({
  children,
  title,
  onSubmit,
  submitText = "Save",
  cancelText = "Cancel",
  onCancel,
  isLoading = false,
  className
}: MobileFormProps) {
  return (
    <div className="w-full max-w-2xl mx-auto max-h-[90vh] overflow-y-auto">
      <Card className={cn("w-full", className)}>
        {title && (
          <CardHeader className="pb-4 sticky top-0 bg-white z-10 border-b">
            <CardTitle className="text-lg sm:text-xl">{title}</CardTitle>
          </CardHeader>
        )}
        <CardContent className="space-y-6 pb-4">
          <form onSubmit={onSubmit} className="space-y-4 sm:space-y-6">
            <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-2">
              {children}
            </div>
            
            <div className="flex flex-col-reverse sm:flex-row gap-3 sm:gap-4 pt-4 border-t sticky bottom-0 bg-white">
              {onCancel && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={onCancel}
                  disabled={isLoading}
                  className="w-full sm:w-auto"
                >
                  {cancelText}
                </Button>
              )}
              <Button
                type="submit"
                disabled={isLoading}
                className="w-full sm:w-auto sm:ml-auto"
              >
                {isLoading ? "Saving..." : submitText}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}