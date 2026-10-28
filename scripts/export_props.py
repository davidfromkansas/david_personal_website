"""Export the desk, the TV and the Aeron to one glTF file for the live beach scene.

The same props as build_scene.py, laid out the same way (metres, the desk centred on the
origin, the chair pushed in from -Y). The bamboo top's procedural texture is baked to an
image, since glTF only carries image textures. Needs scripts/models/aeron.obj (see
chair_model.py).

Writes OUTDIR/props.glb and OUTDIR/props.json (the TV glass corners, in glTF axes: +Y up,
the desk front facing +Z).

Run: python3 export_props.py OUTDIR
"""
import json
import math
import os
import sys

import bpy
from mathutils import Vector

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import chair_model  # noqa: E402
import tv_model  # noqa: E402

OUTDIR = sys.argv[1] if len(sys.argv) > 1 else "."
DESK_TOP = 0.756
TV_YAW = math.radians(24)

bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene


def principled(name, color, rough=0.5, metallic=0.0, coat=0.0):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    p = m.node_tree.nodes["Principled BSDF"]
    p.inputs["Base Color"].default_value = (*color, 1)
    p.inputs["Roughness"].default_value = rough
    p.inputs["Metallic"].default_value = metallic
    p.inputs["Coat Weight"].default_value = coat
    return m, p


def cube(name, size, loc, material, bevel=0.0, rot=(0, 0, 0)):
    bpy.ops.mesh.primitive_cube_add(size=1, location=loc, rotation=rot)
    ob = bpy.context.object
    ob.name = name
    ob.scale = size
    bpy.ops.object.transform_apply(scale=True)
    if bevel:
        mod = ob.modifiers.new("bevel", "BEVEL")
        mod.width = bevel
        mod.segments = 3
    ob.data.materials.append(material)
    return ob


STEEL, _ = principled("steel", (0.025, 0.025, 0.028), rough=0.35, metallic=0.6)
CASE, _ = principled("dvd_case", (0.01, 0.01, 0.012), rough=0.3)
CASE_ART = [principled(f"art{i}", c, rough=0.4)[0] for i, c in enumerate(
    [(0.55, 0.08, 0.12), (0.05, 0.18, 0.45), (0.75, 0.55, 0.10)])]
REMOTE, _ = principled("remote", (0.035, 0.035, 0.04), rough=0.4)


def bamboo_texture(path, px=1024):
    """The bamboo laminate from build_scene.py, drawn straight to an image: long strips in
    two tones with darker seams, streaked with grain."""
    import numpy as np
    rng = np.random.default_rng(4)
    a, b, seam = np.array((0.60, 0.40, 0.17)), np.array((0.38, 0.21, 0.07)), np.array((0.30, 0.15, 0.05))
    rows = 34
    u = (np.arange(px) + 0.5) / px
    img = np.zeros((px, px, 3))
    for r in range(rows):
        j0, j1 = r * px // rows, (r + 1) * px // rows
        edges = np.cumsum(rng.uniform(0.22, 0.4, 8)) - rng.random()
        idx = np.searchsorted(edges, u)
        tone = rng.random(len(edges) + 1)[idx]
        col = a + (b - a) * (0.25 + 0.6 * tone)[:, None]
        grain = 0.85 + 0.15 * np.sin(u * 900 + r * 3.1 + np.sin(u * 37 + r) * 4)
        col = col * grain[:, None]
        near = np.min(np.abs(u[:, None] - edges[None, :]), axis=1) < 0.0015
        col[near] = seam
        img[j0:j1] = col
        img[j0:j0 + max(1, (j1 - j0) // 16)] = seam
    rgba = np.concatenate([img, np.ones((px, px, 1))], axis=2).astype(np.float32)
    im = bpy.data.images.new("bamboo", px, px)
    im.pixels.foreach_set(rgba.ravel())
    im.filepath_raw = path
    im.file_format = "PNG"
    im.save()
    return im


# ---- Bamboo desk on a black steel frame ----
BAMBOO, bp = principled("bamboo", (1, 1, 1), rough=0.32, coat=0.35)
tex = BAMBOO.node_tree.nodes.new("ShaderNodeTexImage")
tex.image = bamboo_texture(os.path.join(OUTDIR, "bamboo.png"))
BAMBOO.node_tree.links.new(tex.outputs["Color"], bp.inputs["Base Color"])
top = cube("desk_top", (1.50, 0.75, 0.032), (0, 0, DESK_TOP - 0.016), BAMBOO, bevel=0.004)
for x in (-0.68, 0.68):
    cube(f"leg{x}", (0.06, 0.06, DESK_TOP - 0.06), (x, 0, (DESK_TOP - 0.06) / 2 + 0.02), STEEL, bevel=0.004)
    cube(f"foot{x}", (0.07, 0.68, 0.03), (x, 0, 0.02), STEEL, bevel=0.006)
    cube(f"rail{x}", (0.06, 0.62, 0.04), (x, 0, DESK_TOP - 0.052), STEEL, bevel=0.004)
cube("crossbar", (1.30, 0.04, 0.08), (0, 0.22, DESK_TOP - 0.08), STEEL, bevel=0.004)
# Strips run along the desk: map the top face's UVs to the desk's x/y.
me = top.data
uv = me.uv_layers.active or me.uv_layers.new()
for poly in me.polygons:
    for li in poly.loop_indices:
        v = me.vertices[me.loops[li].vertex_index].co
        uv.data[li].uv = ((v.x + 0.75) / 1.5, (v.y + 0.375) / 1.5 + (0.3 if poly.normal.z < 0.9 else 0))

# ---- TV ----
rig, glass = tv_model.build("crt")
rig.scale = (0.25, 0.25, 0.25)
rig.rotation_euler = (0, 0, TV_YAW)
rig.location = (-0.30, 0.04, DESK_TOP - 0.25 * 0.012)

for i, (dz, rot) in enumerate([(0.0, 4), (0.015, -6), (0.03, 11)]):
    c = cube(f"dvd{i}", (0.135, 0.19, 0.014), (0.10, 0.08, DESK_TOP + 0.007 + dz), CASE, bevel=0.002,
             rot=(0, 0, math.radians(rot)))
    c.data.materials.append(CASE_ART[i])
    for poly in c.data.polygons:
        if poly.normal.z > 0.9:
            poly.material_index = 1
cube("remote", (0.05, 0.19, 0.022), (0.30, -0.14, DESK_TOP + 0.011), REMOTE, bevel=0.008,
     rot=(0, 0, math.radians(-24)))

# ---- Aeron pushed in under the desk ----
chair = chair_model.build()
chair.location = (0.34, -0.15, 0)
chair.rotation_euler = (0, 0, math.radians(6))
# The pellicle's see-through weave is a Cycles-only trick; in the browser it's a dark mesh.
pel = bpy.data.materials["aeron_pellicle"]
for n in list(pel.node_tree.nodes):
    if n.type in ("TEX_CHECKER", "MAP_RANGE", "TEX_COORD"):
        pel.node_tree.nodes.remove(n)

bpy.context.view_layer.update()

# Picture-tube corners (tl, tr, br, bl), as build_scene.glass_corners().
hw, hh = tv_model.GLASS_W / 2, tv_model.GLASS_H / 2
y = tv_model.FRONT + tv_model.RECESS - 0.03 - 0.012
corners = [rig.matrix_world @ Vector(p) for p in (
    (-hw, y, tv_model.SCR_CZ + hh), (hw, y, tv_model.SCR_CZ + hh),
    (hw, y, tv_model.SCR_CZ - hh), (-hw, y, tv_model.SCR_CZ - hh))]

# Drop helpers that never render (boolean cutters), and turn text into meshes.
for ob in list(scene.objects):
    if ob.type == "MESH" and ob.hide_render:
        bpy.data.objects.remove(ob)
for ob in list(scene.objects):
    if ob.type == "FONT":
        bpy.ops.object.select_all(action="DESELECT")
        bpy.context.view_layer.objects.active = ob
        ob.select_set(True)
        bpy.ops.object.convert(target="MESH")

# Lighten the meshes for the browser: the Aeron's CAD faces are dense, and the TV's small
# labels are far more finely tessellated than they ever show on screen.
for ob in scene.objects:
    if ob.type != "MESH":
        continue
    n = len(ob.data.polygons)
    if ob.name.startswith("SEAT-") and n > 2000:
        d = ob.modifiers.new("lighten", "DECIMATE")
        d.ratio = 0.3
    elif ob.name.endswith("_lbl") or ob.name in ("brand", "tv_logo", "dvd_logo", "dvd_sub"):
        d = ob.modifiers.new("lighten", "DECIMATE")
        d.decimate_type = "DISSOLVE"
        d.angle_limit = math.radians(8)

out = os.path.join(OUTDIR, "props.glb")
kw = dict(filepath=out, export_format="GLB", export_apply=True, export_yup=True,
          export_image_format="WEBP", export_materials="EXPORT")
try:
    bpy.ops.export_scene.gltf(**kw, export_draco_mesh_compression_enable=True,
                              export_draco_mesh_compression_level=7)
    draco = True
except Exception as e:  # Draco isn't bundled in every Blender build
    print("draco unavailable:", e)
    bpy.ops.export_scene.gltf(**kw)
    draco = False

to_gltf = lambda v: [round(v.x, 5), round(v.z, 5), round(-v.y, 5)]
with open(os.path.join(OUTDIR, "props.json"), "w") as f:
    json.dump({"glass": [to_gltf(v) for v in corners], "deskTop": DESK_TOP, "draco": draco}, f, indent=1)
print("wrote", out, os.path.getsize(out), "draco" if draco else "")
