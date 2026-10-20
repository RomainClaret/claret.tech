import { NextResponse } from "next/server";
import { legalText } from "@/lib/legal-text";

/**
 * The terms of service for their modal (src/components/legal/terms-content.tsx),
 * from TERMS-OF-SERVICE.md, built once with the site.
 */
export const dynamic = "force-static";

export function GET() {
  return NextResponse.json(legalText("TERMS-OF-SERVICE.md"));
}
