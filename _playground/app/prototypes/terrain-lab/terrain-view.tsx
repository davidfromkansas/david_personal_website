import { useMemo } from "react";
import { wireframe } from "./terrain";
import type { Settings } from "./types";
export function TerrainView({ settings }: { settings: Settings }) {
  const lines = useMemo(() => wireframe(settings), [settings]);
  return (
    <figure data-thumbnail className="terrain">
      <svg
        viewBox="0 0 700 400"
        role="img"
        aria-label="Procedural green wireframe mountain range"
      >
        <defs>
          <pattern
            id="dots"
            width="15"
            height="15"
            patternUnits="userSpaceOnUse"
          >
            <circle cx="1" cy="1" r=".85" fill="var(--plot-guide)" />
          </pattern>
        </defs>
        <rect width="700" height="400" fill="url(#dots)" />
        <g fill="none" stroke="var(--plot-guide)" strokeWidth="1.3">
          <path d="M19 32V19h13 M668 19h13v13 M19 368v13h13 M668 381h13v-13" />
        </g>
        <g className="plot-type">
          <text x="37" y="41">
            TERRAIN / WIREFRAME
          </text>
          <text x="662" y="41" textAnchor="end">
            FIG. 01
          </text>
        </g>
        {lines.map((l, i) => (
          <g key={i}>
            <path d={l.strip} fill="var(--plot-surface)" />
            <path
              d={l.stitches}
              stroke="var(--mesh)"
              opacity=".55"
              strokeWidth=".8"
            />
            <path
              d={l.line}
              fill="none"
              stroke="var(--mesh)"
              strokeWidth="1.2"
            />
          </g>
        ))}
        <g className="plot-type">
          <text x="38" y="363">
            SEED {String(settings.seed).padStart(3, "0")}
          </text>
          <text x="662" y="363" textAnchor="end">
            X / Y / Z
          </text>
        </g>
      </svg>
    </figure>
  );
}
