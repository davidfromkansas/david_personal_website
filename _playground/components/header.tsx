"use client";
import Link from "next/link";
import { Box, Sun, Moon, Monitor, LockKeyhole } from "lucide-react";
import { useTheme } from "next-themes";
import { usePathname } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
const themes = [
  [Sun, "light"],
  [Moon, "dark"],
  [Monitor, "system"],
] as const;
export function Header() {
  const { setTheme, theme } = useTheme();
  const publicView = usePathname().startsWith("/p/");
  return (
    <header className="topbar">
      <div className="shell nav">
        <Link href={publicView ? "#" : "/"} className="brand">
          <span className="mark">
            <Box size={23} />
          </span>
          Playground
        </Link>
        <div className="nav-right">
          {!publicView && (
            <span className="privacy">
              <LockKeyhole size={13} />
              Private workspace
            </span>
          )}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="icon" aria-label="Choose theme">
                <Sun className="dark:hidden" />
                <Moon className="hidden dark:block" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {themes.map(([Glyph, name]) => {
                return (
                  <DropdownMenuItem key={name} onSelect={() => setTheme(name)}>
                    <Glyph />
                    {name}
                    {theme === name ? " ✓" : ""}
                  </DropdownMenuItem>
                );
              })}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  );
}
