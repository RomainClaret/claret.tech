"use client";

import { TypeWriter } from "@/components/ui/TypeWriter";
import { SocialLinks } from "@/components/ui/SocialLinks";
import { greeting } from "@/data/portfolio";
import { FileText, Mail } from "lucide-react";
import { ProtectedLucideIcon } from "@/components/ui/protected-lucide-icon";
import { cn } from "@/lib/utils";

interface IntroductionContentProps {
  onResumeClick: () => void;
  onContactClick: () => void;
  className?: string;
}

export function IntroductionContent({
  onResumeClick,
  onContactClick,
  className,
}: IntroductionContentProps) {
  return (
    <div className={cn("relative z-10", className)}>
      {/* Text content */}
      <div className="space-y-6">
        {/* Neural glow effect container */}
        <div className="relative">
          {/* Animated glow background */}
          <div
            className="absolute -inset-2 rounded-2xl blur-2xl opacity-20"
            style={{
              background:
                "linear-gradient(135deg, rgb(59, 130, 246), rgb(139, 92, 246))",
            }}
          />

          {/* Container with blur background */}
          <div className="relative rounded-2xl p-4 md:p-6 border-2 border-blue-200/20 dark:border-blue-800/20 bg-blue-50/85 dark:bg-slate-900/85">
            <div className="space-y-4">
              <h1 className="text-4xl md:text-5xl lg:text-6xl xl:text-7xl font-bold leading-tight">
                <span className="bg-gradient-to-r from-blue-600 via-purple-600 to-teal-600 bg-clip-text text-transparent">
                  <span className="whitespace-nowrap">Accuracy</span>{" "}
                  <span className="whitespace-nowrap">is a lie</span>
                </span>
              </h1>

              <div className="text-2xl md:text-2xl lg:text-3xl xl:text-4xl font-semibold text-gray-600 dark:text-gray-300 h-[6rem] md:h-[5.5rem] lg:h-[7.5rem] xl:h-[8.5rem] overflow-hidden leading-tight">
                <div className="mb-1">
                  <span className="text-gray-700 dark:text-gray-200">
                    {greeting.titleGreetingNewline}
                  </span>
                </div>
                <TypeWriter
                  strings={
                    greeting.titleGreetingTitleList.filter(
                      (item) => typeof item === "string",
                    ) as string[]
                  }
                  className="text-blue-600 dark:text-blue-400"
                />
              </div>
            </div>

            <p className="text-lg md:text-xl text-gray-600 dark:text-gray-300 leading-relaxed mt-6">
              {greeting.subTitle}
            </p>

            {/* Action buttons - centered */}
            <div className="flex flex-col sm:flex-row gap-4 justify-center mt-8">
              <button
                onClick={onResumeClick}
                className="inline-flex items-center justify-center gap-2 px-8 py-4 bg-gradient-to-r from-blue-600 to-purple-600 text-white font-semibold rounded-lg hover:from-blue-700 hover:to-purple-700 transition-all duration-300 transform hover:scale-105 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 shadow-lg"
                type="button"
              >
                <ProtectedLucideIcon Icon={FileText} className="w-5 h-5" />
                View Resume
              </button>

              <button
                onClick={onContactClick}
                className="inline-flex items-center justify-center gap-2 px-8 py-4 bg-transparent border-2 border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 font-semibold rounded-lg hover:border-blue-500 hover:text-blue-600 dark:hover:text-blue-400 transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
                type="button"
              >
                <ProtectedLucideIcon Icon={Mail} className="w-5 h-5" />
                Contact Me
              </button>
            </div>

            {/* Social links */}
            <div className="pt-8">
              <SocialLinks />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
