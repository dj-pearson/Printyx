import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import {
  Search,
  Users,
  Plus,
  CheckCircle,
  Mail,
  MapPin,
  Building2,
  Linkedin,
  Phone,
  Briefcase,
  TrendingUp,
  AlertCircle,
  Loader2,
} from "lucide-react";

interface ApolloContact {
  id: string;
  apolloId: string;
  firstName: string;
  lastName: string;
  name: string;
  title: string;
  email: string | null;
  emailStatus: string | null;
  linkedinUrl: string | null;
  phoneNumbers: string[];
  organizationName: string;
  companyDomain: string;
  companySize: string;
  employeeCount: number;
  industry: string;
  companyLocation: string;
  seniority: string;
  departments: string[];
  functions: string[];
  tenantStatus?: string;
  addedToCrm?: boolean;
  tenantLeadId?: string;
}

interface SearchFilters {
  personTitles: string[];
  personSeniorities: string[];
  personDepartments: string[];
  personLocations: string[];
  contactEmailStatus: string[];
  organizationIndustries: string[];
  organizationNumEmployeesRanges: string[];
  page: number;
  perPage: number;
}

const SENIORITIES = [
  { value: "owner", label: "Owner" },
  { value: "founder", label: "Founder" },
  { value: "c_suite", label: "C-Suite" },
  { value: "vp", label: "VP" },
  { value: "director", label: "Director" },
  { value: "manager", label: "Manager" },
];

const DEPARTMENTS = [
  { value: "master_operations", label: "Operations" },
  { value: "master_information_technology", label: "IT" },
  { value: "master_finance", label: "Finance" },
  { value: "master_human_resources", label: "HR" },
  { value: "master_sales", label: "Sales" },
  { value: "master_marketing", label: "Marketing" },
];

const EMPLOYEE_RANGES = [
  { value: "1,10", label: "1-10" },
  { value: "11,50", label: "11-50" },
  { value: "51,200", label: "51-200" },
  { value: "201,500", label: "201-500" },
  { value: "501,1000", label: "501-1,000" },
  { value: "1001,10000", label: "1,001+" },
];

export default function ApolloLeadEnrichment() {
  const { toast } = useToast();
  const [selectedContacts, setSelectedContacts] = useState<Set<string>>(new Set());
  
  const [filters, setFilters] = useState<SearchFilters>({
    personTitles: [],
    personSeniorities: [],
    personDepartments: [],
    personLocations: [],
    contactEmailStatus: ["verified"],
    organizationIndustries: [],
    organizationNumEmployeesRanges: [],
    page: 1,
    perPage: 25,
  });

  const [locationInput, setLocationInput] = useState("");
  const [titleInput, setTitleInput] = useState("");
  const [searchResults, setSearchResults] = useState<any>(null);

  // Search leads mutation (POST request)
  const searchMutation = useMutation({
    mutationFn: async (searchFilters: SearchFilters) => {
      return await apiRequest("POST", "/api/apollo/search", searchFilters);
    },
    onSuccess: (data) => {
      setSearchResults(data);
    },
    onError: (error: any) => {
      toast({
        title: "Search Error",
        description: error.message || "Failed to search leads",
        variant: "destructive",
      });
    },
  });

  // Add single lead mutation
  const addSingleMutation = useMutation({
    mutationFn: async (contactId: string) => {
      return await apiRequest("POST", `/api/apollo/leads/${contactId}/add-to-crm`);
    },
    onSuccess: () => {
      toast({
        title: "Lead Added",
        description: "Lead successfully added to your CRM",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/apollo/search"] });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to add lead",
        variant: "destructive",
      });
    },
  });

  // Bulk add mutation
  const bulkAddMutation = useMutation({
    mutationFn: async (contactIds: string[]) => {
      return await apiRequest("POST", "/api/apollo/leads/bulk-add", { contactIds });
    },
    onSuccess: (data: any) => {
      toast({
        title: "Bulk Add Complete",
        description: `Added ${data.added} leads. Skipped ${data.skipped} duplicates.`,
      });
      setSelectedContacts(new Set());
      queryClient.invalidateQueries({ queryKey: ["/api/apollo/search"] });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to bulk add leads",
        variant: "destructive",
      });
    },
  });

  // Stats query
  const { data: stats } = useQuery({
    queryKey: ["/api/apollo/stats"],
  });

  const handleSearch = () => {
    searchMutation.mutate(filters);
  };

  const handleSeniorityToggle = (value: string) => {
    setFilters((prev) => ({
      ...prev,
      personSeniorities: prev.personSeniorities.includes(value)
        ? prev.personSeniorities.filter((s) => s !== value)
        : [...prev.personSeniorities, value],
    }));
  };

  const handleDepartmentToggle = (value: string) => {
    setFilters((prev) => ({
      ...prev,
      personDepartments: prev.personDepartments.includes(value)
        ? prev.personDepartments.filter((d) => d !== value)
        : [...prev.personDepartments, value],
    }));
  };

  const handleEmployeeRangeToggle = (value: string) => {
    setFilters((prev) => ({
      ...prev,
      organizationNumEmployeesRanges: prev.organizationNumEmployeesRanges.includes(value)
        ? prev.organizationNumEmployeesRanges.filter((r) => r !== value)
        : [...prev.organizationNumEmployeesRanges, value],
    }));
  };

  const handleAddLocation = () => {
    if (locationInput.trim()) {
      setFilters((prev) => ({
        ...prev,
        personLocations: [...prev.personLocations, locationInput.trim()],
      }));
      setLocationInput("");
    }
  };

  const handleAddTitle = () => {
    if (titleInput.trim()) {
      setFilters((prev) => ({
        ...prev,
        personTitles: [...prev.personTitles, titleInput.trim()],
      }));
      setTitleInput("");
    }
  };

  const handleContactToggle = (contactId: string) => {
    setSelectedContacts((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(contactId)) {
        newSet.delete(contactId);
      } else {
        newSet.add(contactId);
      }
      return newSet;
    });
  };

  const handleBulkAdd = () => {
    if (selectedContacts.size > 0) {
      bulkAddMutation.mutate(Array.from(selectedContacts));
    }
  };

  const contacts = searchResults?.contacts || [];
  const pagination = searchResults?.pagination;

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Apollo.io Lead Enrichment</h1>
          <p className="text-gray-600">
            Search for qualified leads and add them to your CRM
          </p>
        </div>
        {stats && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">API Usage (30 Days)</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-1 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600">Total Calls:</span>
                  <span className="font-semibold">{stats.totalCalls}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Credits Used:</span>
                  <span className="font-semibold">{stats.totalCreditsUsed}</span>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Search Filters */}
      <Card>
        <CardHeader>
          <CardTitle>Search Filters</CardTitle>
          <CardDescription>
            Define your ideal customer profile to find qualified leads
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Location */}
          <div className="space-y-2">
            <Label>Location</Label>
            <div className="flex gap-2">
              <Input
                placeholder="e.g., Des Moines, Iowa"
                value={locationInput}
                onChange={(e) => setLocationInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleAddLocation()}
                data-testid="input-location"
              />
              <Button onClick={handleAddLocation} size="sm" data-testid="button-add-location">
                Add
              </Button>
            </div>
            <div className="flex flex-wrap gap-2">
              {filters.personLocations.map((loc) => (
                <Badge key={loc} variant="secondary" data-testid={`badge-location-${loc}`}>
                  {loc}
                  <button
                    className="ml-2"
                    onClick={() =>
                      setFilters((prev) => ({
                        ...prev,
                        personLocations: prev.personLocations.filter((l) => l !== loc),
                      }))
                    }
                    data-testid={`button-remove-location-${loc}`}
                  >
                    ×
                  </button>
                </Badge>
              ))}
            </div>
          </div>

          {/* Job Title */}
          <div className="space-y-2">
            <Label>Job Titles</Label>
            <div className="flex gap-2">
              <Input
                placeholder="e.g., Office Manager, IT Director"
                value={titleInput}
                onChange={(e) => setTitleInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleAddTitle()}
                data-testid="input-job-title"
              />
              <Button onClick={handleAddTitle} size="sm" data-testid="button-add-title">
                Add
              </Button>
            </div>
            <div className="flex flex-wrap gap-2">
              {filters.personTitles.map((title) => (
                <Badge key={title} variant="secondary" data-testid={`badge-title-${title}`}>
                  {title}
                  <button
                    className="ml-2"
                    onClick={() =>
                      setFilters((prev) => ({
                        ...prev,
                        personTitles: prev.personTitles.filter((t) => t !== title),
                      }))
                    }
                    data-testid={`button-remove-title-${title}`}
                  >
                    ×
                  </button>
                </Badge>
              ))}
            </div>
          </div>

          {/* Seniority Level */}
          <div className="space-y-2">
            <Label>Seniority Level</Label>
            <div className="flex flex-wrap gap-3">
              {SENIORITIES.map((seniority) => (
                <label key={seniority.value} className="flex items-center space-x-2 cursor-pointer">
                  <Checkbox
                    checked={filters.personSeniorities.includes(seniority.value)}
                    onCheckedChange={() => handleSeniorityToggle(seniority.value)}
                    data-testid={`checkbox-seniority-${seniority.value}`}
                  />
                  <span className="text-sm">{seniority.label}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Department */}
          <div className="space-y-2">
            <Label>Department</Label>
            <div className="flex flex-wrap gap-3">
              {DEPARTMENTS.map((dept) => (
                <label key={dept.value} className="flex items-center space-x-2 cursor-pointer">
                  <Checkbox
                    checked={filters.personDepartments.includes(dept.value)}
                    onCheckedChange={() => handleDepartmentToggle(dept.value)}
                    data-testid={`checkbox-department-${dept.value}`}
                  />
                  <span className="text-sm">{dept.label}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Company Size */}
          <div className="space-y-2">
            <Label>Company Size (Employees)</Label>
            <div className="flex flex-wrap gap-3">
              {EMPLOYEE_RANGES.map((range) => (
                <label key={range.value} className="flex items-center space-x-2 cursor-pointer">
                  <Checkbox
                    checked={filters.organizationNumEmployeesRanges.includes(range.value)}
                    onCheckedChange={() => handleEmployeeRangeToggle(range.value)}
                    data-testid={`checkbox-employee-range-${range.value}`}
                  />
                  <span className="text-sm">{range.label}</span>
                </label>
              ))}
            </div>
          </div>

          <Button
            onClick={handleSearch}
            disabled={searchMutation.isPending}
            size="lg"
            className="w-full"
            data-testid="button-search"
          >
            {searchMutation.isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Searching...
              </>
            ) : (
              <>
                <Search className="mr-2 h-4 w-4" />
                Search Leads
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      {/* Search Results */}
      {searchResults && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Search Results</CardTitle>
                <CardDescription>
                  {pagination?.totalEntries || 0} leads found
                  {searchResults.fromCache && " (from cache)"}
                </CardDescription>
              </div>
              {selectedContacts.size > 0 && (
                <Button
                  onClick={handleBulkAdd}
                  disabled={bulkAddMutation.isPending}
                  data-testid="button-bulk-add"
                >
                  {bulkAddMutation.isPending ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Adding...
                    </>
                  ) : (
                    <>
                      <Plus className="mr-2 h-4 w-4" />
                      Add {selectedContacts.size} Selected
                    </>
                  )}
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {contacts.map((contact: ApolloContact) => (
                <Card key={contact.id} className="border" data-testid={`card-contact-${contact.apolloId}`}>
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between">
                      <div className="flex items-start space-x-4 flex-1">
                        <Checkbox
                          checked={selectedContacts.has(contact.apolloId)}
                          onCheckedChange={() => handleContactToggle(contact.apolloId)}
                          disabled={contact.addedToCrm}
                          data-testid={`checkbox-contact-${contact.apolloId}`}
                        />
                        <div className="flex-1 space-y-3">
                          <div>
                            <h3 className="font-semibold text-lg">{contact.name}</h3>
                            <p className="text-sm text-gray-600">{contact.title}</p>
                          </div>

                          <div className="grid grid-cols-2 gap-3 text-sm">
                            {contact.email && (
                              <div className="flex items-center gap-2">
                                <Mail className="h-4 w-4 text-gray-400" />
                                <span className="truncate">{contact.email}</span>
                                {contact.emailStatus === "verified" && (
                                  <CheckCircle className="h-4 w-4 text-green-600" />
                                )}
                              </div>
                            )}
                            {contact.phoneNumbers?.[0] && (
                              <div className="flex items-center gap-2">
                                <Phone className="h-4 w-4 text-gray-400" />
                                <span>{contact.phoneNumbers[0]}</span>
                              </div>
                            )}
                            {contact.organizationName && (
                              <div className="flex items-center gap-2">
                                <Building2 className="h-4 w-4 text-gray-400" />
                                <span className="truncate">{contact.organizationName}</span>
                              </div>
                            )}
                            {contact.companyLocation && (
                              <div className="flex items-center gap-2">
                                <MapPin className="h-4 w-4 text-gray-400" />
                                <span className="truncate">{contact.companyLocation}</span>
                              </div>
                            )}
                            {contact.industry && (
                              <div className="flex items-center gap-2">
                                <Briefcase className="h-4 w-4 text-gray-400" />
                                <span className="truncate">{contact.industry}</span>
                              </div>
                            )}
                            {contact.employeeCount && (
                              <div className="flex items-center gap-2">
                                <Users className="h-4 w-4 text-gray-400" />
                                <span>{contact.employeeCount} employees</span>
                              </div>
                            )}
                          </div>

                          <div className="flex flex-wrap gap-2">
                            {contact.seniority && (
                              <Badge variant="secondary">{contact.seniority}</Badge>
                            )}
                            {contact.departments?.map((dept) => (
                              <Badge key={dept} variant="outline">
                                {dept}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      </div>

                      <div className="ml-4">
                        {contact.addedToCrm ? (
                          <Badge variant="default" className="bg-green-600">
                            <CheckCircle className="mr-1 h-3 w-3" />
                            In CRM
                          </Badge>
                        ) : (
                          <Button
                            onClick={() => addSingleMutation.mutate(contact.apolloId)}
                            disabled={addSingleMutation.isPending}
                            size="sm"
                            data-testid={`button-add-single-${contact.apolloId}`}
                          >
                            {addSingleMutation.isPending ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <>
                                <Plus className="mr-1 h-4 w-4" />
                                Add to CRM
                              </>
                            )}
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
      )}
    </div>
  );
}
