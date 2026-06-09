import React, { useState, useRef, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Building2,
  User,
  MapPin,
  Phone,
  Mail,
  Plus,
  Search,
  ChevronsUpDown,
  Check,
} from 'lucide-react';
import { apiRequest } from '@/lib/queryClient';
import { cn } from '@/lib/utils';

interface Company {
  id: string;
  companyName?: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
  address?: string;
  city?: string;
  state?: string;
  zipCode?: string;
  recordType: 'lead' | 'customer';
}

interface Contact {
  id: string;
  firstName: string;
  lastName: string;
  email?: string;
  phone?: string;
  title?: string;
  department?: string;
  isPrimary?: boolean;
}

interface CompanyContactSelectorProps {
  selectedCompany: Company | null;
  selectedContact: Contact | null;
  onCompanySelect: (company: Company) => void;
  onContactSelect: (contact: Contact | null) => void;
}

export default function CompanyContactSelector({
  selectedCompany,
  selectedContact,
  onCompanySelect,
  onContactSelect,
}: CompanyContactSelectorProps) {
  const [companySearchTerm, setCompanySearchTerm] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [companyOpen, setCompanyOpen] = useState(false);
  const [showNewCompanyDialog, setShowNewCompanyDialog] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Focus search input when popover opens
  useEffect(() => {
    if (companyOpen) {
      const timer = setTimeout(() => searchInputRef.current?.focus(), 50);
      return () => clearTimeout(timer);
    } else {
      setCompanySearchTerm('');
      setDebouncedSearch('');
    }
  }, [companyOpen]);

  // Debounce search term - wait 300ms after user stops typing before querying API
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(companySearchTerm.trim());
    }, 300);
    return () => clearTimeout(timer);
  }, [companySearchTerm]);

  // Server-side company search - queries the full database
  const {
    data: searchResults = [],
    isLoading: companiesLoading,
    isFetching: companiesFetching,
  } = useQuery<Company[]>({
    queryKey: ['/api/companies', 'search', debouncedSearch],
    queryFn: async () => {
      const params = new URLSearchParams({ limit: '50', includeContacts: 'false' });
      if (debouncedSearch) {
        params.set('search', debouncedSearch);
      }
      const response = await apiRequest(`/api/companies?${params.toString()}`, 'GET');
      const data = response?.data || response?.records || (Array.isArray(response) ? response : []);
      return Array.isArray(data) ? data : [];
    },
    // Only fetch when popover is open
    enabled: companyOpen,
    // Keep previous results visible while fetching new ones
    placeholderData: (prev) => prev,
  });

  // Fetch contacts for selected company
  const { data: contacts = [], isLoading: contactsLoading } = useQuery<Contact[]>({
    queryKey: [`/api/companies/${selectedCompany?.id}/contacts`],
    enabled: !!selectedCompany?.id,
    queryFn: async () => {
      const response = await apiRequest(`/api/companies/${selectedCompany!.id}/contacts`, 'GET');
      const data = Array.isArray(response) ? response : [];
      // Map snake_case fields from edge function to camelCase
      return data.map((c: any) => ({
        id: c.id,
        firstName: c.firstName || c.first_name || '',
        lastName: c.lastName || c.last_name || '',
        email: c.email || null,
        phone: c.phone || null,
        title: c.title || c.job_title || null,
        department: c.department || null,
        isPrimary: c.isPrimary || c.is_primary || c.is_primary_contact || false,
      }));
    },
  });

  // Auto-select the primary contact once contacts load (if none chosen yet).
  useEffect(() => {
    if (selectedCompany?.id && !selectedContact && contacts.length > 0) {
      const primary = contacts.find((c) => c.isPrimary);
      if (primary) onContactSelect(primary);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contacts, selectedCompany?.id]);

  // Normalized address (companies returns billing_*; business_records uses address_line1/postal_code).
  const c = selectedCompany as any;
  const companyStreet = c?.billing_address || c?.address_line1 || c?.address || '';
  const companyCity = c?.billing_city || c?.city || '';
  const companyState = c?.billing_state || c?.state || '';
  const companyZip = c?.billing_zip || c?.postal_code || c?.zipCode || '';

  const getCompanyDisplayName = (company: Company) => {
    return (
      company.companyName ||
      (company as any).business_name ||
      `${company.firstName || ''} ${company.lastName || ''}`.trim() ||
      'Unnamed Company'
    );
  };

  const getContactDisplayName = (contact: Contact) => {
    return `${contact.firstName} ${contact.lastName}`;
  };

  const handleCompanySelect = (company: Company) => {
    onCompanySelect(company);
    onContactSelect(null);
    setCompanyOpen(false);
  };

  const handleContactChange = (contactId: string) => {
    if (contactId === 'no-contact') {
      onContactSelect(null);
    } else {
      const contact = contacts.find((c) => c.id === contactId);
      onContactSelect(contact || null);
    }
  };

  return (
    <Card>
      <CardHeader className="p-4 sm:p-6">
        <CardTitle className="flex items-center gap-2 text-lg sm:text-xl">
          <Building2 className="h-5 w-5" />
          Company & Contact Information
        </CardTitle>
        <CardDescription className="text-sm">
          Select the company and primary contact for this quote
        </CardDescription>
      </CardHeader>
      <CardContent className="p-4 sm:p-6 space-y-4">
        {/* Company Selection - Searchable Combobox */}
        <div className="space-y-2">
          <Label className="text-sm font-medium">Company *</Label>
          <div className="flex gap-2">
            <Popover open={companyOpen} onOpenChange={setCompanyOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  role="combobox"
                  aria-expanded={companyOpen}
                  className="flex-1 min-h-[44px] justify-between font-normal"
                >
                  {selectedCompany ? (
                    <div className="flex items-center gap-2 truncate">
                      <Building2 className="h-4 w-4 shrink-0" />
                      <span className="truncate">{getCompanyDisplayName(selectedCompany)}</span>
                      {selectedCompany.city && selectedCompany.state && (
                        <span className="text-muted-foreground text-xs hidden sm:inline">
                          ({selectedCompany.city}, {selectedCompany.state})
                        </span>
                      )}
                    </div>
                  ) : (
                    <span className="text-muted-foreground">Search for a company...</span>
                  )}
                  <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent
                className="w-[var(--radix-popover-trigger-width)] p-0"
                align="start"
                side="bottom"
                sideOffset={4}
              >
                {/* Fixed search input at top */}
                <div className="p-2 border-b">
                  <div className="relative">
                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                      ref={searchInputRef}
                      placeholder="Type to search companies..."
                      value={companySearchTerm}
                      onChange={(e) => setCompanySearchTerm(e.target.value)}
                      className="pl-8 h-9"
                    />
                  </div>
                  <p className="text-xs text-muted-foreground mt-1.5 px-0.5">
                    {companiesFetching
                      ? 'Searching...'
                      : debouncedSearch
                        ? `${searchResults.length} result${searchResults.length !== 1 ? 's' : ''} found`
                        : 'Type to search all companies'}
                  </p>
                </div>

                {/* Scrollable results list */}
                <div className="max-h-[280px] overflow-y-auto">
                  {companiesLoading && !searchResults.length ? (
                    <div className="p-4 text-center text-sm text-muted-foreground">Loading...</div>
                  ) : !debouncedSearch && searchResults.length === 0 ? (
                    <div className="p-6 text-center text-sm text-muted-foreground">
                      <Search className="h-8 w-8 mx-auto mb-2 opacity-30" />
                      Start typing to search across all companies
                    </div>
                  ) : debouncedSearch && searchResults.length === 0 ? (
                    <div className="p-4 text-center text-sm text-muted-foreground">
                      No companies match "{debouncedSearch}"
                    </div>
                  ) : (
                    searchResults.map((company) => (
                      <button
                        key={company.id}
                        type="button"
                        className={cn(
                          'flex items-center gap-2 w-full px-3 py-2.5 text-left text-sm hover:bg-accent transition-colors cursor-pointer',
                          selectedCompany?.id === company.id && 'bg-accent',
                        )}
                        onClick={() => handleCompanySelect(company)}
                      >
                        <Check
                          className={cn(
                            'h-4 w-4 shrink-0',
                            selectedCompany?.id === company.id ? 'opacity-100' : 'opacity-0',
                          )}
                        />
                        <Building2 className="h-4 w-4 shrink-0 text-muted-foreground" />
                        <div className="min-w-0 flex-1">
                          <div className="font-medium truncate">
                            {getCompanyDisplayName(company)}
                          </div>
                          {company.city && company.state && (
                            <div className="text-xs text-muted-foreground truncate">
                              {company.city}, {company.state}
                            </div>
                          )}
                        </div>
                      </button>
                    ))
                  )}
                </div>
              </PopoverContent>
            </Popover>

            <Dialog open={showNewCompanyDialog} onOpenChange={setShowNewCompanyDialog}>
              <DialogTrigger asChild>
                <Button
                  variant="outline"
                  size="icon"
                  className="min-h-[44px] min-w-[44px] active:scale-[0.98] transition-transform"
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </DialogTrigger>
              <DialogContent className="w-[95vw] sm:max-w-md">
                <DialogHeader>
                  <DialogTitle>Add New Company</DialogTitle>
                  <DialogDescription>Create a new company record for this quote</DialogDescription>
                </DialogHeader>
                <div className="text-center p-4">
                  <p className="text-sm text-muted-foreground">
                    New company creation functionality would be implemented here
                  </p>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        {/* Selected Company Details */}
        {selectedCompany && (
          <div className="bg-muted/50 rounded-lg p-3 sm:p-4">
            <h4 className="text-sm font-semibold mb-2 flex items-center gap-2">
              <Building2 className="h-4 w-4" />
              Company Details
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs sm:text-sm">
              <div className="flex items-center gap-2">
                <Mail className="h-3 w-3 text-muted-foreground shrink-0" />
                <span className="truncate">{selectedCompany.email || 'No email'}</span>
              </div>
              <div className="flex items-center gap-2">
                <Phone className="h-3 w-3 text-muted-foreground shrink-0" />
                <span className="truncate">{selectedCompany.phone || 'No phone'}</span>
              </div>
              {companyStreet && (
                <div className="flex items-start gap-2 sm:col-span-2">
                  <MapPin className="h-3 w-3 text-muted-foreground mt-0.5 shrink-0" />
                  <div className="min-w-0">
                    <div className="break-words">{companyStreet}</div>
                    {companyCity && companyState && (
                      <div className="break-words">
                        {companyCity}, {companyState} {companyZip}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Contact Selection */}
        {selectedCompany && (
          <div className="space-y-2">
            <Label className="text-sm font-medium">Primary Contact</Label>
            <Select value={selectedContact?.id || 'no-contact'} onValueChange={handleContactChange}>
              <SelectTrigger className="min-h-[44px]">
                <SelectValue placeholder="Select a contact...">
                  {selectedContact && (
                    <div className="flex items-center gap-2">
                      <User className="h-4 w-4 shrink-0" />
                      <span className="truncate">{getContactDisplayName(selectedContact)}</span>
                      {selectedContact.title && (
                        <span className="text-muted-foreground text-sm hidden sm:inline truncate">
                          - {selectedContact.title}
                        </span>
                      )}
                    </div>
                  )}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {contactsLoading ? (
                  <div className="p-2 text-center text-muted-foreground">Loading contacts...</div>
                ) : contacts.length === 0 ? (
                  <div className="p-2 text-center text-muted-foreground">
                    No contacts found for this company
                  </div>
                ) : (
                  <>
                    <SelectItem value="no-contact">
                      <div className="flex items-center gap-2">
                        <User className="h-4 w-4" />
                        No specific contact
                      </div>
                    </SelectItem>
                    {contacts.map((contact) => (
                      <SelectItem key={contact.id} value={contact.id}>
                        <div className="flex items-center gap-2">
                          <User className="h-4 w-4" />
                          <div>
                            <div className="font-medium">
                              {getContactDisplayName(contact)}
                              {contact.isPrimary && (
                                <span className="ml-2 text-xs bg-primary text-primary-foreground px-1 rounded">
                                  Primary
                                </span>
                              )}
                            </div>
                            {contact.title && (
                              <div className="text-xs text-muted-foreground">
                                {contact.title}
                                {contact.department && ` - ${contact.department}`}
                              </div>
                            )}
                          </div>
                        </div>
                      </SelectItem>
                    ))}
                  </>
                )}
              </SelectContent>
            </Select>
          </div>
        )}

        {/* Selected Contact Details */}
        {selectedContact && (
          <div className="bg-muted/50 rounded-lg p-3 sm:p-4">
            <h4 className="text-sm font-semibold mb-2 flex items-center gap-2">
              <User className="h-4 w-4" />
              Contact Details
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs sm:text-sm">
              <div className="flex items-center gap-2">
                <Mail className="h-3 w-3 text-muted-foreground shrink-0" />
                <span className="truncate">{selectedContact.email || 'No email'}</span>
              </div>
              <div className="flex items-center gap-2">
                <Phone className="h-3 w-3 text-muted-foreground shrink-0" />
                <span className="truncate">{selectedContact.phone || 'No phone'}</span>
              </div>
              {selectedContact.title && (
                <div className="flex items-center gap-2">
                  <User className="h-3 w-3 text-muted-foreground shrink-0" />
                  <span className="truncate">{selectedContact.title}</span>
                </div>
              )}
              {selectedContact.department && (
                <div className="flex items-center gap-2">
                  <Building2 className="h-3 w-3 text-muted-foreground shrink-0" />
                  <span className="truncate">{selectedContact.department}</span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Billing Address Section */}
        {selectedCompany && companyStreet && (
          <div className="space-y-2">
            <Label className="text-sm font-medium">Billing Address</Label>
            <div className="bg-muted/50 rounded-lg p-3 sm:p-4">
              <div className="flex items-start gap-2">
                <MapPin className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                <div className="text-xs sm:text-sm min-w-0">
                  <div className="break-words">{companyStreet}</div>
                  {companyCity && companyState && (
                    <div className="break-words">
                      {companyCity}, {companyState} {companyZip}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
