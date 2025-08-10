import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
import NProgress from "nprogress";
import "nprogress/nprogress.css";
import { queryClient } from "@/lib/queryClient";

// Lightweight global fetch wrapper to attach CSRF for mutating requests
// This complements apiRequest; it protects plain fetch usages across the app
(() => {
  if (typeof window === "undefined" || (window as any).__fetchCsrfWrapped)
    return;
  (window as any).__fetchCsrfWrapped = true;

  let csrfTokenCache: string | undefined;
  async function getCsrfToken(): Promise<string | undefined> {
    if (csrfTokenCache) return csrfTokenCache;
    try {
      const res = await window.fetch("/api/csrf-token", {
        credentials: "include",
      });
      if (!res.ok) return undefined;
      const data = await res.json();
      csrfTokenCache =
        (data as any)?.csrfToken || (data as any)?.token || (data as any)?.csrf;
      return csrfTokenCache;
    } catch {
      return undefined;
    }
  }

  const origFetch = window.fetch.bind(window);
  window.fetch = async (
    input: RequestInfo | URL,
    init?: RequestInit
  ): Promise<Response> => {
    const method = (init?.method || "GET").toUpperCase();
    const isMutating = ["POST", "PUT", "PATCH", "DELETE"].includes(method);
    const headers = new Headers(init?.headers || {});

    if (isMutating && !headers.has("x-csrf-token")) {
      const token = await getCsrfToken();
      if (token) headers.set("x-csrf-token", token);
    }

    const finalInit: RequestInit = {
      ...init,
      headers,
      credentials: init?.credentials || "include",
    };

    return origFetch(input, finalInit);
  };
})();

// Global progress bar for queries/mutations
NProgress.configure({ showSpinner: false, trickleSpeed: 120 });
let isLoading = false;
queryClient.getQueryCache().subscribe(() => {
  const fetching = queryClient.isFetching() > 0 || queryClient.isMutating() > 0;
  if (fetching && !isLoading) {
    isLoading = true;
    NProgress.start();
  } else if (!fetching && isLoading) {
    isLoading = false;
    NProgress.done();
  }
});

createRoot(document.getElementById("root")!).render(<App />);
