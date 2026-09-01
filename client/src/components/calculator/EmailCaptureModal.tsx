import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Loader2, CheckCircle, Mail } from 'lucide-react';
import { USER_ROLES } from './types';
import { getApiUrl } from '@/lib/config';

interface EmailCaptureModalProps {
  open: boolean;
  onClose: () => void;
  sessionKey: string;
  onSuccess: () => void;
}

export function EmailCaptureModal({
  open,
  onClose,
  sessionKey,
  onSuccess,
}: EmailCaptureModalProps) {
  const [formData, setFormData] = useState({
    email: '',
    companyName: '',
    fullName: '',
    phone: '',
    role: '',
    wantsQuarterlyUpdates: false,
  });

  const [submitted, setSubmitted] = useState(false);

  const captureMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      const response = await fetch(getApiUrl('/api/public/calculator/leads'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...data,
          sessionKey,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to capture lead');
      }

      return response.json();
    },
    onSuccess: () => {
      setSubmitted(true);
      // AUDIT-023: the pdf-download event is NOT fired here. It sets
      // calculator_sessions.pdf_downloaded, and no PDF is generated or sent by
      // anything - marking the column true would have made a fabricated figure
      // out of a real column. The page's own trackEvent('email_captured') is
      // what happened.

      // Auto-close after showing success
      setTimeout(() => {
        onSuccess();
      }, 2000);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    captureMutation.mutate(formData);
  };

  const isValid = formData.email && formData.companyName && formData.role;

  if (submitted) {
    return (
      <Dialog open={open} onOpenChange={onClose}>
        <DialogContent className="sm:max-w-md">
          <div className="text-center py-8">
            <div className="flex justify-center mb-4">
              <div className="bg-green-100 p-4 rounded-full">
                <CheckCircle className="h-12 w-12 text-green-600" />
              </div>
            </div>
            <h3 className="text-2xl font-bold mb-2">Got it - we'll be in touch</h3>
            <p className="text-gray-600 mb-4">
              Your details are with our team. Someone will follow up with a detailed analysis of
              your fleet.
            </p>
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-sm text-left">
              <p className="font-medium mb-2">Meanwhile, your results are on this page:</p>
              <ul className="space-y-1 text-gray-700">
                <li>Device-level cost breakdown</li>
                <li>Where your fleet sits against industry benchmarks</li>
                <li>The savings each change is worth</li>
              </ul>
            </div>
            <p className="text-xs text-gray-500 mt-4">
              Close this to go back to your results. Nothing is emailed automatically.
            </p>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl">
            <Mail className="h-6 w-6" />
            Get a Fleet Analysis From Our Team
          </DialogTitle>
          {/*
            The subtitle claimed 892 print managers and an $18K average saving.
            Nothing counts either figure - calculator_leads holds the sessions
            but no code aggregates them - so a number printed here would be
            invented, and inventing a peer count is what makes the rest of the
            page hard to believe.
          */}
          <DialogDescription>
            Tell us where to send it and a specialist will work through your numbers.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 mt-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2 space-y-2">
              <Label htmlFor="email">
                Email <span className="text-red-500">*</span>
              </Label>
              <Input
                id="email"
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                placeholder="your.email@company.com"
                required
              />
            </div>

            <div className="col-span-2 space-y-2">
              <Label htmlFor="company">
                Company Name <span className="text-red-500">*</span>
              </Label>
              <Input
                id="company"
                type="text"
                value={formData.companyName}
                onChange={(e) => setFormData({ ...formData, companyName: e.target.value })}
                placeholder="Your Company"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="name">Full Name</Label>
              <Input
                id="name"
                type="text"
                value={formData.fullName}
                onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                placeholder="John Doe"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="phone">Phone Number</Label>
              <Input
                id="phone"
                type="tel"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                placeholder="(555) 123-4567"
              />
            </div>

            <div className="col-span-2 space-y-2">
              <Label htmlFor="role">
                Your Role <span className="text-red-500">*</span>
              </Label>
              <Select
                value={formData.role}
                onValueChange={(value) => setFormData({ ...formData, role: value })}
                required
              >
                <SelectTrigger id="role">
                  <SelectValue placeholder="Select your role..." />
                </SelectTrigger>
                <SelectContent>
                  {USER_ROLES.map((role) => (
                    <SelectItem key={role.value} value={role.value}>
                      {role.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex items-start space-x-2 border rounded-lg p-3 bg-gray-50">
            <Checkbox
              id="quarterly-updates"
              checked={formData.wantsQuarterlyUpdates}
              onCheckedChange={(checked) =>
                setFormData({ ...formData, wantsQuarterlyUpdates: checked as boolean })
              }
            />
            <label htmlFor="quarterly-updates" className="text-sm leading-tight cursor-pointer">
              Yes, send me quarterly print cost benchmarking updates and practical print management
              tips.
              <span className="block text-xs text-gray-500 mt-1">
                No spam. Unsubscribe anytime.
              </span>
            </label>
          </div>

          {/*
            AUDIT-023: this listed six deliverables - a 12-page PDF, an RFP
            template, two spreadsheets - none of which any code produces, and
            the lead capture sends no email at all. What a visitor actually gets
            is a person, so that is what it says.
          */}
          <div className="bg-green-50 border border-green-200 rounded-lg p-4">
            <h4 className="font-semibold text-green-900 mb-2">What happens next</h4>
            <ul className="text-sm text-green-800 space-y-1">
              <li>A specialist reviews the numbers you just entered</li>
              <li>They follow up with a fleet analysis written for your setup</li>
              <li>Your results stay on this page in the meantime</li>
            </ul>
          </div>

          <div className="flex gap-3 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={captureMutation.isPending}
              className="flex-1"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={!isValid || captureMutation.isPending}
              className="flex-1"
            >
              {captureMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Sending...
                </>
              ) : (
                <>
                  <Mail className="h-4 w-4 mr-2" />
                  Send Me the Analysis
                </>
              )}
            </Button>
          </div>

          {captureMutation.isError && (
            <div className="text-sm text-red-600 text-center">
              Failed to send report. Please try again or contact support.
            </div>
          )}

          <p className="text-xs text-center text-gray-500">
            We respect your privacy. Your information will never be sold or shared.
          </p>
        </form>
      </DialogContent>
    </Dialog>
  );
}
