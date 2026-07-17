// client/src/pages/ConversationalAIDashboard.tsx
import { MainLayout } from '@/components/layout/main-layout';
import { ComingSoon } from '@/components/ui/coming-soon';
import { MessageSquare } from 'lucide-react';

/**
 * AUDIT-015 — gated.
 *
 * This page is registered at /conversational-ai-dashboard, so it is user-facing. It
 * previously rendered ~650 lines of fixtures — hardcoded mockMessages,
 * mockConversations and mockCapabilities, plus a generateMockResponse() behind a
 * setTimeout that faked the assistant "thinking" and replying. It contained ZERO
 * useQuery / useMutation / apiRequest calls: nothing on it was ever real, and a user
 * had no way to tell.
 *
 * There is no backend to wire it to — no conversational-ai edge function and no
 * Express route exists on either side. Per AUDIT-015's own rule ("for any page that
 * legitimately has no backend yet, gate it behind an explicit coming-soon state
 * rather than rendering fixtures as if real"), it is gated rather than faked.
 *
 * To restore: `git log --follow` this path — the fixture UI is in history and can
 * come back the moment there is an API behind it.
 */
export function ConversationalAIDashboard() {
  return (
    <MainLayout
      title="Conversation AI"
      description="Conversational AI for customer interactions and support automation"
    >
      <ComingSoon
        title="Conversation AI"
        description="Conversational AI for customer interactions and support automation."
        icon={MessageSquare}
        storyIds={['AUDIT-015']}
        capabilities={[
          'Live customer conversations with AI-assisted replies',
          'Conversation history and search',
          'Capability/skill configuration for the assistant',
          'Escalation to a human agent',
        ]}
        note="Gated because no conversational-AI backend exists yet (no edge function and no Express route). The previous version of this page showed hardcoded sample conversations and scripted replies."
      />
    </MainLayout>
  );
}

export default ConversationalAIDashboard;
