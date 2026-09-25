/**
 * AI meeting notes -> proposal pipeline. NOT BUILT (PROP-009).
 *
 * This file used to return the gate below and then carry ~330 unreachable
 * lines after it: two mock pipelines ("Acme Corporation", $24,500), a
 * processNotes() that waited two seconds on a setTimeout and called that AI,
 * and Upload File / Record Meeting / Send to Customer buttons with no
 * handlers. None of it could render, and all of it read as a feature that was
 * nearly done. Deleted in round 193 so the next person to open this file sees
 * the gate and nothing that looks like an implementation.
 *
 * What exists instead: build a quote, then generate a branded proposal from a
 * reusable template at /proposal-templates. Transcripts are captured by the
 * meeting-transcription edge function; nothing extracts requirements from them.
 */

import { Link } from 'wouter';
import { Sparkles } from 'lucide-react';
import MainLayout from '@/components/layout/main-layout';
import { Button } from '@/components/ui/button';

export default function MeetingToProposalDashboard() {
  return (
    <MainLayout title="Meeting to Proposal AI" description="Coming soon">
      <div className="container mx-auto p-6">
        <div className="max-w-xl mx-auto text-center border rounded-lg bg-white py-12 px-6">
          <Sparkles className="h-10 w-10 mx-auto mb-3 text-muted-foreground" />
          <h1 className="text-2xl font-bold mb-2">Meeting → Proposal AI</h1>
          <p className="text-muted-foreground mb-5">
            Automatically turning meeting notes into proposals is coming soon. For now, build a
            quote and generate a branded proposal from a reusable template.
          </p>
          <Button asChild>
            <Link href="/proposal-templates">Go to Proposal Templates</Link>
          </Button>
        </div>
      </div>
    </MainLayout>
  );
}
