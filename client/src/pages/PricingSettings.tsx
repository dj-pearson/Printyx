import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Save, Info, DollarSign, Shield, Bell, Eye, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { usePricingSettings } from "@/hooks/usePricingVisibility";
import MainLayout from "@/components/layout/main-layout";

export default function PricingSettings() {
  const { data: settings, isLoading } = usePricingSettings();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [formData, setFormData] = useState({
    defaultMarkupPercentage: settings?.defaultMarkupPercentage || "13.00",
    categoryMarkupOverrides: settings?.categoryMarkupOverrides || {},
    allowRepPriceEdit: settings?.allowRepPriceEdit ?? true,
    requireApprovalForPriceEdit: settings?.requireApprovalForPriceEdit ?? false,
    requireApprovalAboveThreshold: settings?.requireApprovalAboveThreshold ?? true,
    maxDiscountPercentage: settings?.maxDiscountPercentage || "20.00",
    minMarginPercentage: settings?.minMarginPercentage || "5.00",
    autoApprovalThreshold: settings?.autoApprovalThreshold || "10.00",
    showDealerCostToReps: settings?.showDealerCostToReps ?? false,
    showMarginToReps: settings?.showMarginToReps ?? true,
    notifyOnPriceChange: settings?.notifyOnPriceChange ?? true,
    notifyManagersOnApproval: settings?.notifyManagersOnApproval ?? true,
  });

  const [categoryOverrides, setCategoryOverrides] = useState<string>(
    settings?.categoryMarkupOverrides
      ? JSON.stringify(settings.categoryMarkupOverrides, null, 2)
      : '{\n  "MFP": 13.0,\n  "Production": 15.0,\n  "Software": 20.0\n}'
  );

  const updateMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      let parsedOverrides = null;
      try {
        if (categoryOverrides.trim()) {
          parsedOverrides = JSON.parse(categoryOverrides);
        }
      } catch (e) {
        throw new Error("Invalid JSON in category markup overrides");
      }

      return await apiRequest('/api/pricing/settings', 'PUT', {
        ...data,
        categoryMarkupOverrides: parsedOverrides,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/pricing/settings'] });
      toast({
        title: "Settings Saved",
        description: "Pricing settings have been updated successfully.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update pricing settings",
        variant: "destructive",
      });
    },
  });

  const handleSave = () => {
    updateMutation.mutate(formData);
  };

  if (isLoading) {
    return (
      <MainLayout title="Pricing Settings" description="Configure company-wide pricing rules">
        <div className="flex items-center justify-center h-64">
          <p className="text-muted-foreground">Loading pricing settings...</p>
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout
      title="Pricing Settings"
      description="Configure three-tier pricing model and approval workflows"
    >
      <div className="space-y-6">
        {/* Header Info */}
        <Alert>
          <Info className="h-4 w-4" />
          <AlertDescription>
            Configure how product pricing works across your organization. These settings apply to all products
            and users in your company.
          </AlertDescription>
        </Alert>

        {/* Default Markup Section */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <DollarSign className="h-5 w-5" />
              <CardTitle>Default Markup Configuration</CardTitle>
            </div>
            <CardDescription>
              Set the default markup percentage to calculate rep cost from dealer cost
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label htmlFor="defaultMarkup">
                  Default Markup Percentage
                </Label>
                <div className="flex items-center gap-2">
                  <Input
                    id="defaultMarkup"
                    type="number"
                    step="0.01"
                    min="0"
                    max="100"
                    value={formData.defaultMarkupPercentage}
                    onChange={(e) => setFormData({ ...formData, defaultMarkupPercentage: e.target.value })}
                  />
                  <span className="text-sm text-muted-foreground">%</span>
                </div>
                <p className="text-xs text-muted-foreground">
                  Rep Cost = Dealer Cost × (1 + Markup ÷ 100)
                </p>
              </div>

              <div className="space-y-2">
                <Label>Example Calculation</Label>
                <div className="p-4 bg-muted rounded-md">
                  <p className="text-sm">
                    <span className="font-medium">Dealer Cost:</span> $10,000
                  </p>
                  <p className="text-sm">
                    <span className="font-medium">Markup:</span> {formData.defaultMarkupPercentage}%
                  </p>
                  <Separator className="my-2" />
                  <p className="text-sm font-bold">
                    Rep Cost: ${(10000 * (1 + parseFloat(formData.defaultMarkupPercentage) / 100)).toFixed(2)}
                  </p>
                </div>
              </div>
            </div>

            <Separator />

            <div className="space-y-2">
              <Label htmlFor="categoryOverrides">
                Category-Specific Markup Overrides (JSON)
              </Label>
              <Textarea
                id="categoryOverrides"
                value={categoryOverrides}
                onChange={(e) => setCategoryOverrides(e.target.value)}
                className="font-mono text-sm"
                rows={8}
                placeholder='{\n  "MFP": 13.0,\n  "Production": 15.0\n}'
              />
              <p className="text-xs text-muted-foreground">
                Override default markup for specific product categories. Leave empty to use default for all categories.
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Sales Rep Permissions */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Shield className="h-5 w-5" />
              <CardTitle>Sales Rep Permissions</CardTitle>
            </div>
            <CardDescription>
              Control what sales representatives can edit and whether approvals are required
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between p-4 border rounded-lg">
              <div className="space-y-1">
                <Label htmlFor="allowRepPriceEdit">Allow Reps to Edit Customer Price</Label>
                <p className="text-sm text-muted-foreground">
                  If disabled, only managers can set customer prices
                </p>
              </div>
              <Switch
                id="allowRepPriceEdit"
                checked={formData.allowRepPriceEdit}
                onCheckedChange={(checked) => setFormData({ ...formData, allowRepPriceEdit: checked })}
              />
            </div>

            <div className="flex items-center justify-between p-4 border rounded-lg">
              <div className="space-y-1">
                <Label htmlFor="requireApproval">Always Require Approval for Price Edits</Label>
                <p className="text-sm text-muted-foreground">
                  All price changes by reps require manager approval
                </p>
              </div>
              <Switch
                id="requireApproval"
                checked={formData.requireApprovalForPriceEdit}
                onCheckedChange={(checked) => setFormData({ ...formData, requireApprovalForPriceEdit: checked })}
              />
            </div>

            {!formData.requireApprovalForPriceEdit && (
              <div className="flex items-center justify-between p-4 border rounded-lg bg-muted/50">
                <div className="space-y-1">
                  <Label htmlFor="thresholdApproval">Require Approval Above Discount Threshold</Label>
                  <p className="text-sm text-muted-foreground">
                    Only require approval when discount exceeds threshold
                  </p>
                </div>
                <Switch
                  id="thresholdApproval"
                  checked={formData.requireApprovalAboveThreshold}
                  onCheckedChange={(checked) => setFormData({ ...formData, requireApprovalAboveThreshold: checked })}
                />
              </div>
            )}
          </CardContent>
        </Card>

        {/* Pricing Thresholds */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5" />
              <CardTitle>Pricing Thresholds & Limits</CardTitle>
            </div>
            <CardDescription>
              Set minimum margins and maximum discounts
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="autoApprovalThreshold">
                  Auto-Approval Threshold
                </Label>
                <div className="flex items-center gap-2">
                  <Input
                    id="autoApprovalThreshold"
                    type="number"
                    step="0.01"
                    min="0"
                    max="100"
                    value={formData.autoApprovalThreshold}
                    onChange={(e) => setFormData({ ...formData, autoApprovalThreshold: e.target.value })}
                  />
                  <span className="text-sm">%</span>
                </div>
                <p className="text-xs text-muted-foreground">
                  Discounts from rep cost below this % are auto-approved
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="minMargin">
                  Minimum Margin Percentage
                </Label>
                <div className="flex items-center gap-2">
                  <Input
                    id="minMargin"
                    type="number"
                    step="0.01"
                    min="0"
                    max="100"
                    value={formData.minMarginPercentage}
                    onChange={(e) => setFormData({ ...formData, minMarginPercentage: e.target.value })}
                  />
                  <span className="text-sm">%</span>
                </div>
                <p className="text-xs text-muted-foreground">
                  Minimum acceptable margin from dealer cost
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="maxDiscount">
                  Maximum Discount Percentage
                </Label>
                <div className="flex items-center gap-2">
                  <Input
                    id="maxDiscount"
                    type="number"
                    step="0.01"
                    min="0"
                    max="100"
                    value={formData.maxDiscountPercentage}
                    onChange={(e) => setFormData({ ...formData, maxDiscountPercentage: e.target.value })}
                  />
                  <span className="text-sm">%</span>
                </div>
                <p className="text-xs text-muted-foreground">
                  Maximum discount allowed from rep cost
                </p>
              </div>
            </div>

            <Alert>
              <Info className="h-4 w-4" />
              <AlertDescription>
                <strong>How it works:</strong> If a sales rep discounts more than{" "}
                <Badge variant="outline">{formData.autoApprovalThreshold}%</Badge> from rep cost,
                manager approval is required. Prices must maintain at least{" "}
                <Badge variant="outline">{formData.minMarginPercentage}%</Badge> margin from dealer cost.
              </AlertDescription>
            </Alert>
          </CardContent>
        </Card>

        {/* Visibility Settings */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Eye className="h-5 w-5" />
              <CardTitle>Visibility Settings</CardTitle>
            </div>
            <CardDescription>
              Control what pricing information sales reps can see
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between p-4 border rounded-lg">
              <div className="space-y-1">
                <Label htmlFor="showDealerCost">Show Dealer Cost to Sales Reps</Label>
                <p className="text-sm text-muted-foreground">
                  If enabled, reps can see the hard cost (not recommended)
                </p>
              </div>
              <Switch
                id="showDealerCost"
                checked={formData.showDealerCostToReps}
                onCheckedChange={(checked) => setFormData({ ...formData, showDealerCostToReps: checked })}
              />
            </div>

            <div className="flex items-center justify-between p-4 border rounded-lg">
              <div className="space-y-1">
                <Label htmlFor="showMargin">Show Margin to Sales Reps</Label>
                <p className="text-sm text-muted-foreground">
                  If enabled, reps can see margin calculations
                </p>
              </div>
              <Switch
                id="showMargin"
                checked={formData.showMarginToReps}
                onCheckedChange={(checked) => setFormData({ ...formData, showMarginToReps: checked })}
              />
            </div>

            <Alert variant="default">
              <Info className="h-4 w-4" />
              <AlertDescription>
                <strong>Note:</strong> Managers and admins always see all pricing tiers regardless of these settings.
              </AlertDescription>
            </Alert>
          </CardContent>
        </Card>

        {/* Notification Settings */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Bell className="h-5 w-5" />
              <CardTitle>Notification Settings</CardTitle>
            </div>
            <CardDescription>
              Configure when to send pricing-related notifications
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between p-4 border rounded-lg">
              <div className="space-y-1">
                <Label htmlFor="notifyPriceChange">Notify on Price Changes</Label>
                <p className="text-sm text-muted-foreground">
                  Send notifications when dealer costs are updated
                </p>
              </div>
              <Switch
                id="notifyPriceChange"
                checked={formData.notifyOnPriceChange}
                onCheckedChange={(checked) => setFormData({ ...formData, notifyOnPriceChange: checked })}
              />
            </div>

            <div className="flex items-center justify-between p-4 border rounded-lg">
              <div className="space-y-1">
                <Label htmlFor="notifyApproval">Notify Managers on Approval Requests</Label>
                <p className="text-sm text-muted-foreground">
                  Send notifications when reps request price approvals
                </p>
              </div>
              <Switch
                id="notifyApproval"
                checked={formData.notifyManagersOnApproval}
                onCheckedChange={(checked) => setFormData({ ...formData, notifyManagersOnApproval: checked })}
              />
            </div>
          </CardContent>
        </Card>

        {/* Save Button */}
        <div className="flex justify-end gap-4">
          <Button
            variant="outline"
            onClick={() => {
              setFormData({
                defaultMarkupPercentage: settings?.defaultMarkupPercentage || "13.00",
                categoryMarkupOverrides: settings?.categoryMarkupOverrides || {},
                allowRepPriceEdit: settings?.allowRepPriceEdit ?? true,
                requireApprovalForPriceEdit: settings?.requireApprovalForPriceEdit ?? false,
                requireApprovalAboveThreshold: settings?.requireApprovalAboveThreshold ?? true,
                maxDiscountPercentage: settings?.maxDiscountPercentage || "20.00",
                minMarginPercentage: settings?.minMarginPercentage || "5.00",
                autoApprovalThreshold: settings?.autoApprovalThreshold || "10.00",
                showDealerCostToReps: settings?.showDealerCostToReps ?? false,
                showMarginToReps: settings?.showMarginToReps ?? true,
                notifyOnPriceChange: settings?.notifyOnPriceChange ?? true,
                notifyManagersOnApproval: settings?.notifyManagersOnApproval ?? true,
              });
              setCategoryOverrides(
                settings?.categoryMarkupOverrides
                  ? JSON.stringify(settings.categoryMarkupOverrides, null, 2)
                  : '{\n  "MFP": 13.0,\n  "Production": 15.0\n}'
              );
            }}
          >
            Reset to Saved
          </Button>
          <Button onClick={handleSave} disabled={updateMutation.isPending}>
            <Save className="h-4 w-4 mr-2" />
            {updateMutation.isPending ? "Saving..." : "Save Settings"}
          </Button>
        </div>
      </div>
    </MainLayout>
  );
}
