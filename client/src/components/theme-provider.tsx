import { ThemeProvider as BaseThemeProvider } from "@/hooks/use-theme";

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  return (
    <BaseThemeProvider defaultTheme="light" storageKey="code-ai-theme">
      {children}
    </BaseThemeProvider>
  );
}
