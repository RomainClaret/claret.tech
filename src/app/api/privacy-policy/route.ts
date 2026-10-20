import { NextResponse } from "next/server";
import { legalText } from "@/lib/legal-text";

/**
 * The privacy policy for its modal (src/components/legal/privacy-content.tsx),
 * from PRIVACY-POLICY.md, built once with the site.
 */
export const dynamic = "force-static";

export function GET() {
  return NextResponse.json(legalText("PRIVACY-POLICY.md"));
}
