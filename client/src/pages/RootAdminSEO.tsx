import { useState } from 'react';
import { apiRequest } from '@/lib/queryClient';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { MainLayout } from '@/components/layout/main-layout';
import { Search, Globe, FileText, Bot, Brain } from 'lucide-react';

interface SeoSettings {
  siteName?: string;
  siteUrl?: string;
  defaultTitle?: string;
  defaultDescription?: string;
  defaultOgImage?: string;
  twitterHandle?: string;
}

export default function RootAdminSEO() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const { data: settings } = useQuery<SeoSettings>({ queryKey: ['/api/seo/settings'] });

  const [siteName, setSiteName] = useState(settings?.siteName || '');
  const [siteUrl, setSiteUrl] = useState(settings?.siteUrl || '');
  const [defaultTitle, setDefaultTitle] = useState(settings?.defaultTitle || '');
  const [defaultDescription, setDefaultDescription] = useState(settings?.defaultDescription || '');
  const [defaultOgImage, setDefaultOgImage] = useState(settings?.defaultOgImage || '');
  const [twitterHandle, setTwitterHandle] = useState(settings?.twitterHandle || '');

  const upsertSettings = useMutation({
    mutationFn: async (payload: any) => {
      return await apiRequest('/api/seo/settings', 'POST', payload);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['/api/seo/settings'] });
      toast({ title: 'SEO settings saved successfully!' });
    },
    onError: (error: any) => {
      toast({
        title: 'Error saving SEO settings',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  /*
   * SEO-005: the "Generate Sitemap", "Generate Robots.txt" and "Generate
   * LLMs.txt" buttons were here. Their three endpoints returned a success
   * message and did nothing - a green toast for an action that never happened.
   * The files have no runtime artifact to rebuild: the public ones are static
   * build output and the Express ones are composed per request. Removed rather
   * than reworded; the links below show what is actually being served.
   */

  /*
   * SEO-PAGES-001: the "SEO Pages" card was here - a path/title/description/
   * schema-type form over /api/seo/pages, a schema-preset picker, and a list
   * linking each row to /meta.json and /schema.json.
   *
   * None of it reached anything. `seoPages` is declared in no schema and no
   * migration, so the Express handlers behind it threw a TypeError into their
   * own catch (500 on the list and the save, a generic document from the two
   * JSON endpoints). In production /api/seo is not proxied, so the same URL
   * went to supabase/functions/seo/, whose `pages` branch reads
   * `seo_page_scores` - analysis scores, not page metadata - and answers
   * { data, total } where this page mapped a bare array. Both hosts were
   * wrong, differently.
   *
   * Deleted rather than repaired: per-path title, description and structured
   * data have one writer, PUBLIC_ROUTES_SEO in client/src/lib/seo/seoConfig.ts,
   * which SEOProvider applies and scripts/generate-sitemap.mts reads. SEO-014
   * removed the last consumer of the /meta.json path. The reasoning is recorded
   * at the top of server/routes-seo-core.ts.
   */

  return (
    <MainLayout>
      <div className="p-6 space-y-6">
        <div className="flex items-center gap-4">
          <Search className="h-8 w-8 text-blue-600" />
          <div>
            <h1 className="text-2xl font-semibold">SEO Management</h1>
            <p className="text-sm text-muted-foreground">
              Manage sitemaps, meta tags, schema markup, and search engine optimization
            </p>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Globe className="h-5 w-5" />
              Global SEO Settings
            </CardTitle>
            <CardDescription>
              Configure default SEO settings that apply across your entire platform
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Site Name</Label>
                <Input
                  value={siteName}
                  onChange={(e) => setSiteName(e.target.value)}
                  placeholder="Printyx"
                />
              </div>
              <div>
                <Label>Site URL</Label>
                <Input
                  value={siteUrl}
                  onChange={(e) => setSiteUrl(e.target.value)}
                  placeholder="https://printyx.net"
                />
              </div>
              <div className="col-span-2">
                <Label>Default Title</Label>
                <Input
                  value={defaultTitle}
                  onChange={(e) => setDefaultTitle(e.target.value)}
                  placeholder="Printyx - Unified Copier Dealer Management Platform"
                />
              </div>
              <div className="col-span-2">
                <Label>Default Description</Label>
                <Textarea
                  rows={3}
                  value={defaultDescription}
                  onChange={(e) => setDefaultDescription(e.target.value)}
                  placeholder="Printyx is a unified SaaS platform designed to consolidate fragmented technology stacks for small-to-medium copier dealers..."
                />
              </div>
              <div>
                <Label>Default OG Image URL</Label>
                <Input
                  value={defaultOgImage}
                  onChange={(e) => setDefaultOgImage(e.target.value)}
                  placeholder="https://printyx.net/og-image.png"
                />
              </div>
              <div>
                <Label>Twitter Handle</Label>
                <Input
                  value={twitterHandle}
                  onChange={(e) => setTwitterHandle(e.target.value)}
                  placeholder="@printyx"
                />
              </div>
            </div>

            <div className="flex gap-2 items-center">
              <Button
                onClick={() =>
                  upsertSettings.mutate({
                    siteName,
                    siteUrl,
                    defaultTitle,
                    defaultDescription,
                    defaultOgImage,
                    twitterHandle,
                  })
                }
                disabled={upsertSettings.isPending}
              >
                {upsertSettings.isPending ? 'Saving...' : 'Save Settings'}
              </Button>
            </div>

            <div className="flex gap-4 text-sm">
              <a
                className="text-blue-600 hover:text-blue-800 underline flex items-center gap-1"
                href="/sitemap.xml"
                target="_blank"
                rel="noreferrer"
              >
                <FileText className="h-4 w-4" />
                View sitemap.xml
              </a>
              <a
                className="text-blue-600 hover:text-blue-800 underline flex items-center gap-1"
                href="/robots.txt"
                target="_blank"
                rel="noreferrer"
              >
                <Bot className="h-4 w-4" />
                View robots.txt
              </a>
              <a
                className="text-blue-600 hover:text-blue-800 underline flex items-center gap-1"
                href="/llms.txt"
                target="_blank"
                rel="noreferrer"
              >
                <Brain className="h-4 w-4" />
                View llms.txt
              </a>
            </div>
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  );
}
