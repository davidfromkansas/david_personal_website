// Convert a DWG made of 3DFACEs (like Herman Miller's AutoCAD 3D models) to an OBJ,
// one object per layer, in the drawing's own units.
// Setup: npm i @mlightcad/libredwg-web@0.8.2
// Run:   node dwg_to_obj.mjs IN.dwg OUT.obj   (from the folder holding node_modules)
import { Dwg_File_Type, LibreDwg } from '@mlightcad/libredwg-web';
import fs from 'fs';

const [, , input, output] = process.argv;
const lib = await LibreDwg.create('./node_modules/@mlightcad/libredwg-web/wasm/');
const db = lib.convert(lib.dwg_read_data(fs.readFileSync(input), Dwg_File_Type.DWG));

const verts = [], index = new Map(), layers = new Map();
const vertex = (p) => {
  const key = [p.x, p.y, p.z].map((n) => n.toFixed(5)).join(' ');
  if (!index.has(key)) { verts.push(key); index.set(key, verts.length); }
  return index.get(key);
};
for (const e of db.entities) {
  if (e.type !== '3DFACE') continue;
  const ids = [...new Set([e.corner1, e.corner2, e.corner3, e.corner4].filter(Boolean).map(vertex))];
  if (ids.length < 3) continue;
  if (!layers.has(e.layer)) layers.set(e.layer, []);
  layers.get(e.layer).push('f ' + ids.join(' '));
}
const lines = verts.map((v) => 'v ' + v);
for (const [name, faces] of layers) lines.push('o ' + name, ...faces);
fs.writeFileSync(output, lines.join('\n') + '\n');
console.log(`${verts.length} vertices, ${[...layers.values()].reduce((n, f) => n + f.length, 0)} faces`);
