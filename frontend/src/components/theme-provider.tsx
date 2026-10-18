"use client";

import { ThemeProvider as NextThemesProvider } from "next-themes";
import { type ReactNode } from "react";

interface ThemeProviderProps {
  children: ReactNode;
  nonce?: string;
  attribute?: "class" | "data-theme";
  defaultTheme?: string;
  enableSystem?: boolean;
}

export function ThemeProvider({
  children,
  nonce,
  attribute = "class",
  defaultTheme = "light",
  enableSystem = true,
}: ThemeProviderProps) {
  return (
    <NextThemesProvider
      nonce={nonce}
      attribute={attribute}
      defaultTheme={defaultTheme}
      enableSystem={enableSystem}
    >
      {children}
    </NextThemesProvider>
  );
}
