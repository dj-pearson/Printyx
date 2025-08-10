import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ExternalLink, RefreshCw, User, Building2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

// Mock data structure
interface BusinessRecord {
  id: string;
  companyName: string;
  recordType: string;
  status: string;
  createdAt: string;
}

interface MissingIdsResponse {
  records: BusinessRecord[];
  count: number;
}

interface BackfillResult {
  success: boolean;
  message: string;
  updatedCount: number;
}

interface GenerateResult {
  success: boolean;
  recordId: string;
  companyDisplayId: string;
  urlSlug: string;
  url: string;
}

interface SlugPreview {
  companyName: string;
  sampleDisplayId: string;
  urlSlug: string;
  previewUrl: string;
  note: string;
}

export default function CompanyIdsTest() {
  const [testCompanyName, setTestCompanyName] = useState("");
  const [recordType, setRecordType] = useState("customer");
  const queryClient = useQueryClient();
  const { toast } = useToast();

  // Query for records missing IDs
  const {
    data: missingIds,
    isLoading: loadingMissing,
    refetch: refetchMissing,
  } = useQuery({
    queryKey: ["/api/company-ids/missing-ids"],
    queryFn: async (): Promise<MissingIdsResponse> => {
      return await apiRequest("/api/company-ids/missing-ids");
    },
  });

  // Mutation for backfilling records
  const backfillMutation = useMutation({
    mutationFn: async (limit: number = 50): Promise<BackfillResult> => {
      return await apiRequest("/api/company-ids/backfill", "POST", { limit });
    },
    onSuccess: (data) => {
      toast({
        title: "Backfill Complete",
        description: data.message,
      });
      queryClient.invalidateQueries({
        queryKey: ["/api/company-ids/missing-ids"],
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Backfill Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Mutation for generating ID for specific record
  const generateMutation = useMutation({
    mutationFn: async (recordId: string): Promise<GenerateResult> => {
      return await apiRequest(`/api/company-ids/generate/${recordId}`, "POST");
    },
    onSuccess: (data) => {
      toast({
        title: "Company ID Generated",
        description: `New URL: ${data.url}`,
      });
      queryClient.invalidateQueries({
        queryKey: ["/api/company-ids/missing-ids"],
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Generation Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Query for URL slug preview
  const { data: slugPreview, isLoading: loadingPreview } = useQuery({
    queryKey: ["/api/company-ids/preview-slug", testCompanyName, recordType],
    queryFn: async (): Promise<SlugPreview> => {
      return await apiRequest("/api/company-ids/preview-slug", "POST", {
        companyName: testCompanyName,
        recordType,
      });
    },
    enabled: testCompanyName.length > 2,
  });

  return (
    <div className="space-y-6 p-6">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">
          Company ID System Test
        </h2>
        <p className="text-muted-foreground">
          Test the new company display ID and URL slug generation system
        </p>
      </div>

      {/* URL Preview Tool */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ExternalLink className="h-5 w-5" />
            URL Slug Preview
          </CardTitle>
          <CardDescription>
            Test how company names will be converted to URL-friendly slugs
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="company-name">Company Name</Label>
              <Input
                id="company-name"
                placeholder="e.g., New Customer Company"
                value={testCompanyName}
                onChange={(e) => setTestCompanyName(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="record-type">Record Type</Label>
              <select
                id="record-type"
                className="w-full p-2 border rounded-md"
                value={recordType}
                onChange={(e) => setRecordType(e.target.value)}
              >
                <option value="customer">Customer</option>
                <option value="lead">Lead</option>
              </select>
            </div>
          </div>

          {slugPreview && !loadingPreview && (
            <div className="p-4 bg-muted rounded-lg">
              <h4 className="font-semibold mb-2">Preview Result:</h4>
              <div className="space-y-2 text-sm">
                <div>
                  <span className="font-medium">Company:</span>{" "}
                  {slugPreview.companyName}
                </div>
                <div>
                  <span className="font-medium">Display ID:</span>{" "}
                  <code>{slugPreview.sampleDisplayId}</code>
                </div>
                <div>
                  <span className="font-medium">URL Slug:</span>{" "}
                  <code>{slugPreview.urlSlug}</code>
                </div>
                <div>
                  <span className="font-medium">Full URL:</span>{" "}
                  <code>{slugPreview.previewUrl}</code>
                </div>
                <div className="text-xs text-muted-foreground">
                  {slugPreview.note}
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Records Missing IDs */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5" />
            Records Missing Company IDs
            <Badge variant="secondary">{missingIds?.count || 0}</Badge>
          </CardTitle>
          <CardDescription>
            Business records that need company display IDs and URL slugs
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2 mb-4">
            <Button
              onClick={() => refetchMissing()}
              disabled={loadingMissing}
              variant="outline"
              size="sm"
            >
              <RefreshCw
                className={`h-4 w-4 mr-2 ${
                  loadingMissing ? "animate-spin" : ""
                }`}
              />
              Refresh
            </Button>
            <Button
              onClick={() => backfillMutation.mutate(50)}
              disabled={backfillMutation.isPending || !missingIds?.count}
              size="sm"
            >
              {backfillMutation.isPending ? "Processing..." : "Backfill All"}
            </Button>
          </div>

          {loadingMissing ? (
            <div>Loading records...</div>
          ) : missingIds?.records.length ? (
            <div className="space-y-2">
              {missingIds.records.slice(0, 10).map((record) => (
                <div
                  key={record.id}
                  className="flex items-center justify-between p-3 border rounded-lg"
                >
                  <div className="flex-1">
                    <div className="font-medium">
                      {record.companyName || "Unnamed Company"}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {record.recordType} • {record.status} •{" "}
                      {new Date(record.createdAt).toLocaleDateString()}
                    </div>
                  </div>
                  <Button
                    onClick={() => generateMutation.mutate(record.id)}
                    disabled={generateMutation.isPending}
                    size="sm"
                    variant="outline"
                  >
                    Generate ID
                  </Button>
                </div>
              ))}
              {missingIds.records.length > 10 && (
                <div className="text-sm text-muted-foreground text-center py-2">
                  Showing 10 of {missingIds.records.length} records
                </div>
              )}
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <User className="h-12 w-12 mx-auto mb-2 opacity-50" />
              <p>All records have company IDs assigned!</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
