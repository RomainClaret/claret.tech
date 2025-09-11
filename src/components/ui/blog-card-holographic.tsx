"use client";

import {
  ExternalLink,
  Calendar,
  BookOpen,
  Sparkles,
  Clock,
  User,
  Share2,
  Eye,
  ChevronDown,
} from "lucide-react";
import Image from "next/image";
import { HolographicCard } from "@/components/ui/holographic-card";
import { motion } from "framer-motion";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { useColorExtraction } from "@/lib/hooks/useColorExtraction";

interface BlogCardHolographicProps {
  title: string;
  description: string;
  url: string;
  date?: string;
  image?: string;
  index: number;
  color?: string;
  readingTime?: number;
  views?: number;
  author?: string;
}

// Blog category colors - optimized for better contrast
const BLOG_COLORS: Record<string, string> = {
  ai: "59, 130, 246", // Blue
  neuroevolution: "139, 92, 246", // Purple
  technology: "16, 185, 129", // Emerald
  research: "168, 85, 247", // Purple
  tutorial: "251, 146, 60", // Orange
  story: "236, 72, 153", // Pink
  default: "71, 85, 105", // Slate
};

// Detect blog category from title/description
function detectBlogCategory(title: string, description: string): string {
  const text = `${title} ${description}`.toLowerCase();

  if (
    text.includes("ai") ||
    text.includes("artificial intelligence") ||
    text.includes("machine learning")
  ) {
    return "ai";
  }
  if (
    text.includes("neural") ||
    text.includes("evolution") ||
    text.includes("geenns")
  ) {
    return "neuroevolution";
  }
  if (
    text.includes("research") ||
    text.includes("paper") ||
    text.includes("study")
  ) {
    return "research";
  }
  if (
    text.includes("tutorial") ||
    text.includes("how to") ||
    text.includes("guide")
  ) {
    return "tutorial";
  }
  if (
    text.includes("story") ||
    text.includes("tale") ||
    text.includes("journey")
  ) {
    return "story";
  }
  if (
    text.includes("story") ||
    text.includes("tech") ||
    text.includes("code") ||
    text.includes("software")
  ) {
    return "technology";
  }
  return "default";
}

// Detect article status
function detectArticleStatus(date?: string): {
  status: "new" | "recent" | "archive";
  label: string;
  color: string;
} {
  if (!date)
    return { status: "archive", label: "Archive", color: "107, 114, 128" };

  const postDate = new Date(date);
  const now = new Date();
  const daysDiff = Math.floor(
    (now.getTime() - postDate.getTime()) / (1000 * 60 * 60 * 24),
  );

  if (daysDiff <= 7) {
    return { status: "new", label: "New", color: "34, 197, 94" }; // Green
  } else if (daysDiff <= 30) {
    return { status: "recent", label: "Recent", color: "59, 130, 246" }; // Blue
  }
  return { status: "archive", label: "Archive", color: "107, 114, 128" }; // Gray
}

export function BlogCardHolographic({
  title,
  description,
  url,
  date,
  image,
  index,
  color: providedColor,
  readingTime = 5,
  views,
  author = "Romain Claret",
}: BlogCardHolographicProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  // Determine color based on category or use provided color
  const category = detectBlogCategory(title, description);
  const fallbackColor = BLOG_COLORS[category];

  // Always call the hook (React hooks rules), but only use it if no server color provided
  const { color: extractedColor } = useColorExtraction(
    providedColor ? "" : image || "", // Pass empty string if we have server color
    `rgb(${fallbackColor})`,
  );

  // Use server-provided color if available, otherwise use extracted color
  const finalColor = providedColor || extractedColor;

  // Format the color for use in the component (remove "rgb(" and ")")
  const nodeColor = finalColor.replace("rgb(", "").replace(")", "");

  const articleStatus = detectArticleStatus(date);

  return (
    <motion.div
      className="h-full group/card relative card-animation"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.1, duration: 0.5 }}
      whileHover={{ scale: 1.02 }}
    >
      <HolographicCard
        glowColor={nodeColor}
        className="h-full transition-all duration-300 blog-card-enhanced"
      >
        <div className="p-6 h-full flex flex-col">
          {/* Header with type badge */}
          <div className="flex items-start justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="relative group">
                {/* Icon glow background - enhanced on hover */}
                <div
                  className="absolute -inset-1 rounded-full blur-md opacity-30 group-hover:opacity-50 transition-opacity duration-500"
                  style={{ backgroundColor: `rgb(${nodeColor})` }}
                />
                <div
                  className="relative w-12 h-12 rounded-full flex items-center justify-center transform transition-all duration-500 group-hover:scale-110 group-hover:shadow-xl"
                  style={{ backgroundColor: `rgba(${nodeColor}, 0.1)` }}
                >
                  {category === "research" ? (
                    <Sparkles
                      className="w-6 h-6"
                      style={{ color: `rgb(${nodeColor})` }}
                    />
                  ) : category === "story" ? (
                    <BookOpen
                      className="w-6 h-6"
                      style={{ color: `rgb(${nodeColor})` }}
                    />
                  ) : (
                    <BookOpen
                      className="w-6 h-6"
                      style={{ color: `rgb(${nodeColor})` }}
                    />
                  )}
                </div>
                {/* Gentle breathing effect */}
                <motion.div
                  className="absolute inset-0 rounded-full pointer-events-none"
                  style={{
                    backgroundColor: `rgb(${nodeColor})`,
                    opacity: 0.1,
                  }}
                  animate={{
                    scale: [1, 1.15, 1],
                  }}
                  transition={{
                    duration: 4,
                    repeat: Infinity,
                    ease: "easeInOut",
                  }}
                />
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs text-muted-foreground capitalize">
                    {category === "default" ? "Blog Post" : category}
                  </span>
                  {/* Article status tag */}
                  <span
                    className="text-xs px-2 py-0.5 rounded-full font-medium"
                    style={{
                      backgroundColor: `rgba(${articleStatus.color}, 0.1)`,
                      color: `rgb(${articleStatus.color})`,
                      border: `1px solid rgba(${articleStatus.color}, 0.3)`,
                    }}
                  >
                    {articleStatus.label}
                  </span>
                </div>
                <p className="text-sm font-medium flex items-center gap-2">
                  {date && (
                    <>
                      <Calendar className="w-3 h-3" />
                      {new Date(date).toLocaleDateString("en-US", {
                        year: "numeric",
                        month: "short",
                        day: "numeric",
                      })}
                    </>
                  )}
                  <span className="text-muted-foreground">•</span>
                  <Clock className="w-3 h-3" />
                  {readingTime} min read
                </p>
              </div>
            </div>
          </div>

          {/* Image section */}
          {image && (
            <div className="relative w-full h-48 mb-4 overflow-hidden rounded-lg bg-muted/10">
              <Image
                src={image}
                alt={title}
                fill
                className="object-contain object-center"
                sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-background via-background/20 to-transparent opacity-60" />
            </div>
          )}

          {/* Title */}
          <h3 className="text-lg font-semibold mb-3 line-clamp-2 bg-gradient-to-r from-foreground to-foreground group-hover:from-primary group-hover:to-purple-600 bg-clip-text text-transparent transition-all duration-500">
            {title}
          </h3>

          {/* Author and stats */}
          <div className="space-y-1 mb-3">
            <div className="text-sm text-muted-foreground flex items-start gap-1">
              <User className="w-3 h-3 flex-shrink-0 mt-0.5" />
              <p className="line-clamp-1">{author}</p>
              {views && (
                <>
                  <span className="text-muted-foreground">•</span>
                  <Eye className="w-3 h-3" />
                  {views.toLocaleString()} views
                </>
              )}
            </div>
          </div>

          {/* Description with expand/collapse */}
          <div className="flex-1 mb-4">
            <div
              className={cn(
                "relative transition-all duration-300",
                isExpanded && "bg-muted/5 p-3 rounded-lg",
                isExpanded && `border-l-2`,
              )}
              style={{
                borderColor: isExpanded ? `rgb(${nodeColor})` : "transparent",
              }}
            >
              <p
                className={cn(
                  "text-sm text-muted-foreground transition-all duration-300",
                  isExpanded ? "" : "line-clamp-3",
                )}
              >
                {description}
              </p>
            </div>
            {description.length > 150 && (
              <button
                onClick={(e) => {
                  e.preventDefault();
                  setIsExpanded(!isExpanded);
                }}
                className="text-xs text-primary hover:underline mt-2 flex items-center gap-1 transition-all duration-300 hover:gap-2"
                aria-label={
                  isExpanded ? "Show less description" : "Read more description"
                }
              >
                {isExpanded ? "Show less" : "Read more"}
                <ChevronDown
                  className={cn(
                    "w-3 h-3 transition-transform duration-300",
                    isExpanded && "rotate-180",
                  )}
                />
              </button>
            )}
          </div>

          {/* Action buttons */}
          <div className="grid grid-cols-3 gap-2 mt-auto">
            <a
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              className="relative overflow-hidden flex items-center justify-center gap-1 text-xs px-3 py-2 rounded-lg transition-all duration-300 hover:scale-105 active:scale-95 group border"
              style={{
                backgroundColor: `rgba(${nodeColor}, 0.15)`,
                color: `rgb(${nodeColor})`,
                borderColor: `rgba(${nodeColor}, 0.3)`,
              }}
            >
              <div
                className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300"
                style={{
                  backgroundColor: `rgba(${nodeColor}, 0.2)`,
                }}
              />
              <span className="relative z-10">Read</span>
              <ExternalLink className="relative z-10 w-3 h-3 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform duration-300" />
            </a>
            <button
              onClick={(e) => {
                e.preventDefault();
                // Share functionality
                if (navigator.share) {
                  navigator.share({
                    title,
                    text: description,
                    url,
                  });
                }
              }}
              className="relative overflow-hidden flex items-center justify-center gap-1 text-xs px-3 py-2 rounded-lg transition-all duration-300 hover:scale-105 active:scale-95 group border"
              style={{
                backgroundColor: `rgba(${nodeColor}, 0.15)`,
                color: `rgb(${nodeColor})`,
                borderColor: `rgba(${nodeColor}, 0.3)`,
              }}
              aria-label="Share blog post"
            >
              <div
                className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300"
                style={{
                  backgroundColor: `rgba(${nodeColor}, 0.2)`,
                }}
              />
              <span className="relative z-10">Share</span>
              <Share2 className="relative z-10 w-3 h-3 group-hover:rotate-12 transition-transform duration-300" />
            </button>
            <a
              href={`https://medium.com/@romainclaret`}
              target="_blank"
              rel="noopener noreferrer"
              className="relative overflow-hidden flex items-center justify-center gap-1 text-xs px-3 py-2 rounded-lg transition-all duration-300 hover:scale-105 active:scale-95 group border"
              style={{
                backgroundColor: `rgba(${nodeColor}, 0.15)`,
                color: `rgb(${nodeColor})`,
                borderColor: `rgba(${nodeColor}, 0.3)`,
              }}
            >
              <div
                className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300"
                style={{
                  backgroundColor: `rgba(${nodeColor}, 0.2)`,
                }}
              />
              <span className="relative z-10">More</span>
              <Sparkles className="relative z-10 w-3 h-3 group-hover:rotate-12 transition-transform duration-300" />
            </a>
          </div>
        </div>
      </HolographicCard>
    </motion.div>
  );
}
