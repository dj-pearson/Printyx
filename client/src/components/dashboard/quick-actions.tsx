import { Plus, FileText, Wrench, Package } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";

export default function QuickActions() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Quick Actions</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        <Link to="/customers">
          <Button variant="outline" className="w-full justify-start">
            <Plus className="mr-2 h-4 w-4" />
            Add Customer
          </Button>
        </Link>
        <Link to="/service-dispatch">
          <Button variant="outline" className="w-full justify-start">
            <Wrench className="mr-2 h-4 w-4" />
            Create Service Ticket
          </Button>
        </Link>
        <Link to="/contracts">
          <Button variant="outline" className="w-full justify-start">
            <FileText className="mr-2 h-4 w-4" />
            New Contract
          </Button>
        </Link>
        <Link to="/inventory">
          <Button variant="outline" className="w-full justify-start">
            <Package className="mr-2 h-4 w-4" />
            Manage Inventory
          </Button>
        </Link>
      </CardContent>
    </Card>
  );
}