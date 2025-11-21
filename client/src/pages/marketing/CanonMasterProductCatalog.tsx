import { useEffect } from "react";
import { useLocation } from "wouter";
import { useSeo } from "@/lib/useSeo";

export default function CanonMasterProductCatalog() {
  const [pathname] = useLocation();
  useSeo(pathname);
  useEffect(() => {}, []);
  return (
    <div className="max-w-3xl mx-auto p-6 space-y-4">
      <h1 className="text-3xl font-semibold">Canon Master Product Catalog</h1>
      <p className="text-gray-700">
        Overview of Canon imageRUNNER/imagePRESS models and accessories with
        enablement and pricing strategies for dealers.
      </p>
    </div>
  );
}
