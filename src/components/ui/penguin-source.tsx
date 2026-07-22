// View-source easter egg: a penguin tucked into the server-rendered HTML for
// anyone who opens "View Page Source" or pokes around the Elements panel.
// Renders an inert, hidden HTML comment; nothing is visible on the page.
// Part of the colony (see also penguin-console.tsx and the terminal `penguin`
// command). The ASCII art is deliberately comment-safe: no bare "--" (which is
// not allowed inside an HTML comment) and no "<", ">" or "&".
const PENGUIN_COMMENT = `<!--

     .~~.
    |o_o |
    |:_/ |
   //   \\ \\
  (|     | )
 /'\\_   _/'\\
 \\___)=(___/

  You viewed the source. Of course you did.
  The colony respects the curious. Poke around the terminal, or just type 'penguin'.
  Grown by evolution, not engineering. Adaptation over accuracy.  🐧

-->`;

// Server component: server-rendered into the initial HTML document so the
// comment shows up in "View Page Source".
export function PenguinSource() {
  return (
    <div
      hidden
      aria-hidden="true"
      suppressHydrationWarning
      dangerouslySetInnerHTML={{ __html: PENGUIN_COMMENT }}
    />
  );
}
