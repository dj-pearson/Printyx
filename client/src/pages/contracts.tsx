import { useEffect, useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import MainLayout from "@/components/layout/main-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Search, Plus, FileText, Loader2 } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

export default function Contracts() {
  const queryClient = useQueryClient();
  const { data: contracts, isLoading: contractsLoading } = useQuery({
    queryKey: ["/api/contracts"],
  });

  // Create Contract dialog state
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [quoteSearch, setQuoteSearch] = useState("");
  const [selectedQuoteId, setSelectedQuoteId] = useState<string>("");
  const [contractForm, setContractForm] = useState({
    customerId: "",
    startDate: "",
    endDate: "",
    monthlyBase: "",
    blackRate: "",
    colorRate: "",
    terms: "",
  });

  // Fetch active/accepted quotes for building contracts
  const { data: availableQuotes = [], isLoading: quotesLoading } = useQuery({
    queryKey: ["/api/quotes", "contract-source", quoteSearch],
    enabled: isCreateOpen,
  });

  // Fetch line items when a quote is selected
  const { data: quoteLineItems = [], isLoading: lineItemsLoading } = useQuery({
    queryKey: ["/api/quotes", selectedQuoteId, "line-items"],
    enabled: !!selectedQuoteId,
  });

  useEffect(() => {
    // When quote changes, prefill customer and dates if present
    if (!selectedQuoteId) return;
    const quote = (availableQuotes as any[]).find(
      (q) => q.id === selectedQuoteId
    );
    if (quote) {
      setContractForm((prev) => ({
        ...prev,
        customerId: quote.customerId || prev.customerId,
        startDate: prev.startDate || format(new Date(), "yyyy-MM-dd"),
        endDate:
          prev.endDate ||
          format(
            new Date(new Date().setFullYear(new Date().getFullYear() + 1)),
            "yyyy-MM-dd"
          ),
      }));
    }
  }, [selectedQuoteId, availableQuotes]);

  const createContractMutation = useMutation({
    mutationFn: async () => {
      const payload: any = {
        customerId:
          contractForm.customerId ||
          (availableQuotes as any[]).find((q) => q.id === selectedQuoteId)
            ?.customerId,
        startDate: contractForm.startDate,
        endDate: contractForm.endDate,
        monthlyBase: contractForm.monthlyBase
          ? Number(contractForm.monthlyBase)
          : undefined,
        blackRate: contractForm.blackRate
          ? Number(contractForm.blackRate)
          : undefined,
        colorRate: contractForm.colorRate
          ? Number(contractForm.colorRate)
          : undefined,
        status: "active",
        sourceQuoteId: selectedQuoteId || undefined,
        terms: contractForm.terms,
      };
      const res = await fetch("/api/contracts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const msg = await res.text();
        throw new Error(msg || "Failed to create contract");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/contracts"] });
      setIsCreateOpen(false);
      setSelectedQuoteId("");
    },
  });

  const getStatusVariant = (status: string) => {
    switch (status) {
      case "active":
        return "default";
      case "expired":
        return "destructive";
      case "pending":
        return "secondary";
      default:
        return "outline";
    }
  };

  if (contractsLoading) {
    return (
      <MainLayout
        title="Contracts"
        description="Manage service contracts and billing agreements"
      >
        <div className="grid gap-4">
          {[1, 2, 3].map((i) => (
            <Card key={i} className="animate-pulse">
              <CardContent className="p-6">
                <div className="h-4 bg-gray-200 rounded w-1/4 mb-2"></div>
                <div className="h-3 bg-gray-200 rounded w-1/2"></div>
              </CardContent>
            </Card>
          ))}
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout
      title="Contracts"
      description="Manage service contracts and billing agreements"
    >
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row justify-between gap-4">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
            <Input placeholder="Search contracts..." className="pl-10" />
          </div>
          <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
            <DialogTrigger asChild>
              <Button className="flex items-center gap-2">
                <Plus className="h-4 w-4" />
                New Contract
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-4xl">
              <DialogHeader>
                <DialogTitle>Create Contract</DialogTitle>
              </DialogHeader>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Quote selector */}
                <Card className="md:col-span-1">
                  <CardHeader>
                    <CardTitle className="text-sm">
                      Select Quote (optional)
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                      <Input
                        value={quoteSearch}
                        onChange={(e) => setQuoteSearch(e.target.value)}
                        placeholder="Search quotes..."
                        className="pl-10"
                      />
                    </div>
                    <div className="max-h-64 overflow-y-auto border rounded p-2 space-y-2">
                      {quotesLoading ? (
                        <div className="flex items-center justify-center py-8">
                          <Loader2 className="h-5 w-5 animate-spin" />
                        </div>
                      ) : (
                        (availableQuotes as any[])
                          .filter((q) =>
                            quoteSearch
                              ? (q.title || "")
                                  .toLowerCase()
                                  .includes(quoteSearch.toLowerCase()) ||
                                (q.quoteNumber || "")
                                  .toLowerCase()
                                  .includes(quoteSearch.toLowerCase())
                              : true
                          )
                          .map((q) => (
                            <button
                              key={q.id}
                              className={cn(
                                "w-full text-left rounded border p-2 hover:bg-muted",
                                selectedQuoteId === q.id &&
                                  "ring-2 ring-primary"
                              )}
                              onClick={() => setSelectedQuoteId(q.id)}
                            >
                              <div className="flex items-center justify-between">
                                <div>
                                  <div className="font-medium">
                                    {q.quoteNumber} — {q.title}
                                  </div>
                                  <div className="text-xs text-gray-600">
                                    ${"{"}(q.totalAmount ?? 0){"}"}
                                  </div>
                                </div>
                                <Badge className="capitalize">{q.status}</Badge>
                              </div>
                            </button>
                          ))
                      )}
                    </div>
                  </CardContent>
                </Card>

                {/* Contract form */}
                <Card className="md:col-span-2">
                  <CardHeader>
                    <CardTitle className="text-sm">Contract Details</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <Input
                        placeholder="Customer ID"
                        value={contractForm.customerId}
                        onChange={(e) =>
                          setContractForm((p) => ({
                            ...p,
                            customerId: e.target.value,
                          }))
                        }
                      />
                      <div className="grid grid-cols-2 gap-3">
                        <Input
                          type="date"
                          value={contractForm.startDate}
                          onChange={(e) =>
                            setContractForm((p) => ({
                              ...p,
                              startDate: e.target.value,
                            }))
                          }
                        />
                        <Input
                          type="date"
                          value={contractForm.endDate}
                          onChange={(e) =>
                            setContractForm((p) => ({
                              ...p,
                              endDate: e.target.value,
                            }))
                          }
                        />
                      </div>
                      <div className="grid grid-cols-3 gap-3">
                        <Input
                          type="number"
                          step="0.01"
                          placeholder="Monthly Base"
                          value={contractForm.monthlyBase}
                          onChange={(e) =>
                            setContractForm((p) => ({
                              ...p,
                              monthlyBase: e.target.value,
                            }))
                          }
                        />
                        <Input
                          type="number"
                          step="0.0001"
                          placeholder="Black Rate"
                          value={contractForm.blackRate}
                          onChange={(e) =>
                            setContractForm((p) => ({
                              ...p,
                              blackRate: e.target.value,
                            }))
                          }
                        />
                        <Input
                          type="number"
                          step="0.0001"
                          placeholder="Color Rate"
                          value={contractForm.colorRate}
                          onChange={(e) =>
                            setContractForm((p) => ({
                              ...p,
                              colorRate: e.target.value,
                            }))
                          }
                        />
                      </div>
                      <Input
                        placeholder="Terms & conditions"
                        value={contractForm.terms}
                        onChange={(e) =>
                          setContractForm((p) => ({
                            ...p,
                            terms: e.target.value,
                          }))
                        }
                      />

                      {/* Quote line items preview */}
                      <div className="border rounded">
                        <div className="px-3 py-2 text-sm font-medium border-b">
                          Quote Items
                        </div>
                        <div className="max-h-56 overflow-y-auto">
                          {lineItemsLoading ? (
                            <div className="flex items-center justify-center py-6">
                              <Loader2 className="h-5 w-5 animate-spin" />
                            </div>
                          ) : (quoteLineItems as any[]).length > 0 ? (
                            <Table>
                              <TableHeader>
                                <TableRow>
                                  <TableHead>Description</TableHead>
                                  <TableHead className="w-24 text-right">
                                    Qty
                                  </TableHead>
                                  <TableHead className="w-24 text-right">
                                    Price
                                  </TableHead>
                                  <TableHead className="w-28 text-right">
                                    Total
                                  </TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {(quoteLineItems as any[]).map((li) => (
                                  <TableRow key={li.id}>
                                    <TableCell>
                                      {li.description || li.productName}
                                    </TableCell>
                                    <TableCell className="text-right">
                                      {li.quantity ?? 1}
                                    </TableCell>
                                    <TableCell className="text-right">
                                      {Number(
                                        li.unitPrice ?? li.price ?? 0
                                      ).toFixed(2)}
                                    </TableCell>
                                    <TableCell className="text-right">
                                      {Number(
                                        li.total ??
                                          (li.quantity ?? 1) *
                                            (li.unitPrice ?? li.price ?? 0)
                                      ).toFixed(2)}
                                    </TableCell>
                                  </TableRow>
                                ))}
                              </TableBody>
                            </Table>
                          ) : (
                            <div className="px-3 py-4 text-sm text-muted-foreground">
                              No quote selected or no items
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="flex justify-end gap-2 pt-2">
                        <Button
                          variant="outline"
                          onClick={() => setIsCreateOpen(false)}
                        >
                          Cancel
                        </Button>
                        <Button
                          onClick={() => createContractMutation.mutate()}
                          disabled={createContractMutation.isPending}
                        >
                          {createContractMutation.isPending && (
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          )}
                          Create Contract
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {contractsLoading ? (
          <div className="space-y-4">
            {[...Array(5)].map((_, i) => (
              <Card key={i} className="animate-pulse">
                <CardContent className="p-6">
                  <div className="flex justify-between items-start">
                    <div className="space-y-2 flex-1">
                      <div className="h-4 bg-gray-200 rounded w-1/3"></div>
                      <div className="h-3 bg-gray-200 rounded w-1/2"></div>
                      <div className="h-3 bg-gray-200 rounded w-1/4"></div>
                    </div>
                    <div className="h-6 bg-gray-200 rounded w-16"></div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : contracts && Array.isArray(contracts) && contracts.length > 0 ? (
          <div className="space-y-4">
            {Array.isArray(contracts) &&
              contracts.map((contract: any) => (
                <Card
                  key={contract.id}
                  className="hover:shadow-md transition-shadow"
                >
                  <CardContent className="p-6">
                    <div className="flex justify-between items-start mb-4">
                      <div className="flex items-start space-x-4">
                        <div className="w-10 h-10 bg-primary-100 rounded-lg flex items-center justify-center">
                          <FileText className="h-5 w-5 text-primary-600" />
                        </div>
                        <div className="flex-1">
                          <h3 className="font-semibold text-gray-900">
                            {contract.contractNumber}
                          </h3>
                          <p className="text-sm text-gray-600 mt-1">
                            Customer ID: {contract.customerId}
                          </p>
                          <div className="flex items-center gap-4 mt-2 text-sm text-gray-600">
                            <span>
                              Start:{" "}
                              {new Date(
                                contract.startDate
                              ).toLocaleDateString()}
                            </span>
                            <span>
                              End:{" "}
                              {new Date(contract.endDate).toLocaleDateString()}
                            </span>
                          </div>
                        </div>
                      </div>
                      <Badge
                        variant={getStatusVariant(contract.status)}
                        className="capitalize"
                      >
                        {contract.status}
                      </Badge>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4 pt-4 border-t border-gray-200">
                      <div>
                        <p className="text-xs text-gray-500 uppercase tracking-wide">
                          Monthly Base
                        </p>
                        <p className="text-lg font-semibold text-gray-900">
                          $
                          {contract.monthlyBase
                            ? Number(contract.monthlyBase).toFixed(2)
                            : "0.00"}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500 uppercase tracking-wide">
                          Black Rate
                        </p>
                        <p className="text-lg font-semibold text-gray-900">
                          $
                          {contract.blackRate
                            ? Number(contract.blackRate).toFixed(4)
                            : "0.0000"}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500 uppercase tracking-wide">
                          Color Rate
                        </p>
                        <p className="text-lg font-semibold text-gray-900">
                          $
                          {contract.colorRate
                            ? Number(contract.colorRate).toFixed(4)
                            : "0.0000"}
                        </p>
                      </div>
                    </div>

                    <div className="mt-4 flex gap-2">
                      <Button variant="outline" size="sm">
                        View Details
                      </Button>
                      <Button variant="outline" size="sm">
                        Edit Contract
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
          </div>
        ) : (
          <Card>
            <CardContent className="py-12">
              <div className="text-center">
                <FileText className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-gray-900 mb-2">
                  No contracts found
                </h3>
                <p className="text-gray-600 mb-6">
                  Create your first service contract to get started.
                </p>
                <Button className="flex items-center gap-2">
                  <Plus className="h-4 w-4" />
                  New Contract
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </MainLayout>
  );
}
