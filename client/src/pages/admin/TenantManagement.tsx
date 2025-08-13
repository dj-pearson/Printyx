import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Building2, Users, DollarSign, Activity, Plus, Edit, Trash2, Eye } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export default function TenantManagement() {
  const [activeTab, setActiveTab] = useState("overview");
  const [selectedTenant, setSelectedTenant] = useState(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: tenants } = useQuery({
    queryKey: ["/api/admin/tenants"],
  });

  const { data: tenantStats } = useQuery({
    queryKey: ["/api/admin/tenant-stats"],
  });

  const createTenantMutation = useMutation({
    mutationFn: async (tenantData: any) => {
      const response = await fetch("/api/admin/tenants", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(tenantData),
      });
      if (!response.ok) throw new Error("Failed to create tenant");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/tenants"] });
      toast({ title: "Tenant created successfully" });
    },
  });

  const mockTenants = tenants || [
    {
      id: "tenant-1",
      name: "Acme Corporation",
      domain: "acme.printyx.com",
      status: "active",
      plan: "enterprise",
      users: 45,
      revenue: 12500,
      lastActivity: "2024-01-15",
      createdAt: "2023-06-15",
    },
    {
      id: "tenant-2", 
      name: "TechStart Solutions",
      domain: "techstart.printyx.com",
      status: "trial",
      plan: "professional",
      users: 12,
      revenue: 2400,
      lastActivity: "2024-01-14",
      createdAt: "2024-01-01",
    },
    {
      id: "tenant-3",
      name: "Global Industries",
      domain: "global.printyx.com", 
      status: "active",
      plan: "enterprise",
      users: 156,
      revenue: 45000,
      lastActivity: "2024-01-15",
      createdAt: "2022-03-20",
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Tenant Management</h1>
          <p className="text-gray-600 mt-2">
            Manage all tenant organizations and their configurations
          </p>
        </div>
        <Dialog>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Create Tenant
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Create New Tenant</DialogTitle>
              <DialogDescription>
                Set up a new tenant organization with initial configuration
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label htmlFor="tenantName">Company Name</Label>
                <Input id="tenantName" placeholder="Enter company name" />
              </div>
              <div>
                <Label htmlFor="tenantDomain">Subdomain</Label>
                <Input id="tenantDomain" placeholder="company.printyx.com" />
              </div>
              <div>
                <Label htmlFor="tenantPlan">Plan</Label>
                <Select>
                  <SelectTrigger>
                    <SelectValue placeholder="Select plan" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="starter">Starter</SelectItem>
                    <SelectItem value="professional">Professional</SelectItem>
                    <SelectItem value="enterprise">Enterprise</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="adminEmail">Admin Email</Label>
                <Input id="adminEmail" type="email" placeholder="admin@company.com" />
              </div>
              <Button className="w-full">Create Tenant</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Tenant Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Tenants</CardTitle>
            <Building2 className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">156</div>
            <p className="text-xs text-green-600 mt-2">+12% from last month</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Users</CardTitle>
            <Users className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">2,847</div>
            <p className="text-xs text-green-600 mt-2">+8% from last month</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
            <DollarSign className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">$284,750</div>
            <p className="text-xs text-green-600 mt-2">+15% from last month</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Trial Conversions</CardTitle>
            <Activity className="h-4 w-4 text-orange-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">73%</div>
            <p className="text-xs text-green-600 mt-2">+5% from last month</p>
          </CardContent>
        </Card>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="tenants">All Tenants</TabsTrigger>
          <TabsTrigger value="billing">Billing</TabsTrigger>
          <TabsTrigger value="settings">Settings</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Recent Tenant Activity</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {mockTenants.slice(0, 5).map((tenant) => (
                    <div key={tenant.id} className="flex items-center justify-between py-2 border-b">
                      <div>
                        <p className="font-medium">{tenant.name}</p>
                        <p className="text-sm text-gray-500">{tenant.domain}</p>
                      </div>
                      <Badge 
                        variant={tenant.status === 'active' ? 'default' : 'secondary'}
                      >
                        {tenant.status}
                      </Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Tenant Distribution</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <span>Enterprise Plan</span>
                    <div className="flex items-center gap-2">
                      <div className="w-20 bg-gray-200 rounded-full h-2">
                        <div className="bg-blue-600 h-2 rounded-full" style={{ width: '65%' }}></div>
                      </div>
                      <span className="text-sm">65%</span>
                    </div>
                  </div>
                  <div className="flex justify-between items-center">
                    <span>Professional Plan</span>
                    <div className="flex items-center gap-2">
                      <div className="w-20 bg-gray-200 rounded-full h-2">
                        <div className="bg-green-600 h-2 rounded-full" style={{ width: '25%' }}></div>
                      </div>
                      <span className="text-sm">25%</span>
                    </div>
                  </div>
                  <div className="flex justify-between items-center">
                    <span>Starter Plan</span>
                    <div className="flex items-center gap-2">
                      <div className="w-20 bg-gray-200 rounded-full h-2">
                        <div className="bg-orange-600 h-2 rounded-full" style={{ width: '10%' }}></div>
                      </div>
                      <span className="text-sm">10%</span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="tenants" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>All Tenants</CardTitle>
              <CardDescription>
                Complete list of tenant organizations with management actions
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex gap-4">
                  <Input placeholder="Search tenants..." className="max-w-sm" />
                  <Select>
                    <SelectTrigger className="w-32">
                      <SelectValue placeholder="Status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All</SelectItem>
                      <SelectItem value="active">Active</SelectItem>
                      <SelectItem value="trial">Trial</SelectItem>
                      <SelectItem value="suspended">Suspended</SelectItem>
                    </SelectContent>
                  </Select>
                  <Select>
                    <SelectTrigger className="w-32">
                      <SelectValue placeholder="Plan" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Plans</SelectItem>
                      <SelectItem value="enterprise">Enterprise</SelectItem>
                      <SelectItem value="professional">Professional</SelectItem>
                      <SelectItem value="starter">Starter</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="border rounded-lg">
                  <div className="grid grid-cols-7 gap-4 p-4 border-b bg-gray-50 font-medium">
                    <div>Company</div>
                    <div>Domain</div>
                    <div>Status</div>
                    <div>Plan</div>
                    <div>Users</div>
                    <div>Revenue</div>
                    <div>Actions</div>
                  </div>
                  {mockTenants.map((tenant) => (
                    <div key={tenant.id} className="grid grid-cols-7 gap-4 p-4 border-b items-center">
                      <div>
                        <p className="font-medium">{tenant.name}</p>
                        <p className="text-sm text-gray-500">ID: {tenant.id}</p>
                      </div>
                      <div className="text-sm">{tenant.domain}</div>
                      <div>
                        <Badge variant={tenant.status === 'active' ? 'default' : 'secondary'}>
                          {tenant.status}
                        </Badge>
                      </div>
                      <div className="capitalize">{tenant.plan}</div>
                      <div>{tenant.users}</div>
                      <div>${tenant.revenue.toLocaleString()}</div>
                      <div className="flex gap-2">
                        <Button size="sm" variant="outline">
                          <Eye className="h-3 w-3" />
                        </Button>
                        <Button size="sm" variant="outline">
                          <Edit className="h-3 w-3" />
                        </Button>
                        <Button size="sm" variant="outline">
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="billing" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Billing Overview</CardTitle>
              <CardDescription>
                Revenue tracking and billing management across all tenants
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="text-center p-4 border rounded-lg">
                    <div className="text-2xl font-bold text-green-600">$284,750</div>
                    <p className="text-sm text-gray-600">Monthly Recurring Revenue</p>
                  </div>
                  <div className="text-center p-4 border rounded-lg">
                    <div className="text-2xl font-bold text-blue-600">$3,417,000</div>
                    <p className="text-sm text-gray-600">Annual Recurring Revenue</p>
                  </div>
                  <div className="text-center p-4 border rounded-lg">
                    <div className="text-2xl font-bold text-orange-600">$45,200</div>
                    <p className="text-sm text-gray-600">Outstanding Invoices</p>
                  </div>
                </div>

                <div className="space-y-3">
                  <Button className="w-full" variant="outline">
                    Generate Revenue Report
                  </Button>
                  <Button className="w-full" variant="outline">
                    Export Billing Data
                  </Button>
                  <Button className="w-full" variant="outline">
                    Manage Payment Methods
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="settings" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Platform Settings</CardTitle>
              <CardDescription>
                Global configuration settings that affect all tenants
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="defaultPlan">Default Plan for New Tenants</Label>
                    <Select>
                      <SelectTrigger>
                        <SelectValue placeholder="Select default plan" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="starter">Starter (30-day trial)</SelectItem>
                        <SelectItem value="professional">Professional (14-day trial)</SelectItem>
                        <SelectItem value="enterprise">Enterprise (Custom)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label htmlFor="maxUsers">Default Max Users per Tenant</Label>
                    <Input id="maxUsers" type="number" defaultValue="100" />
                  </div>

                  <div>
                    <Label htmlFor="trialDays">Trial Period (Days)</Label>
                    <Input id="trialDays" type="number" defaultValue="30" />
                  </div>

                  <div>
                    <Label htmlFor="welcomeMessage">Welcome Message for New Tenants</Label>
                    <Textarea 
                      id="welcomeMessage" 
                      placeholder="Enter welcome message..."
                      defaultValue="Welcome to Printyx! Your account has been successfully created."
                    />
                  </div>
                </div>

                <div className="space-y-3">
                  <Button className="w-full">Save Settings</Button>
                  <Button className="w-full" variant="outline">Reset to Defaults</Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}