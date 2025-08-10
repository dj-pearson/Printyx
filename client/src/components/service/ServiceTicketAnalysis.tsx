import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import {
  Clock,
  User,
  Wrench,
  AlertTriangle,
  CheckCircle,
  Package,
  ShoppingCart,
  Camera,
  FileText,
  Star,
  MapPin,
  Calendar,
  DollarSign,
  Truck,
  Phone,
  Clipboard,
} from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  insertServiceCallAnalysisSchema,
  insertPartsOrderSchema,
} from "@shared/schema";
import type {
  ServiceTicket,
  ServiceCallAnalysis,
  PartsOrder,
  PartsOrderItem,
} from "@shared/schema";
import { z } from "zod";
import { format } from "date-fns";

const analysisFormSchema = insertServiceCallAnalysisSchema.extend({
  callStartTime: z.string(),
  callEndTime: z.string().optional(),
  actualArrivalTime: z.string().optional(),
  followUpDate: z.string().optional(),
});

const partsOrderFormSchema = insertPartsOrderSchema.extend({
  orderDate: z.string(),
  expectedDeliveryDate: z.string().optional(),
  items: z.array(
    z.object({
      partNumber: z.string(),
      partName: z.string(),
      partDescription: z.string().optional(),
      quantityOrdered: z.number().min(1),
      unitPrice: z.number().min(0),
    })
  ),
});

type AnalysisFormInput = z.infer<typeof analysisFormSchema>;
type PartsOrderFormInput = z.infer<typeof partsOrderFormSchema>;

interface ServiceTicketAnalysisProps {
  ticket: ServiceTicket;
  isOpen: boolean;
  onClose: () => void;
}

const outcomeOptions = [
  {
    value: "resolved",
    label: "Resolved",
    icon: CheckCircle,
    color: "text-green-600",
  },
  {
    value: "partial_fix",
    label: "Partial Fix",
    icon: Wrench,
    color: "text-yellow-600",
  },
  {
    value: "requires_parts",
    label: "Requires Parts",
    icon: Package,
    color: "text-blue-600",
  },
  {
    value: "requires_escalation",
    label: "Requires Escalation",
    icon: AlertTriangle,
    color: "text-red-600",
  },
  {
    value: "customer_declined",
    label: "Customer Declined",
    icon: User,
    color: "text-gray-600",
  },
  {
    value: "follow_up_needed",
    label: "Follow-up Needed",
    icon: Calendar,
    color: "text-orange-600",
  },
];

const analysisTypeOptions = [
  { value: "diagnostic", label: "Diagnostic" },
  { value: "repair", label: "Repair" },
  { value: "maintenance", label: "Maintenance" },
  { value: "installation", label: "Installation" },
  { value: "inspection", label: "Inspection" },
  { value: "training", label: "Training" },
];

export default function ServiceTicketAnalysis({
  ticket,
  isOpen,
  onClose,
}: ServiceTicketAnalysisProps) {
  const [activeTab, setActiveTab] = useState("analysis");
  const [showPartsOrderDialog, setShowPartsOrderDialog] = useState(false);
  const [selectedAnalysis, setSelectedAnalysis] =
    useState<ServiceCallAnalysis | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch existing analyses for this ticket
  const { data: analyses = [], isLoading: isLoadingAnalyses } = useQuery<
    ServiceCallAnalysis[]
  >({
    queryKey: ["/api/service-tickets", ticket.id, "analysis"],
    enabled: isOpen && !!ticket.id,
  });

  // Fetch parts orders for analysis
  const { data: partsOrders = [] } = useQuery<PartsOrder[]>({
    queryKey: ["/api/service-analysis", selectedAnalysis?.id, "parts-orders"],
    enabled: !!selectedAnalysis?.id,
  });

  const analysisForm = useForm<AnalysisFormInput>({
    resolver: zodResolver(analysisFormSchema),
    defaultValues: {
      analysisType: "diagnostic",
      outcome: "resolved",
      customerPresent: false,
      followUpRequired: false,
      callStartTime: new Date().toISOString().slice(0, 16),
    },
  });

  const partsOrderForm = useForm<PartsOrderFormInput>({
    resolver: zodResolver(partsOrderFormSchema),
    defaultValues: {
      vendorName: "",
      priority: "normal",
      rushOrder: false,
      orderDate: new Date().toISOString().slice(0, 16),
      items: [
        { partNumber: "", partName: "", quantityOrdered: 1, unitPrice: 0 },
      ],
    },
  });

  // Create service call analysis
  const createAnalysisMutation = useMutation({
    mutationFn: async (data: AnalysisFormInput) =>
      apiRequest(`/api/service-tickets/${ticket.id}/analysis`, "POST", {
        ...data,
        callStartTime: new Date(data.callStartTime),
        callEndTime: data.callEndTime ? new Date(data.callEndTime) : null,
        actualArrivalTime: data.actualArrivalTime
          ? new Date(data.actualArrivalTime)
          : null,
        followUpDate: data.followUpDate ? new Date(data.followUpDate) : null,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["/api/service-tickets", ticket.id, "analysis"],
      });
      queryClient.invalidateQueries({ queryKey: ["/api/service-tickets"] });
      analysisForm.reset();
      toast({ title: "Analysis created successfully" });
    },
  });

  // Create parts order
  const createPartsOrderMutation = useMutation({
    mutationFn: async (data: PartsOrderFormInput) => {
      if (!selectedAnalysis) throw new Error("No analysis selected");
      return apiRequest(
        `/api/service-analysis/${selectedAnalysis.id}/parts-order`,
        "POST",
        {
          ...data,
          orderDate: new Date(data.orderDate),
          expectedDeliveryDate: data.expectedDeliveryDate
            ? new Date(data.expectedDeliveryDate)
            : null,
          total: data.items.reduce(
            (sum, item) => sum + item.quantityOrdered * item.unitPrice,
            0
          ),
          subtotal: data.items.reduce(
            (sum, item) => sum + item.quantityOrdered * item.unitPrice,
            0
          ),
        }
      );
    },
    onSuccess: (newOrder) => {
      const addItemsPromise = apiRequest(
        `/api/parts-orders/${newOrder.id}/items`,
        "POST",
        {
          items: partsOrderForm.getValues("items").map((item) => ({
            ...item,
            lineTotal: item.quantityOrdered * item.unitPrice,
          })),
        }
      );

      Promise.resolve(addItemsPromise).then(() => {
        queryClient.invalidateQueries({
          queryKey: [
            "/api/service-analysis",
            selectedAnalysis?.id,
            "parts-orders",
          ],
        });
        setShowPartsOrderDialog(false);
        partsOrderForm.reset();
        toast({ title: "Parts order created successfully" });
      });
    },
  });

  const handleAnalysisSubmit = (data: AnalysisFormInput) => {
    createAnalysisMutation.mutate(data);
  };

  const handlePartsOrderSubmit = (data: PartsOrderFormInput) => {
    createPartsOrderMutation.mutate(data);
  };

  const getOutcomeIcon = (outcome: string) => {
    const option = outcomeOptions.find((opt) => opt.value === outcome);
    if (!option) return Clock;
    return option.icon;
  };

  const getOutcomeColor = (outcome: string) => {
    const option = outcomeOptions.find((opt) => opt.value === outcome);
    return option?.color || "text-gray-600";
  };

  const addPartsOrderItem = () => {
    const currentItems = partsOrderForm.getValues("items");
    partsOrderForm.setValue("items", [
      ...currentItems,
      { partNumber: "", partName: "", quantityOrdered: 1, unitPrice: 0 },
    ]);
  };

  const removePartsOrderItem = (index: number) => {
    const currentItems = partsOrderForm.getValues("items");
    partsOrderForm.setValue(
      "items",
      currentItems.filter((_, i) => i !== index)
    );
  };

  if (!isOpen) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Clipboard className="h-5 w-5" />
            Service Call Analysis - {ticket.title}
          </DialogTitle>
          <DialogDescription>
            Detailed analysis and outcome tracking for service ticket #
            {ticket.id}
          </DialogDescription>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="analysis">New Analysis</TabsTrigger>
            <TabsTrigger value="history">Analysis History</TabsTrigger>
            <TabsTrigger value="parts">Parts & Orders</TabsTrigger>
            <TabsTrigger value="overview">Overview</TabsTrigger>
          </TabsList>

          <TabsContent value="analysis" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Service Call Analysis</CardTitle>
                <CardDescription>
                  Document the service call outcome and next steps
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Form {...analysisForm}>
                  <form
                    onSubmit={analysisForm.handleSubmit(handleAnalysisSubmit)}
                    className="space-y-4"
                  >
                    <div className="grid grid-cols-2 gap-4">
                      <FormField
                        control={analysisForm.control}
                        name="analysisType"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Analysis Type</FormLabel>
                            <Select
                              onValueChange={field.onChange}
                              value={field.value}
                            >
                              <FormControl>
                                <SelectTrigger>
                                  <SelectValue />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                {analysisTypeOptions.map((option) => (
                                  <SelectItem
                                    key={option.value}
                                    value={option.value}
                                  >
                                    {option.label}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={analysisForm.control}
                        name="outcome"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Outcome</FormLabel>
                            <Select
                              onValueChange={field.onChange}
                              value={field.value}
                            >
                              <FormControl>
                                <SelectTrigger>
                                  <SelectValue />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                {outcomeOptions.map((option) => {
                                  const Icon = option.icon;
                                  return (
                                    <SelectItem
                                      key={option.value}
                                      value={option.value}
                                    >
                                      <div className="flex items-center gap-2">
                                        <Icon
                                          className={`h-4 w-4 ${option.color}`}
                                        />
                                        {option.label}
                                      </div>
                                    </SelectItem>
                                  );
                                })}
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    <div className="grid grid-cols-3 gap-4">
                      <FormField
                        control={analysisForm.control}
                        name="callStartTime"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Call Start Time</FormLabel>
                            <FormControl>
                              <Input type="datetime-local" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={analysisForm.control}
                        name="callEndTime"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Call End Time</FormLabel>
                            <FormControl>
                              <Input type="datetime-local" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={analysisForm.control}
                        name="onSiteTime"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>On-Site Time (minutes)</FormLabel>
                            <FormControl>
                              <Input
                                type="number"
                                {...field}
                                value={field.value || ""}
                                onChange={(e) =>
                                  field.onChange(parseInt(e.target.value) || 0)
                                }
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    <FormField
                      control={analysisForm.control}
                      name="problemDescription"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Problem Description</FormLabel>
                          <FormControl>
                            <Textarea
                              placeholder="Describe the issue found during the service call..."
                              className="min-h-[100px]"
                              {...field}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={analysisForm.control}
                      name="rootCause"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Root Cause Analysis</FormLabel>
                          <FormControl>
                            <Textarea
                              placeholder="What caused this issue?"
                              {...field}
                              value={field.value || ""}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <div className="grid grid-cols-2 gap-4">
                      <FormField
                        control={analysisForm.control}
                        name="customerPresent"
                        render={({ field }) => (
                          <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                            <div className="space-y-0.5">
                              <FormLabel className="text-base">
                                Customer Present
                              </FormLabel>
                              <div className="text-sm text-muted-foreground">
                                Was the customer present during service?
                              </div>
                            </div>
                            <FormControl>
                              <Switch
                                checked={field.value || false}
                                onCheckedChange={field.onChange}
                              />
                            </FormControl>
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={analysisForm.control}
                        name="customerSatisfactionScore"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Customer Satisfaction (1-5)</FormLabel>
                            <FormControl>
                              <Select
                                onValueChange={(value) =>
                                  field.onChange(parseInt(value))
                                }
                              >
                                <SelectTrigger>
                                  <SelectValue placeholder="Rate satisfaction" />
                                </SelectTrigger>
                                <SelectContent>
                                  {[1, 2, 3, 4, 5].map((rating) => (
                                    <SelectItem
                                      key={rating}
                                      value={rating.toString()}
                                    >
                                      <div className="flex items-center gap-2">
                                        <div className="flex">
                                          {Array.from({ length: rating }).map(
                                            (_, i) => (
                                              <Star
                                                key={i}
                                                className="h-4 w-4 fill-yellow-400 text-yellow-400"
                                              />
                                            )
                                          )}
                                        </div>
                                        {rating} Star{rating !== 1 ? "s" : ""}
                                      </div>
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    <FormField
                      control={analysisForm.control}
                      name="customerFeedback"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Customer Feedback</FormLabel>
                          <FormControl>
                            <Textarea
                              placeholder="Any feedback from the customer..."
                              {...field}
                              value={field.value || ""}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <div className="grid grid-cols-2 gap-4">
                      <FormField
                        control={analysisForm.control}
                        name="laborHours"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Labor Hours</FormLabel>
                            <FormControl>
                              <Input
                                type="number"
                                step="0.25"
                                placeholder="2.5"
                                {...field}
                                value={field.value || ""}
                                onChange={(e) =>
                                  field.onChange(
                                    parseFloat(e.target.value) || 0
                                  )
                                }
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={analysisForm.control}
                        name="laborRate"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Labor Rate ($/hour)</FormLabel>
                            <FormControl>
                              <Input
                                type="number"
                                step="0.01"
                                placeholder="125.00"
                                {...field}
                                value={field.value || ""}
                                onChange={(e) =>
                                  field.onChange(
                                    parseFloat(e.target.value) || 0
                                  )
                                }
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    <Button
                      type="submit"
                      className="w-full"
                      disabled={createAnalysisMutation.isPending}
                    >
                      {createAnalysisMutation.isPending
                        ? "Creating Analysis..."
                        : "Create Analysis"}
                    </Button>
                  </form>
                </Form>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="history" className="space-y-4">
            {isLoadingAnalyses ? (
              <div className="text-center py-8">Loading analyses...</div>
            ) : analyses.length === 0 ? (
              <Card>
                <CardContent className="text-center py-8">
                  <Clipboard className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <p className="text-gray-500">
                    No service analyses recorded yet
                  </p>
                </CardContent>
              </Card>
            ) : (
              analyses.map((analysis) => {
                const OutcomeIcon = getOutcomeIcon(analysis.outcome);
                return (
                  <Card
                    key={analysis.id}
                    className="cursor-pointer hover:shadow-md transition-shadow"
                    onClick={() => setSelectedAnalysis(analysis)}
                  >
                    <CardContent className="pt-6">
                      <div className="flex items-start justify-between">
                        <div className="space-y-2">
                          <div className="flex items-center gap-2">
                            <OutcomeIcon
                              className={`h-5 w-5 ${getOutcomeColor(
                                analysis.outcome
                              )}`}
                            />
                            <span className="font-semibold capitalize">
                              {analysis.outcome.replace("_", " ")}
                            </span>
                            <Badge variant="outline">
                              {analysis.analysisType}
                            </Badge>
                          </div>
                          <p className="text-sm text-gray-600 line-clamp-2">
                            {analysis.problemDescription}
                          </p>
                          <div className="flex items-center gap-4 text-sm text-gray-500">
                            <div className="flex items-center gap-1">
                              <Clock className="h-4 w-4" />
                              {analysis.onSiteTime
                                ? `${analysis.onSiteTime}min`
                                : "N/A"}
                            </div>
                            {analysis.customerSatisfactionScore && (
                              <div className="flex items-center gap-1">
                                <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                                {analysis.customerSatisfactionScore}/5
                              </div>
                            )}
                            {analysis.totalLaborCost && (
                              <div className="flex items-center gap-1">
                                <DollarSign className="h-4 w-4" />$
                                {analysis.totalLaborCost}
                              </div>
                            )}
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-sm text-gray-500">
                            {format(
                              new Date(analysis.createdAt),
                              "MMM d, yyyy"
                            )}
                          </p>
                          <p className="text-xs text-gray-400">
                            {format(new Date(analysis.createdAt), "h:mm a")}
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })
            )}
          </TabsContent>

          <TabsContent value="parts" className="space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="text-lg font-semibold">Parts Orders</h3>
              <Button
                onClick={() => setShowPartsOrderDialog(true)}
                disabled={!selectedAnalysis}
              >
                <ShoppingCart className="h-4 w-4 mr-2" />
                Create Parts Order
              </Button>
            </div>

            {!selectedAnalysis ? (
              <Card>
                <CardContent className="text-center py-8">
                  <Package className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <p className="text-gray-500">
                    Select an analysis to view parts orders
                  </p>
                </CardContent>
              </Card>
            ) : partsOrders.length === 0 ? (
              <Card>
                <CardContent className="text-center py-8">
                  <ShoppingCart className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <p className="text-gray-500">
                    No parts orders for this analysis
                  </p>
                </CardContent>
              </Card>
            ) : (
              partsOrders.map((order) => (
                <Card key={order.id}>
                  <CardContent className="pt-6">
                    <div className="flex items-start justify-between">
                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <Badge
                            variant={
                              order.status === "delivered"
                                ? "default"
                                : "secondary"
                            }
                          >
                            {order.status.replace("_", " ")}
                          </Badge>
                          <span className="font-mono text-sm">
                            #{order.orderNumber}
                          </span>
                        </div>
                        <p className="font-semibold">{order.vendorName}</p>
                        <div className="flex items-center gap-4 text-sm text-gray-600">
                          <div className="flex items-center gap-1">
                            <Calendar className="h-4 w-4" />
                            Ordered:{" "}
                            {format(new Date(order.orderDate), "MMM d, yyyy")}
                          </div>
                          {order.expectedDeliveryDate && (
                            <div className="flex items-center gap-1">
                              <Truck className="h-4 w-4" />
                              Expected:{" "}
                              {format(
                                new Date(order.expectedDeliveryDate),
                                "MMM d, yyyy"
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-lg font-bold">${order.total}</p>
                        {order.rushOrder && (
                          <Badge variant="destructive" className="text-xs">
                            Rush Order
                          </Badge>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </TabsContent>

          <TabsContent value="overview" className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center gap-2">
                    <Clipboard className="h-8 w-8 text-blue-600" />
                    <div>
                      <p className="text-2xl font-bold">{analyses.length}</p>
                      <p className="text-sm text-muted-foreground">
                        Total Analyses
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center gap-2">
                    <CheckCircle className="h-8 w-8 text-green-600" />
                    <div>
                      <p className="text-2xl font-bold">
                        {
                          analyses.filter((a) => a.outcome === "resolved")
                            .length
                        }
                      </p>
                      <p className="text-sm text-muted-foreground">Resolved</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center gap-2">
                    <Package className="h-8 w-8 text-orange-600" />
                    <div>
                      <p className="text-2xl font-bold">
                        {
                          analyses.filter((a) => a.outcome === "requires_parts")
                            .length
                        }
                      </p>
                      <p className="text-sm text-muted-foreground">
                        Need Parts
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {analyses.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle>Service Performance</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div>
                      <div className="flex justify-between text-sm mb-2">
                        <span>Resolution Rate</span>
                        <span>
                          {Math.round(
                            (analyses.filter((a) => a.outcome === "resolved")
                              .length /
                              analyses.length) *
                              100
                          )}
                          %
                        </span>
                      </div>
                      <Progress
                        value={
                          (analyses.filter((a) => a.outcome === "resolved")
                            .length /
                            analyses.length) *
                          100
                        }
                        className="h-2"
                      />
                    </div>

                    <div>
                      <div className="flex justify-between text-sm mb-2">
                        <span>Avg. Customer Satisfaction</span>
                        <span>
                          {analyses.filter((a) => a.customerSatisfactionScore)
                            .length > 0
                            ? (
                                analyses.reduce(
                                  (sum, a) =>
                                    sum + (a.customerSatisfactionScore || 0),
                                  0
                                ) /
                                analyses.filter(
                                  (a) => a.customerSatisfactionScore
                                ).length
                              ).toFixed(1)
                            : "N/A"}
                          /5
                        </span>
                      </div>
                      <Progress
                        value={
                          analyses.filter((a) => a.customerSatisfactionScore)
                            .length > 0
                            ? (analyses.reduce(
                                (sum, a) =>
                                  sum + (a.customerSatisfactionScore || 0),
                                0
                              ) /
                                analyses.filter(
                                  (a) => a.customerSatisfactionScore
                                ).length) *
                              20
                            : 0
                        }
                        className="h-2"
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>
        </Tabs>

        {/* Parts Order Dialog */}
        <Dialog
          open={showPartsOrderDialog}
          onOpenChange={setShowPartsOrderDialog}
        >
          <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Create Parts Order</DialogTitle>
              <DialogDescription>
                Order parts required for service completion
              </DialogDescription>
            </DialogHeader>

            <Form {...partsOrderForm}>
              <form
                onSubmit={partsOrderForm.handleSubmit(handlePartsOrderSubmit)}
                className="space-y-4"
              >
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={partsOrderForm.control}
                    name="vendorName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Vendor Name</FormLabel>
                        <FormControl>
                          <Input placeholder="Vendor name" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={partsOrderForm.control}
                    name="priority"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Priority</FormLabel>
                        <Select
                          onValueChange={field.onChange}
                          value={field.value}
                        >
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="low">Low</SelectItem>
                            <SelectItem value="normal">Normal</SelectItem>
                            <SelectItem value="high">High</SelectItem>
                            <SelectItem value="urgent">Urgent</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <Label className="text-base font-semibold">
                      Order Items
                    </Label>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={addPartsOrderItem}
                    >
                      Add Item
                    </Button>
                  </div>

                  {partsOrderForm.watch("items").map((_, index) => (
                    <Card key={index}>
                      <CardContent className="pt-4">
                        <div className="grid grid-cols-12 gap-2 items-start">
                          <div className="col-span-3">
                            <FormField
                              control={partsOrderForm.control}
                              name={`items.${index}.partNumber`}
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>Part Number</FormLabel>
                                  <FormControl>
                                    <Input placeholder="P/N" {...field} />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                          </div>

                          <div className="col-span-4">
                            <FormField
                              control={partsOrderForm.control}
                              name={`items.${index}.partName`}
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>Part Name</FormLabel>
                                  <FormControl>
                                    <Input placeholder="Part name" {...field} />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                          </div>

                          <div className="col-span-2">
                            <FormField
                              control={partsOrderForm.control}
                              name={`items.${index}.quantityOrdered`}
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>Qty</FormLabel>
                                  <FormControl>
                                    <Input
                                      type="number"
                                      min="1"
                                      {...field}
                                      onChange={(e) =>
                                        field.onChange(
                                          parseInt(e.target.value) || 1
                                        )
                                      }
                                    />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                          </div>

                          <div className="col-span-2">
                            <FormField
                              control={partsOrderForm.control}
                              name={`items.${index}.unitPrice`}
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>Price</FormLabel>
                                  <FormControl>
                                    <Input
                                      type="number"
                                      step="0.01"
                                      min="0"
                                      {...field}
                                      onChange={(e) =>
                                        field.onChange(
                                          parseFloat(e.target.value) || 0
                                        )
                                      }
                                    />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                          </div>

                          <div className="col-span-1 pt-8">
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => removePartsOrderItem(index)}
                              disabled={
                                partsOrderForm.watch("items").length === 1
                              }
                            >
                              ✕
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>

                <DialogFooter>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setShowPartsOrderDialog(false)}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    disabled={createPartsOrderMutation.isPending}
                  >
                    {createPartsOrderMutation.isPending
                      ? "Creating Order..."
                      : "Create Order"}
                  </Button>
                </DialogFooter>
              </form>
            </Form>
          </DialogContent>
        </Dialog>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
