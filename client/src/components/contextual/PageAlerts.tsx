import React from "react";
import { useQuery } from "@tanstack/react-query";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, CheckCircle, Info } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";

type AlertItem = {
  id: string;
  type: "info" | "warning" | "error" | "success" | string;
  category: string; // system, security, performance, business
  message: string;
  severity?: "low" | "medium" | "high" | "critical" | string;
  createdAt?: string;
  page?: string;
};

function iconFor(type: string) {
  switch (type) {
    case "error":
      return <AlertTriangle className="h-4 w-4 text-red-600" />;
    case "warning":
      return <AlertTriangle className="h-4 w-4 text-amber-600" />;
    case "success":
      return <CheckCircle className="h-4 w-4 text-green-600" />;
    default:
      return <Info className="h-4 w-4 text-blue-600" />;
  }
}

interface PageAlertsProps {
  categories?: string[];
  severities?: string[];
  pageKey?: string;
  limit?: number;
  className?: string;
}

export default function PageAlerts({
  categories,
  severities,
  pageKey,
  limit = 3,
  className = "",
}: PageAlertsProps) {
  const { data: alerts = [], isLoading, isError } = useQuery<AlertItem[]>({
    queryKey: ["/api/performance/alerts"],
    queryFn: () => apiRequest("/api/performance/alerts"),
    refetchInterval: 60_000,
  });

  if (isLoading || isError) return null;

  const filtered = alerts
    .filter((a) => (categories?.length ? categories.includes(a.category) : true))
    .filter((a) => (severities?.length ? (a.severity ? severities.includes(a.severity) : false) : true))
    .filter((a) => (pageKey ? a.page === pageKey : true))
    .slice(0, limit);

  if (filtered.length === 0) return null;

  return (
    <div className={className}>
      <div className="space-y-2">
        {filtered.map((a) => (
          <Alert key={a.id} className="bg-amber-50 border-amber-200">
            <div className="flex items-start gap-3">
              {iconFor(a.type)}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-sm font-medium capitalize">{a.category}</span>
                  {a.severity && (
                    <Badge variant="outline" className="text-xs capitalize">
                      {a.severity}
                    </Badge>
                  )}
                </div>
                <AlertDescription className="text-amber-900 whitespace-pre-line">
                  {a.message}
                </AlertDescription>
              </div>
            </div>
          </Alert>
        ))}
      </div>
    </div>
  );
}


