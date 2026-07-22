// Ambient types for deep per-icon lucide imports: lucide-react 0.400.0 ships
// no .d.ts beside dist/esm/icons/*. Lazily loaded components import icons
// this way to bypass Next's default barrel optimization, whose
// __barrel_optimize__ proxy modules end up undefined in lazy webpack-dev
// chunks (2026-07-20 crash); see src/components/ui/pdf-viewer.tsx.
declare module "lucide-react/dist/esm/icons/*" {
  import type { LucideIcon } from "lucide-react";
  const Icon: LucideIcon;
  export default Icon;
}
