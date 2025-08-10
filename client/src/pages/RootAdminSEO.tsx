import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { MainLayout } from "@/components/layout/main-layout";
import { Search, Globe, FileText, Bot, Brain, Refresh } from "lucide-react";

export default function RootAdminSEO() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const { data: settings } = useQuery({ queryKey: ["/api/seo/settings"] });
  const { data: pages } = useQuery({ queryKey: ["/api/seo/pages"] });

  const [siteName, setSiteName] = useState(settings?.siteName || "");
  const [siteUrl, setSiteUrl] = useState(settings?.siteUrl || "");
  const [defaultTitle, setDefaultTitle] = useState(
    settings?.defaultTitle || ""
  );
  const [defaultDescription, setDefaultDescription] = useState(
    settings?.defaultDescription || ""
  );
  const [defaultOgImage, setDefaultOgImage] = useState(
    settings?.defaultOgImage || ""
  );
  const [twitterHandle, setTwitterHandle] = useState(
    settings?.twitterHandle || ""
  );

  const upsertSettings = useMutation({
    mutationFn: async (payload: any) => {
      const res = await fetch("/api/seo/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        credentials: "include",
      });
      if (!res.ok) {
        const error = await res.text();
        throw new Error(error || "Failed to save settings");
      }
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/seo/settings"] });
      toast({ title: "SEO settings saved successfully!" });
    },
    onError: (error: any) => {
      toast({
        title: "Error saving SEO settings",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const upsertPage = useMutation({
    mutationFn: async (payload: any) => {
      const res = await fetch("/api/seo/pages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        credentials: "include",
      });
      if (!res.ok) {
        const error = await res.text();
        throw new Error(error || "Failed to save page");
      }
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/seo/pages"] });
      toast({ title: "SEO page saved successfully!" });
      // Clear form
      setNewPath("");
      setNewTitle("");
      setNewDescription("");
      setNewSchemaType("");
      setNewSchemaData("");
    },
    onError: (error: any) => {
      toast({
        title: "Error saving SEO page",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Add mutations for regenerating static files
  const regenerateSitemap = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/seo/regenerate-sitemap", {
        method: "POST",
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to regenerate sitemap");
      return res.text();
    },
    onSuccess: () => {
      toast({ title: "Sitemap regenerated successfully!" });
    },
    onError: (error: any) => {
      toast({
        title: "Error regenerating sitemap",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const regenerateRobots = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/seo/regenerate-robots", {
        method: "POST",
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to regenerate robots.txt");
      return res.text();
    },
    onSuccess: () => {
      toast({ title: "Robots.txt regenerated successfully!" });
    },
    onError: (error: any) => {
      toast({
        title: "Error regenerating robots.txt",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const regenerateLlms = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/seo/regenerate-llms", {
        method: "POST",
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to regenerate llms.txt");
      return res.text();
    },
    onSuccess: () => {
      toast({ title: "LLMs.txt regenerated successfully!" });
    },
    onError: (error: any) => {
      toast({
        title: "Error regenerating llms.txt",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const [newPath, setNewPath] = useState("/product-catalog");
  const [newTitle, setNewTitle] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [newSchemaType, setNewSchemaType] = useState("Service");
  const [newSchemaData, setNewSchemaData] = useState(
    '{\n  "name": "Master Product Catalog"\n}'
  );

  const presetOptions = [
    {
      label: "Organization",
      type: "Organization",
      data: {
        name: "Printyx",
        url: "https://printyx.net",
      },
    },
    {
      label: "SoftwareApplication",
      type: "SoftwareApplication",
      data: {
        name: "Printyx Platform",
        applicationCategory: "BusinessApplication",
      },
    },
    {
      label: "Product",
      type: "Product",
      data: {
        name: "Canon imageRUNNER",
        brand: {
          "@type": "Brand",
          name: "Canon",
        },
      },
    },
    {
      label: "FAQPage",
      type: "FAQPage",
      data: {
        mainEntity: [
          {
            "@type": "Question",
            name: "What is Printyx?",
            acceptedAnswer: {
              "@type": "Answer",
              text: "Printyx is an all-in-one platform for print dealers.",
            },
          },
        ],
      },
    },
  ];

  const pagesSorted = useMemo(
    () =>
      Array.isArray(pages)
        ? [...pages].sort((a: any, b: any) =>
            (a.path || "").localeCompare(b.path || "")
          )
        : [],
    [pages]
  );

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
                {upsertSettings.isPending ? "Saving..." : "Save Settings"}
              </Button>
              
              <div className="flex gap-2 ml-4">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => regenerateSitemap.mutate()}
                  disabled={regenerateSitemap.isPending}
                  className="flex items-center gap-1"
                >
                  <FileText className="h-4 w-4" />
                  {regenerateSitemap.isPending ? "Generating..." : "Generate Sitemap"}
                </Button>
                
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => regenerateRobots.mutate()}
                  disabled={regenerateRobots.isPending}
                  className="flex items-center gap-1"
                >
                  <Bot className="h-4 w-4" />
                  {regenerateRobots.isPending ? "Generating..." : "Generate Robots.txt"}
                </Button>
                
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => regenerateLlms.mutate()}
                  disabled={regenerateLlms.isPending}
                  className="flex items-center gap-1"
                >
                  <Brain className="h-4 w-4" />
                  {regenerateLlms.isPending ? "Generating..." : "Generate LLMs.txt"}
                </Button>
              </div>
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

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              SEO Pages
            </CardTitle>
            <CardDescription>
              Manage individual page SEO settings, meta tags, and structured data
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Path</Label>
              <Input
                value={newPath}
                onChange={(e) => setNewPath(e.target.value)}
                placeholder="/product-catalog"
              />
            </div>
            <div>
              <Label>Schema Type</Label>
              <Input
                value={newSchemaType}
                onChange={(e) => setNewSchemaType(e.target.value)}
                placeholder="Service | Product | SoftwareApplication | Article | FAQPage | Organization"
              />
            </div>
            <div className="col-span-2">
              <Label>Title</Label>
              <Input
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
              />
            </div>
            <div className="col-span-2">
              <Label>Description</Label>
              <Textarea
                rows={3}
                value={newDescription}
                onChange={(e) => setNewDescription(e.target.value)}
              />
            </div>
            <div className="col-span-2">
              <Label>Schema Data (JSON)</Label>
              <Textarea
                rows={6}
                value={newSchemaData}
                onChange={(e) => setNewSchemaData(e.target.value)}
              />
            </div>
            <div className="col-span-2 flex items-end gap-2">
              <div className="flex-1">
                <Label>Presets</Label>
                <select
                  className="w-full border rounded h-9 px-2"
                  onChange={(e) => {
                    const preset = presetOptions.find(
                      (p) => p.type === e.target.value
                    );
                    if (preset) {
                      setNewSchemaType(preset.type);
                      setNewSchemaData(JSON.stringify(preset.data, null, 2));
                    }
                  }}
                  defaultValue=""
                >
                  <option value="" disabled>
                    Select a schema preset
                  </option>
                  {presetOptions.map((p) => (
                    <option key={p.type} value={p.type}>
                      {p.label}
                    </option>
                  ))}
                </select>
              </div>
              <Button
                variant="outline"
                onClick={() => {
                  setNewSchemaType("");
                  setNewSchemaData("");
                }}
              >
                Clear
              </Button>
            </div>
          </div>
          <Button
            onClick={() => {
              let parsed: any = null;
              try {
                parsed = newSchemaData ? JSON.parse(newSchemaData) : null;
              } catch (e) {
                alert("Schema JSON is invalid");
                return;
              }
              upsertPage.mutate({
                path: newPath,
                title: newTitle || null,
                description: newDescription || null,
                schemaType: newSchemaType || null,
                schemaData: parsed,
                includeInSitemap: true,
              });
            }}
            disabled={upsertPage.isPending}
          >
            {upsertPage.isPending ? "Saving..." : "Add / Update Page"}
          </Button>

          <div className="mt-6">
            <div className="text-sm text-gray-600 mb-2">Existing Pages</div>
            <div className="rounded border divide-y">
              {pagesSorted.map((p: any) => (
                <div
                  key={p.id}
                  className="p-3 text-sm flex items-center justify-between"
                >
                  <div className="flex-1">
                    <div className="font-medium">{p.path}</div>
                    <div className="text-gray-500 line-clamp-1">
                      {p.title || "(no title)"}
                    </div>
                  </div>
                  <div className="flex gap-3 text-xs">
                    <a
                      className="text-blue-600 underline"
                      href={`/schema.json?path=${encodeURIComponent(p.path)}`}
                      target="_blank"
                      rel="noreferrer"
                    >
                      schema.json
                    </a>
                    <a
                      className="text-blue-600 underline"
                      href={`/meta.json?path=${encodeURIComponent(p.path)}`}
                      target="_blank"
                      rel="noreferrer"
                    >
                      meta.json
                    </a>
                  </div>
                </div>
              ))}
              {!pagesSorted.length && (
                <div className="p-3 text-sm text-gray-500">No pages yet</div>
              )}
            </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  );
}
