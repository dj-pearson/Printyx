import { Separator } from "@/components/ui/separator";

export default function Footer() {
  return (
    <footer className="border-t bg-background">
      <div className="container py-6">
        <div className="flex flex-col items-center justify-between gap-4 md:flex-row">
          <div className="flex flex-col items-center gap-4 px-8 md:flex-row md:gap-2 md:px-0">
            <p className="text-center text-sm leading-loose text-muted-foreground md:text-left">
              © 2025 Printyx. All rights reserved. Empowering copier dealers with unified business management.
            </p>
          </div>
          <div className="flex items-center space-x-4 text-sm text-muted-foreground">
            <span>v2.1.0</span>
            <Separator orientation="vertical" className="h-4" />
            <span>System Status: Online</span>
          </div>
        </div>
      </div>
    </footer>
  );
}