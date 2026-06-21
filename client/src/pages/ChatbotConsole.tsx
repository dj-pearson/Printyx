/**
 * Slack/Teams Natural-Language Printyx Bot console (US-SUPER-014) — READ-ONLY v1.
 *
 * Admin console to install Slack/Teams workspaces, map chat users to Printyx
 * users (by verified email, for RBAC scoping), try a natural-language query, and
 * review the query audit log.
 *
 * >>> READ-ONLY v1: the bot never writes to Printyx business data. <<<
 * It answers read-only questions (account summary, rep activity, pipeline, this
 * week, at-risk customers, predicted failures) with deep links. There is no
 * "create"/"send" capability anywhere on this page by design.
 */

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'wouter';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Bot,
  CheckCircle2,
  Link2,
  MessageSquare,
  Send,
  ShieldCheck,
  Trash2,
  XCircle,
} from 'lucide-react';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';

// ---------------------------------------------------------------------------
// Locally-typed shapes
// ---------------------------------------------------------------------------

interface Connection {
  id: string;
  platform: string;
  teamId: string;
  teamName: string | null;
  enabled: boolean;
  installedByUserId: string | null;
  tokensSet: boolean;
  createdAt: string;
  updatedAt: string;
}

interface UserLink {
  id: string;
  platform: string;
  platformUserId: string;
  email: string | null;
  printyxUserId: string | null;
  verified: boolean;
  createdAt: string;
}

interface QueryLogRow {
  id: string;
  platform: string | null;
  channel: string | null;
  platformUserId: string | null;
  printyxUserId: string | null;
  question: string | null;
  toolsCalled: Array<{ tool: string; args?: Record<string, string>; source?: string }> | null;
  responseExcerpt: string | null;
  createdAt: string;
}

interface Citation {
  label: string;
  href: string;
}

interface QueryAnswer {
  answer: string;
  citations: Citation[];
  toolsCalled: Array<{ tool: string; args?: Record<string, string>; source?: string }>;
  replyInThread: boolean;
}

interface ListResponse<T> {
  data: T[];
  total: number;
}

const EXAMPLE_QUESTIONS: Array<{ label: string; question: string }> = [
  { label: 'Account summary', question: 'Give me a summary for Acme Corporation' },
  { label: 'Reps below quota', question: 'Which reps have no recent activity?' },
  { label: 'Pipeline', question: 'What does the pipeline look like?' },
  { label: 'This week', question: 'What changed this week?' },
  { label: 'At-risk', question: 'Which customers are at churn risk?' },
  { label: 'Predicted failures', question: 'Any predicted equipment failures?' },
];

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function ChatbotConsole() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Connection form state
  const [connPlatform, setConnPlatform] = useState<string>('slack');
  const [teamId, setTeamId] = useState('');
  const [teamName, setTeamName] = useState('');
  const [botToken, setBotToken] = useState('');

  // Link form state
  const [linkPlatform, setLinkPlatform] = useState<string>('slack');
  const [platformUserId, setPlatformUserId] = useState('');
  const [linkEmail, setLinkEmail] = useState('');

  // Query box state
  const [question, setQuestion] = useState('');
  const [answer, setAnswer] = useState<QueryAnswer | null>(null);

  // -------------------------------------------------------------------------
  // Queries
  // -------------------------------------------------------------------------

  const connections = useQuery<ListResponse<Connection>>({
    queryKey: ['/api/chatbot/connections'],
  });
  const links = useQuery<ListResponse<UserLink>>({ queryKey: ['/api/chatbot/links'] });
  const queryLog = useQuery<ListResponse<QueryLogRow>>({ queryKey: ['/api/chatbot/query-log'] });

  // -------------------------------------------------------------------------
  // Mutations
  // -------------------------------------------------------------------------

  const connectMutation = useMutation({
    mutationFn: () =>
      apiRequest('/api/chatbot/connect', 'POST', {
        platform: connPlatform,
        teamId: teamId.trim(),
        teamName: teamName.trim() || undefined,
        botToken: botToken.trim() || undefined,
      }),
    onSuccess: () => {
      toast({ title: 'Workspace connected' });
      setTeamId('');
      setTeamName('');
      setBotToken('');
      queryClient.invalidateQueries({ queryKey: ['/api/chatbot/connections'] });
    },
    onError: (err: any) =>
      toast({ title: 'Failed to connect', description: err?.message, variant: 'destructive' }),
  });

  const toggleConnMutation = useMutation({
    mutationFn: ({ id, enabled }: { id: string; enabled: boolean }) =>
      apiRequest(`/api/chatbot/connections/${id}`, 'PUT', { enabled }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['/api/chatbot/connections'] }),
    onError: (err: any) =>
      toast({ title: 'Failed to update', description: err?.message, variant: 'destructive' }),
  });

  const removeConnMutation = useMutation({
    mutationFn: (id: string) => apiRequest(`/api/chatbot/connections/${id}`, 'DELETE'),
    onSuccess: () => {
      toast({ title: 'Workspace removed' });
      queryClient.invalidateQueries({ queryKey: ['/api/chatbot/connections'] });
    },
    onError: (err: any) =>
      toast({ title: 'Failed to remove', description: err?.message, variant: 'destructive' }),
  });

  const addLinkMutation = useMutation({
    mutationFn: () =>
      apiRequest('/api/chatbot/links', 'POST', {
        platform: linkPlatform,
        platformUserId: platformUserId.trim(),
        email: linkEmail.trim(),
      }),
    onSuccess: (row: UserLink) => {
      toast({
        title: row?.verified
          ? 'User mapped and verified'
          : 'User mapped (no matching Printyx email)',
      });
      setPlatformUserId('');
      setLinkEmail('');
      queryClient.invalidateQueries({ queryKey: ['/api/chatbot/links'] });
    },
    onError: (err: any) =>
      toast({ title: 'Failed to map user', description: err?.message, variant: 'destructive' }),
  });

  const removeLinkMutation = useMutation({
    mutationFn: (id: string) => apiRequest(`/api/chatbot/links/${id}`, 'DELETE'),
    onSuccess: () => {
      toast({ title: 'Mapping removed' });
      queryClient.invalidateQueries({ queryKey: ['/api/chatbot/links'] });
    },
    onError: (err: any) =>
      toast({ title: 'Failed to remove', description: err?.message, variant: 'destructive' }),
  });

  const queryMutation = useMutation({
    mutationFn: (q: string) =>
      // No platformUserId → the query runs as your own Printyx account.
      apiRequest('/api/chatbot/query', 'POST', { question: q }),
    onSuccess: (res: QueryAnswer) => {
      setAnswer(res);
      queryClient.invalidateQueries({ queryKey: ['/api/chatbot/query-log'] });
    },
    onError: (err: any) =>
      toast({ title: 'Query failed', description: err?.message, variant: 'destructive' }),
  });

  const runQuery = (q: string) => {
    const trimmed = q.trim();
    if (!trimmed) return;
    setQuestion(trimmed);
    queryMutation.mutate(trimmed);
  };

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------

  return (
    <div className="container mx-auto max-w-5xl space-y-6 p-4 sm:p-6">
      <div className="flex items-center gap-3">
        <Bot className="h-7 w-7 text-primary" />
        <div>
          <h1 className="text-2xl font-bold">Slack / Teams Bot</h1>
          <p className="text-sm text-muted-foreground">
            Ask Printyx questions from chat. Read-only v1 — the bot never writes to Printyx.
          </p>
        </div>
      </div>

      {/* Try a query */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5" /> Try a query
          </CardTitle>
          <CardDescription>
            Runs as your own Printyx account (no platform user id). Answers are read-only with deep
            links.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap gap-2">
            {EXAMPLE_QUESTIONS.map((ex) => (
              <Button
                key={ex.label}
                type="button"
                variant="outline"
                size="sm"
                className="min-h-[48px]"
                onClick={() => runQuery(ex.question)}
                disabled={queryMutation.isPending}
              >
                {ex.label}
              </Button>
            ))}
          </div>
          <Textarea
            placeholder="e.g. What happened with Acme this week?"
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            className="min-h-[80px]"
          />
          <Button
            type="button"
            className="min-h-[48px]"
            onClick={() => runQuery(question)}
            disabled={queryMutation.isPending || !question.trim()}
          >
            <Send className="mr-2 h-4 w-4" />
            {queryMutation.isPending ? 'Asking…' : 'Send'}
          </Button>

          {answer && (
            <div className="rounded-md border bg-muted/40 p-4">
              <p className="whitespace-pre-wrap text-sm">{answer.answer}</p>
              {answer.citations.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-2">
                  {answer.citations.map((c, i) => (
                    <Link key={i} href={c.href}>
                      <Badge variant="secondary" className="cursor-pointer">
                        {c.label}
                      </Badge>
                    </Link>
                  ))}
                </div>
              )}
              {answer.toolsCalled.length > 0 && (
                <p className="mt-3 text-xs text-muted-foreground">
                  Tools: {answer.toolsCalled.map((t) => t.tool).join(', ')}
                </p>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Connections */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5" /> Workspace connections
          </CardTitle>
          <CardDescription>
            Install a Slack/Teams workspace. The bot token is write-only and never shown again.
            Read-only v1 — the bot never writes to Printyx.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="space-y-1">
              <Label>Platform</Label>
              <Select value={connPlatform} onValueChange={setConnPlatform}>
                <SelectTrigger className="min-h-[48px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="slack">Slack</SelectItem>
                  <SelectItem value="teams">Teams</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Team / workspace id</Label>
              <Input
                className="min-h-[48px]"
                value={teamId}
                onChange={(e) => setTeamId(e.target.value)}
                placeholder="T0123ABC"
              />
            </div>
            <div className="space-y-1">
              <Label>Team name (optional)</Label>
              <Input
                className="min-h-[48px]"
                value={teamName}
                onChange={(e) => setTeamName(e.target.value)}
                placeholder="Acme Workspace"
              />
            </div>
            <div className="space-y-1">
              <Label>Bot token (write-only)</Label>
              <Input
                type="password"
                className="min-h-[48px]"
                value={botToken}
                onChange={(e) => setBotToken(e.target.value)}
                placeholder="xoxb-…"
              />
            </div>
          </div>
          <Button
            type="button"
            className="min-h-[48px]"
            onClick={() => connectMutation.mutate()}
            disabled={connectMutation.isPending || !teamId.trim()}
          >
            {connectMutation.isPending ? 'Connecting…' : 'Connect workspace'}
          </Button>

          {connections.isLoading ? (
            <p className="text-sm text-muted-foreground">Loading connections…</p>
          ) : connections.isError ? (
            <p className="text-sm text-destructive">Failed to load connections.</p>
          ) : (connections.data?.data.length ?? 0) === 0 ? (
            <p className="text-sm text-muted-foreground">No workspaces connected yet.</p>
          ) : (
            <div className="space-y-2">
              {connections.data!.data.map((c) => (
                <div
                  key={c.id}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-md border p-3"
                >
                  <div className="flex items-center gap-2">
                    <Badge variant="outline">{c.platform}</Badge>
                    <span className="font-medium">{c.teamName || c.teamId}</span>
                    {c.tokensSet ? (
                      <Badge variant="secondary">token set</Badge>
                    ) : (
                      <Badge variant="outline">no token</Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-muted-foreground">Enabled</span>
                      <Switch
                        checked={c.enabled}
                        onCheckedChange={(enabled) =>
                          toggleConnMutation.mutate({ id: c.id, enabled })
                        }
                      />
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="min-h-[48px] min-w-[48px]"
                      onClick={() => removeConnMutation.mutate(c.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* User links */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Link2 className="h-5 w-5" /> User mappings
          </CardTitle>
          <CardDescription>
            Slack/Teams users are mapped to Printyx users by verified email for RBAC scoping.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div className="space-y-1">
              <Label>Platform</Label>
              <Select value={linkPlatform} onValueChange={setLinkPlatform}>
                <SelectTrigger className="min-h-[48px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="slack">Slack</SelectItem>
                  <SelectItem value="teams">Teams</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Platform user id</Label>
              <Input
                className="min-h-[48px]"
                value={platformUserId}
                onChange={(e) => setPlatformUserId(e.target.value)}
                placeholder="U0123ABC"
              />
            </div>
            <div className="space-y-1">
              <Label>Printyx email</Label>
              <Input
                type="email"
                className="min-h-[48px]"
                value={linkEmail}
                onChange={(e) => setLinkEmail(e.target.value)}
                placeholder="rep@dealer.com"
              />
            </div>
          </div>
          <Button
            type="button"
            className="min-h-[48px]"
            onClick={() => addLinkMutation.mutate()}
            disabled={addLinkMutation.isPending || !platformUserId.trim() || !linkEmail.trim()}
          >
            {addLinkMutation.isPending ? 'Mapping…' : 'Map user'}
          </Button>

          {links.isLoading ? (
            <p className="text-sm text-muted-foreground">Loading mappings…</p>
          ) : links.isError ? (
            <p className="text-sm text-destructive">Failed to load mappings.</p>
          ) : (links.data?.data.length ?? 0) === 0 ? (
            <p className="text-sm text-muted-foreground">No users mapped yet.</p>
          ) : (
            <div className="space-y-2">
              {links.data!.data.map((l) => (
                <div
                  key={l.id}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-md border p-3"
                >
                  <div className="flex items-center gap-2">
                    <Badge variant="outline">{l.platform}</Badge>
                    <span className="font-mono text-sm">{l.platformUserId}</span>
                    <span className="text-sm text-muted-foreground">{l.email}</span>
                    {l.verified ? (
                      <Badge variant="secondary" className="gap-1">
                        <CheckCircle2 className="h-3 w-3" /> verified
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="gap-1">
                        <XCircle className="h-3 w-3" /> unverified
                      </Badge>
                    )}
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="min-h-[48px] min-w-[48px]"
                    onClick={() => removeLinkMutation.mutate(l.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Audit log */}
      <Card>
        <CardHeader>
          <CardTitle>Query audit log</CardTitle>
          <CardDescription>Every query is logged (newest first, last 200).</CardDescription>
        </CardHeader>
        <CardContent>
          {queryLog.isLoading ? (
            <p className="text-sm text-muted-foreground">Loading audit log…</p>
          ) : queryLog.isError ? (
            <p className="text-sm text-destructive">Failed to load audit log.</p>
          ) : (queryLog.data?.data.length ?? 0) === 0 ? (
            <p className="text-sm text-muted-foreground">No queries logged yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Actor</TableHead>
                    <TableHead>Question</TableHead>
                    <TableHead>Tools</TableHead>
                    <TableHead>Time</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {queryLog.data!.data.map((row) => (
                    <TableRow key={row.id}>
                      <TableCell className="text-sm">
                        {row.printyxUserId ? (
                          <span className="font-mono">{row.printyxUserId.slice(0, 8)}</span>
                        ) : (
                          <Badge variant="outline">denied</Badge>
                        )}
                        {row.platform && (
                          <span className="ml-1 text-xs text-muted-foreground">
                            ({row.platform})
                          </span>
                        )}
                      </TableCell>
                      <TableCell
                        className="max-w-[280px] truncate text-sm"
                        title={row.question ?? ''}
                      >
                        {row.question}
                      </TableCell>
                      <TableCell className="text-xs">
                        {(row.toolsCalled ?? []).map((t) => t.tool).join(', ') || '—'}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {new Date(row.createdAt).toLocaleString()}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
