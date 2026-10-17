// Shared TypeScript interfaces for test mock components
// This file provides proper typing for mock components used across test files

import { ReactNode } from "react";
import type { Mock } from "vitest";

// Base interface for all mock components
export interface BaseMockProps {
  children?: ReactNode;
  className?: string;
  [key: string]: unknown; // For spread props
}

// Animation component props
export interface SlideInUpProps extends BaseMockProps {
  delay?: number;
  direction?: "up" | "down" | "left" | "right";
}

export interface MotionDivProps extends BaseMockProps {
  initial?: object;
  animate?: object;
  transition?: object;
  whileHover?: object;
  whileTap?: object;
  variants?: object;
  layout?: boolean;
  layoutId?: string;
}

// Next.js component props
export interface NextImageProps {
  src: string;
  alt: string;
  width?: number;
  height?: number;
  priority?: boolean;
  placeholder?: "blur" | "empty";
  blurDataURL?: string;
  className?: string;
  fill?: boolean;
  sizes?: string;
  quality?: number;
  loading?: "lazy" | "eager";
  style?: React.CSSProperties;
}

export interface NextLinkProps extends BaseMockProps {
  href: string;
  target?: "_blank" | "_self" | "_parent" | "_top";
  rel?: string;
  prefetch?: boolean;
  replace?: boolean;
  scroll?: boolean;
  shallow?: boolean;
}

// Icon component props (Lucide React)
export interface IconProps {
  className?: string;
  size?: number;
  strokeWidth?: number;
  color?: string;
  style?: React.CSSProperties;
  onClick?: () => void;
}

// Custom component props
export interface OptimizedImageProps {
  src: string;
  alt: string;
  className?: string;
  width?: number;
  height?: number;
  priority?: boolean;
  placeholder?: string;
  blurDataURL?: string;
}

// Modal and viewer component props
export interface PDFViewerModalProps extends BaseMockProps {
  isOpen?: boolean;
  onClose?: () => void;
  pdfUrl?: string;
  title?: string;
}

// Dynamic import and utility types
export interface DynamicImportOptions {
  loading?: () => ReactNode;
  ssr?: boolean;
}

export interface DynamicImportFn {
  (): Promise<{ default: React.ComponentType<Record<string, unknown>> }>;
}

export interface TypeWriterProps extends BaseMockProps {
  text?: string;
  speed?: number;
  delay?: number;
  cursor?: boolean;
}

export interface ConditionalMotionProps extends BaseMockProps {
  condition?: boolean;
  disable?: boolean;
}

// Project-specific component props
export interface ScaleInProps extends BaseMockProps {
  delay?: number;
  duration?: number;
  scale?: number;
}

export interface HolographicCardProps extends BaseMockProps {
  title?: string;
  description?: string;
  href?: string;
  gradient?: string;
}

export interface HolographicStatsCardProps extends BaseMockProps {
  title?: string;
  value?: string | number;
  unit?: string;
  trend?: "up" | "down" | "neutral";
}

export interface ProjectFilterProps extends BaseMockProps {
  technologies?: string[];
  selectedTech?: string | null;
  onSelectTech?: (tech: string | null) => void;
}

// Lucide icon props
export interface LucideIconProps {
  size?: number;
  color?: string;
  className?: string;
  "data-testid"?: string;
  [key: string]: unknown;
}

// Test-specific mock types
export interface MockedFetch {
  mockResolvedValue: (value: MockedFetchResponse) => MockedFetch;
  mockResolvedValueOnce: (value: MockedFetchResponse) => MockedFetch;
  mockRejectedValueOnce: (error: Error) => MockedFetch;
  mockImplementation: (fn: (...args: unknown[]) => unknown) => MockedFetch;
  mockClear: () => void;
}

export interface MockedFetchResponse {
  ok: boolean;
  status?: number;
  json: () => Promise<unknown>;
}

// Skills-specific component props
export interface SkillManifestoProps extends BaseMockProps {
  skills?: string[];
  autoPlayDelay?: number;
}

export interface LanguageSpectrumProps extends BaseMockProps {
  languages?: Array<{
    name: string;
    proficiency: number;
    color?: string;
  }>;
}

export interface TechIconProps {
  size?: number;
  className?: string;
  style?: React.CSSProperties;
  "data-testid"?: string;
  [key: string]: unknown;
}

// Storage mock types
export interface MockStorage extends Mock {
  getItem: Mock;
  setItem: Mock;
  removeItem: Mock;
  clear: Mock;
  key: Mock;
  length: number;
}

// MediaQueryList mock types for useReducedMotion tests
export interface MockMediaQueryListEvent {
  matches: boolean;
  media?: string;
}

export interface MockMediaQueryList {
  matches: boolean;
  media: string;
  onchange: ((this: MediaQueryList, ev: MediaQueryListEvent) => void) | null;
  addEventListener: Mock<
    (event: string, callback: (event: MockMediaQueryListEvent) => void) => void
  >;
  removeEventListener: Mock<
    (event: string, callback: (event: MockMediaQueryListEvent) => void) => void
  >;
  dispatchEvent: Mock<(event: Event) => boolean>;
  addListener: Mock<
    (callback: (event: MockMediaQueryListEvent) => void) => void
  >; // Deprecated
  removeListener: Mock<
    (callback: (event: MockMediaQueryListEvent) => void) => void
  >; // Deprecated
}

export interface MockMatchMedia extends Mock {
  <T extends string>(query: T): MockMediaQueryList;
}

// PDF Viewer hook types for Papers.test.tsx
export interface MockPDFViewerHook {
  isOpen: boolean;
  pdfUrl: string;
  title: string;
  downloadFileName: string;
  openPDF: (...args: string[]) => void;
  closePDF: Mock;
}

export interface MockHookFunction {
  mockReturnValue: (
    value: MockPDFViewerHook | boolean | (() => unknown),
  ) => MockHookFunction;
}

// Terminal Commands types for commands.test.ts
export interface CommandContext {
  currentDirectory: string;
  currentUser: string;
  setCurrentDirectory: (path: string) => void;
  setCurrentUser: (username: string) => void;
  addToHistory: (line: string) => void;
  clearTerminal: () => void;
  closeTerminal: () => void;
  terminalCols?: number;
  terminalRows?: number;
}

export interface CommandResult {
  output: string;
  success: boolean;
}

export interface CommandFunction {
  (
    args: string[],
    context: CommandContext,
  ): CommandResult | Promise<CommandResult>;
}

export interface CommandsObject {
  [commandName: string]: CommandFunction;
}
