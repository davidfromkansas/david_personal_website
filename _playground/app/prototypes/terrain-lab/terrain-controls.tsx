import { Dices, RotateCcw, SlidersHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { controls, defaults } from "./data";
import type { Settings } from "./types";
export function TerrainControls({
  settings,
  change,
}: {
  settings: Settings;
  change: (s: Settings) => void;
}) {
  const fields = (
    <div className="control-fields">
      {controls.map((c) => (
        <label key={c.key}>
          {c.label}
          <output>{settings[c.key]}</output>
          <input
            type="range"
            min={c.min}
            max={c.max}
            value={settings[c.key]}
            onChange={(e) =>
              change({ ...settings, [c.key]: Number(e.target.value) })
            }
          />
        </label>
      ))}
      <div className="actions">
        <Button
          aria-label="Randomize"
          onClick={() =>
            change(
              Object.fromEntries(
                controls.map((c) => [
                  c.key,
                  c.min + Math.floor(Math.random() * (1 + c.max - c.min)),
                ]),
              ) as Settings,
            )
          }
        >
          <Dices />
          <span className="hidden sm:inline">Randomize</span>
        </Button>
        <Button
          variant="outline"
          aria-label="Reset"
          onClick={() => change(defaults)}
        >
          <RotateCcw />
          <span className="hidden sm:inline">Reset</span>
        </Button>
      </div>
    </div>
  );
  return (
    <>
      <aside className="control-panel">
        <h2>Controls</h2>
        {fields}
      </aside>
      <div className="mobile-controls">
        <Sheet>
          <SheetTrigger asChild>
            <Button aria-label="Open controls">
              <SlidersHorizontal />
              Controls
            </Button>
          </SheetTrigger>
          <SheetContent side="bottom" aria-describedby={undefined}>
            <SheetTitle>Controls</SheetTitle>
            {fields}
          </SheetContent>
        </Sheet>
      </div>
    </>
  );
}
