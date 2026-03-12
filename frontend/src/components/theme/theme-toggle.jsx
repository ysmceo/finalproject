import { MoonStar, SunMedium } from "lucide-react";

import { useTheme } from "@/components/theme/use-theme";
import { cn } from "@/lib/utils";

export function ThemeToggle({ className }) {
  const { theme, toggleTheme } = useTheme();
  const nextTheme = theme === "dark" ? "light" : "dark";

  return (
    <button
      aria-label={`Switch to ${nextTheme} mode`}
      aria-pressed={theme === "dark"}
      className={cn("theme-toggle shrink-0", className)}
      onClick={toggleTheme}
      title={`Switch to ${nextTheme} mode`}
      type="button"
    >
      <span className="theme-toggle__thumb" />
      <SunMedium className="theme-toggle__icon theme-toggle__icon--sun h-4 w-4" />
      <MoonStar className="theme-toggle__icon theme-toggle__icon--moon h-4 w-4" />
    </button>
  );
}
