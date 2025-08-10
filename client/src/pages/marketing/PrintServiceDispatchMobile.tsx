import { useEffect } from "react";
import { useLocation } from "wouter";
import { useSeo } from "@/lib/useSeo";

export default function PrintServiceDispatchMobile() {
  const [pathname] = useLocation();
  useSeo(pathname);
  useEffect(() => {}, []);
  return (
    <div className="max-w-3xl mx-auto p-6 space-y-4">
      <h1 className="text-3xl font-semibold">
        Print Service Dispatch & Mobile
      </h1>
      <p className="text-gray-700">
        Optimize ticketing, dispatch, preventive maintenance and mobile field
        operations for print service teams.
      </p>
    </div>
  );
}
