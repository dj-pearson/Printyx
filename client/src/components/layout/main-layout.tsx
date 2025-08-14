import { useEffect, ReactNode } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar";
import RoleBasedSidebar from "@/components/layout/role-based-sidebar";
import { RoleAwareCollapsibleSidebar } from "@/components/layout/RoleAwareCollapsibleSidebar";
import Header from "@/components/layout/header";
import MobileBottomNav from "@/components/ui/mobile-bottom-nav";

interface MainLayoutProps {
  children: ReactNode;
  title?: string;
  description?: string;
}

export function MainLayout({ children, title, description }: MainLayoutProps) {
  const { toast } = useToast();
  const { isAuthenticated, isLoading } = useAuth();

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      toast({
        title: "Unauthorized",
        description: "You are logged out. Logging in again...",
        variant: "destructive",
      });
      setTimeout(() => {
        window.location.href = "/api/login";
      }, 500);
      return;
    }
  }, [isAuthenticated, isLoading, toast]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-4 border-primary-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <SidebarProvider defaultOpen={false}>
      <div className="flex min-h-screen w-full bg-gray-50">
        {/* Integrated Sidebar Component - Works with SidebarProvider */}
        <RoleAwareCollapsibleSidebar />
        
        <SidebarInset className="flex-1 flex flex-col overflow-hidden">
          <Header title={title} description={description} />
          
          <main className="flex-1 overflow-auto">
            <div className="p-4 sm:p-6 space-y-4 sm:space-y-6 pb-20 md:pb-6">
              {children}
            </div>
          </main>
        </SidebarInset>
        
        {/* Mobile Bottom Navigation - Only show on small screens */}
        <div className="md:hidden">
          <MobileBottomNav />
        </div>
      </div>
    </SidebarProvider>
  );
}

export default MainLayout;