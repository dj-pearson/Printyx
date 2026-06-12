import { useEffect, ReactNode } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { SidebarProvider, SidebarInset } from '@/components/ui/sidebar';
import { RoleAwareCollapsibleSidebar } from '@/components/layout/RoleAwareCollapsibleSidebar';
import Header from '@/components/layout/header';
import MobileBottomNav from '@/components/ui/mobile-bottom-nav';
import { CommandPalette, useCommandPalette } from '@/components/layout/command-palette';
import { SmartBreadcrumb } from '@/components/layout/smart-breadcrumb';
import {
  KeyboardShortcutsDialog,
  useKeyboardNavigation,
} from '@/components/layout/keyboard-shortcuts-dialog';

interface MainLayoutProps {
  children: ReactNode;
  title?: string;
  description?: string;
}

export function MainLayout({ children, title, description }: MainLayoutProps) {
  const { toast } = useToast();
  const { isAuthenticated, isLoading } = useAuth();
  const { open, setOpen } = useCommandPalette();

  // Enable keyboard navigation
  useKeyboardNavigation();

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      toast({
        title: 'Unauthorized',
        description: 'You are logged out. Logging in again...',
        variant: 'destructive',
      });
      setTimeout(() => {
        window.location.href = '/login';
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
    <SidebarProvider defaultOpen={true}>
      {/* Skip navigation links are rendered once at the App root (App.tsx) */}
      <div className="flex min-h-screen w-full bg-executive">
        {/* Global Components */}
        <CommandPalette open={open} onOpenChange={setOpen} />
        <KeyboardShortcutsDialog />

        {/* Integrated Sidebar Component - Works with SidebarProvider */}
        <nav id="sidebar-navigation" aria-label="Main navigation">
          <RoleAwareCollapsibleSidebar />
        </nav>

        <SidebarInset className="flex-1 flex flex-col overflow-hidden">
          <Header title={title} description={description} onSearchClick={() => setOpen(true)} />

          {/* Smart Breadcrumb Navigation with Quick Actions */}
          <SmartBreadcrumb />

          <main
            id="main-content"
            className="flex-1 overflow-auto"
            tabIndex={-1}
            aria-label="Main content"
          >
            <div className="p-4 sm:p-6 space-y-4 sm:space-y-6 pb-20 md:pb-6">{children}</div>
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
