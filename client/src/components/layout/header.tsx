import { Button } from "@/components/ui/button";
import { Plus, Bell } from "lucide-react";

interface HeaderProps {
  title?: string;
  description?: string;
}

export default function Header({ title = "Dashboard", description = "Welcome back, here's what's happening today" }: HeaderProps) {
  return (
    <header className="bg-white shadow-sm border-b border-gray-200 px-6 py-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">{title}</h2>
          <p className="text-sm text-gray-600 mt-1">{description}</p>
        </div>
        <div className="flex items-center space-x-4">
          <Button className="flex items-center space-x-2">
            <Plus className="h-4 w-4" />
            <span>New Ticket</span>
          </Button>
          <button className="relative p-2 text-gray-400 hover:text-gray-600">
            <Bell className="h-5 w-5" />
            <span className="absolute -top-1 -right-1 h-4 w-4 bg-red-500 rounded-full flex items-center justify-center text-xs text-white">
              3
            </span>
          </button>
        </div>
      </div>
    </header>
  );
}
