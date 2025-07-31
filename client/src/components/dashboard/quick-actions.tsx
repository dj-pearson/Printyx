import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Plus, UserPlus, FileText, Package } from "lucide-react";

export default function QuickActions() {
  const actions = [
    {
      label: "Create Service Ticket",
      icon: Plus,
      onClick: () => console.log("Create service ticket"),
      variant: "default" as const,
    },
    {
      label: "Add New Customer",
      icon: UserPlus,
      onClick: () => console.log("Add new customer"),
      variant: "outline" as const,
    },
    {
      label: "Generate Invoice",
      icon: FileText,
      onClick: () => console.log("Generate invoice"),
      variant: "outline" as const,
    },
    {
      label: "Update Inventory",
      icon: Package,
      onClick: () => console.log("Update inventory"),
      variant: "outline" as const,
    },
  ];

  return (
    <Card>
      <CardHeader className="pb-4">
        <CardTitle className="text-lg font-semibold text-gray-900">Quick Actions</CardTitle>
      </CardHeader>
      
      <CardContent className="space-y-3">
        {actions.map((action, index) => {
          const Icon = action.icon;
          return (
            <Button
              key={index}
              variant={action.variant}
              className="w-full justify-start"
              onClick={action.onClick}
            >
              <Icon className="h-4 w-4 mr-3" />
              {action.label}
            </Button>
          );
        })}
      </CardContent>
    </Card>
  );
}
