"use client";

import { useRef, useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ResearchNode, ResearchNodeData } from "./research-node";
import { SynapticConnection } from "./synaptic-connection";
import { NeuralNetworkCanvas } from "./neural-network-canvas";
import { NetworkControls } from "./network-controls";
import { useNeuralNetwork } from "@/lib/hooks/useNeuralNetwork";
import { Publication } from "@/lib/api/fetch-publications";
import { Paper } from "@/data/sections/papers";
import { cn } from "@/lib/utils";
import { logWarning } from "@/lib/utils/dev-logger";

interface NeuralResearchNetworkProps {
  publications: Publication[];
  staticPapers: Paper[];
  totalCitations: number;
  className?: string;
  onOpenPDF: (url: string, title: string, fileName: string) => void;
}

export function NeuralResearchNetwork({
  publications,
  staticPapers,
  totalCitations,
  className,
  onOpenPDF,
}: NeuralResearchNetworkProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 800, height: 600 });

  // Update dimensions on resize
  useEffect(() => {
    const updateDimensions = () => {
      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        setDimensions({ width: rect.width, height: rect.height });
      }
    };

    updateDimensions();
    window.addEventListener("resize", updateDimensions);
    return () => window.removeEventListener("resize", updateDimensions);
  }, []);

  const {
    filteredGraph,
    selectedNode,
    highlightedNode,
    connectedNodes,
    viewMode,
    isFullscreen,
    isLoading,
    setSelectedNode,
    setHighlightedNode,
    setViewMode,
    setFilters,
    setFullscreen,
    exportVisualization,
  } = useNeuralNetwork({
    publications,
    staticPapers,
    containerWidth: dimensions.width,
    containerHeight: dimensions.height,
  });

  // Handle node click to open PDF
  const handleNodeClick = (node: ResearchNodeData) => {
    setSelectedNode(node);

    // Check if node has PDF
    if (node.pdfUrl) {
      const fileName = node.title.replace(/[^a-zA-Z0-9]/g, "_") + ".pdf";
      onOpenPDF(node.pdfUrl, node.title, fileName);
    }
  };

  const totalPapers = publications.length + staticPapers.length;

  return (
    <div
      ref={containerRef}
      className={cn(
        "relative w-full",
        isFullscreen && "fixed inset-0 z-50 bg-background",
        className,
      )}
      style={{
        height: isFullscreen ? "100vh" : "80vh",
        minHeight: "600px",
      }}
    >
      {/* Background neural network */}
      <NeuralNetworkCanvas
        className="absolute inset-0"
        nodeCount={30}
        connectionDistance={200}
        animationSpeed={0.3}
        color="139, 92, 246"
        opacity={0.1}
        interactive={false}
      />

      {/* Controls */}
      <NetworkControls
        viewMode={viewMode}
        onViewModeChange={setViewMode}
        onFilterChange={setFilters}
        onExport={exportVisualization}
        isFullscreen={isFullscreen}
        onFullscreenToggle={() => setFullscreen(!isFullscreen)}
        totalPapers={totalPapers}
        totalCitations={totalCitations}
        className="absolute top-4 left-4 right-4 z-30"
      />

      {/* Loading state */}
      <AnimatePresence>
        {isLoading && (
          <motion.div
            className="absolute inset-0 flex items-center justify-center bg-background/50 backdrop-blur-sm z-40"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <div className="flex flex-col items-center gap-4">
              <div className="w-16 h-16 rounded-full border-4 border-primary border-t-transparent animate-spin" />
              <p className="text-muted-foreground">
                Building neural network...
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Network visualization */}
      <AnimatePresence mode="wait">
        {viewMode === "network" && (
          <motion.div
            key="network"
            className="absolute inset-0 mt-24"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
          >
            <svg
              width={dimensions.width}
              height={dimensions.height - 96}
              className="absolute inset-0"
              style={{ touchAction: "none" }}
            >
              {/* Define filters */}
              <defs>
                <filter id="glow">
                  <feGaussianBlur stdDeviation="3" result="coloredBlur" />
                  <feMerge>
                    <feMergeNode in="coloredBlur" />
                    <feMergeNode in="SourceGraphic" />
                  </feMerge>
                </filter>
              </defs>

              {/* Render connections */}
              <g>
                {Array.from(filteredGraph.edges).map((edge, index) => {
                  const startNode = filteredGraph.nodes.get(edge.source);
                  const endNode = filteredGraph.nodes.get(edge.target);

                  // Validate nodes exist and have valid positions
                  if (!startNode || !endNode) return null;
                  if (
                    typeof startNode.x !== "number" ||
                    typeof startNode.y !== "number" ||
                    typeof endNode.x !== "number" ||
                    typeof endNode.y !== "number" ||
                    isNaN(startNode.x) ||
                    isNaN(startNode.y) ||
                    isNaN(endNode.x) ||
                    isNaN(endNode.y)
                  ) {
                    logWarning(
                      "NeuralResearchNetwork: Invalid node positions for edge",
                      "neural-research-network-edge-validation",
                    );
                    return null;
                  }

                  const isConnected =
                    connectedNodes.has(edge.source) &&
                    connectedNodes.has(edge.target);
                  const isHighlighted =
                    highlightedNode?.id === edge.source ||
                    highlightedNode?.id === edge.target ||
                    selectedNode?.id === edge.source ||
                    selectedNode?.id === edge.target;

                  // Make some connections automatically active for visual interest
                  const isDefaultActive = index < 3 || edge.strength > 0.7; // First 3 connections or very high strength
                  const shouldAutoActivate =
                    edge.strength > 0.5 || isDefaultActive;

                  return (
                    <SynapticConnection
                      key={`${edge.source}-${edge.target}-${index}`}
                      startNode={startNode}
                      endNode={endNode}
                      strength={edge.strength}
                      isActive={isConnected || isDefaultActive}
                      isHighlighted={isHighlighted}
                      gradientId={`gradient-${edge.source}-${edge.target}`}
                      bidirectional={edge.bidirectional}
                      autoActive={shouldAutoActivate}
                    />
                  );
                })}
              </g>
            </svg>

            {/* Render nodes */}
            <div className="absolute inset-0 mt-24 pointer-events-none">
              {Array.from(filteredGraph.nodes.values()).map((node, index) => (
                <div key={node.id} className="pointer-events-auto">
                  <ResearchNode
                    node={node}
                    isSelected={selectedNode?.id === node.id}
                    isHighlighted={highlightedNode?.id === node.id}
                    isConnected={connectedNodes.has(node.id)}
                    onSelect={handleNodeClick}
                    onHover={setHighlightedNode}
                    delay={index * 0.02}
                    viewMode={viewMode}
                  />
                </div>
              ))}
            </div>

            {/* Selected node details panel */}
            <AnimatePresence>
              {selectedNode && (
                <motion.div
                  className="absolute bottom-4 left-4 right-4 max-w-2xl mx-auto"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 20 }}
                >
                  <div className="bg-background/95 backdrop-blur-md rounded-lg shadow-xl border border-border/50 p-6">
                    <h3 className="text-lg font-semibold mb-2">
                      {selectedNode.title}
                    </h3>
                    <p className="text-sm text-muted-foreground mb-3">
                      {selectedNode.authors.join(", ")} • {selectedNode.year}
                    </p>
                    {selectedNode.abstract && (
                      <p className="text-sm text-muted-foreground line-clamp-3">
                        {selectedNode.abstract}
                      </p>
                    )}
                    <button
                      onClick={() => setSelectedNode(null)}
                      className="absolute top-2 right-2 p-1 rounded hover:bg-muted transition-colors"
                      aria-label="Close details"
                    >
                      ×
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
