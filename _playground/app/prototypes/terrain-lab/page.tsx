"use client";
import { useEffect, useState } from "react";
import { defaults, isSettings } from "./data";
import { TerrainView } from "./terrain-view";
import { TerrainControls } from "./terrain-controls";
import type { Settings } from "./types";
const key = "playground:terrain-lab:v1";
export default function TerrainLab() {
  const [settings, setSettings] = useState(defaults);
  useEffect(() => {
    try {
      const stored = JSON.parse(localStorage.getItem(key) || "null");
      if (isSettings(stored)) setSettings(stored);
    } catch {
      /* Defaults also work with restricted storage. */
    }
  }, []);
  function change(next: Settings) {
    setSettings(next);
    try {
      localStorage.setItem(key, JSON.stringify(next));
    } catch {
      /* Settings remain in memory. */
    }
  }
  return (
    <main className="shell library">
      <div className="eyebrow">SIMULATION / GENERATIVE</div>
      <h1>
        Terrain Lab<span>.</span>
      </h1>
      <p className="intro">Shape a procedural landscape in three dimensions.</p>
      <div className="workbench">
        <TerrainView settings={settings} />
        <TerrainControls settings={settings} change={change} />
      </div>
    </main>
  );
}
