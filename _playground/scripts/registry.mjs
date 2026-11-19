import { readdirSync, existsSync, readFileSync, writeFileSync } from "node:fs";
export function discover() {
  return readdirSync("app/prototypes", { withFileTypes: true })
    .filter(
      (d) =>
        d.isDirectory() && !d.name.startsWith("[") && !d.name.startsWith("_"),
    )
    .map(({ name: slug }) => {
      if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug))
        throw Error("Invalid slug " + slug);
      const dir = "app/prototypes/" + slug;
      const m = JSON.parse(readFileSync(dir + "/metadata.json", "utf8"));
      if (
        !m.title ||
        !m.description ||
        !Array.isArray(m.tags) ||
        !m.tags.every((t) => typeof t === "string") ||
        !/^\d{4}-\d{2}-\d{2}$/.test(m.createdAt) ||
        !Number.isFinite(Date.parse(m.updatedAt)) ||
        !existsSync(dir + "/HOW_IT_WORKS.md") ||
        !existsSync(dir + "/page.tsx")
      )
        throw Error("Incomplete prototype: " + slug);
      const hasImage = (theme) =>
        existsSync("public/thumbnails/" + slug + "-" + theme + ".webp");
      return {
        ...m,
        public: m.public === true,
        hidden: m.hidden === true,
        slug,
        preview: hasImage("light") && hasImage("dark"),
      };
    })
    .sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt));
}
export function generateRegistry() {
  const rows = discover();
  for (const p of rows.filter((p) => p.public))
    for (const ext of ["jpg", "mp4"])
      if (!existsSync("public/share/" + p.slug + "." + ext))
        throw Error("Missing public share media for " + p.slug);
  writeFileSync(
    "lib/public-slugs.generated.json",
    JSON.stringify(rows.filter((p) => p.public).map((p) => p.slug)),
  );
  const imports = rows
    .filter((p) => p.public)
    .map(
      (p) =>
        JSON.stringify(p.slug) +
        ":()=>import(" +
        JSON.stringify("@/app/prototypes/" + p.slug + "/page") +
        ")",
    )
    .join(",\n");
  writeFileSync(
    "lib/registry.generated.ts",
    "// Generated from prototype folders.\nimport type {ComponentType} from 'react';\nimport type {Prototype} from './prototypes';\nexport const prototypes:Prototype[] = " +
      JSON.stringify(rows, null, 2) +
      ";\nexport const published:Record<string,()=>Promise<{default:ComponentType}>>={" +
      imports +
      "};\n",
  );
}
