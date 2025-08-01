import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Printer } from "lucide-react";

const loginSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(1, "Password is required"),
});

type LoginForm = z.infer<typeof loginSchema>;

const testAccounts = [
  {
    label: "Root Admin",
    email: "Pearsonperformance@gmail.com",
    password: "Infomax1!",
    role: "System Administrator"
  },
  {
    label: "Director",
    email: "director@printyx.com",
    password: "director123",
    role: "Director"
  },
  {
    label: "Sales Manager",
    email: "sales.manager@printyx.com",
    password: "manager123",
    role: "Sales Manager"
  },
  {
    label: "Service Manager",
    email: "service.manager@printyx.com",
    password: "manager123",
    role: "Service Manager"
  },
  {
    label: "Team Lead",
    email: "team.lead@printyx.com",
    password: "lead123",
    role: "Team Lead"
  },
  {
    label: "Sales Rep",
    email: "sales.rep@printyx.com",
    password: "rep123",
    role: "Sales Representative"
  },
  {
    label: "Technician",
    email: "technician@printyx.com",
    password: "tech123",
    role: "Service Technician"
  }
];

export default function Login() {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);

  const form = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: "",
      password: "",
    },
  });

  const loginMutation = useMutation({
    mutationFn: async (data: LoginForm) => {
      return await apiRequest("/api/auth/login", {
        method: "POST",
        body: JSON.stringify(data),
      });
    },
    onSuccess: (data) => {
      toast({
        title: "Login successful",
        description: `Welcome back, ${data.user.firstName || data.user.email}!`,
      });
      // Invalidate auth query and reload
      queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
      setTimeout(() => {
        window.location.href = "/";
      }, 500);
    },
    onError: (error: any) => {
      toast({
        title: "Login failed",
        description: error.message || "Invalid email or password",
        variant: "destructive",
      });
    },
  });

  const onSubmit = async (data: LoginForm) => {
    setIsLoading(true);
    try {
      await loginMutation.mutateAsync(data);
    } finally {
      setIsLoading(false);
    }
  };

  const fillTestAccount = (account: typeof testAccounts[0]) => {
    form.setValue("email", account.email);
    form.setValue("password", account.password);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <div className="w-full max-w-4xl flex gap-8">
        {/* Login Form */}
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="flex items-center justify-center space-x-2 mb-4">
              <div className="w-10 h-10 bg-primary rounded-lg flex items-center justify-center">
                <Printer className="text-white h-6 w-6" />
              </div>
              <h1 className="text-2xl font-bold text-gray-900">Printyx</h1>
            </div>
            <CardTitle>Sign In</CardTitle>
            <CardDescription>
              Enter your credentials to access the copier management platform
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Email</FormLabel>
                      <FormControl>
                        <Input placeholder="Enter your email" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="password"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Password</FormLabel>
                      <FormControl>
                        <Input type="password" placeholder="Enter your password" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <Button 
                  type="submit" 
                  className="w-full" 
                  disabled={isLoading || loginMutation.isPending}
                >
                  {isLoading || loginMutation.isPending ? "Signing in..." : "Sign In"}
                </Button>
              </form>
            </Form>
          </CardContent>
        </Card>

        {/* Test Accounts */}
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>Demo Accounts</CardTitle>
            <CardDescription>
              Click any account below to auto-fill login credentials for testing different role levels
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {testAccounts.map((account, index) => (
                <Button
                  key={index}
                  variant="outline"
                  className="w-full justify-between text-left h-auto py-3"
                  onClick={() => fillTestAccount(account)}
                >
                  <div>
                    <div className="font-medium">{account.label}</div>
                    <div className="text-sm text-muted-foreground">{account.role}</div>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {account.email}
                  </div>
                </Button>
              ))}
            </div>
            <div className="mt-4 p-3 bg-blue-50 rounded-lg">
              <p className="text-sm text-blue-800">
                <strong>Testing RBAC:</strong> Each account has different permissions and data access levels. 
                Root Admin sees everything, while Sales Reps only see their assigned customers.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}