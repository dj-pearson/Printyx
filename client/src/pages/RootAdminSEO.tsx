import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select } from "@/components/ui/select";
import { Label } from "@/components/ui/label";

export default function RootAdminSEO() {
  const qc = useQueryClient();
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
      });
      if (!res.ok) throw new Error("Failed to save settings");
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/seo/settings"] });
    },
  });

  const upsertPage = useMutation({
    mutationFn: async (payload: any) => {
      const res = await fetch("/api/seo/pages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error("Failed to save page");
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/seo/pages"] });
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
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-semibold">SEO Management</h1>

      <Card>
        <CardHeader>
          <CardTitle>Global SEO Settings</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Site Name</Label>
              <Input
                value={siteName}
                onChange={(e) => setSiteName(e.target.value)}
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
              />
            </div>
            <div className="col-span-2">
              <Label>Default Description</Label>
              <Textarea
                rows={3}
                value={defaultDescription}
                onChange={(e) => setDefaultDescription(e.target.value)}
              />
            </div>
            <div>
              <Label>Default OG Image URL</Label>
              <Input
                value={defaultOgImage}
                onChange={(e) => setDefaultOgImage(e.target.value)}
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
          <div className="flex gap-2">
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
            <a
              className="text-blue-600 underline text-sm"
              href="/sitemap.xml"
              target="_blank"
              rel="noreferrer"
            >
              View sitemap.xml
            </a>
            <a
              className="text-blue-600 underline text-sm"
              href="/robots.txt"
              target="_blank"
              rel="noreferrer"
            >
              View robots.txt
            </a>
            <a
              className="text-blue-600 underline text-sm"
              href="/llms.txt"
              target="_blank"
              rel="noreferrer"
            >
              View llms.txt
            </a>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>SEO Pages</CardTitle>
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
  );
}
