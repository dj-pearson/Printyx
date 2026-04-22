import { Link } from 'wouter';
import { MainLayout } from '@/components/layout/main-layout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Target, BookOpen, Users, Layers, Wand2, ArrowRight } from 'lucide-react';

const TILES = [
  {
    title: 'Business Context',
    description:
      'Define who you sell to, what you deliver, why you win, and past wins. The AI reads this before every draft.',
    icon: BookOpen,
    path: '/outreach/business-context',
    badge: 'Start here',
  },
  {
    title: 'My Specialty',
    description:
      'Pick copier / production / IT / software / finishing — or a blend. Shapes tone and talking points.',
    icon: Users,
    path: '/outreach/my-specialty',
    badge: 'Step 2',
  },
  {
    title: 'Sequence Studio',
    description:
      'AI-draft 2-email and 3-LinkedIn sequences against a specific angle (lease expiring, new hire, trade show, etc.).',
    icon: Layers,
    path: '/outreach/sequence-studio',
    badge: 'Step 3',
  },
  {
    title: 'Draft Generator',
    description:
      'Pick a prospect, pick a sequence step, get a polished draft in 3 variants. Copy. Paste. Send.',
    icon: Wand2,
    path: '/outreach/draft-generator',
    badge: 'Daily driver',
  },
];

export default function OutreachHub() {
  return (
    <MainLayout>
      <div className="container mx-auto py-6 space-y-6 max-w-6xl">
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Target className="h-6 w-6 text-primary" />
              <h1 className="text-3xl font-semibold tracking-tight">Outreach</h1>
              <Badge variant="outline" className="ml-2">
                Beta
              </Badge>
            </div>
            <p className="text-muted-foreground">
              AI-assisted cold email and LinkedIn drafts tailored to your specialty and ICP.
              Human-in-the-loop — you review and send.
            </p>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          {TILES.map((tile) => {
            const Icon = tile.icon;
            return (
              <Link key={tile.path} href={tile.path}>
                <Card className="cursor-pointer transition-all hover:border-primary hover:shadow-md">
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        <div className="rounded-lg bg-primary/10 p-2">
                          <Icon className="h-5 w-5 text-primary" />
                        </div>
                        <CardTitle>{tile.title}</CardTitle>
                      </div>
                      <Badge variant="secondary">{tile.badge}</Badge>
                    </div>
                    <CardDescription className="pt-2">{tile.description}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="text-sm text-primary flex items-center gap-1 font-medium">
                      Open <ArrowRight className="h-4 w-4" />
                    </div>
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>

        <Card>
          <CardHeader>
            <CardTitle>How this works</CardTitle>
            <CardDescription>
              The 10-to-1 coverage model: email for reach, LinkedIn for precision.
            </CardDescription>
          </CardHeader>
          <CardContent className="prose prose-sm max-w-none dark:prose-invert">
            <ol>
              <li>
                <strong>Configure once:</strong> Business Context + My Specialty. Takes ~15 minutes
                and shapes every draft the AI produces.
              </li>
              <li>
                <strong>Build sequences:</strong> Save a few AI-drafted sequences aimed at specific
                angles (lease expiry, new office, leadership change, trade show). Re-use them across
                prospects.
              </li>
              <li>
                <strong>Work the list:</strong> Paste or import a prospect, generate a draft, copy
                it to your email client or LinkedIn. Mark sent. Track what replies.
              </li>
              <li>
                <strong>Learn what works:</strong> Over time, high-reply sequences and angles bubble
                up. Double down.
              </li>
            </ol>
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  );
}
