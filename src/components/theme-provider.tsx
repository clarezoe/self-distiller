"use client";

import { ThemeProvider as NextThemesProvider } from "next-themes";

// Class-based dark mode driven by next-themes. System / Light / Dark tri-state;
// no flash thanks to next-themes' inline script + suppressHydrationWarning on <html>.
export function ThemeProvider({ children }: { children: React.ReactNode }) {
  return (
    <NextThemesProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      disableTransitionOnChange
    >
      {children}
    </NextThemesProvider>
  );
}
