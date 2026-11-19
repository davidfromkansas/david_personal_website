# Prototype Playground

These instructions apply to the playground inside `_playground/`. Run its npm commands there. The surrounding repository also serves the personal website through GitHub Pages.

## Start a prototype

1. Start on a new branch from current main. Run `npm ci` at the playground package root. Install additional dependencies there only when the requested feature needs them.
2. Create `app/prototypes/<kebab-case-slug>/` with a thin `page.tsx`, `metadata.json`, and `HOW_IT_WORKS.md`. Build the requested prototype directly in code. Do not add an in-app creation button or creation API.
3. Follow every rule below. Run `npm run dev` for local development. The registry discovers folders at startup and build time. Restart development after adding a folder or editing metadata.
4. Test the real entry points at desktop width and 375px. Capture and inspect the required previews. Run the release checks, push, open a pull request, and post the working deployment URL.

## Metadata and discovery

Use this exact shape with real dates. Update `updatedAt` to the current ISO timestamp on every edit.

```json
{
  "title": "My Prototype",
  "description": "What it does",
  "tags": ["tag1"],
  "createdAt": "2026-11-19",
  "updatedAt": "2026-11-19T14:00:00Z",
  "hidden": false,
  "public": false
}
```

Hidden controls gallery visibility. Every prototype starts private. The owner must explicitly request publication of that specific slug. Generate its share image and a short, meaningful MP4 demonstration before setting `public` to true. Save them as `public/share/<slug>.jpg` and `public/share/<slug>.mp4`. Inspect both, then verify the public URL emits absolute og:image and og:video tags and serves the files. Use the same page component at `/p/<slug>`. Both unknown and private slugs must return HTTP 404 without a login redirect. Keep private thumbnails, prototype APIs, and gallery URLs behind the production gate.

This GitHub repository is public. A password protects deployed routes. Anyone can read committed source, metadata and assets on GitHub. Keep confidential prototypes and data out of this repository.

## Documentation

Keep HOW_IT_WORKS.md current with every change. Include:
- **What It Does** in one or two sentences.
- **Architecture** with an ASCII data-flow diagram.
- **Frontend / API** with state ownership, shortcuts, responsive behavior and request/response contracts.
- **AI Usage** for any model call. Record the model ID, rationale, call location, key parameters, system prompt summary and user prompt shape.
- **Key Dependencies**, **Component Tree**, **Error Handling**, and **File Structure**.

## Structure and design

- Keep implementation in its prototype folder, except shared foundation code and dedicated server endpoints in `app/api/<slug>/`. Never import another prototype. Keep page.tsx around 60 lines. Put shared types in types.ts, constants and mock data in data.ts, and pure logic in descriptively named modules testable without React. Give each meaningful UI component its own file.
- Read the actual component source before using its props. Use installed components from components/ui and shared tokens such as bg-background, text-foreground, bg-card, bg-muted, text-muted-foreground, bg-primary and border-border. No hardcoded colors, hex values, or inline color styles. Extend semantic tokens centrally when needed.
- Start with one centered column using max-w-2xl mx-auto. Add sidebars, splits, tabs, dashboards and charts only when requested or required for the controls below. Build only what the owner asked for. Use plain badges, functional icons, and concise copy. Remove captions that repeat labels.
- Collect tunable parameters into a single panel. Define controls with a schema where practical. Include persistent settings, Reset and Randomize. Place desktop controls alongside the subject. Use a bottom sheet on mobile.
- Support 375px screens, 44×44px touch targets, and visible touch alternatives for hover actions. Use accessible icon-only buttons on mobile with labels from sm upward. Wrap code blocks. Give media modals visible previous/next or swipe controls alongside keyboard navigation.
- Design dark-first and verify light mode. Use the global theme. Never hardcode a dark class on a page. Use resolvedTheme only for behavior such as drawing a canvas or WebGL scene.
- Animate user-added or removed sections through their full opening and closing height. Use smooth deceleration without overshoot and respect prefers-reduced-motion. Inspect computed styles to verify the animations actually run.

## AI, errors and storage

Call models only from server routes and keep credentials server-side. Include explicit constraints such as maximum columns and table width in any UI-generating system prompt. Use defensive CSS as a backup. Extract the first balanced JSON object from model output, respecting escaped strings and nested braces, parse defensively, and validate its shape. Wrap API handlers in try/catch and return meaningful status codes. Document which routes a public prototype needs and expose only those explicitly authorized operations.

Wrap every localStorage read and write in try/catch. Load saved state on mount, validate the shape, and use per-prototype versioned keys. Preserve an in-memory fallback.

## Images and workflow

- Cards use static light and dark images switched with CSS. Keep the missing-image fallback. Never embed prototype iframes in the gallery.
- Install Chromium with `npx playwright install chromium`, or set CHROMIUM_PATH to an installed binary. Run `npm run thumbnails -- --slug terrain-lab` for one, `npm run thumbnails -- slug-one slug-two` for several, `npm run thumbnails -- --missing` for incomplete pairs, or `npm run thumbnails` for all. The script builds and starts a disposable loopback production server and signs in with an ephemeral password.
- Mark the visual subject with data-thumbnail when useful. Capture a new prototype and regenerate both theme images after every visual change in the same commit. Global style edits require a full recapture. Open the captured images before committing.
- Run `npm run lint`, `npm run typecheck`, and `npm run build`. Verify production access with a fresh browser session. Never ship a bypass password, secret in client code, or a client-only login.
- Push the branch and open a PR. Check the build and branch preview. Finish with the preview URL so the owner can open it on a phone. State a deployment blocker if there is one. Do not present a predicted URL as live.
- When fixing a problem, add its reusable lesson here. Keep rules specific to observed failures.

## Lessons

- Stage screenshot files on the same filesystem as their destination. Renaming between a system temporary directory and a mounted checkout can fail with EXDEV after successful captures.
- GitHub Pages serves static files. Keep the Next.js package in the underscore-prefixed directory excluded by Jekyll, and use a server-capable host for middleware, private assets, and API routes.
- Use the repository owner’s GitHub noreply address for agent commits when email privacy protection rejects a push.
