import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Bell, AlertTriangle, CheckCircle, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

type AlertItem = {
  id: string;
  type: string; // info, warning, error, success
  category: string; // system, security, performance, business
  message: string;
  severity?: string; // low, medium, high, critical
  createdAt?: string;
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

export default function SystemAlertBell() {
  const { data: alerts = [] } = useQuery<AlertItem[]>({
    queryKey: ["/api/performance/alerts"],
    queryFn: () => apiRequest("/api/performance/alerts"),
    refetchInterval: 60_000,
  });

  useEffect(() => {
    const critical = alerts.find((a) => a.severity === "critical" || a.type === "error");
    if (critical) {
      toast({
        title: "System Alert",
        description: critical.message,
        variant: "destructive",
      });
    }
  }, [alerts]);

  const unreadCount = alerts.length;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="relative hidden sm:flex" aria-label="Notifications">
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <Badge className="absolute -top-1 -right-1 h-5 w-5 rounded-full p-0 text-xs bg-red-500">
              {unreadCount > 9 ? "9+" : unreadCount}
            </Badge>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80">
        <DropdownMenuLabel>System Alerts</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {alerts.length === 0 ? (
          <div className="p-3 text-sm text-muted-foreground">No alerts in the last 24h</div>
        ) : (
          alerts.slice(0, 10).map((a) => (
            <DropdownMenuItem key={a.id} className="flex items-start gap-2">
              {iconFor(a.type)}
              <div className="flex-1">
                <div className="text-sm font-medium capitalize">{a.category}</div>
                <div className="text-sm whitespace-pre-line">{a.message}</div>
              </div>
            </DropdownMenuItem>
          ))
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}


