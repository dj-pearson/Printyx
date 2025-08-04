import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { 
  UserCheck, 
  Users, 
  Shield, 
  Key, 
  Lock, 
  Settings,
  Eye,
  EyeOff,
  Plus,
  Edit,
  Trash2,
  Search,
  Filter,
  Crown,
  Building2,
  MapPin,
  AlertCircle
} from "lucide-react";
import { format } from "date-fns";
import MainLayout from "@/components/layout/main-layout";

interface User {
  id: string;
  name: string;
  email: string;
  role: string;
  department: string;
  location: string;
  status: 'active' | 'inactive' | 'suspended';
  lastLogin: string;
  permissions: string[];
  createdAt: string;
}

interface Role {
  id: string;
  name: string;
  description: string;
  level: number;
  permissions: string[];
  userCount: number;
  isSystemRole: boolean;
  createdAt: string;
}

interface Permission {
  id: string;
  name: string;
  description: string;
  category: string;
  isSystemPermission: boolean;
}

export default function AccessControl() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedTab, setSelectedTab] = useState("users");
  const [searchTerm, setSearchTerm] = useState("");
  const [filterRole, setFilterRole] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");
  
  // Mock data for demonstration
  const users: User[] = [
    {
      id: "usr-001",
      name: "John Administrator",
      email: "john.admin@printyx.com",
      role: "Platform Admin",
      department: "IT",
      location: "Headquarters",
      status: "active",
      lastLogin: new Date(Date.now() - 1000 * 60 * 30).toISOString(),
      permissions: ["users.read", "users.write", "system.admin", "tenants.manage"],
      createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 365).toISOString()
    },
    {
      id: "usr-002",
      name: "Sarah Manager",
      email: "sarah.manager@dealer1.com",
      role: "Company Admin",
      department: "Management",
      location: "Branch Office A",
      status: "active",
      lastLogin: new Date(Date.now() - 1000 * 60 * 60 * 2).toISOString(),
      permissions: ["users.read", "users.write", "reports.read", "sales.manage"],
      createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 180).toISOString()
    },
    {
      id: "usr-003",
      name: "Mike Technician",
      email: "mike.tech@dealer1.com",
      role: "Service Technician",
      department: "Service",
      location: "Branch Office A",
      status: "active",
      lastLogin: new Date(Date.now() - 1000 * 60 * 60 * 6).toISOString(),
      permissions: ["service.read", "service.write", "inventory.read"],
      createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 90).toISOString()
    },
    {
      id: "usr-004",
      name: "Lisa Sales",
      email: "lisa.sales@dealer2.com",
      role: "Sales Representative",
      department: "Sales",
      location: "Branch Office B",
      status: "suspended",
      lastLogin: new Date(Date.now() - 1000 * 60 * 60 * 24 * 7).toISOString(),
      permissions: ["crm.read", "crm.write", "quotes.manage"],
      createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 45).toISOString()
    }
  ];

  const roles: Role[] = [
    {
      id: "role-001",
      name: "Platform Admin",
      description: "Full system access across all tenants",
      level: 8,
      permissions: ["*"],
      userCount: 3,
      isSystemRole: true,
      createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 365).toISOString()
    },
    {
      id: "role-002",
      name: "Company Admin",
      description: "Full access within company tenant",
      level: 7,
      permissions: ["users.read", "users.write", "reports.read", "sales.manage", "service.manage"],
      userCount: 8,
      isSystemRole: true,
      createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 365).toISOString()
    },
    {
      id: "role-003",
      name: "Sales Manager",
      description: "Manage sales team and CRM",
      level: 5,
      permissions: ["crm.read", "crm.write", "quotes.manage", "sales.reports", "team.manage"],
      userCount: 12,
      isSystemRole: false,
      createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 200).toISOString()
    },
    {
      id: "role-004",
      name: "Service Technician",
      description: "Handle service tickets and inventory",
      level: 3,
      permissions: ["service.read", "service.write", "inventory.read", "mobile.access"],
      userCount: 25,
      isSystemRole: false,
      createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 200).toISOString()
    }
  ];

  const permissions: Permission[] = [
    { id: "perm-001", name: "users.read", description: "View user accounts", category: "User Management", isSystemPermission: true },
    { id: "perm-002", name: "users.write", description: "Create and edit user accounts", category: "User Management", isSystemPermission: true },
    { id: "perm-003", name: "crm.read", description: "View CRM data", category: "CRM", isSystemPermission: false },
    { id: "perm-004", name: "crm.write", description: "Edit CRM data", category: "CRM", isSystemPermission: false },
    { id: "perm-005", name: "service.read", description: "View service tickets", category: "Service", isSystemPermission: false },
    { id: "perm-006", name: "service.write", description: "Create and edit service tickets", category: "Service", isSystemPermission: false },
    { id: "perm-007", name: "reports.read", description: "View reports and analytics", category: "Reporting", isSystemPermission: false },
    { id: "perm-008", name: "system.admin", description: "System administration access", category: "System", isSystemPermission: true },
    { id: "perm-009", name: "tenants.manage", description: "Manage tenant settings", category: "System", isSystemPermission: true }
  ];

  const filteredUsers = users.filter(user => {
    const matchesSearch = searchTerm === "" || 
      user.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.email.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesRole = filterRole === "all" || user.role === filterRole;
    const matchesStatus = filterStatus === "all" || user.status === filterStatus;
    
    return matchesSearch && matchesRole && matchesStatus;
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'bg-green-100 text-green-800';
      case 'inactive': return 'bg-gray-100 text-gray-800';
      case 'suspended': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getRoleIcon = (role: string) => {
    if (role.includes('Admin')) return <Crown className="w-4 h-4" />;
    if (role.includes('Manager')) return <Building2 className="w-4 h-4" />;
    return <Users className="w-4 h-4" />;
  };

  const getLevelColor = (level: number) => {
    if (level >= 7) return 'bg-purple-100 text-purple-800';
    if (level >= 5) return 'bg-blue-100 text-blue-800';
    if (level >= 3) return 'bg-green-100 text-green-800';
    return 'bg-gray-100 text-gray-800';
  };

  return (
    <MainLayout>
      <div className="container mx-auto p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Access Control</h1>
            <p className="text-gray-600 mt-2">Manage user permissions, roles, and access levels</p>
          </div>
          <div className="flex items-center space-x-2">
            <Badge variant="outline">
              <Users className="w-4 h-4 mr-1" />
              {users.length} Users
            </Badge>
            <Badge variant="outline">
              <Shield className="w-4 h-4 mr-1" />
              {roles.length} Roles
            </Badge>
          </div>
        </div>

        <Tabs value={selectedTab} onValueChange={setSelectedTab}>
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="users">User Management</TabsTrigger>
            <TabsTrigger value="roles">Role Management</TabsTrigger>
            <TabsTrigger value="permissions">Permissions</TabsTrigger>
            <TabsTrigger value="audit">Audit Log</TabsTrigger>
          </TabsList>

          {/* User Management */}
          <TabsContent value="users" className="space-y-6">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center space-x-2">
                    <Users className="w-5 h-5" />
                    <span>User Accounts</span>
                  </CardTitle>
                  <Button>
                    <Plus className="w-4 h-4 mr-2" />
                    Add User
                  </Button>
                </div>
                
                <div className="flex items-center space-x-4 mt-4">
                  <div className="flex-1">
                    <Input
                      placeholder="Search users..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="max-w-sm"
                    />
                  </div>
                  <Select value={filterRole} onValueChange={setFilterRole}>
                    <SelectTrigger className="w-40">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Roles</SelectItem>
                      {roles.map(role => (
                        <SelectItem key={role.id} value={role.name}>{role.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select value={filterStatus} onValueChange={setFilterStatus}>
                    <SelectTrigger className="w-32">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Status</SelectItem>
                      <SelectItem value="active">Active</SelectItem>
                      <SelectItem value="inactive">Inactive</SelectItem>
                      <SelectItem value="suspended">Suspended</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>User</TableHead>
                      <TableHead>Role</TableHead>
                      <TableHead>Department</TableHead>
                      <TableHead>Location</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Last Login</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredUsers.map((user) => (
                      <TableRow key={user.id}>
                        <TableCell>
                          <div>
                            <div className="font-medium flex items-center space-x-2">
                              {getRoleIcon(user.role)}
                              <span>{user.name}</span>
                            </div>
                            <div className="text-sm text-gray-500">{user.email}</div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">
                            {user.role}
                          </Badge>
                        </TableCell>
                        <TableCell>{user.department}</TableCell>
                        <TableCell>
                          <div className="flex items-center space-x-1">
                            <MapPin className="w-3 h-3 text-gray-400" />
                            <span>{user.location}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge className={getStatusColor(user.status)}>
                            {user.status}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {format(new Date(user.lastLogin), 'MMM dd, HH:mm')}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center space-x-2">
                            <Button size="sm" variant="outline">
                              <Edit className="w-4 h-4" />
                            </Button>
                            <Button size="sm" variant="outline">
                              <Eye className="w-4 h-4" />
                            </Button>
                            <Button size="sm" variant="outline">
                              <Lock className="w-4 h-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Role Management */}
          <TabsContent value="roles" className="space-y-6">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center space-x-2">
                    <Shield className="w-5 h-5" />
                    <span>Role Management</span>
                  </CardTitle>
                  <Button>
                    <Plus className="w-4 h-4 mr-2" />
                    Create Role
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {roles.map((role) => (
                    <Card key={role.id} className="border">
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between mb-3">
                          <div className="flex items-center space-x-2">
                            <h3 className="font-semibold">{role.name}</h3>
                            <Badge className={getLevelColor(role.level)}>
                              Level {role.level}
                            </Badge>
                            {role.isSystemRole && (
                              <Badge variant="outline" className="bg-yellow-50 text-yellow-700">
                                <Crown className="w-3 h-3 mr-1" />
                                System
                              </Badge>
                            )}
                          </div>
                        </div>
                        
                        <p className="text-sm text-gray-600 mb-3">{role.description}</p>
                        
                        <div className="flex items-center justify-between text-sm">
                          <div className="flex items-center space-x-4">
                            <span className="text-gray-500">
                              {role.userCount} users
                            </span>
                            <span className="text-gray-500">
                              {role.permissions.length === 1 && role.permissions[0] === "*" 
                                ? "All permissions" 
                                : `${role.permissions.length} permissions`
                              }
                            </span>
                          </div>
                          <div className="flex items-center space-x-2">
                            <Button size="sm" variant="outline">
                              <Edit className="w-4 h-4" />
                            </Button>
                            {!role.isSystemRole && (
                              <Button size="sm" variant="outline">
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            )}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Permissions */}
          <TabsContent value="permissions" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Key className="w-5 h-5" />
                  <span>Permission Matrix</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-6">
                  {Object.entries(
                    permissions.reduce((acc, perm) => {
                      if (!acc[perm.category]) acc[perm.category] = [];
                      acc[perm.category].push(perm);
                      return acc;
                    }, {} as Record<string, Permission[]>)
                  ).map(([category, perms]) => (
                    <div key={category}>
                      <h3 className="font-semibold text-lg mb-3 flex items-center space-x-2">
                        <span>{category}</span>
                        <Badge variant="outline">{perms.length} permissions</Badge>
                      </h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {perms.map((permission) => (
                          <Card key={permission.id} className="border">
                            <CardContent className="p-3">
                              <div className="flex items-center justify-between">
                                <div className="flex-1">
                                  <div className="flex items-center space-x-2 mb-1">
                                    <code className="text-sm bg-gray-100 px-2 py-1 rounded">
                                      {permission.name}
                                    </code>
                                    {permission.isSystemPermission && (
                                      <Badge variant="outline" className="bg-red-50 text-red-700">
                                        <AlertCircle className="w-3 h-3 mr-1" />
                                        System
                                      </Badge>
                                    )}
                                  </div>
                                  <p className="text-sm text-gray-600">{permission.description}</p>
                                </div>
                              </div>
                            </CardContent>
                          </Card>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Audit Log */}
          <TabsContent value="audit" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Eye className="w-5 h-5" />
                  <span>Access Control Audit Log</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {[
                    {
                      id: 1,
                      timestamp: new Date(Date.now() - 1000 * 60 * 30).toISOString(),
                      action: "User Created",
                      details: "Created new user account for mike.tech@dealer1.com",
                      performer: "john.admin@printyx.com",
                      type: "user_management"
                    },
                    {
                      id: 2,
                      timestamp: new Date(Date.now() - 1000 * 60 * 60 * 2).toISOString(),
                      action: "Role Updated",
                      details: "Modified permissions for Sales Manager role",
                      performer: "sarah.manager@dealer1.com",
                      type: "role_management"
                    },
                    {
                      id: 3,
                      timestamp: new Date(Date.now() - 1000 * 60 * 60 * 4).toISOString(),
                      action: "User Suspended",
                      details: "Suspended user account lisa.sales@dealer2.com",
                      performer: "john.admin@printyx.com",
                      type: "user_management"
                    }
                  ].map((log) => (
                    <Card key={log.id} className="border-l-4 border-l-blue-500">
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center space-x-2 mb-1">
                              <h4 className="font-medium">{log.action}</h4>
                              <Badge variant="outline">
                                {log.type.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}
                              </Badge>
                            </div>
                            <p className="text-sm text-gray-600 mb-2">{log.details}</p>
                            <div className="text-xs text-gray-500">
                              Performed by {log.performer} • {format(new Date(log.timestamp), 'MMM dd, yyyy HH:mm:ss')}
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </MainLayout>
  );
}