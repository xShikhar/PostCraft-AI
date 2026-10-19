import { headers } from "next/headers";
import type { Metadata } from "next";
import { Lato, Merriweather } from "next/font/google";
import { ThemeProvider } from "@/components/theme-provider";
import { Toaster } from "@/components/ui/sonner";
import { MotionAtmosphere } from "@/components/motion/motion-atmosphere";
import "./globals.css";
import "@/components/motion/writing-motion.css";

// Lato — navigation, body text, UI, buttons (replaces Inter)
const lato = Lato({
  subsets: ["latin"],
  variable: "--font-lato",
  display: "swap",
  weight: ["400", "700"],
  style: ["normal", "italic"],
});

// Merriweather — hero headlines, section headings (replaces Playfair Display)
// Matches hyperverge.co: hero at 700, section headlines at 700/800
const merriweather = Merriweather({
  subsets: ["latin"],
  variable: "--font-merriweather",
  display: "swap",
  weight: ["400", "700", "800", "900"],
  style: ["normal", "italic"],
});

export const metadata: Metadata = {
  title: "PostCraft AI",
  description: "Transform your raw thoughts into high-performing social posts.",
};

export const dynamic = "force-dynamic";

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const nonce = (await headers()).get("x-nonce") || undefined;
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${lato.variable} ${merriweather.variable}`}
    >
      <body className="font-sans antialiased bg-canvas-base text-text-body min-h-screen">
        <ThemeProvider nonce={nonce} defaultTheme="light" enableSystem>
          <MotionAtmosphere />
          {children}
          <Toaster position="top-center" richColors />
        </ThemeProvider>
      </body>
    </html>
  );
}
