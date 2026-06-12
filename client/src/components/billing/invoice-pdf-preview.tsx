import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Download, Loader2, AlertCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { fetchInvoicePdfBlob, triggerBlobDownload } from '@/lib/invoice-pdf';

interface InvoicePDFPreviewProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  invoiceId: string | null;
}

export function InvoicePDFPreview({ open, onOpenChange, invoiceId }: InvoicePDFPreviewProps) {
  const { toast } = useToast();
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open && invoiceId) {
      loadPDF();
    } else {
      setPdfUrl(null);
      setError(null);
    }

    return () => {
      if (pdfUrl) {
        URL.revokeObjectURL(pdfUrl);
      }
    };
  }, [open, invoiceId]);

  const loadPDF = async () => {
    if (!invoiceId) return;

    setIsLoading(true);
    setError(null);

    try {
      const blob = await fetchInvoicePdfBlob(invoiceId);
      const url = URL.createObjectURL(blob);
      setPdfUrl(url);
    } catch (err: any) {
      console.error('Error loading PDF:', err);
      setError(err.message || 'Failed to load invoice PDF');
      toast({
        title: 'Failed to load PDF',
        description: err.message || 'Please try again',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleDownload = async () => {
    if (!invoiceId) return;

    try {
      const blob = await fetchInvoicePdfBlob(invoiceId);
      triggerBlobDownload(blob, `invoice-${invoiceId}.pdf`);

      toast({
        title: 'Download started',
        description: 'Invoice PDF is downloading.',
      });
    } catch (error) {
      toast({
        title: 'Download failed',
        description: 'Failed to download invoice PDF',
        variant: 'destructive',
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl h-[90vh] flex flex-col">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <div>
              <DialogTitle>Invoice Preview</DialogTitle>
              <DialogDescription>Preview invoice before sending or downloading</DialogDescription>
            </div>
            <Button variant="outline" onClick={handleDownload} disabled={isLoading || !!error}>
              <Download className="mr-2 h-4 w-4" />
              Download
            </Button>
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-hidden rounded-md border bg-muted/50">
          {isLoading && (
            <div className="h-full flex items-center justify-center">
              <div className="text-center space-y-4">
                <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
                <p className="text-muted-foreground">Loading PDF preview...</p>
              </div>
            </div>
          )}

          {error && (
            <div className="h-full flex items-center justify-center">
              <div className="text-center space-y-4 max-w-md">
                <AlertCircle className="h-12 w-12 text-destructive mx-auto" />
                <div>
                  <h3 className="font-semibold mb-2">Failed to load PDF</h3>
                  <p className="text-sm text-muted-foreground">{error}</p>
                </div>
                <Button onClick={loadPDF} variant="outline">
                  Try Again
                </Button>
              </div>
            </div>
          )}

          {pdfUrl && !isLoading && !error && (
            <iframe src={pdfUrl} className="w-full h-full" title="Invoice PDF Preview" />
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
