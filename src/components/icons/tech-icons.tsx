import React from "react";
import {
  Code2,
  Database,
  Server,
  Cloud,
  Terminal,
  GitBranch,
  Cpu,
  Braces,
  Package,
  Layers,
  Globe,
  FileCode,
  Settings,
  Palette,
  Box,
  FlaskConical,
  Shield,
  Zap,
  Brain,
  Bot,
  GraduationCap,
  Github,
  Link,
  LucideIcon,
  Sparkles,
  Dna,
  Atom,
  Network,
  CircuitBoard,
  Infinity,
  Sprout,
  ArrowLeftRight,
  TrendingUp,
  MemoryStick,
  Handshake,
  Flame,
  Book,
  Lightbulb,
  Route,
  Wind,
  Hand,
  Coins,
  Clock,
  Activity,
  Leaf,
  Rocket,
  Bug,
} from "lucide-react";
import { ProtectedLucideIcon } from "@/components/ui/protected-lucide-icon";

// Mapping of Font Awesome class names to Lucide icons
export const techIconMap: Record<string, LucideIcon> = {
  // Programming Languages
  "fab fa-html5": FileCode,
  "fab fa-css3-alt": Palette,
  "fab fa-js": Code2,
  "fab fa-react": Layers,
  "fab fa-node-js": Server,
  "fab fa-python": FileCode,
  "fab fa-java": Code2,
  "fas fa-database": Database,

  // Tools & Frameworks
  "fab fa-sass": Palette,
  "fab fa-npm": Package,
  "fab fa-git-alt": GitBranch,
  "fab fa-aws": Cloud,
  "fab fa-google-cloud": Cloud,
  "fab fa-docker": Box,
  "fas fa-fire": Zap,
  "fab fa-swift": Code2,

  // General
  "fas fa-code": Code2,
  "fas fa-terminal": Terminal,
  "fas fa-server": Server,
  "fas fa-cloud": Cloud,
  "fas fa-cogs": Settings,
  "fas fa-shield-alt": Shield,
  "fas fa-flask": FlaskConical,
  "fas fa-microchip": Cpu,
  "fas fa-globe": Globe,
  "fas fa-bracket-curly": Braces,

  // AI & Robotics
  "fas fa-brain": Brain,
  "fas fa-robot": Bot,
  "fas fa-sparkles": Sparkles,
  "fas fa-dna": Dna,
  "fas fa-atom": Atom,
  "fas fa-network-wired": Network,
  "fas fa-brain-circuit": CircuitBoard,
  "fas fa-infinity": Infinity,
  "fas fa-zap": Zap,

  // Education & Community
  "fas fa-graduation-cap": GraduationCap,
  "fab fa-github": Github,

  // Blockchain
  "fas fa-link": Link,

  // Skills and Interests specific icons
  "fas fa-seedling": Sprout,
  "fas fa-exchange-alt": ArrowLeftRight,
  "fas fa-chart-line": TrendingUp,
  "fas fa-memory": MemoryStick,
  "fas fa-handshake": Handshake,
  "fas fa-fire-flame-curved": Flame,
  "fas fa-book": Book,
  "fas fa-lightbulb": Lightbulb,
  "fas fa-route": Route,
  "fas fa-tornado": Wind,
  "fas fa-fist-raised": Hand,
  "fas fa-coins": Coins,
  "fas fa-turtle": Clock, // No turtle icon, using clock for "slow"
  "fas fa-heartbeat": Activity,
  "fas fa-project-diagram": Network,
  "fas fa-bolt": Zap,
  "fas fa-leaf": Leaf,
  "fas fa-space-shuttle": Rocket,
  "fas fa-bacterium": Bug, // Using bug as closest alternative
};

// Get icon component by Font Awesome class name, with fallback
export function getTechIcon(fontAwesomeClass: string): LucideIcon {
  return techIconMap[fontAwesomeClass] || Code2;
}

// Get protected icon component by Font Awesome class name, with fallback
export function getProtectedTechIcon(
  fontAwesomeClass: string,
  props: Record<string, unknown> = {},
): React.ReactElement {
  const IconComponent = techIconMap[fontAwesomeClass] || Code2;
  return <ProtectedLucideIcon Icon={IconComponent} {...props} />;
}
