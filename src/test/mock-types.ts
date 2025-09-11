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

export interface FadeInProps extends BaseMockProps {
  delay?: number;
  duration?: number;
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

export interface EducationStyleCardProps extends BaseMockProps {
  onClick?: () => void;
  "data-testid"?: string;
}

export interface ProjectCardProps extends BaseMockProps {
  project?: {
    id?: string;
    title?: string;
    description?: string;
    technologies?: string[];
    githubUrl?: string;
    liveUrl?: string;
    imageUrl?: string;
    featured?: boolean;
    category?: string;
    year?: number;
  };
  onClick?: () => void;
  "data-testid"?: string;
}

export interface SkillCardProps extends BaseMockProps {
  skill?: {
    name?: string;
    level?: number;
    category?: string;
    icon?: string;
  };
  "data-testid"?: string;
}

// Modal and viewer component props
export interface PDFViewerModalProps extends BaseMockProps {
  isOpen?: boolean;
  onClose?: () => void;
  pdfUrl?: string;
  title?: string;
}

export interface ModalProps extends BaseMockProps {
  isOpen?: boolean;
  onClose?: () => void;
  title?: string;
  size?: "sm" | "md" | "lg" | "xl" | "full";
}

// Navigation component props
export interface NavigationProps extends BaseMockProps {
  isOpen?: boolean;
  onToggle?: () => void;
  activeSection?: string;
}

export interface ThemeToggleProps extends BaseMockProps {
  onClick?: () => void;
  "aria-label"?: string;
}

// Canvas and context props
export interface CanvasProps extends BaseMockProps {
  width?: number;
  height?: number;
  onMouseMove?: (event: React.MouseEvent<HTMLCanvasElement>) => void;
  onMouseLeave?: () => void;
  style?: React.CSSProperties;
}

export interface CanvasContextMock {
  fillRect: Mock;
  clearRect: Mock;
  getContext: Mock;
  toDataURL: Mock;
  [key: string]: Mock;
}

// Form component props
export interface FormFieldProps extends BaseMockProps {
  name?: string;
  label?: string;
  type?: "text" | "email" | "textarea" | "select";
  value?: string;
  onChange?: (value: string) => void;
  required?: boolean;
  placeholder?: string;
  error?: string;
}

// Performance and monitoring props
export interface PerformanceMetricProps extends BaseMockProps {
  value?: number;
  label?: string;
  unit?: string;
  status?: "good" | "fair" | "poor";
}

// Terminal component props
export interface TerminalProps extends BaseMockProps {
  isOpen?: boolean;
  onToggle?: () => void;
  onClose?: () => void;
  commands?: string[];
  output?: string[];
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

export interface ProtectedLucideIconProps extends BaseMockProps {
  Icon?: React.ComponentType<IconProps>;
  fallback?: ReactNode;
}

export interface SlideInLeftProps extends BaseMockProps {
  delay?: number;
  duration?: number;
}

export interface SlideInRightProps extends BaseMockProps {
  delay?: number;
  duration?: number;
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

// Utility function types
export interface UtilityFunction {
  (...args: unknown[]): string;
}

// Test-specific mock types
export interface MockedFetch {
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

export interface GitHubProject {
  id: number;
  name: string;
  full_name: string;
  description: string | null;
  html_url: string;
  stargazers_count: number;
  forks_count: number;
  language: string | null;
  topics: string[];
  updated_at: string;
  size: number;
}

export interface ProjectsApiResponse {
  success: boolean;
  data: {
    pinnedItems: {
      nodes: GitHubProject[];
    };
    repositories: {
      nodes: GitHubProject[];
    };
  };
}

// DOM API mock types
export interface MockDOMRect {
  top: number;
  left: number;
  bottom: number;
  right: number;
  width: number;
  height: number;
  x: number;
  y: number;
  toJSON: () => Omit<MockDOMRect, "toJSON">;
}

// Mock function types for testing
export interface MockFunction {
  mock: {
    calls: unknown[][];
    results: { type: "return" | "throw"; value: unknown }[];
  };
  mockImplementation: (fn: (...args: unknown[]) => unknown) => MockFunction;
  mockReturnValue: (value: unknown) => MockFunction;
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

// Neural Network graph types for useNeuralNetwork tests
export interface MockGraphNode {
  id: string;
  title: string;
  authors: string[];
  year: string;
  citations?: number;
  x: number;
  y: number;
  radius: number;
  color: string;
  influence: number;
}

export interface MockGraphEdge {
  source: string;
  target: string;
  strength: number;
  bidirectional: boolean;
}

export interface MockGraph {
  nodes: Map<string, MockGraphNode>;
  edges: MockGraphEdge[];
  clusters: Map<string, string[]>;
}

// Animation Manager types for animation-manager tests
export interface MockWindow {
  addEventListener: Mock;
  removeEventListener: Mock;
  dispatchEvent: Mock;
  [key: string]: unknown;
}

// Framer Motion types for conditional-motion.tsx
export interface MotionVariants {
  [key: string]: {
    [property: string]: string | number | boolean;
  };
}

export interface MotionTransition {
  duration?: number;
  delay?: number;
  ease?: string | number[];
  type?: "spring" | "tween" | "inertia";
  stiffness?: number;
  damping?: number;
  mass?: number;
  when?: "beforeChildren" | "afterChildren" | false;
  delayChildren?: number;
  staggerChildren?: number;
  staggerDirection?: number;
  [key: string]: unknown;
}

export interface MotionAnimateProps {
  x?: string | number | (string | number)[];
  y?: string | number | (string | number)[];
  scale?: number | number[];
  rotate?: number | number[];
  opacity?: number | number[];
  [key: string]: string | number | boolean | (string | number)[] | undefined;
}

export type MotionValue = string | number | MotionVariants | MotionAnimateProps;

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

// User mock types for commands.test.ts
export interface MockUser {
  username: string;
  displayName: string;
  isAdmin: boolean;
  homeDirectory:
    | string
    | {
        name: string;
        type: "directory";
        children: Record<string, unknown>;
      };
}

// WebLLM Client type for ai-commands.ts
export interface WebLLMClientClass {
  isSupported: () => boolean;
  new (...args: unknown[]): unknown;
}
