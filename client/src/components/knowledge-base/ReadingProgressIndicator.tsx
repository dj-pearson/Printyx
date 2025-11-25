import { useState, useEffect } from "react";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";

interface ReadingProgressIndicatorProps {
  className?: string;
  showPercentage?: boolean;
  position?: "top" | "bottom";
  color?: "blue" | "green" | "purple";
}

export default function ReadingProgressIndicator({
  className,
  showPercentage = false,
  position = "top",
  color = "blue",
}: ReadingProgressIndicatorProps) {
  const [progress, setProgress] = useState(0);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const calculateProgress = () => {
      const windowHeight = window.innerHeight;
      const documentHeight = document.documentElement.scrollHeight;
      const scrollTop = window.scrollY;

      // Calculate how far through the document we've scrolled
      const scrollPercentage =
        (scrollTop / (documentHeight - windowHeight)) * 100;

      setProgress(Math.min(100, Math.max(0, scrollPercentage)));

      // Show indicator after scrolling past 50px
      setIsVisible(scrollTop > 50);
    };

    // Calculate on mount
    calculateProgress();

    // Update on scroll
    window.addEventListener("scroll", calculateProgress);
    // Update on resize (content height might change)
    window.addEventListener("resize", calculateProgress);

    return () => {
      window.removeEventListener("scroll", calculateProgress);
      window.removeEventListener("resize", calculateProgress);
    };
  }, []);

  const colorClasses = {
    blue: "bg-blue-500",
    green: "bg-green-500",
    purple: "bg-purple-500",
  };

  return (
    <>
      {/* Fixed Progress Bar */}
      <div
        className={cn(
          "fixed left-0 right-0 z-50 transition-opacity duration-300",
          position === "top" ? "top-0" : "bottom-0",
          isVisible ? "opacity-100" : "opacity-0",
          className
        )}
      >
        <div className="h-1 bg-gray-200 dark:bg-gray-800">
          <div
            className={cn(
              "h-full transition-all duration-150 ease-out",
              colorClasses[color]
            )}
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {/* Optional Percentage Display */}
      {showPercentage && isVisible && (
        <div
          className={cn(
            "fixed right-4 z-50 bg-white dark:bg-gray-800 shadow-lg rounded-full px-3 py-1.5 border border-gray-200 dark:border-gray-700 transition-all duration-300",
            position === "top" ? "top-4" : "bottom-4"
          )}
        >
          <div className="flex items-center gap-2">
            <div className={cn("w-2 h-2 rounded-full", colorClasses[color])} />
            <span className="text-xs font-medium text-gray-700 dark:text-gray-300">
              {Math.round(progress)}%
            </span>
          </div>
        </div>
      )}
    </>
  );
}

/**
 * Circular Progress Indicator variant
 */
export function CircularReadingProgress({
  size = 60,
  strokeWidth = 4,
  color = "blue",
}: {
  size?: number;
  strokeWidth?: number;
  color?: "blue" | "green" | "purple";
}) {
  const [progress, setProgress] = useState(0);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const calculateProgress = () => {
      const windowHeight = window.innerHeight;
      const documentHeight = document.documentElement.scrollHeight;
      const scrollTop = window.scrollY;

      const scrollPercentage =
        (scrollTop / (documentHeight - windowHeight)) * 100;

      setProgress(Math.min(100, Math.max(0, scrollPercentage)));
      setIsVisible(scrollTop > 100);
    };

    calculateProgress();
    window.addEventListener("scroll", calculateProgress);
    window.addEventListener("resize", calculateProgress);

    return () => {
      window.removeEventListener("scroll", calculateProgress);
      window.removeEventListener("resize", calculateProgress);
    };
  }, []);

  const colorMap = {
    blue: "#3b82f6",
    green: "#10b981",
    purple: "#a855f7",
  };

  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (progress / 100) * circumference;

  return (
    <div
      className={cn(
        "fixed bottom-8 right-8 z-50 transition-all duration-300",
        isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4 pointer-events-none"
      )}
    >
      <button
        onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
        className="relative group"
        aria-label="Scroll to top"
      >
        {/* Background Circle */}
        <div className="absolute inset-0 bg-white dark:bg-gray-800 rounded-full shadow-lg" />

        {/* SVG Progress Circle */}
        <svg width={size} height={size} className="relative transform -rotate-90">
          {/* Background circle */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke="currentColor"
            strokeWidth={strokeWidth}
            className="text-gray-200 dark:text-gray-700"
          />
          {/* Progress circle */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke={colorMap[color]}
            strokeWidth={strokeWidth}
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            strokeLinecap="round"
            className="transition-all duration-300"
          />
        </svg>

        {/* Center Icon */}
        <div className="absolute inset-0 flex items-center justify-center">
          <svg
            className="w-5 h-5 text-gray-600 dark:text-gray-300 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M5 10l7-7m0 0l7 7m-7-7v18"
            />
          </svg>
        </div>

        {/* Tooltip */}
        <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 px-2 py-1 bg-gray-900 dark:bg-gray-700 text-white text-xs rounded whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
          Back to top ({Math.round(progress)}%)
        </div>
      </button>
    </div>
  );
}
