import { showToast } from "@/components/ui/toast";

/**
 * The system's share sheet where there is one. Elsewhere (Firefox on a
 * computer has none) the link goes to the clipboard, with a toast to say so;
 * the button did nothing there. A sheet closed without sharing rejects: the
 * visitor's choice, so nothing follows.
 *
 * Shared by a blog card and its details dialog.
 */
export async function shareArticle(data: {
  title: string;
  text: string;
  url: string;
}) {
  if (typeof navigator.share === "function") {
    try {
      await navigator.share(data);
      return;
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      // Refused by the browser: copy the link instead.
    }
  }
  try {
    await navigator.clipboard.writeText(data.url);
  } catch {
    // Clipboard denied or unavailable (plain http): nothing happened to say.
    return;
  }
  showToast("Link copied to the clipboard", "success", 2500);
}
