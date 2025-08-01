import { ReactNode } from "react";
import Sidebar from "./sidebar";
import Header from "./header";
import Footer from "./footer";

interface LayoutProps {
  children: ReactNode;
}

export default function Layout({ children }: LayoutProps) {
  return (
    <div className="min-h-screen bg-background flex">
      <Sidebar />
      <div className="flex-1 flex flex-col">
        <Header />
        <main className="flex-1 p-6">
          {children}
        </main>
        <Footer />
      </div>
    </div>
  );
}