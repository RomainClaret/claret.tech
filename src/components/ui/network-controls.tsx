"use client";

import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import {
  Network,
  Grid3X3,
  Filter,
  Calendar,
  TrendingUp,
  Search,
  X,
  SlidersHorizontal,
  Download,
  Maximize2,
  Minimize2,
} from "lucide-react";
import { useState } from "react";

interface NetworkControlsProps {
  viewMode: "network" | "grid";
  onViewModeChange: (mode: "network" | "grid") => void;
  onFilterChange: (filters: NetworkFilters) => void;
  onExport?: () => void;
  isFullscreen: boolean;
  onFullscreenToggle: () => void;
  totalPapers: number;
  totalCitations: number;
  className?: string;
}

export interface NetworkFilters {
  yearRange: [number, number];
  minCitations: number;
  searchQuery: string;
  showTheses: boolean;
  showPapers: boolean;
  showPosters: boolean;
}

export function NetworkControls({
  viewMode,
  onViewModeChange,
  onFilterChange,
  onExport,
  isFullscreen,
  onFullscreenToggle,
  totalPapers,
  totalCitations,
  className,
}: NetworkControlsProps) {
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState<NetworkFilters>({
    yearRange: [2010, new Date().getFullYear()],
    minCitations: 0,
    searchQuery: "",
    showTheses: true,
    showPapers: true,
    showPosters: true,
  });

  const handleFilterChange = (newFilters: Partial<NetworkFilters>) => {
    const updated = { ...filters, ...newFilters };
    setFilters(updated);
    onFilterChange(updated);
  };

  return (
    <motion.div
      className={cn(
        "relative z-10 bg-background/80 backdrop-blur-md rounded-lg shadow-xl border border-border/50",
        className,
      )}
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      {/* Main Controls Bar */}
      <div className="flex items-center justify-between p-4">
        {/* View Mode Toggle */}
        <div className="flex items-center gap-2">
          <div className="flex bg-muted rounded-md p-1">
            <button
              onClick={() => onViewModeChange("network")}
              className={cn(
                "px-3 py-1.5 rounded flex items-center gap-2 text-sm transition-all",
                viewMode === "network"
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground",
              )}
              aria-label="Network view"
            >
              <Network className="w-4 h-4" />
              <span className="hidden sm:inline">Network</span>
            </button>
            <button
              onClick={() => onViewModeChange("grid")}
              className={cn(
                "px-3 py-1.5 rounded flex items-center gap-2 text-sm transition-all",
                viewMode === "grid"
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground",
              )}
              aria-label="Grid view"
            >
              <Grid3X3 className="w-4 h-4" />
              <span className="hidden sm:inline">Grid</span>
            </button>
          </div>

          {/* Stats */}
          <div className="hidden md:flex items-center gap-4 ml-4 text-sm text-muted-foreground">
            <div className="flex items-center gap-1">
              <span className="font-semibold text-foreground">
                {totalPapers}
              </span>
              <span>papers</span>
            </div>
            <div className="w-px h-4 bg-border" />
            <div className="flex items-center gap-1">
              <span className="font-semibold text-foreground">
                {totalCitations}
              </span>
              <span>citations</span>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={cn(
              "p-2 rounded-md transition-colors",
              showFilters
                ? "bg-primary text-primary-foreground"
                : "hover:bg-muted",
            )}
            aria-label="Toggle filters"
          >
            {showFilters ? (
              <X className="w-4 h-4" />
            ) : (
              <SlidersHorizontal className="w-4 h-4" />
            )}
          </button>

          {onExport && (
            <button
              onClick={onExport}
              className="p-2 rounded-md hover:bg-muted transition-colors"
              aria-label="Export visualization"
            >
              <Download className="w-4 h-4" />
            </button>
          )}

          <button
            onClick={onFullscreenToggle}
            className="p-2 rounded-md hover:bg-muted transition-colors"
            aria-label={isFullscreen ? "Exit fullscreen" : "Enter fullscreen"}
          >
            {isFullscreen ? (
              <Minimize2 className="w-4 h-4" />
            ) : (
              <Maximize2 className="w-4 h-4" />
            )}
          </button>
        </div>
      </div>

      {/* Filters Panel */}
      <motion.div
        className="border-t border-border/50 overflow-hidden"
        initial={false}
        animate={{
          height: showFilters ? "auto" : 0,
          opacity: showFilters ? 1 : 0,
        }}
        transition={{ duration: 0.3 }}
      >
        <div className="p-4 space-y-4">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              type="text"
              id="papers-search"
              name="papers-search"
              autoComplete="search"
              placeholder="Search papers..."
              value={filters.searchQuery}
              onChange={(e) =>
                handleFilterChange({ searchQuery: e.target.value })
              }
              className="w-full pl-10 pr-3 py-2 bg-muted rounded-md text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Year Range */}
            <div>
              <label className="text-sm font-medium mb-2 flex items-center gap-2">
                <Calendar className="w-4 h-4" />
                Year Range
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  id="year-range-start"
                  name="year-range-start"
                  autoComplete="off"
                  min="2000"
                  max={new Date().getFullYear()}
                  value={filters.yearRange[0]}
                  onChange={(e) =>
                    handleFilterChange({
                      yearRange: [
                        parseInt(e.target.value),
                        filters.yearRange[1],
                      ],
                    })
                  }
                  className="w-20 px-2 py-1 bg-muted rounded text-sm text-center focus:outline-none focus:ring-2 focus:ring-primary"
                />
                <span className="text-muted-foreground">-</span>
                <input
                  type="number"
                  id="year-range-end"
                  name="year-range-end"
                  autoComplete="off"
                  min="2000"
                  max={new Date().getFullYear()}
                  value={filters.yearRange[1]}
                  onChange={(e) =>
                    handleFilterChange({
                      yearRange: [
                        filters.yearRange[0],
                        parseInt(e.target.value),
                      ],
                    })
                  }
                  className="w-20 px-2 py-1 bg-muted rounded text-sm text-center focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
            </div>

            {/* Min Citations */}
            <div>
              <label className="text-sm font-medium mb-2 flex items-center gap-2">
                <TrendingUp className="w-4 h-4" />
                Min Citations
              </label>
              <input
                type="number"
                id="min-citations"
                name="min-citations"
                autoComplete="off"
                min="0"
                value={filters.minCitations}
                onChange={(e) =>
                  handleFilterChange({
                    minCitations: parseInt(e.target.value) || 0,
                  })
                }
                className="w-full px-3 py-1 bg-muted rounded text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
          </div>

          {/* Paper Types */}
          <div>
            <label className="text-sm font-medium mb-2 flex items-center gap-2">
              <Filter className="w-4 h-4" />
              Paper Types
            </label>
            <div className="flex flex-wrap gap-2">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  id="show-theses"
                  name="show-theses"
                  autoComplete="off"
                  checked={filters.showTheses}
                  onChange={(e) =>
                    handleFilterChange({ showTheses: e.target.checked })
                  }
                  className="rounded border-muted-foreground text-primary focus:ring-primary"
                />
                <span className="text-sm">Theses</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  id="show-papers"
                  name="show-papers"
                  autoComplete="off"
                  checked={filters.showPapers}
                  onChange={(e) =>
                    handleFilterChange({ showPapers: e.target.checked })
                  }
                  className="rounded border-muted-foreground text-primary focus:ring-primary"
                />
                <span className="text-sm">Papers</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  id="show-posters"
                  name="show-posters"
                  autoComplete="off"
                  checked={filters.showPosters}
                  onChange={(e) =>
                    handleFilterChange({ showPosters: e.target.checked })
                  }
                  className="rounded border-muted-foreground text-primary focus:ring-primary"
                />
                <span className="text-sm">Posters</span>
              </label>
            </div>
          </div>

          {/* Quick Actions */}
          <div className="flex gap-2 pt-2">
            <button
              onClick={() =>
                handleFilterChange({
                  yearRange: [2010, new Date().getFullYear()],
                  minCitations: 0,
                  searchQuery: "",
                  showTheses: true,
                  showPapers: true,
                  showPosters: true,
                })
              }
              className="px-3 py-1.5 text-sm bg-muted hover:bg-muted/80 rounded-md transition-colors"
            >
              Reset Filters
            </button>
            <button
              onClick={() => handleFilterChange({ minCitations: 10 })}
              className="px-3 py-1.5 text-sm bg-muted hover:bg-muted/80 rounded-md transition-colors"
            >
              High Impact
            </button>
            <button
              onClick={() =>
                handleFilterChange({
                  yearRange: [
                    new Date().getFullYear() - 2,
                    new Date().getFullYear(),
                  ],
                })
              }
              className="px-3 py-1.5 text-sm bg-muted hover:bg-muted/80 rounded-md transition-colors"
            >
              Recent
            </button>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}
