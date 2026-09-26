import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Commonroom — good things grow together",
  description: "A thoughtful little corner of the internet for people and ideas.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" data-theme="dark">
      <body>
        <div
          hidden
          dangerouslySetInnerHTML={{
            __html:
              "<!-- THESIS: A shared room, not an endless scroll. OWN-WORLD: Charcoal surfaces, precise blue actions, citron signals, and soft editorial type. STORY: Find familiar faces, share a moment, and keep a conversation going. FIRST VIEWPORT: A persistent top bar anchors a three-column desktop room: quiet navigation, active feed, and a people rail; mobile brings the feed first and a compact bottom bar. FORM: Operate-first social workspace, composed as an open community room rather than a wall of cards. -->",
          }}
        />
        {children}
      </body>
    </html>
  );
}
