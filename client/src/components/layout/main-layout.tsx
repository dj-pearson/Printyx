import { ReactNode } from 'react';
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
import { SkipNavigation } from '@/components/accessibility/SkipNavigation';
import { AccessibilityWidget } from '@/components/accessibility/AccessibilityWidget';

interface MainLayoutProps {
  children: ReactNode;
  title?: string;
  description?: string;
}

export function MainLayout({ children, title, description }: MainLayoutProps) {
  const { open, setOpen } = useCommandPalette();

  // Enable keyboard navigation
  useKeyboardNavigation();

  return (
    <SidebarProvider defaultOpen={true}>
      {/* Skip Navigation for Keyboard Users - WCAG 2.1 Level A (2.4.1) */}
      <SkipNavigation
        links={[
          { id: 'main-content', label: 'Skip to main content' },
          { id: 'sidebar-navigation', label: 'Skip to navigation' },
          { id: 'search-input', label: 'Skip to search' },
        ]}
      />

      <div className="flex min-h-screen w-full bg-executive">
        <CommandPalette open={open} onOpenChange={setOpen} />
        <KeyboardShortcutsDialog />

        <nav id="sidebar-navigation" aria-label="Main navigation">
          <RoleAwareCollapsibleSidebar />
        </nav>

        <SidebarInset className="flex-1 flex flex-col overflow-hidden">
          <Header title={title} description={description} onSearchClick={() => setOpen(true)} />

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

        <div className="md:hidden">
          <MobileBottomNav />
        </div>
      </div>

      <AccessibilityWidget />
    </SidebarProvider>
  );
}

export default MainLayout;
