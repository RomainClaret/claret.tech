"use client";

import { cn } from "@/lib/utils";
import { useShouldReduceAnimations } from "@/lib/hooks/useSafari";

interface SafeLoadingSpinnerProps {
  className?: string;
  children?: React.ReactNode;
}

/**
 * Loading component that conditionally applies animate-pulse based on browser
 * Prevents performance issues on Safari by using static styles instead
 */
export function SafeLoadingSpinner({
  className,
  children,
}: SafeLoadingSpinnerProps) {
  const shouldReduceAnimations = useShouldReduceAnimations();

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <div
          className={cn(
            "h-8 w-48 bg-muted rounded mx-auto mb-4",
            !shouldReduceAnimations && "animate-pulse",
            className,
          )}
        />
        <div
          className={cn(
            "h-4 w-64 bg-muted rounded mx-auto",
            !shouldReduceAnimations && "animate-pulse",
          )}
        />
        {children}
      </div>
    </div>
  );
}
