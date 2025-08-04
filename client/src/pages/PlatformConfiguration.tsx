import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { 
  Settings, 
  Crown, 
  Globe, 
  Database, 
  Mail, 
  Lock, 
  Bell, 
  Palette,
  Shield,
  Server,
  Key,
  Clock,
  AlertTriangle,
  CheckCircle,
  Save,
  RefreshCw,
  Edit,
  Trash2,
  Plus,
  Eye,
  EyeOff
} from "lucide-react";
import MainLayout from "@/components/layout/main-layout";

interface ConfigSection {
  name: string;
  description: string;
  settings: ConfigSetting[];
}

interface ConfigSetting {
  key: string;
  name: string;
  value: string | number | boolean;
  type: 'text' | 'number' | 'boolean' | 'select' | 'password' | 'textarea';
  options?: string[];
  description: string;
  required: boolean;
  sensitive?: boolean;
}

interface SystemLog {
  id: string;
  timestamp: string;
  level: 'info' | 'warning' | 'error' | 'critical';
  category: string;
  message: string;
  user?: string;
}

export default function PlatformConfiguration() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedTab, setSelectedTab] = useState("general");
  const [showSensitive, setShowSensitive] = useState(false);
  
  // Mock configuration data
  const configSections: ConfigSection[] = [
    {
      name: "General Settings",
      description: "Core platform configuration",
      settings: [
        { key: "platform_name", name: "Platform Name", value: "Printyx", type: "text", description: "Display name for the platform", required: true },
        { key: "platform_url", name: "Platform URL", value: "https://app.printyx.net", type: "text", description: "Base URL for the platform", required: true },
        { key: "maintenance_mode", name: "Maintenance Mode", value: false, type: "boolean", description: "Enable maintenance mode", required: false },
        { key: "max_tenants", name: "Maximum Tenants", value: 100, type: "number", description: "Maximum number of tenants allowed", required: true },
        { key: "session_timeout", name: "Session Timeout (minutes)", value: 30, type: "number", description: "User session timeout duration", required: true }
      ]
    },
    {
      name: "Database Configuration",
      description: "Database connection and performance settings",
      settings: [
        { key: "db_host", name: "Database Host", value: "db.printyx.net", type: "text", description: "Database server hostname", required: true },
        { key: "db_port", name: "Database Port", value: 5432, type: "number", description: "Database server port", required: true },
        { key: "db_max_connections", name: "Max Connections", value: 50, type: "number", description: "Maximum database connections", required: true },
        { key: "db_backup_frequency", name: "Backup Frequency", value: "daily", type: "select", options: ["hourly", "daily", "weekly"], description: "Automated backup schedule", required: true },
        { key: "db_password", name: "Database Password", value: "••••••••••", type: "password", description: "Database connection password", required: true, sensitive: true }
      ]
    },
    {
      name: "Email Configuration",
      description: "SMTP and email delivery settings",
      settings: [
        { key: "smtp_host", name: "SMTP Host", value: "smtp.sendgrid.net", type: "text", description: "SMTP server hostname", required: true },
        { key: "smtp_port", name: "SMTP Port", value: 587, type: "number", description: "SMTP server port", required: true },
        { key: "smtp_username", name: "SMTP Username", value: "apikey", type: "text", description: "SMTP authentication username", required: true },
        { key: "smtp_password", name: "SMTP Password", value: "••••••••••", type: "password", description: "SMTP authentication password", required: true, sensitive: true },
        { key: "from_email", name: "From Email", value: "noreply@printyx.net", type: "text", description: "Default sender email address", required: true },
        { key: "email_enabled", name: "Email Enabled", value: true, type: "boolean", description: "Enable email delivery", required: false }
      ]
    },
    {
      name: "Security Settings",
      description: "Authentication and security configuration",
      settings: [
        { key: "enforce_2fa", name: "Enforce 2FA", value: false, type: "boolean", description: "Require two-factor authentication", required: false },
        { key: "password_min_length", name: "Minimum Password Length", value: 12, type: "number", description: "Minimum password length requirement", required: true },
        { key: "max_login_attempts", name: "Max Login Attempts", value: 5, type: "number", description: "Maximum failed login attempts before lockout", required: true },
        { key: "lockout_duration", name: "Lockout Duration (minutes)", value: 15, type: "number", description: "Account lockout duration", required: true },
        { key: "jwt_secret", name: "JWT Secret", value: "••••••••••", type: "password", description: "JWT signing secret", required: true, sensitive: true },
        { key: "encryption_key", name: "Encryption Key", value: "••••••••••", type: "password", description: "Data encryption key", required: true, sensitive: true }
      ]
    }
  ];

  const systemLogs: SystemLog[] = [
    {
      id: "log-001",
      timestamp: new Date(Date.now() - 1000 * 60 * 5).toISOString(),
      level: "info",
      category: "Configuration",
      message: "Platform configuration updated successfully",
      user: "root@printyx.com"
    },
    {
      id: "log-002",
      timestamp: new Date(Date.now() - 1000 * 60 * 30).toISOString(),
      level: "warning",
      category: "Database",
      message: "Database connection pool approaching maximum capacity",
    },
    {
      id: "log-003",
      timestamp: new Date(Date.now() - 1000 * 60 * 60).toISOString(),
      level: "error",
      category: "Email",
      message: "SMTP authentication failed - invalid credentials",
    },
    {
      id: "log-004",
      timestamp: new Date(Date.now() - 1000 * 60 * 60 * 2).toISOString(),
      level: "critical",
      category: "Security",
      message: "Multiple failed admin login attempts detected",
    }
  ];

  const getLevelColor = (level: string) => {
    switch (level) {
      case 'info': return 'bg-blue-100 text-blue-800';
      case 'warning': return 'bg-yellow-100 text-yellow-800';
      case 'error': return 'bg-red-100 text-red-800';
      case 'critical': return 'bg-purple-100 text-purple-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getLevelIcon = (level: string) => {
    switch (level) {
      case 'info': return <CheckCircle className="w-4 h-4" />;
      case 'warning': return <AlertTriangle className="w-4 h-4" />;
      case 'error': return <AlertTriangle className="w-4 h-4" />;
      case 'critical': return <AlertTriangle className="w-4 h-4" />;
      default: return <CheckCircle className="w-4 h-4" />;
    }
  };

  const getSectionIcon = (sectionName: string) => {
    switch (sectionName.toLowerCase()) {
      case 'general settings': return <Settings className="w-5 h-5" />;
      case 'database configuration': return <Database className="w-5 h-5" />;
      case 'email configuration': return <Mail className="w-5 h-5" />;
      case 'security settings': return <Shield className="w-5 h-5" />;
      default: return <Settings className="w-5 h-5" />;
    }
  };

  const renderSettingInput = (setting: ConfigSetting) => {
    switch (setting.type) {
      case 'boolean':
        return (
          <div className="flex items-center space-x-2">
            <Switch checked={setting.value as boolean} />
            <span className="text-sm">{setting.value ? 'Enabled' : 'Disabled'}</span>
          </div>
        );
      case 'select':
        return (
          <Select value={setting.value as string}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {setting.options?.map(option => (
                <SelectItem key={option} value={option}>{option}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        );
      case 'password':
        return (
          <div className="flex items-center space-x-2">
            <Input 
              type={showSensitive ? "text" : "password"} 
              value={setting.value as string} 
              className="flex-1"
            />
            <Button size="sm" variant="outline" onClick={() => setShowSensitive(!showSensitive)}>
              {showSensitive ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </Button>
          </div>
        );
      case 'textarea':
        return (
          <Textarea value={setting.value as string} rows={3} />
        );
      case 'number':
        return (
          <Input type="number" value={setting.value as number} />
        );
      default:
        return (
          <Input type="text" value={setting.value as string} />
        );
    }
  };

  return (
    <MainLayout>
      <div className="container mx-auto p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Platform Configuration</h1>
            <p className="text-gray-600 mt-2">Manage system-wide settings and configuration</p>
          </div>
          <div className="flex items-center space-x-2">
            <Badge variant="outline" className="bg-purple-50 text-purple-700">
              <Crown className="w-4 h-4 mr-1" />
              Root Admin Access
            </Badge>
            <Button>
              <Save className="w-4 h-4 mr-2" />
              Save All Changes
            </Button>
          </div>
        </div>

        <Tabs value={selectedTab} onValueChange={setSelectedTab}>
          <TabsList className="grid w-full grid-cols-5">
            <TabsTrigger value="general">General</TabsTrigger>
            <TabsTrigger value="database">Database</TabsTrigger>
            <TabsTrigger value="email">Email</TabsTrigger>
            <TabsTrigger value="security">Security</TabsTrigger>
            <TabsTrigger value="logs">System Logs</TabsTrigger>
          </TabsList>

          {/* Configuration Sections */}
          {configSections.map((section, sectionIndex) => (
            <TabsContent 
              key={sectionIndex} 
              value={section.name.toLowerCase().replace(' ', '')} 
              className="space-y-6"
            >
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center space-x-2">
                    {getSectionIcon(section.name)}
                    <span>{section.name}</span>
                  </CardTitle>
                  <p className="text-gray-600">{section.description}</p>
                </CardHeader>
                <CardContent className="space-y-6">
                  {section.settings.map((setting, settingIndex) => (
                    <div key={settingIndex} className="space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-2">
                          <Label className="font-medium">{setting.name}</Label>
                          {setting.required && (
                            <Badge variant="outline" className="text-xs">Required</Badge>
                          )}
                          {setting.sensitive && (
                            <Badge variant="outline" className="text-xs bg-red-50 text-red-700">
                              <Lock className="w-3 h-3 mr-1" />
                              Sensitive
                            </Badge>
                          )}
                        </div>
                      </div>
                      <div className="grid grid-cols-3 gap-4 items-center">
                        <div className="col-span-2">
                          {renderSettingInput(setting)}
                        </div>
                        <div className="text-sm text-gray-500">
                          {setting.description}
                        </div>
                      </div>
                      {settingIndex < section.settings.length - 1 && <Separator />}
                    </div>
                  ))}
                  
                  <div className="flex justify-end space-x-2 pt-4">
                    <Button variant="outline">
                      <RefreshCw className="w-4 h-4 mr-2" />
                      Reset to Defaults
                    </Button>
                    <Button>
                      <Save className="w-4 h-4 mr-2" />
                      Save {section.name}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          ))}

          {/* System Logs */}
          <TabsContent value="logs" className="space-y-6">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center space-x-2">
                    <Server className="w-5 h-5" />
                    <span>System Configuration Logs</span>
                  </CardTitle>
                  <div className="flex items-center space-x-2">
                    <Button size="sm" variant="outline">
                      <RefreshCw className="w-4 h-4 mr-2" />
                      Refresh
                    </Button>
                    <Button size="sm" variant="outline">
                      Export Logs
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {systemLogs.map((log) => (
                    <Card key={log.id} className="border">
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between">
                          <div className="flex items-start space-x-3">
                            <div className="mt-1">
                              {getLevelIcon(log.level)}
                            </div>
                            <div className="flex-1">
                              <div className="flex items-center space-x-2 mb-1">
                                <Badge className={getLevelColor(log.level)}>
                                  {log.level.toUpperCase()}
                                </Badge>
                                <Badge variant="outline">
                                  {log.category}
                                </Badge>
                                <span className="text-sm text-gray-500">
                                  {new Date(log.timestamp).toLocaleString()}
                                </span>
                              </div>
                              <p className="text-sm mb-1">{log.message}</p>
                              {log.user && (
                                <p className="text-xs text-gray-500">User: {log.user}</p>
                              )}
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