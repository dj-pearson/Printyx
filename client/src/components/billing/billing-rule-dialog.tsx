import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";

const billingRuleSchema = z.object({
  ruleName: z.string().min(1, "Rule name is required"),
  ruleDescription: z.string().optional(),
  ruleType: z.enum(["tiered", "volume_discount", "time_based", "overage", "flat_rate", "custom"]),
  ruleStatus: z.enum(["active", "inactive", "draft"]).default("draft"),
  priority: z.coerce.number().min(0).default(0),
  effectiveStartDate: z.string().min(1, "Start date is required"),
  effectiveEndDate: z.string().optional(),
  billingCycle: z.enum(["daily", "weekly", "monthly", "quarterly", "annual"]).default("monthly"),
  baseCharge: z.string().optional(),
  minimumCharge: z.string().optional(),
  maximumCharge: z.string().optional(),
  bwRate: z.string().optional(),
  colorRate: z.string().optional(),
  baseVolumeBw: z.coerce.number().optional(),
  baseVolumeColor: z.coerce.number().optional(),
  overageMultiplier: z.string().optional(),
  applicableToAllCustomers: z.boolean().default(false),
  applicableToAllEquipment: z.boolean().default(false),
  roundingMethod: z.enum(["up", "down", "nearest"]).default("nearest"),
  roundingPrecision: z.coerce.number().default(2),
  customCalculationFormula: z.string().optional(),
});

type BillingRuleFormValues = z.infer<typeof billingRuleSchema>;

interface BillingRuleDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  rule?: any | null;
}

export function BillingRuleDialog({ open, onOpenChange, rule }: BillingRuleDialogProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const form = useForm<BillingRuleFormValues>({
    resolver: zodResolver(billingRuleSchema),
    defaultValues: {
      ruleName: "",
      ruleDescription: "",
      ruleType: "flat_rate",
      ruleStatus: "draft",
      priority: 0,
      effectiveStartDate: new Date().toISOString().split("T")[0],
      billingCycle: "monthly",
      applicableToAllCustomers: false,
      applicableToAllEquipment: false,
      roundingMethod: "nearest",
      roundingPrecision: 2,
    },
  });

  // Populate form when editing
  useEffect(() => {
    if (rule) {
      form.reset({
        ruleName: rule.ruleName || "",
        ruleDescription: rule.ruleDescription || "",
        ruleType: rule.ruleType || "flat_rate",
        ruleStatus: rule.ruleStatus || "draft",
        priority: rule.priority || 0,
        effectiveStartDate: rule.effectiveStartDate
          ? new Date(rule.effectiveStartDate).toISOString().split("T")[0]
          : new Date().toISOString().split("T")[0],
        effectiveEndDate: rule.effectiveEndDate
          ? new Date(rule.effectiveEndDate).toISOString().split("T")[0]
          : undefined,
        billingCycle: rule.billingCycle || "monthly",
        baseCharge: rule.baseCharge || "",
        minimumCharge: rule.minimumCharge || "",
        maximumCharge: rule.maximumCharge || "",
        bwRate: rule.bwRate || "",
        colorRate: rule.colorRate || "",
        baseVolumeBw: rule.baseVolumeBw || 0,
        baseVolumeColor: rule.baseVolumeColor || 0,
        overageMultiplier: rule.overageMultiplier || "",
        applicableToAllCustomers: rule.applicableToAllCustomers || false,
        applicableToAllEquipment: rule.applicableToAllEquipment || false,
        roundingMethod: rule.roundingMethod || "nearest",
        roundingPrecision: rule.roundingPrecision || 2,
        customCalculationFormula: rule.customCalculationFormula || "",
      });
    } else {
      form.reset({
        ruleName: "",
        ruleDescription: "",
        ruleType: "flat_rate",
        ruleStatus: "draft",
        priority: 0,
        effectiveStartDate: new Date().toISOString().split("T")[0],
        billingCycle: "monthly",
        applicableToAllCustomers: false,
        applicableToAllEquipment: false,
        roundingMethod: "nearest",
        roundingPrecision: 2,
      });
    }
  }, [rule, form]);

  // Create/update mutation
  const saveMutation = useMutation({
    mutationFn: async (data: BillingRuleFormValues) => {
      if (rule?.id) {
        return await apiRequest(`/api/billing/rules/${rule.id}`, "PUT", data);
      } else {
        return await apiRequest("/api/billing/rules", "POST", data);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/billing/rules"] });
      toast({
        title: rule ? "Rule updated" : "Rule created",
        description: `Billing rule has been ${rule ? "updated" : "created"} successfully.`,
      });
      onOpenChange(false);
    },
    onError: (error: any) => {
      toast({
        title: `Failed to ${rule ? "update" : "create"} rule`,
        description: error.message || "Please try again",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: BillingRuleFormValues) => {
    saveMutation.mutate(data);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle>{rule ? "Edit Billing Rule" : "Create Billing Rule"}</DialogTitle>
          <DialogDescription>
            {rule
              ? "Update your billing rule configuration"
              : "Create a new billing rule to automate your pricing"}
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="max-h-[calc(90vh-200px)]">
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6 pr-4">
              <Tabs defaultValue="basic" className="w-full">
                <TabsList className="grid w-full grid-cols-3">
                  <TabsTrigger value="basic">Basic Info</TabsTrigger>
                  <TabsTrigger value="pricing">Pricing</TabsTrigger>
                  <TabsTrigger value="advanced">Advanced</TabsTrigger>
                </TabsList>

                <TabsContent value="basic" className="space-y-4 mt-4">
                  <FormField
                    control={form.control}
                    name="ruleName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Rule Name *</FormLabel>
                        <FormControl>
                          <Input placeholder="Standard Tiered Pricing" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="ruleDescription"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Description</FormLabel>
                        <FormControl>
                          <Textarea
                            placeholder="Describe this billing rule..."
                            className="resize-none"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="ruleType"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Rule Type *</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Select type" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="flat_rate">Flat Rate</SelectItem>
                              <SelectItem value="tiered">Tiered Pricing</SelectItem>
                              <SelectItem value="volume_discount">Volume Discount</SelectItem>
                              <SelectItem value="time_based">Time Based</SelectItem>
                              <SelectItem value="overage">Overage Charges</SelectItem>
                              <SelectItem value="custom">Custom Formula</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="ruleStatus"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Status</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Select status" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="draft">Draft</SelectItem>
                              <SelectItem value="active">Active</SelectItem>
                              <SelectItem value="inactive">Inactive</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="billingCycle"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Billing Cycle</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Select cycle" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="monthly">Monthly</SelectItem>
                              <SelectItem value="quarterly">Quarterly</SelectItem>
                              <SelectItem value="annual">Annual</SelectItem>
                              <SelectItem value="weekly">Weekly</SelectItem>
                              <SelectItem value="daily">Daily</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="priority"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Priority</FormLabel>
                          <FormControl>
                            <Input type="number" placeholder="0" {...field} />
                          </FormControl>
                          <FormDescription>Higher priority rules apply first</FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="effectiveStartDate"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Effective Start Date *</FormLabel>
                          <FormControl>
                            <Input type="date" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="effectiveEndDate"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Effective End Date</FormLabel>
                          <FormControl>
                            <Input type="date" {...field} />
                          </FormControl>
                          <FormDescription>Leave empty for no end date</FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </TabsContent>

                <TabsContent value="pricing" className="space-y-4 mt-4">
                  <div className="grid grid-cols-3 gap-4">
                    <FormField
                      control={form.control}
                      name="baseCharge"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Base Charge ($)</FormLabel>
                          <FormControl>
                            <Input type="number" step="0.01" placeholder="0.00" {...field} />
                          </FormControl>
                          <FormDescription>Monthly base fee</FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="minimumCharge"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Minimum Charge ($)</FormLabel>
                          <FormControl>
                            <Input type="number" step="0.01" placeholder="0.00" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="maximumCharge"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Maximum Charge ($)</FormLabel>
                          <FormControl>
                            <Input type="number" step="0.01" placeholder="0.00" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="bwRate"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>B&W Rate (per page)</FormLabel>
                          <FormControl>
                            <Input type="number" step="0.0001" placeholder="0.0100" {...field} />
                          </FormControl>
                          <FormDescription>Cost per black & white page</FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="colorRate"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Color Rate (per page)</FormLabel>
                          <FormControl>
                            <Input type="number" step="0.0001" placeholder="0.0500" {...field} />
                          </FormControl>
                          <FormDescription>Cost per color page</FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="baseVolumeBw"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Base B&W Volume</FormLabel>
                          <FormControl>
                            <Input type="number" placeholder="1000" {...field} />
                          </FormControl>
                          <FormDescription>Included pages (B&W)</FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="baseVolumeColor"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Base Color Volume</FormLabel>
                          <FormControl>
                            <Input type="number" placeholder="100" {...field} />
                          </FormControl>
                          <FormDescription>Included pages (Color)</FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <FormField
                    control={form.control}
                    name="overageMultiplier"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Overage Multiplier</FormLabel>
                        <FormControl>
                          <Input type="number" step="0.01" placeholder="1.5" {...field} />
                        </FormControl>
                        <FormDescription>
                          Multiply rate by this for overage pages (e.g., 1.5 = 50% surcharge)
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </TabsContent>

                <TabsContent value="advanced" className="space-y-4 mt-4">
                  <div className="space-y-4">
                    <FormField
                      control={form.control}
                      name="applicableToAllCustomers"
                      render={({ field }) => (
                        <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                          <div className="space-y-0.5">
                            <FormLabel className="text-base">Apply to All Customers</FormLabel>
                            <FormDescription>
                              Use this rule for all customers (default pricing)
                            </FormDescription>
                          </div>
                          <FormControl>
                            <Switch checked={field.value} onCheckedChange={field.onChange} />
                          </FormControl>
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="applicableToAllEquipment"
                      render={({ field }) => (
                        <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                          <div className="space-y-0.5">
                            <FormLabel className="text-base">Apply to All Equipment</FormLabel>
                            <FormDescription>
                              Use this rule for all equipment types
                            </FormDescription>
                          </div>
                          <FormControl>
                            <Switch checked={field.value} onCheckedChange={field.onChange} />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="roundingMethod"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Rounding Method</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Select method" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="nearest">Nearest</SelectItem>
                              <SelectItem value="up">Round Up</SelectItem>
                              <SelectItem value="down">Round Down</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="roundingPrecision"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Rounding Precision</FormLabel>
                          <FormControl>
                            <Input type="number" min="0" max="4" placeholder="2" {...field} />
                          </FormControl>
                          <FormDescription>Decimal places (0-4)</FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <FormField
                    control={form.control}
                    name="customCalculationFormula"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Custom Calculation Formula</FormLabel>
                        <FormControl>
                          <Textarea
                            placeholder="e.g., (bw_pages * bw_rate) + (color_pages * color_rate) + base_charge"
                            className="font-mono text-sm"
                            {...field}
                          />
                        </FormControl>
                        <FormDescription>
                          Advanced: Custom JavaScript expression for calculations
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </TabsContent>
              </Tabs>

              <div className="flex justify-end space-x-2 pt-4 border-t">
                <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={saveMutation.isPending}>
                  {saveMutation.isPending ? "Saving..." : rule ? "Update Rule" : "Create Rule"}
                </Button>
              </div>
            </form>
          </Form>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
