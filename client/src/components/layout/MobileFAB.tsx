import React from "react";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";

export default function MobileFAB({ onClick, label = "New", className = "" }: { onClick?: () => void; label?: string; className?: string }) {
  return (
    <div className={`fixed bottom-4 right-4 sm:hidden ${className}`}>
      <Button onClick={onClick} className="rounded-full h-12 w-12 p-0 shadow-lg">
        <Plus className="h-6 w-6" />
        <span className="sr-only">{label}</span>
      </Button>
    </div>
  );
}


