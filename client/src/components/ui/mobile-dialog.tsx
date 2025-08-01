import { ReactNode } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

interface MobileDialogProps {
  trigger: ReactNode;
  title?: string;
  children: ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  className?: string;
  maxHeight?: string;
}

export default function MobileDialog({
  trigger,
  title,
  children,
  open,
  onOpenChange,
  className,
  maxHeight = "90vh"
}: MobileDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        {trigger}
      </DialogTrigger>
      <DialogContent 
        className={cn(
          "w-[95vw] max-w-lg mx-auto p-0 gap-0 overflow-hidden",
          `max-h-[${maxHeight}]`,
          className
        )}
      >
        {title && (
          <DialogHeader className="p-4 pb-2 border-b bg-white sticky top-0 z-10">
            <div className="flex items-center justify-between">
              <DialogTitle className="text-lg font-semibold">{title}</DialogTitle>
              <Button
                variant="ghost"
                size="sm"
                className="h-8 w-8 p-0"
                onClick={() => onOpenChange?.(false)}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </DialogHeader>
        )}
        
        <ScrollArea className="flex-1 max-h-[calc(90vh-80px)]">
          <div className="p-4">
            {children}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}