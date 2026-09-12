import { Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTheme } from "./useTheme";

export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  const dark = resolvedTheme === "dark";
  return <Button variant="ghost" size="icon" aria-label={dark ? "라이트 모드로 전환" : "다크 모드로 전환"} onClick={() => setTheme(dark ? "light" : "dark")}>
    {dark ? <Sun /> : <Moon />}
  </Button>;
}
