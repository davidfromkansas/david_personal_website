# Terrain Lab

## What It Does

Sculpt a mountain range by changing elevation, spatial frequency, and the seed. The same parameters reproduce the same wireframe.

## Architecture

```text
sliders / Randomize / Reset -> Settings -> wireframe -> SVG strips
                                  |
                                  v
                           localStorage
```

## Frontend / API

- React holds three integers. Native sliders support arrow keys and touch. Randomize samples each parameter independently within its range and Reset restores the initial landscape.
- A desktop panel becomes a bottom sheet on small screens. The subject uses global theme tokens.
- All computation happens locally. There are no network requests, model calls, or API credentials.

## Key Dependencies

React, shadcn Button and Sheet, Lucide icons.

## Component Tree

TerrainLab renders TerrainView and TerrainControls.

## Error Handling

Malformed, out-of-range, and unavailable storage use defaults. Write failures preserve the current in-memory session.

## File Structure

- `page.tsx` owns state and persistence.
- `types.ts` and `data.ts` define settings, bounds and defaults.
- `terrain.ts` projects sampled height fields into a mesh.
- `terrain-view.tsx` draws strips from back to front.
- `terrain-controls.tsx` renders desktop and mobile controls.
- `metadata.json` describes the gallery entry.
