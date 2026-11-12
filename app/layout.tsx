import type { Metadata } from "next";
import "./globals.css";
import { Nav } from "@/lib/ui";

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || "https://universaltiers.vercel.app"),
  title: {
    default: "Universal Tiers — Minecraft PvP Tierlist",
    template: "%s · Universal Tiers",
  },
  description:
    "Universal Tiers is the premier Minecraft PvP tierlist for Universal players. Rankings, tiers and points across Sword, Mace, Axe, DiaPot, SMP and UHC.",
  icons: {
    icon: "/icon.png",
    apple: "/icon.png",
    shortcut: "/icon.png",
  },
  openGraph: {
    title: "Universal Tiers — Minecraft PvP Tierlist",
    description: "Official PvP rankings for Sword, Mace, Axe, Crystal, NethPot, DiaPot, SMP and UHC.",
    siteName: "Universal Tiers",
    type: "website",
    images: [{ url: "/logo.png", width: 256, height: 256, alt: "Universal Tiers logo" }],
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="flex min-h-screen flex-col">
        <Nav />
        <main id="page-content" className="flex-1 pt-[72px]">{children}</main>
        <footer className="mt-16 border-t border-white/[0.06] bg-navy-950">
          <div className="container-x flex flex-col items-center justify-between gap-4 py-8 text-sm text-ink-400 sm:flex-row">
            <p>
              © {new Date().getFullYear()} <span className="font-semibold text-ink-200">Universal Tiers</span>. All rights reserved.
            </p>
            <p className="text-xs">Not affiliated with Mojang or Microsoft. Rankings are provided by verified testers.</p>
          </div>
        </footer>
      </body>
    </html>
  );
}
