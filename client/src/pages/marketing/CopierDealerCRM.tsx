import { useEffect } from "react";
import { useLocation } from "wouter";
import { useSeo } from "@/lib/useSeo";

export default function CopierDealerCRM() {
  const [pathname] = useLocation();
  useSeo(pathname);
  useEffect(() => {
    // no-op: content could be expanded later
  }, []);
  return (
    <div className="max-w-3xl mx-auto p-6 space-y-4">
      <h1 className="text-3xl font-semibold">Copier Dealer CRM</h1>
      <p className="text-gray-700">
        End-to-end CRM for copier dealers: leads, activities, quotes, proposals,
        and forecasting. Best practices and playbooks.
      </p>
    </div>
  );
}
