import type { Settings } from "./types";
export const defaults: Settings = { elevation: 78, frequency: 46, seed: 24 };
export const controls = [
  { key: "elevation", label: "Elevation", min: 20, max: 100 },
  { key: "frequency", label: "Frequency", min: 10, max: 90 },
  { key: "seed", label: "Seed", min: 1, max: 99 },
] as const;
export function isSettings(value: unknown): value is Settings {
  return (
    !!value &&
    typeof value === "object" &&
    controls.every((c) => {
      const n = (value as Settings)[c.key];
      return Number.isInteger(n) && n >= c.min && n <= c.max;
    })
  );
}
