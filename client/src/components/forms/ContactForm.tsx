import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CalendarIcon, Search, Plus, X, AlertCircle } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

const contactSchema = z.object({
  salutation: z.string().optional(),
  firstName: z.string().min(1, "First name is required"),
  lastName: z.string().min(1, "Last name is required"),
  title: z.string().optional(),
  department: z.string().optional(),
  reportsTo: z.string().optional(),
  phone: z.string().optional(),
  mobile: z.string().optional(),
  email: z.string().email("Invalid email address").optional().or(z.literal("")),
  nextCallBack: z.date().optional(),
  isPrimaryContact: z.boolean().default(false),
  contactRoles: z.array(z.string()).default([]),
  notes: z.string().optional(),
});

type ContactFormData = z.infer<typeof contactSchema>;

interface ContactFormProps {
  companyId?: string;
  onSubmit: (data: ContactFormData) => void;
  onCancel: () => void;
  initialData?: Partial<ContactFormData>;
  isLoading?: boolean;
}

const salutationOptions = [
  { value: "mr", label: "Mr." },
  { value: "mrs", label: "Mrs." },
  { value: "ms", label: "Ms." },
  { value: "dr", label: "Dr." },
  { value: "prof", label: "Prof." },
];

const commonRoles = [
  "Decision Maker",
  "IT Manager",
  "Office Manager",
  "Procurement",
  "Finance Contact",
  "Technical Contact",
  "Executive Assistant",
  "Department Head",
];

export default function ContactForm({ 
  companyId, 
  onSubmit, 
  onCancel, 
  initialData, 
  isLoading = false 
}: ContactFormProps) {
  const [selectedRoles, setSelectedRoles] = useState<string[]>(initialData?.contactRoles || []);
  const [newRole, setNewRole] = useState("");
  const [reportsToSearch, setReportsToSearch] = useState("");

  const form = useForm<ContactFormData>({
    resolver: zodResolver(contactSchema),
    defaultValues: {
      salutation: initialData?.salutation || "",
      firstName: initialData?.firstName || "",
      lastName: initialData?.lastName || "",
      title: initialData?.title || "",
      department: initialData?.department || "",
      reportsTo: initialData?.reportsTo || "",
      phone: initialData?.phone || "",
      mobile: initialData?.mobile || "",
      email: initialData?.email || "",
      nextCallBack: initialData?.nextCallBack,
      isPrimaryContact: initialData?.isPrimaryContact || false,
      contactRoles: initialData?.contactRoles || [],
      notes: initialData?.notes || "",
    },
  });

  const handleSubmit = (data: ContactFormData) => {
    onSubmit({
      ...data,
      contactRoles: selectedRoles,
    });
  };

  const addRole = () => {
    if (newRole.trim() && !selectedRoles.includes(newRole.trim())) {
      setSelectedRoles([...selectedRoles, newRole.trim()]);
      setNewRole("");
    }
  };

  const removeRole = (role: string) => {
    setSelectedRoles(selectedRoles.filter(r => r !== role));
  };

  const addCommonRole = (role: string) => {
    if (!selectedRoles.includes(role)) {
      setSelectedRoles([...selectedRoles, role]);
    }
  };

  return (
    <Card className="w-full max-w-4xl mx-auto">
      <CardHeader>
        <CardTitle className="flex items-center">
          Contact Information
          {form.formState.errors.firstName && (
            <AlertCircle className="w-4 h-4 text-red-500 ml-2" />
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
            {/* Name Section */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-4">
                <div>
                  <Label htmlFor="salutation">Salutation</Label>
                  <FormField
                    control={form.control}
                    name="salutation"
                    render={({ field }) => (
                      <FormItem>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="--None--" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {salutationOptions.map((option) => (
                              <SelectItem key={option.value} value={option.value}>
                                {option.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={form.control}
                  name="firstName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>First Name</FormLabel>
                      <FormControl>
                        <Input placeholder="First Name" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="lastName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-red-600">* Last Name</FormLabel>
                      <FormControl>
                        <Input 
                          placeholder="Last Name" 
                          className={cn(
                            form.formState.errors.lastName && "border-red-500 focus:border-red-500"
                          )}
                          {...field} 
                        />
                      </FormControl>
                      <FormMessage className="text-red-600" />
                      {form.formState.errors.lastName && (
                        <p className="text-red-600 text-sm">Complete this field.</p>
                      )}
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="title"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Title</FormLabel>
                      <FormControl>
                        <Input placeholder="Title" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="department"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Department</FormLabel>
                      <FormControl>
                        <Input placeholder="Department" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div>
                  <Label htmlFor="reportsTo">Reports To</Label>
                  <div className="relative">
                    <Input
                      placeholder="Search Contacts..."
                      value={reportsToSearch}
                      onChange={(e) => setReportsToSearch(e.target.value)}
                    />
                    <Search className="absolute right-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <FormField
                  control={form.control}
                  name="phone"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Phone</FormLabel>
                      <FormControl>
                        <Input placeholder="515-242-7911" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="mobile"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Mobile</FormLabel>
                      <FormControl>
                        <Input placeholder="Mobile" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="nextCallBack"
                  render={({ field }) => (
                    <FormItem className="flex flex-col">
                      <FormLabel>Next Call Back</FormLabel>
                      <Popover>
                        <PopoverTrigger asChild>
                          <FormControl>
                            <Button
                              variant="outline"
                              className={cn(
                                "w-full pl-3 text-left font-normal",
                                !field.value && "text-muted-foreground"
                              )}
                            >
                              {field.value ? (
                                format(field.value, "PPP")
                              ) : (
                                <span>Pick a date</span>
                              )}
                              <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                            </Button>
                          </FormControl>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                          <Calendar
                            mode="single"
                            selected={field.value}
                            onSelect={field.onChange}
                            disabled={(date) =>
                              date < new Date(new Date().setHours(0, 0, 0, 0))
                            }
                            initialFocus
                          />
                        </PopoverContent>
                      </Popover>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Email</FormLabel>
                      <FormControl>
                        <Input placeholder="email@example.com" type="email" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="isPrimaryContact"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                      <FormControl>
                        <Checkbox
                          checked={field.value}
                          onCheckedChange={field.onChange}
                        />
                      </FormControl>
                      <div className="space-y-1 leading-none">
                        <FormLabel>Primary Contact</FormLabel>
                      </div>
                    </FormItem>
                  )}
                />
              </div>
            </div>

            {/* Contact Roles Section */}
            <div className="space-y-4">
              <Label>Contact Roles</Label>
              
              {/* Quick Add Common Roles */}
              <div className="flex flex-wrap gap-2">
                {commonRoles.map((role) => (
                  <Button
                    key={role}
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => addCommonRole(role)}
                    disabled={selectedRoles.includes(role)}
                    className="text-xs"
                  >
                    <Plus className="w-3 h-3 mr-1" />
                    {role}
                  </Button>
                ))}
              </div>

              {/* Custom Role Input */}
              <div className="flex gap-2">
                <Input
                  placeholder="Add custom role..."
                  value={newRole}
                  onChange={(e) => setNewRole(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addRole())}
                />
                <Button type="button" onClick={addRole} disabled={!newRole.trim()}>
                  <Plus className="w-4 h-4" />
                </Button>
              </div>

              {/* Selected Roles */}
              {selectedRoles.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {selectedRoles.map((role) => (
                    <div
                      key={role}
                      className="flex items-center gap-1 bg-blue-100 text-blue-800 px-2 py-1 rounded-md text-sm"
                    >
                      {role}
                      <button
                        type="button"
                        onClick={() => removeRole(role)}
                        className="ml-1 hover:bg-blue-200 rounded"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Notes Section */}
            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Notes</FormLabel>
                  <FormControl>
                    <Textarea 
                      placeholder="Additional notes about this contact..."
                      className="min-h-[100px]"
                      {...field} 
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Action Buttons */}
            <div className="flex justify-end space-x-4 pt-4 border-t">
              <Button
                type="button"
                variant="outline"
                onClick={onCancel}
                disabled={isLoading}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={isLoading}
              >
                {isLoading ? "Saving..." : "Save Contact"}
              </Button>
            </div>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}