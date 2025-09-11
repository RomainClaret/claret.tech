/**
 * Test fixtures for background context tests
 *
 * These fixtures provide minimal but valid background data for testing
 * without triggering memory-intensive generation algorithms.
 */

import type { BackgroundData } from "@/contexts/background-context";

export const mockBackgroundData: BackgroundData = {
  nodes: [
    { x: 0, y: 0, animationDelay: 0.5 },
    { x: 1, y: 1, animationDelay: 1.2 },
    { x: 2, y: 0, animationDelay: 0.8 },
  ],
  curves: [
    {
      id: "curve-0",
      path: "M0.00,0.00 Q20.00,10.00 40.00,0.00",
      type: "quadratic",
    },
    {
      id: "curve-1",
      path: "M40.00,40.00 C50.00,30.00 60.00,50.00 80.00,40.00",
      type: "cubic",
    },
  ],
  lines: [
    {
      id: "line-0",
      startX: 0,
      startY: 0,
      endX: 2,
      endY: 0,
      hasEndpoint: true,
    },
    {
      id: "line-1",
      startX: 1,
      startY: 1,
      endX: 1,
      endY: 3,
      hasEndpoint: false,
    },
  ],
  neuralPatterns: [
    {
      id: "pattern-0",
      type: "triangle",
      nodes: [
        { gridX: 1, gridY: 0 },
        { gridX: 0, gridY: 2 },
        { gridX: 2, gridY: 2 },
      ],
      opacity: 0.2,
    },
  ],
  connections: [
    {
      id: "line-conn-0",
      fromX: 0,
      fromY: 0,
      toX: 2,
      toY: 0,
      path: "M0.00,0.00 L80.00,0.00",
      type: "straight",
    },
    {
      id: "pattern-0-0",
      fromX: 1,
      fromY: 0,
      toX: 0,
      toY: 2,
      path: "M40.00,0.00 L0.00,80.00",
      type: "straight",
    },
  ],
};

export const emptyBackgroundData: BackgroundData = {
  nodes: [],
  curves: [],
  lines: [],
  neuralPatterns: [],
  connections: [],
};

export const minimalBackgroundData: BackgroundData = {
  nodes: [{ x: 0, y: 0, animationDelay: 0 }],
  curves: [],
  lines: [],
  neuralPatterns: [],
  connections: [],
};
