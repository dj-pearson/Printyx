import { useEffect } from "react";

export function useSeo(pathname: string) {
  useEffect(() => {
    let cancelled = false;
    async function run() {
      try {
        const [metaRes, schemaRes] = await Promise.all([
          fetch(`/meta.json?path=${encodeURIComponent(pathname)}`),
          fetch(`/schema.json?path=${encodeURIComponent(pathname)}`),
        ]);
        const meta = await metaRes.json().catch(() => ({}));
        const schema = await schemaRes.json().catch(() => null);
        if (cancelled) return;

        const title = meta?.title || "Printyx";
        const description = meta?.description || "";
        document.title = title;

        function setMeta(name: string, content: string) {
          if (!content) return;
          let tag = document.querySelector(
            `meta[name="${name}"]`
          ) as HTMLMetaElement | null;
          if (!tag) {
            tag = document.createElement("meta");
            tag.setAttribute("name", name);
            document.head.appendChild(tag);
          }
          tag.setAttribute("content", content);
        }

        function setProperty(property: string, content: string) {
          if (!content) return;
          let tag = document.querySelector(
            `meta[property="${property}"]`
          ) as HTMLMetaElement | null;
          if (!tag) {
            tag = document.createElement("meta");
            tag.setAttribute("property", property);
            document.head.appendChild(tag);
          }
          tag.setAttribute("content", content);
        }

        setMeta("description", description);
        setProperty("og:title", title);
        setProperty("og:description", description);
        if ((meta as any)?.ogImage)
          setProperty("og:image", (meta as any).ogImage);
        if ((meta as any)?.twitterHandle)
          setMeta("twitter:site", (meta as any).twitterHandle);
        if ((meta as any)?.robots) setMeta("robots", (meta as any).robots);

        // JSON-LD
        const id = "printyx-jsonld";
        let script = document.getElementById(id);
        if (!script) {
          script = document.createElement("script");
          script.id = id;
          script.type = "application/ld+json";
          document.head.appendChild(script);
        }
        script.textContent = schema ? JSON.stringify(schema) : "";
      } catch {
        // ignore
      }
    }
    run();
    return () => {
      cancelled = true;
    };
  }, [pathname]);
}
