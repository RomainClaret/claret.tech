"use client";

import { ExternalLink } from "lucide-react";

interface BlogCardProps {
  title: string;
  description: string;
  url: string;
  date?: string;
  image?: string;
}

export function BlogCard({
  title,
  description,
  url,
  date,
  image: _image,
}: BlogCardProps) {
  const truncateDescription = (text: string, maxLength: number = 150) => {
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength).trim() + "...";
  };

  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={`Read blog post: ${title} (opens in new tab)`}
      className="block group transform transition-all duration-200 hover:-translate-y-1"
    >
      <div className="relative bg-card border border-border rounded-lg p-6 h-full transition-all duration-300 hover:shadow-lg hover:border-primary/50">
        <div className="flex flex-col h-full">
          {/* Title */}
          <h3 className="text-xl font-semibold mb-2 group-hover:text-primary transition-colors line-clamp-2">
            {title}
          </h3>

          {/* Date */}
          {date && (
            <p className="text-sm text-muted-foreground mb-3">
              {new Date(date).toLocaleDateString("en-US", {
                year: "numeric",
                month: "long",
                day: "numeric",
              })}
            </p>
          )}

          {/* Description */}
          <p className="text-muted-foreground mb-4 flex-grow line-clamp-3">
            {truncateDescription(description)}
          </p>

          {/* Read more indicator */}
          <div className="flex items-center text-sm text-primary opacity-0 group-hover:opacity-100 transition-opacity">
            <span>Read more</span>
            <ExternalLink className="w-3 h-3 ml-1" aria-hidden="true" />
          </div>
        </div>

        {/* Corner arrow decoration */}
        <div className="absolute top-0 right-0 w-0 h-0 border-t-[40px] border-t-primary/10 border-l-[40px] border-l-transparent opacity-0 group-hover:opacity-100 transition-opacity">
          <div className="absolute -top-[35px] -right-[2px] text-primary/60">
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              aria-hidden="true"
            >
              <path d="M7 17L17 7M17 7H7M17 7V17" />
            </svg>
          </div>
        </div>
      </div>
    </a>
  );
}
