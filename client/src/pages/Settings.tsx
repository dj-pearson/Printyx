import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import MainLayout from "@/components/layout/main-layout";
import { apiRequest } from "@/lib/queryClient";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  User,
  Lock,
  Palette,
  Globe,
  Bell,
  Eye,
  Shield,
  Download,
  Trash2,
  Camera,
  Loader2,
  AlertTriangle,
} from "lucide-react";

interface UserSettings {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  jobTitle?: string;
  department?: string;
  bio?: string;
  avatar?: string;
  theme: string;
  language: string;
  timezone: string;
  dateFormat: string;
  timeFormat: string;
  currency: string;
  notifications: {
    email: boolean;
    push: boolean;
    sms: boolean;
    marketing: boolean;
  };
  accessibility: {
    highContrast: boolean;
    reducedMotion: boolean;
    fontSize: string;
    screenReader: boolean;
    keyboardNavigation: boolean;
    colorBlind: string;
    soundEnabled: boolean;
    voiceCommands: boolean;
  };
  twoFactorEnabled: boolean;
}

export default function Settings() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState("profile");
  const [deleteConfirmation, setDeleteConfirmation] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);

  // Fetch user settings
  const { data: userSettings, isLoading: settingsLoading } = useQuery<UserSettings>({
    queryKey: ['/api/user/settings'],
    enabled: !!user,
  });

  // Profile form state
  const [profileForm, setProfileForm] = useState({
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    jobTitle: "",
    department: "",
    bio: "",
  });

  // Password form state
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });

  // Preferences form state
  const [preferencesForm, setPreferencesForm] = useState({
    theme: "system",
    language: "en",
    timezone: "America/New_York",
    dateFormat: "MM/dd/yyyy",
    timeFormat: "12",
    currency: "USD",
  });

  // Notifications state
  const [notifications, setNotifications] = useState({
    email: true,
    push: true,
    sms: false,
    marketing: false,
  });

  // Accessibility state
  const [accessibility, setAccessibility] = useState({
    highContrast: false,
    reducedMotion: false,
    fontSize: "medium",
    screenReader: false,
    keyboardNavigation: false,
    colorBlind: "none",
    soundEnabled: true,
    voiceCommands: false,
  });

  // Update forms when settings load
  useEffect(() => {
    if (userSettings) {
      setProfileForm({
        firstName: userSettings.firstName || "",
        lastName: userSettings.lastName || "",
        email: userSettings.email || "",
        phone: userSettings.phone || "",
        jobTitle: userSettings.jobTitle || "",
        department: userSettings.department || "",
        bio: userSettings.bio || "",
      });

      setPreferencesForm({
        theme: userSettings.theme || "system",
        language: userSettings.language || "en",
        timezone: userSettings.timezone || "America/New_York",
        dateFormat: userSettings.dateFormat || "MM/dd/yyyy",
        timeFormat: userSettings.timeFormat || "12",
        currency: userSettings.currency || "USD",
      });

      setNotifications(userSettings.notifications || {
        email: true,
        push: true,
        sms: false,
        marketing: false,
      });

      setAccessibility(userSettings.accessibility || {
        highContrast: false,
        reducedMotion: false,
        fontSize: "medium",
        screenReader: false,
        keyboardNavigation: false,
        colorBlind: "none",
        soundEnabled: true,
        voiceCommands: false,
      });
    }
  }, [userSettings]);

  // Mutations
  const profileMutation = useMutation({
    mutationFn: (data: any) => apiRequest('/api/user/profile', { method: 'PUT', body: data }),
    onSuccess: () => {
      toast({ title: "Profile updated successfully" });
      queryClient.invalidateQueries({ queryKey: ['/api/user/settings'] });
    },
    onError: () => {
      toast({ title: "Failed to update profile", variant: "destructive" });
    },
  });

  const passwordMutation = useMutation({
    mutationFn: (data: any) => apiRequest('/api/user/password', { method: 'PUT', body: data }),
    onSuccess: () => {
      toast({ title: "Password updated successfully" });
      setPasswordForm({ currentPassword: "", newPassword: "", confirmPassword: "" });
    },
    onError: (error: any) => {
      toast({ 
        title: "Failed to update password", 
        description: error.message || "Please check your current password",
        variant: "destructive" 
      });
    },
  });

  const preferencesMutation = useMutation({
    mutationFn: (data: any) => apiRequest('/api/user/preferences', { method: 'PUT', body: data }),
    onSuccess: () => {
      toast({ title: "Preferences updated successfully" });
      queryClient.invalidateQueries({ queryKey: ['/api/user/settings'] });
    },
    onError: () => {
      toast({ title: "Failed to update preferences", variant: "destructive" });
    },
  });

  const accessibilityMutation = useMutation({
    mutationFn: (data: any) => apiRequest('/api/user/accessibility', { method: 'PUT', body: data }),
    onSuccess: () => {
      toast({ title: "Accessibility settings updated successfully" });
      queryClient.invalidateQueries({ queryKey: ['/api/user/settings'] });
    },
    onError: () => {
      toast({ title: "Failed to update accessibility settings", variant: "destructive" });
    },
  });

  const exportMutation = useMutation({
    mutationFn: () => apiRequest('/api/user/export'),
    onSuccess: (data) => {
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'printyx-user-data.json';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast({ title: "Data exported successfully" });
    },
    onError: () => {
      toast({ title: "Failed to export data", variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: () => apiRequest('/api/user/delete', { method: 'DELETE' }),
    onSuccess: () => {
      toast({ title: "Account deleted successfully" });
      // Redirect to login or home page
      window.location.href = '/';
    },
    onError: () => {
      toast({ title: "Failed to delete account", variant: "destructive" });
    },
  });

  // Handle form submissions
  const handleProfileSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    profileMutation.mutate(profileForm);
  };

  const handlePasswordSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      toast({ title: "Passwords do not match", variant: "destructive" });
      return;
    }
    if (passwordForm.newPassword.length < 8) {
      toast({ title: "Password must be at least 8 characters", variant: "destructive" });
      return;
    }
    passwordMutation.mutate({
      currentPassword: passwordForm.currentPassword,
      newPassword: passwordForm.newPassword,
    });
  };

  const handlePreferencesSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    preferencesMutation.mutate({
      ...preferencesForm,
      notifications,
    });
  };

  const handleAccessibilitySubmit = (e: React.FormEvent) => {
    e.preventDefault();
    accessibilityMutation.mutate({
      accessibility,
    });
  };

  const handleDeleteAccount = () => {
    if (deleteConfirmation !== "DELETE") {
      toast({ title: "Please type DELETE to confirm", variant: "destructive" });
      return;
    }
    setIsDeleting(true);
    deleteMutation.mutate();
  };

  if (settingsLoading) {
    return (
      <MainLayout>
        <div className="flex items-center justify-center h-96">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
          <p className="text-muted-foreground">
            Manage your account settings and preferences.
          </p>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
          <TabsList className="grid w-full grid-cols-6">
            <TabsTrigger value="profile" className="flex items-center gap-2">
              <User className="h-4 w-4" />
              Profile
            </TabsTrigger>
            <TabsTrigger value="security" className="flex items-center gap-2">
              <Lock className="h-4 w-4" />
              Security
            </TabsTrigger>
            <TabsTrigger value="preferences" className="flex items-center gap-2">
              <Palette className="h-4 w-4" />
              Preferences
            </TabsTrigger>
            <TabsTrigger value="notifications" className="flex items-center gap-2">
              <Bell className="h-4 w-4" />
              Notifications
            </TabsTrigger>
            <TabsTrigger value="accessibility" className="flex items-center gap-2">
              <Eye className="h-4 w-4" />
              Accessibility
            </TabsTrigger>
            <TabsTrigger value="data" className="flex items-center gap-2">
              <Shield className="h-4 w-4" />
              Data & Privacy
            </TabsTrigger>
          </TabsList>

          {/* Profile Tab */}
          <TabsContent value="profile" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Profile Information</CardTitle>
                <CardDescription>
                  Update your personal information and profile details.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="flex items-center gap-4">
                  <Avatar className="h-20 w-20">
                    <AvatarImage src={userSettings?.avatar} />
                    <AvatarFallback className="text-lg">
                      {profileForm.firstName?.[0]}{profileForm.lastName?.[0]}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <Button variant="outline" size="sm">
                      <Camera className="h-4 w-4 mr-2" />
                      Change Avatar
                    </Button>
                    <p className="text-sm text-muted-foreground mt-1">
                      JPG, PNG or GIF. Max size 5MB.
                    </p>
                  </div>
                </div>

                <form onSubmit={handleProfileSubmit} className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="firstName">First name</Label>
                      <Input
                        id="firstName"
                        value={profileForm.firstName}
                        onChange={(e) => setProfileForm({ ...profileForm, firstName: e.target.value })}
                        required
                      />
                    </div>
                    <div>
                      <Label htmlFor="lastName">Last name</Label>
                      <Input
                        id="lastName"
                        value={profileForm.lastName}
                        onChange={(e) => setProfileForm({ ...profileForm, lastName: e.target.value })}
                        required
                      />
                    </div>
                  </div>

                  <div>
                    <Label htmlFor="email">Email</Label>
                    <Input
                      id="email"
                      type="email"
                      value={profileForm.email}
                      onChange={(e) => setProfileForm({ ...profileForm, email: e.target.value })}
                      required
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="phone">Phone</Label>
                      <Input
                        id="phone"
                        value={profileForm.phone}
                        onChange={(e) => setProfileForm({ ...profileForm, phone: e.target.value })}
                      />
                    </div>
                    <div>
                      <Label htmlFor="jobTitle">Job Title</Label>
                      <Input
                        id="jobTitle"
                        value={profileForm.jobTitle}
                        onChange={(e) => setProfileForm({ ...profileForm, jobTitle: e.target.value })}
                      />
                    </div>
                  </div>

                  <div>
                    <Label htmlFor="department">Department</Label>
                    <Select
                      value={profileForm.department}
                      onValueChange={(value) => setProfileForm({ ...profileForm, department: value })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select department" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="sales">Sales</SelectItem>
                        <SelectItem value="service">Service</SelectItem>
                        <SelectItem value="finance">Finance</SelectItem>
                        <SelectItem value="purchasing">Purchasing</SelectItem>
                        <SelectItem value="administration">Administration</SelectItem>
                        <SelectItem value="management">Management</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label htmlFor="bio">Bio</Label>
                    <Textarea
                      id="bio"
                      value={profileForm.bio}
                      onChange={(e) => setProfileForm({ ...profileForm, bio: e.target.value })}
                      placeholder="Tell us a little about yourself..."
                      className="min-h-[100px]"
                    />
                  </div>

                  <Button type="submit" disabled={profileMutation.isPending}>
                    {profileMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                    Save Profile
                  </Button>
                </form>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Security Tab */}
          <TabsContent value="security" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Change Password</CardTitle>
                <CardDescription>
                  Update your password to keep your account secure.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handlePasswordSubmit} className="space-y-4">
                  <div>
                    <Label htmlFor="currentPassword">Current password</Label>
                    <Input
                      id="currentPassword"
                      type="password"
                      value={passwordForm.currentPassword}
                      onChange={(e) => setPasswordForm({ ...passwordForm, currentPassword: e.target.value })}
                      required
                    />
                  </div>

                  <div>
                    <Label htmlFor="newPassword">New password</Label>
                    <Input
                      id="newPassword"
                      type="password"
                      value={passwordForm.newPassword}
                      onChange={(e) => setPasswordForm({ ...passwordForm, newPassword: e.target.value })}
                      required
                    />
                  </div>

                  <div>
                    <Label htmlFor="confirmPassword">Confirm new password</Label>
                    <Input
                      id="confirmPassword"
                      type="password"
                      value={passwordForm.confirmPassword}
                      onChange={(e) => setPasswordForm({ ...passwordForm, confirmPassword: e.target.value })}
                      required
                    />
                  </div>

                  <Button type="submit" disabled={passwordMutation.isPending}>
                    {passwordMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                    Update Password
                  </Button>
                </form>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Two-Factor Authentication</CardTitle>
                <CardDescription>
                  Add an extra layer of security to your account.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">Two-factor authentication</p>
                    <p className="text-sm text-muted-foreground">
                      {userSettings?.twoFactorEnabled ? 'Enabled' : 'Disabled'}
                    </p>
                  </div>
                  <Switch checked={userSettings?.twoFactorEnabled || false} />
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Preferences Tab */}
          <TabsContent value="preferences" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Appearance & Language</CardTitle>
                <CardDescription>
                  Customize how Printyx looks and feels.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handlePreferencesSubmit} className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="theme">Theme</Label>
                      <Select
                        value={preferencesForm.theme}
                        onValueChange={(value) => setPreferencesForm({ ...preferencesForm, theme: value })}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="light">Light</SelectItem>
                          <SelectItem value="dark">Dark</SelectItem>
                          <SelectItem value="system">System</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div>
                      <Label htmlFor="language">Language</Label>
                      <Select
                        value={preferencesForm.language}
                        onValueChange={(value) => setPreferencesForm({ ...preferencesForm, language: value })}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="en">English</SelectItem>
                          <SelectItem value="es">Spanish</SelectItem>
                          <SelectItem value="fr">French</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="timezone">Timezone</Label>
                      <Select
                        value={preferencesForm.timezone}
                        onValueChange={(value) => setPreferencesForm({ ...preferencesForm, timezone: value })}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="America/New_York">Eastern Time</SelectItem>
                          <SelectItem value="America/Chicago">Central Time</SelectItem>
                          <SelectItem value="America/Denver">Mountain Time</SelectItem>
                          <SelectItem value="America/Los_Angeles">Pacific Time</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div>
                      <Label htmlFor="currency">Currency</Label>
                      <Select
                        value={preferencesForm.currency}
                        onValueChange={(value) => setPreferencesForm({ ...preferencesForm, currency: value })}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="USD">USD ($)</SelectItem>
                          <SelectItem value="EUR">EUR (€)</SelectItem>
                          <SelectItem value="GBP">GBP (£)</SelectItem>
                          <SelectItem value="CAD">CAD (C$)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="dateFormat">Date Format</Label>
                      <Select
                        value={preferencesForm.dateFormat}
                        onValueChange={(value) => setPreferencesForm({ ...preferencesForm, dateFormat: value })}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="MM/dd/yyyy">MM/dd/yyyy</SelectItem>
                          <SelectItem value="dd/MM/yyyy">dd/MM/yyyy</SelectItem>
                          <SelectItem value="yyyy-MM-dd">yyyy-MM-dd</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div>
                      <Label htmlFor="timeFormat">Time Format</Label>
                      <Select
                        value={preferencesForm.timeFormat}
                        onValueChange={(value) => setPreferencesForm({ ...preferencesForm, timeFormat: value })}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="12">12-hour</SelectItem>
                          <SelectItem value="24">24-hour</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <Button type="submit" disabled={preferencesMutation.isPending}>
                    {preferencesMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                    Save Preferences
                  </Button>
                </form>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Notifications Tab */}
          <TabsContent value="notifications" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Notification Preferences</CardTitle>
                <CardDescription>
                  Choose which notifications you want to receive.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium">Email Notifications</p>
                      <p className="text-sm text-muted-foreground">
                        Receive notifications via email
                      </p>
                    </div>
                    <Switch
                      checked={notifications.email}
                      onCheckedChange={(checked) => setNotifications({ ...notifications, email: checked })}
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium">Push Notifications</p>
                      <p className="text-sm text-muted-foreground">
                        Receive push notifications in your browser
                      </p>
                    </div>
                    <Switch
                      checked={notifications.push}
                      onCheckedChange={(checked) => setNotifications({ ...notifications, push: checked })}
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium">SMS Notifications</p>
                      <p className="text-sm text-muted-foreground">
                        Receive notifications via text message
                      </p>
                    </div>
                    <Switch
                      checked={notifications.sms}
                      onCheckedChange={(checked) => setNotifications({ ...notifications, sms: checked })}
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium">Marketing Communications</p>
                      <p className="text-sm text-muted-foreground">
                        Receive updates about new features and promotions
                      </p>
                    </div>
                    <Switch
                      checked={notifications.marketing}
                      onCheckedChange={(checked) => setNotifications({ ...notifications, marketing: checked })}
                    />
                  </div>
                </div>

                <Button onClick={handlePreferencesSubmit} disabled={preferencesMutation.isPending}>
                  {preferencesMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  Save Notification Settings
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Accessibility Tab */}
          <TabsContent value="accessibility" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Accessibility Settings</CardTitle>
                <CardDescription>
                  Configure accessibility features to improve your experience.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium">High Contrast</p>
                      <p className="text-sm text-muted-foreground">
                        Increase contrast for better visibility
                      </p>
                    </div>
                    <Switch
                      checked={accessibility.highContrast}
                      onCheckedChange={(checked) => setAccessibility({ ...accessibility, highContrast: checked })}
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium">Reduced Motion</p>
                      <p className="text-sm text-muted-foreground">
                        Minimize animations and transitions
                      </p>
                    </div>
                    <Switch
                      checked={accessibility.reducedMotion}
                      onCheckedChange={(checked) => setAccessibility({ ...accessibility, reducedMotion: checked })}
                    />
                  </div>

                  <div>
                    <Label htmlFor="fontSize">Font Size</Label>
                    <Select
                      value={accessibility.fontSize}
                      onValueChange={(value) => setAccessibility({ ...accessibility, fontSize: value })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="small">Small</SelectItem>
                        <SelectItem value="medium">Medium</SelectItem>
                        <SelectItem value="large">Large</SelectItem>
                        <SelectItem value="extra-large">Extra Large</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label htmlFor="colorBlind">Color Blind Support</Label>
                    <Select
                      value={accessibility.colorBlind}
                      onValueChange={(value) => setAccessibility({ ...accessibility, colorBlind: value })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">None</SelectItem>
                        <SelectItem value="protanopia">Protanopia</SelectItem>
                        <SelectItem value="deuteranopia">Deuteranopia</SelectItem>
                        <SelectItem value="tritanopia">Tritanopia</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium">Screen Reader Support</p>
                      <p className="text-sm text-muted-foreground">
                        Optimize for screen readers
                      </p>
                    </div>
                    <Switch
                      checked={accessibility.screenReader}
                      onCheckedChange={(checked) => setAccessibility({ ...accessibility, screenReader: checked })}
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium">Keyboard Navigation</p>
                      <p className="text-sm text-muted-foreground">
                        Enhanced keyboard navigation support
                      </p>
                    </div>
                    <Switch
                      checked={accessibility.keyboardNavigation}
                      onCheckedChange={(checked) => setAccessibility({ ...accessibility, keyboardNavigation: checked })}
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium">Sound Enabled</p>
                      <p className="text-sm text-muted-foreground">
                        Play notification sounds
                      </p>
                    </div>
                    <Switch
                      checked={accessibility.soundEnabled}
                      onCheckedChange={(checked) => setAccessibility({ ...accessibility, soundEnabled: checked })}
                    />
                  </div>
                </div>

                <Button onClick={handleAccessibilitySubmit} disabled={accessibilityMutation.isPending}>
                  {accessibilityMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  Save Accessibility Settings
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Data & Privacy Tab */}
          <TabsContent value="data" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Data Export</CardTitle>
                <CardDescription>
                  Download a copy of your data stored in Printyx.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <p className="text-sm text-muted-foreground">
                    This will include your profile information, settings, and associated business data.
                  </p>
                  <Button variant="outline" onClick={() => exportMutation.mutate()} disabled={exportMutation.isPending}>
                    {exportMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                    <Download className="h-4 w-4 mr-2" />
                    Export My Data
                  </Button>
                </div>
              </CardContent>
            </Card>

            <Card className="border-red-200">
              <CardHeader>
                <CardTitle className="text-red-600">Delete Account</CardTitle>
                <CardDescription>
                  Permanently delete your account and all associated data.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Alert className="mb-4">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription>
                    This action cannot be undone. This will permanently delete your account and remove all your data from our servers.
                  </AlertDescription>
                </Alert>

                <Dialog>
                  <DialogTrigger asChild>
                    <Button variant="destructive">
                      <Trash2 className="h-4 w-4 mr-2" />
                      Delete Account
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Are you absolutely sure?</DialogTitle>
                      <DialogDescription>
                        This action cannot be undone. This will permanently delete your account and remove all your data from our servers.
                      </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4">
                      <div>
                        <Label htmlFor="deleteConfirmation">
                          Type "DELETE" to confirm:
                        </Label>
                        <Input
                          id="deleteConfirmation"
                          value={deleteConfirmation}
                          onChange={(e) => setDeleteConfirmation(e.target.value)}
                          placeholder="DELETE"
                        />
                      </div>
                    </div>
                    <DialogFooter>
                      <Button
                        variant="destructive"
                        onClick={handleDeleteAccount}
                        disabled={deleteConfirmation !== "DELETE" || isDeleting}
                      >
                        {isDeleting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                        Delete Account
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </MainLayout>
  );
}