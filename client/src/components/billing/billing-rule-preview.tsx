import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Calculator, DollarSign, FileText } from "lucide-react";
import { Separator } from "@/components/ui/separator";
import { format } from "date-fns";

interface BillingRulePreviewProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  rule: any | null;
}

export function BillingRulePreview({ open, onOpenChange, rule }: BillingRulePreviewProps) {
  const [testBwPages, setTestBwPages] = useState("1000");
  const [testColorPages, setTestColorPages] = useState("100");
  const [calculatedResult, setCalculatedResult] = useState<any>(null);

  if (!rule) return null;

  const calculateBilling = () => {
    const bwPages = parseInt(testBwPages) || 0;
    const colorPages = parseInt(testColorPages) || 0;

    const bwRate = parseFloat(rule.bwRate || "0");
    const colorRate = parseFloat(rule.colorRate || "0");
    const baseCharge = parseFloat(rule.baseCharge || "0");
    const baseVolumeBw = rule.baseVolumeBw || 0;
    const baseVolumeColor = rule.baseVolumeColor || 0;
    const overageMultiplier = parseFloat(rule.overageMultiplier || "1");

    // Calculate billable pages (pages beyond base volume)
    const billableBwPages = Math.max(0, bwPages - baseVolumeBw);
    const billableColorPages = Math.max(0, colorPages - baseVolumeColor);

    // Calculate charges
    const bwCharge = billableBwPages * bwRate * (billableBwPages > 0 && overageMultiplier > 1 ? overageMultiplier : 1);
    const colorCharge = billableColorPages * colorRate * (billableColorPages > 0 && overageMultiplier > 1 ? overageMultiplier : 1);

    const subtotal = baseCharge + bwCharge + colorCharge;

    // Apply minimum and maximum charges
    let total = subtotal;
    const minimumCharge = parseFloat(rule.minimumCharge || "0");
    const maximumCharge = parseFloat(rule.maximumCharge || "0");

    if (minimumCharge > 0 && total < minimumCharge) {
      total = minimumCharge;
    }

    if (maximumCharge > 0 && total > maximumCharge) {
      total = maximumCharge;
    }

    setCalculatedResult({
      baseCharge,
      bwPages,
      colorPages,
      billableBwPages,
      billableColorPages,
      bwCharge,
      colorCharge,
      subtotal,
      total,
      wasMinimumApplied: minimumCharge > 0 && subtotal < minimumCharge,
      wasMaximumApplied: maximumCharge > 0 && subtotal > maximumCharge,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Billing Rule Preview</DialogTitle>
          <DialogDescription>
            Review rule details and test calculations
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Rule Details */}
          <Card>
            <CardHeader>
              <div className="flex items-start justify-between">
                <div>
                  <CardTitle>{rule.ruleName}</CardTitle>
                  <CardDescription className="mt-1">{rule.ruleDescription}</CardDescription>
                </div>
                <Badge
                  variant={rule.ruleStatus === "active" ? "default" : "secondary"}
                  className={rule.ruleStatus === "active" ? "bg-green-100 text-green-800" : ""}
                >
                  {rule.ruleStatus}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div>
                  <Label className="text-muted-foreground text-xs">Type</Label>
                  <p className="font-medium capitalize">{rule.ruleType.replace("_", " ")}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground text-xs">Billing Cycle</Label>
                  <p className="font-medium capitalize">{rule.billingCycle}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground text-xs">Priority</Label>
                  <p className="font-medium">{rule.priority || 0}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground text-xs">Effective Date</Label>
                  <p className="font-medium">
                    {format(new Date(rule.effectiveStartDate), "MMM d, yyyy")}
                  </p>
                </div>
              </div>

              <Separator />

              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                {rule.baseCharge && parseFloat(rule.baseCharge) > 0 && (
                  <div className="flex items-start space-x-2">
                    <DollarSign className="h-4 w-4 text-muted-foreground mt-1" />
                    <div>
                      <Label className="text-muted-foreground text-xs">Base Charge</Label>
                      <p className="font-medium">${parseFloat(rule.baseCharge).toFixed(2)}</p>
                    </div>
                  </div>
                )}

                {rule.bwRate && parseFloat(rule.bwRate) > 0 && (
                  <div className="flex items-start space-x-2">
                    <FileText className="h-4 w-4 text-muted-foreground mt-1" />
                    <div>
                      <Label className="text-muted-foreground text-xs">B&W Rate</Label>
                      <p className="font-medium">${parseFloat(rule.bwRate).toFixed(4)}/page</p>
                      {rule.baseVolumeBw > 0 && (
                        <p className="text-xs text-muted-foreground">
                          {rule.baseVolumeBw} pages included
                        </p>
                      )}
                    </div>
                  </div>
                )}

                {rule.colorRate && parseFloat(rule.colorRate) > 0 && (
                  <div className="flex items-start space-x-2">
                    <FileText className="h-4 w-4 text-muted-foreground mt-1" />
                    <div>
                      <Label className="text-muted-foreground text-xs">Color Rate</Label>
                      <p className="font-medium">${parseFloat(rule.colorRate).toFixed(4)}/page</p>
                      {rule.baseVolumeColor > 0 && (
                        <p className="text-xs text-muted-foreground">
                          {rule.baseVolumeColor} pages included
                        </p>
                      )}
                    </div>
                  </div>
                )}

                {rule.minimumCharge && parseFloat(rule.minimumCharge) > 0 && (
                  <div>
                    <Label className="text-muted-foreground text-xs">Minimum Charge</Label>
                    <p className="font-medium">${parseFloat(rule.minimumCharge).toFixed(2)}</p>
                  </div>
                )}

                {rule.maximumCharge && parseFloat(rule.maximumCharge) > 0 && (
                  <div>
                    <Label className="text-muted-foreground text-xs">Maximum Charge</Label>
                    <p className="font-medium">${parseFloat(rule.maximumCharge).toFixed(2)}</p>
                  </div>
                )}

                {rule.overageMultiplier && parseFloat(rule.overageMultiplier) !== 1 && (
                  <div>
                    <Label className="text-muted-foreground text-xs">Overage Multiplier</Label>
                    <p className="font-medium">{parseFloat(rule.overageMultiplier).toFixed(2)}x</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Test Calculator */}
          <Card>
            <CardHeader>
              <div className="flex items-center space-x-2">
                <Calculator className="h-5 w-5" />
                <CardTitle>Test Calculator</CardTitle>
              </div>
              <CardDescription>
                Input page counts to see how this rule would calculate billing
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="testBwPages">B&W Pages</Label>
                  <Input
                    id="testBwPages"
                    type="number"
                    value={testBwPages}
                    onChange={(e) => setTestBwPages(e.target.value)}
                    placeholder="1000"
                  />
                </div>
                <div>
                  <Label htmlFor="testColorPages">Color Pages</Label>
                  <Input
                    id="testColorPages"
                    type="number"
                    value={testColorPages}
                    onChange={(e) => setTestColorPages(e.target.value)}
                    placeholder="100"
                  />
                </div>
              </div>

              <Button onClick={calculateBilling} className="w-full">
                <Calculator className="mr-2 h-4 w-4" />
                Calculate Billing
              </Button>

              {calculatedResult && (
                <div className="mt-6 p-4 bg-muted rounded-lg space-y-4">
                  <h4 className="font-semibold">Calculation Breakdown</h4>

                  <div className="space-y-2 text-sm">
                    {calculatedResult.baseCharge > 0 && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Base Charge:</span>
                        <span className="font-medium">${calculatedResult.baseCharge.toFixed(2)}</span>
                      </div>
                    )}

                    {calculatedResult.bwPages > 0 && (
                      <>
                        <div className="flex justify-between text-xs text-muted-foreground">
                          <span>B&W Pages Used: {calculatedResult.bwPages}</span>
                          <span>Billable: {calculatedResult.billableBwPages}</span>
                        </div>
                        {calculatedResult.bwCharge > 0 && (
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">B&W Charges:</span>
                            <span className="font-medium">${calculatedResult.bwCharge.toFixed(2)}</span>
                          </div>
                        )}
                      </>
                    )}

                    {calculatedResult.colorPages > 0 && (
                      <>
                        <div className="flex justify-between text-xs text-muted-foreground">
                          <span>Color Pages Used: {calculatedResult.colorPages}</span>
                          <span>Billable: {calculatedResult.billableColorPages}</span>
                        </div>
                        {calculatedResult.colorCharge > 0 && (
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Color Charges:</span>
                            <span className="font-medium">${calculatedResult.colorCharge.toFixed(2)}</span>
                          </div>
                        )}
                      </>
                    )}

                    <Separator className="my-2" />

                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Subtotal:</span>
                      <span className="font-medium">${calculatedResult.subtotal.toFixed(2)}</span>
                    </div>

                    {calculatedResult.wasMinimumApplied && (
                      <div className="flex justify-between text-xs text-amber-600">
                        <span>Minimum charge applied</span>
                      </div>
                    )}

                    {calculatedResult.wasMaximumApplied && (
                      <div className="flex justify-between text-xs text-amber-600">
                        <span>Maximum charge cap applied</span>
                      </div>
                    )}

                    <div className="flex justify-between pt-2 border-t text-lg">
                      <span className="font-semibold">Total:</span>
                      <span className="font-bold text-primary">
                        ${calculatedResult.total.toFixed(2)}
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Additional Configuration */}
          {rule.customCalculationFormula && (
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Custom Formula</CardTitle>
              </CardHeader>
              <CardContent>
                <pre className="p-4 bg-muted rounded-md text-xs overflow-x-auto">
                  {rule.customCalculationFormula}
                </pre>
              </CardContent>
            </Card>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
