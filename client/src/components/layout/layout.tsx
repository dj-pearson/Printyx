import { ReactNode } from 'react';
import RoleBasedSidebar from './role-based-sidebar';
import Header from './header';
import Footer from './footer';
import MobileBottomNav from '@/components/ui/mobile-bottom-nav';

interface LayoutProps {
  children: ReactNode;
}

export default function Layout({ children }: LayoutProps) {
  return (
    <div className="min-h-screen min-h-screen-safe bg-background flex">
      {/* Sidebar: hidden on mobile, visible on tablet and up */}
      <div className="hidden md:block">
        <RoleBasedSidebar />
      </div>

      <div className="flex-1 flex flex-col w-full">
        <Header />
        {/* Main content with responsive padding and bottom padding for mobile nav */}
        <main className="flex-1 p-4 sm:p-6 pb-20 md:pb-6">{children}</main>
        {/* Footer: hidden on mobile to save space */}
        <div className="hidden md:block">
          <Footer />
        </div>
      </div>

      {/* Mobile bottom navigation - only visible on mobile */}
      <div className="md:hidden">
        <MobileBottomNav />
      </div>
    </div>
  );
}
