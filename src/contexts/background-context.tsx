"use client";

import { createContext, useContext, useState, ReactNode, useMemo } from "react";

export interface GridNode {
  x: number; // Grid column
  y: number; // Grid row
  animationDelay: number;
}

export interface CurveLine {
  id: string;
  path: string; // SVG path string
  type: "quadratic" | "cubic";
}

export interface StraightLine {
  id: string;
  startX: number;
  startY: number;
  endX: number;
  endY: number;
  hasEndpoint: boolean;
}

export interface NeuralPattern {
  id: string;
  type: "triangle" | "square" | "pentagon" | "hexagon" | "star";
  nodes: Array<{
    gridX: number; // Grid column
    gridY: number; // Grid row
  }>;
  opacity: number;
}

export interface BackgroundData {
  nodes: GridNode[];
  curves: CurveLine[];
  lines: StraightLine[];
  neuralPatterns: NeuralPattern[];
  connections: Connection[];
}

export interface Connection {
  id: string;
  fromX: number;
  fromY: number;
  toX: number;
  toY: number;
  path: string;
  type: "straight" | "curved";
}

interface BackgroundContextType {
  backgroundData: BackgroundData | null;
  generateBackgroundData: (
    width: number,
    height: number,
    gridSize: number,
  ) => void;
}

const BackgroundContext = createContext<BackgroundContextType | undefined>(
  undefined,
);

// Helper function to generate random grid position
const randomGridPos = (max: number): number => {
  return Math.floor(Math.random() * max);
};

// Helper function to generate bezier curve path
const generateCurvePath = (
  startX: number,
  startY: number,
  endX: number,
  endY: number,
  gridSize: number,
  type: "quadratic" | "cubic",
): string => {
  if (type === "quadratic") {
    // Generate control point
    const controlX = (startX + endX) / 2 + (Math.random() - 0.5) * 4;
    const controlY = (startY + endY) / 2 + (Math.random() - 0.5) * 4;

    return `M${(startX * gridSize).toFixed(2)},${(startY * gridSize).toFixed(2)} Q${(controlX * gridSize).toFixed(2)},${(controlY * gridSize).toFixed(2)} ${(endX * gridSize).toFixed(2)},${(endY * gridSize).toFixed(2)}`;
  } else {
    // Generate two control points for cubic bezier
    const control1X =
      startX + (endX - startX) * 0.33 + (Math.random() - 0.5) * 3;
    const control1Y =
      startY + (endY - startY) * 0.33 + (Math.random() - 0.5) * 3;
    const control2X =
      startX + (endX - startX) * 0.66 + (Math.random() - 0.5) * 3;
    const control2Y =
      startY + (endY - startY) * 0.66 + (Math.random() - 0.5) * 3;

    return `M${(startX * gridSize).toFixed(2)},${(startY * gridSize).toFixed(2)} C${(control1X * gridSize).toFixed(2)},${(control1Y * gridSize).toFixed(2)} ${(control2X * gridSize).toFixed(2)},${(control2Y * gridSize).toFixed(2)} ${(endX * gridSize).toFixed(2)},${(endY * gridSize).toFixed(2)}`;
  }
};

export function BackgroundProvider({ children }: { children: ReactNode }) {
  const [backgroundData, setBackgroundData] = useState<BackgroundData | null>(
    null,
  );

  const generateBackgroundData = useMemo(
    () => (width: number, height: number, gridSize: number) => {
      const cols = Math.ceil(width / gridSize);
      const rows = Math.ceil(height / gridSize);

      // Generate random nodes (15-25)
      const nodeCount = 15 + Math.floor(Math.random() * 11);
      const nodes: GridNode[] = [];
      const usedPositions = new Set<string>();

      for (let i = 0; i < nodeCount; i++) {
        let x, y;
        let posKey;

        // Ensure unique positions
        do {
          x = randomGridPos(cols);
          y = randomGridPos(rows);
          posKey = `${x},${y}`;
        } while (usedPositions.has(posKey));

        usedPositions.add(posKey);

        nodes.push({
          x,
          y,
          animationDelay: Math.random() * 3,
        });
      }

      // Generate random curved lines (8-15)
      const curveCount = 8 + Math.floor(Math.random() * 8);
      const curves: CurveLine[] = [];

      for (let i = 0; i < curveCount; i++) {
        const startX = randomGridPos(cols);
        const startY = randomGridPos(rows);
        const endX = randomGridPos(cols);
        const endY = randomGridPos(rows);
        const type = Math.random() > 0.5 ? "quadratic" : "cubic";

        curves.push({
          id: `curve-${i}`,
          path: generateCurvePath(startX, startY, endX, endY, gridSize, type),
          type,
        });
      }

      // Generate random straight lines (10-20)
      const lineCount = 10 + Math.floor(Math.random() * 11);
      const lines: StraightLine[] = [];

      for (let i = 0; i < lineCount; i++) {
        const startX = randomGridPos(cols);
        const startY = randomGridPos(rows);

        // Determine orientation (horizontal, vertical, or diagonal)
        const orientation = Math.floor(Math.random() * 3);
        let endX, endY;

        const length = 2 + Math.floor(Math.random() * 7); // 2-8 grid cells

        switch (orientation) {
          case 0: // Horizontal
            endX = Math.min(startX + length, cols - 1);
            endY = startY;
            break;
          case 1: // Vertical
            endX = startX;
            endY = Math.min(startY + length, rows - 1);
            break;
          case 2: // Diagonal
            endX = Math.min(startX + length, cols - 1);
            endY = Math.min(startY + length, rows - 1);
            break;
          default:
            endX = startX;
            endY = startY;
        }

        lines.push({
          id: `line-${i}`,
          startX,
          startY,
          endX,
          endY,
          hasEndpoint: Math.random() > 0.5,
        });
      }

      // Generate neural patterns (2-4 for better performance)
      const patternCount = 2 + Math.floor(Math.random() * 3);
      const neuralPatterns: NeuralPattern[] = [];
      const occupiedCells = new Set<string>();

      // Helper to check if a cell is occupied
      const isCellOccupied = (x: number, y: number): boolean => {
        return occupiedCells.has(`${x},${y}`);
      };

      // Helper to mark cells as occupied
      const markCellsOccupied = (
        nodes: Array<{ gridX: number; gridY: number }>,
      ) => {
        nodes.forEach((node) => {
          occupiedCells.add(`${node.gridX},${node.gridY}`);
        });
      };

      // Generate patterns
      for (let i = 0; i < patternCount; i++) {
        const patternTypes: NeuralPattern["type"][] = [
          "triangle",
          "square",
          "pentagon",
          "hexagon",
          "star",
        ];
        const type =
          patternTypes[Math.floor(Math.random() * patternTypes.length)];

        let attempts = 0;
        let pattern: NeuralPattern | null = null;

        while (attempts < 50 && !pattern) {
          attempts++;

          // Find a center point that's not too close to edges
          const centerX = 2 + Math.floor(Math.random() * (cols - 4));
          const centerY = 2 + Math.floor(Math.random() * (rows - 4));

          if (isCellOccupied(centerX, centerY)) continue;

          let patternNodes: Array<{ gridX: number; gridY: number }> = [];

          switch (type) {
            case "triangle":
              // Equilateral triangle-ish pattern
              patternNodes = [
                { gridX: centerX, gridY: centerY - 1 },
                { gridX: centerX - 1, gridY: centerY + 1 },
                { gridX: centerX + 1, gridY: centerY + 1 },
              ];
              break;

            case "square":
              // 2x2 square
              const size = Math.random() > 0.5 ? 1 : 2;
              patternNodes = [
                { gridX: centerX - size, gridY: centerY - size },
                { gridX: centerX + size, gridY: centerY - size },
                { gridX: centerX + size, gridY: centerY + size },
                { gridX: centerX - size, gridY: centerY + size },
              ];
              break;

            case "pentagon":
              // Pentagon pattern
              patternNodes = [
                { gridX: centerX, gridY: centerY - 2 },
                { gridX: centerX + 2, gridY: centerY - 1 },
                { gridX: centerX + 1, gridY: centerY + 2 },
                { gridX: centerX - 1, gridY: centerY + 2 },
                { gridX: centerX - 2, gridY: centerY - 1 },
              ];
              break;

            case "hexagon":
              // Hexagon pattern
              patternNodes = [
                { gridX: centerX - 1, gridY: centerY - 1 },
                { gridX: centerX + 1, gridY: centerY - 1 },
                { gridX: centerX + 2, gridY: centerY },
                { gridX: centerX + 1, gridY: centerY + 1 },
                { gridX: centerX - 1, gridY: centerY + 1 },
                { gridX: centerX - 2, gridY: centerY },
              ];
              break;

            case "star":
              // Star pattern (center + 5 points)
              patternNodes = [
                { gridX: centerX, gridY: centerY }, // center
                { gridX: centerX, gridY: centerY - 2 },
                { gridX: centerX + 2, gridY: centerY },
                { gridX: centerX, gridY: centerY + 2 },
                { gridX: centerX - 2, gridY: centerY },
                { gridX: centerX + 1, gridY: centerY - 1 },
                { gridX: centerX + 1, gridY: centerY + 1 },
                { gridX: centerX - 1, gridY: centerY + 1 },
                { gridX: centerX - 1, gridY: centerY - 1 },
              ];
              break;
          }

          // Check if all nodes are within bounds and not occupied
          const isValid = patternNodes.every(
            (node) =>
              node.gridX >= 0 &&
              node.gridX < cols &&
              node.gridY >= 0 &&
              node.gridY < rows &&
              !isCellOccupied(node.gridX, node.gridY),
          );

          if (isValid) {
            pattern = {
              id: `pattern-${i}`,
              type,
              nodes: patternNodes,
              opacity: 0.1 + Math.random() * 0.2, // 0.1 to 0.3
            };
            markCellsOccupied(patternNodes);
            neuralPatterns.push(pattern);
          }
        }
      }

      // Generate connections from all elements
      const connections: Connection[] = [];

      // Add connections from straight lines
      lines.forEach((line, i) => {
        connections.push({
          id: `line-conn-${i}`,
          fromX: line.startX,
          fromY: line.startY,
          toX: line.endX,
          toY: line.endY,
          path: `M${(line.startX * gridSize).toFixed(2)},${(line.startY * gridSize).toFixed(2)} L${(line.endX * gridSize).toFixed(2)},${(line.endY * gridSize).toFixed(2)}`,
          type: "straight",
        });
      });

      // Add connections from curves
      curves.forEach((curve, i) => {
        // Extract start and end points from the path
        const pathMatch = curve.path.match(
          /M([\d.]+),([\d.]+).*\s([\d.]+),([\d.]+)$/,
        );
        if (pathMatch) {
          const startX = parseFloat(pathMatch[1]) / gridSize;
          const startY = parseFloat(pathMatch[2]) / gridSize;
          const endX = parseFloat(pathMatch[3]) / gridSize;
          const endY = parseFloat(pathMatch[4]) / gridSize;

          connections.push({
            id: `curve-conn-${i}`,
            fromX: startX,
            fromY: startY,
            toX: endX,
            toY: endY,
            path: `M${startX * gridSize},${startY * gridSize} ${curve.path.substring(curve.path.indexOf("Q") !== -1 ? curve.path.indexOf("Q") : curve.path.indexOf("C"))}`,
            type: "curved",
          });
        }
      });

      // Add connections from neural patterns
      neuralPatterns.forEach((pattern, patternIndex) => {
        if (pattern.type === "triangle") {
          // Triangle connections
          connections.push({
            id: `pattern-${patternIndex}-0`,
            fromX: pattern.nodes[0].gridX,
            fromY: pattern.nodes[0].gridY,
            toX: pattern.nodes[1].gridX,
            toY: pattern.nodes[1].gridY,
            path: `M${(pattern.nodes[0].gridX * gridSize).toFixed(2)},${(pattern.nodes[0].gridY * gridSize).toFixed(2)} L${(pattern.nodes[1].gridX * gridSize).toFixed(2)},${(pattern.nodes[1].gridY * gridSize).toFixed(2)}`,
            type: "straight",
          });
          connections.push({
            id: `pattern-${patternIndex}-1`,
            fromX: pattern.nodes[1].gridX,
            fromY: pattern.nodes[1].gridY,
            toX: pattern.nodes[2].gridX,
            toY: pattern.nodes[2].gridY,
            path: `M${(pattern.nodes[1].gridX * gridSize).toFixed(2)},${(pattern.nodes[1].gridY * gridSize).toFixed(2)} L${(pattern.nodes[2].gridX * gridSize).toFixed(2)},${(pattern.nodes[2].gridY * gridSize).toFixed(2)}`,
            type: "straight",
          });
          connections.push({
            id: `pattern-${patternIndex}-2`,
            fromX: pattern.nodes[2].gridX,
            fromY: pattern.nodes[2].gridY,
            toX: pattern.nodes[0].gridX,
            toY: pattern.nodes[0].gridY,
            path: `M${(pattern.nodes[2].gridX * gridSize).toFixed(2)},${(pattern.nodes[2].gridY * gridSize).toFixed(2)} L${(pattern.nodes[0].gridX * gridSize).toFixed(2)},${(pattern.nodes[0].gridY * gridSize).toFixed(2)}`,
            type: "straight",
          });
        } else if (pattern.type === "star") {
          // Star connections (center to all points)
          const center = pattern.nodes[0];
          pattern.nodes.slice(1).forEach((node, i) => {
            connections.push({
              id: `pattern-${patternIndex}-star-${i}`,
              fromX: center.gridX,
              fromY: center.gridY,
              toX: node.gridX,
              toY: node.gridY,
              path: `M${(center.gridX * gridSize).toFixed(2)},${(center.gridY * gridSize).toFixed(2)} L${(node.gridX * gridSize).toFixed(2)},${(node.gridY * gridSize).toFixed(2)}`,
              type: "straight",
            });
          });
        } else {
          // For other shapes, connect adjacent nodes
          pattern.nodes.forEach((node, i) => {
            const nextNode = pattern.nodes[(i + 1) % pattern.nodes.length];
            connections.push({
              id: `pattern-${patternIndex}-${i}`,
              fromX: node.gridX,
              fromY: node.gridY,
              toX: nextNode.gridX,
              toY: nextNode.gridY,
              path: `M${(node.gridX * gridSize).toFixed(2)},${(node.gridY * gridSize).toFixed(2)} L${(nextNode.gridX * gridSize).toFixed(2)},${(nextNode.gridY * gridSize).toFixed(2)}`,
              type: "straight",
            });
          });
        }
      });

      setBackgroundData({ nodes, curves, lines, neuralPatterns, connections });
    },
    [],
  );

  return (
    <BackgroundContext.Provider
      value={{
        backgroundData,
        generateBackgroundData,
      }}
    >
      {children}
    </BackgroundContext.Provider>
  );
}

export function useBackground() {
  const context = useContext(BackgroundContext);
  if (!context) {
    throw new Error("useBackground must be used within a BackgroundProvider");
  }
  return context;
}
