"""Model a Gear Aid HeroClip (medium, Stealth Black) and export it as a .glb for the
Favorites page, where it spins slowly (beach/src/spin.js).

Built from the published specs (3" wide, 3.75" tall closed): a D-shaped machined aluminium
clip with a spring gate, a swivel hub at its base and a flat hook that folds up across the
clip's face, ending in a rubber tip. Units are metres, +Z up, the hook on the -Y face.

Run: python3 export_heroclip.py OUT.glb [poster.png]
(the poster is the still shown until the model loads, saved as art/favorites/heroclip.webp)
"""
import math
import sys

import bpy
from mathutils import Vector

OUT = sys.argv[1]
PREVIEW = sys.argv[2] if len(sys.argv) > 2 else None
MM = 0.001

bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene


def material(name, color, rough, metallic=0.0):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    p = m.node_tree.nodes["Principled BSDF"]
    p.inputs["Base Color"].default_value = (*color, 1)
    p.inputs["Roughness"].default_value = rough
    p.inputs["Metallic"].default_value = metallic
    return m


ANODIZED = material("anodized", (0.035, 0.036, 0.04), 0.38, 1.0)
GATE = material("gate", (0.25, 0.26, 0.28), 0.3, 1.0)
RUBBER = material("rubber", (0.02, 0.02, 0.022), 0.85)
MARK = material("mark", (0.55, 0.56, 0.58), 0.5, 0.6)


def profile(name, w, h, r):
    """A rounded rectangle w x h (mm) to sweep along a path."""
    cu = bpy.data.curves.new(name, "CURVE")
    cu.dimensions = "2D"
    sp = cu.splines.new("POLY")
    pts = []
    for cx, cy, a0 in ((w / 2 - r, h / 2 - r, 0), (-w / 2 + r, h / 2 - r, 90),
                       (-w / 2 + r, -h / 2 + r, 180), (w / 2 - r, -h / 2 + r, 270)):
        for k in range(5):
            a = math.radians(a0 + k * 22.5)
            pts.append(((cx + r * math.cos(a)) * MM, (cy + r * math.sin(a)) * MM))
    sp.points.add(len(pts) - 1)
    for p, (x, y) in zip(sp.points, pts):
        p.co = (x, y, 0, 1)
    sp.use_cyclic_u = True
    ob = bpy.data.objects.new(name, cu)
    scene.collection.objects.link(ob)
    ob.hide_render = True
    return ob


def sweep(name, pts, prof, mat, y=0.0):
    """A smooth bar along points in the XZ plane (mm), with prof as its cross-section."""
    cu = bpy.data.curves.new(name, "CURVE")
    cu.dimensions = "3D"
    cu.bevel_mode = "OBJECT"
    cu.bevel_object = prof
    cu.use_fill_caps = True
    cu.resolution_u = 6
    sp = cu.splines.new("BEZIER")
    sp.bezier_points.add(len(pts) - 1)
    for bp, (x, z) in zip(sp.bezier_points, pts):
        bp.co = (x * MM, y * MM, z * MM)
        bp.handle_left_type = bp.handle_right_type = "AUTO"
    ob = bpy.data.objects.new(name, cu)
    scene.collection.objects.link(ob)
    ob.data.materials.append(mat)
    return ob


def cylinder(name, r, depth, loc, mat, rot=(math.radians(90), 0, 0), verts=48):
    bpy.ops.mesh.primitive_cylinder_add(vertices=verts, radius=r * MM, depth=depth * MM,
                                        location=[v * MM for v in loc], rotation=rot)
    ob = bpy.context.object
    ob.name = name
    ob.data.materials.append(mat)
    bev = ob.modifiers.new("bevel", "BEVEL")
    bev.width = 0.6 * MM
    bev.segments = 3
    bev.limit_method = "ANGLE"
    for p in ob.data.polygons:
        p.use_smooth = True
    return ob


# ---- The clip: a D, its straight spine on the left, the gate closing the right side ----
body_prof = profile("body_prof", 6.5, 9.0, 2.2)   # thin across the face, deep front to back
clip = [(-4, 4), (-22, 10), (-33, 26), (-35, 46), (-29, 62), (-14, 72), (4, 74),
        (20, 68), (31, 54), (33, 40), (28, 30)]
sweep("clip", clip, body_prof, ANODIZED)
# The nose: a small hooked lip the gate snaps against.
sweep("nose", [(28, 30), (24, 27), (21, 29)], profile("nose_prof", 5.0, 9.0, 2.0), ANODIZED)
# The gate: a solid bar from the hub to the nose, slightly inside the D.
sweep("gate", [(6, 8), (13, 17), (20, 26.5)], profile("gate_prof", 3.6, 3.6, 1.7), GATE)
# Gate pin and the clip's base block, where the swivel sits.
cylinder("gate_pin", 2.2, 10.5, (6, 0, 8), GATE)
bpy.ops.mesh.primitive_cube_add(size=1, location=(0, 0, 1 * MM))
base = bpy.context.object
base.name = "base"
base.scale = (20 * MM, 9.5 * MM, 12 * MM)
bpy.ops.object.transform_apply(scale=True)
bev = base.modifiers.new("bevel", "BEVEL")
bev.width = 3 * MM
bev.segments = 4
base.data.materials.append(ANODIZED)
for p in base.data.polygons:
    p.use_smooth = True

# ---- Swivel hub below the clip, and the hook folded up across the clip's front face ----
cylinder("swivel", 6.5, 6, (0, 0, -8), ANODIZED, rot=(0, 0, 0))
cylinder("swivel_ring", 7.2, 1.2, (0, 0, -5), GATE, rot=(0, 0, 0))
cylinder("pivot", 7, 14, (0, 0, -15), ANODIZED)
cylinder("pivot_cap_f", 3.2, 15.2, (0, 0, -15), GATE)

HOOK_Y = -9.5   # in front of the clip
hook_prof = profile("hook_prof", 10.0, 3.2, 1.3)
hook = [(0, -15), (0, 10), (-1, 36), (-3, 54), (-8, 63), (-16, 64), (-21, 58), (-21, 50)]
h = sweep("hook", hook, hook_prof, ANODIZED, y=HOOK_Y)
# Side plates joining the hook to the pivot.
for y in (-4.5, -14.5):
    bpy.ops.mesh.primitive_cube_add(size=1, location=(0, y * MM, -11 * MM))
    plate = bpy.context.object
    plate.scale = (14 * MM, 2.2 * MM, 14 * MM)
    bpy.ops.object.transform_apply(scale=True)
    m = plate.modifiers.new("bevel", "BEVEL")
    m.width = 2 * MM
    m.segments = 3
    plate.data.materials.append(ANODIZED)
# The rubber tip on the end of the hook.
bpy.ops.mesh.primitive_uv_sphere_add(segments=32, ring_count=16, radius=1, location=(-21 * MM, HOOK_Y * MM, 48 * MM))
tip = bpy.context.object
tip.scale = (6.2 * MM, 4.2 * MM, 7.5 * MM)
tip.data.materials.append(RUBBER)
for p in tip.data.polygons:
    p.use_smooth = True

# Laser-etched name up the hook's face.
bpy.ops.object.text_add(location=(1.8 * MM, (HOOK_Y - 1.65) * MM, 2 * MM), rotation=(math.radians(90), 0, math.radians(90)))
txt = bpy.context.object
txt.data.body = "HEROCLIP"
txt.data.size = 5.2 * MM
txt.data.extrude = 0.05 * MM
txt.rotation_euler = (math.radians(90), math.radians(-90), 0)
txt.data.materials.append(MARK)

# Bake the curves and text to meshes, centre the clip on its bounding box.
bpy.ops.object.select_all(action="DESELECT")
for ob in list(scene.objects):
    if ob.type in ("CURVE", "FONT") and not ob.hide_render:
        bpy.context.view_layer.objects.active = ob
        ob.select_set(True)
bpy.ops.object.convert(target="MESH")
for ob in list(scene.objects):
    if ob.hide_render:
        bpy.data.objects.remove(ob)
for ob in scene.objects:
    if ob.type == "MESH" and ob.name.split(".")[0] in ("clip", "nose", "gate", "hook"):
        for p in ob.data.polygons:
            p.use_smooth = True

bpy.context.view_layer.update()
lo = Vector((1e9,) * 3)
hi = Vector((-1e9,) * 3)
for ob in scene.objects:
    for c in ob.bound_box:
        w = ob.matrix_world @ Vector(c)
        lo = Vector(map(min, lo, w))
        hi = Vector(map(max, hi, w))
mid = (lo + hi) / 2
for ob in scene.objects:
    ob.location -= mid
print("size mm", [round(v / MM, 1) for v in hi - lo])

if PREVIEW:
    scene.render.engine = "CYCLES"
    scene.cycles.samples = 32
    scene.render.resolution_x = scene.render.resolution_y = 600
    scene.render.film_transparent = True
    scene.render.image_settings.color_mode = "RGBA"
    world = bpy.data.worlds.new("w")
    world.use_nodes = True
    world.node_tree.nodes["Background"].inputs[0].default_value = (0.35, 0.4, 0.42, 1)
    scene.world = world
    for loc, power in (((0.3, -0.4, 0.3), 40), ((-0.3, -0.2, 0.1), 15), ((0, 0.4, 0.3), 20)):
        bpy.ops.object.light_add(type="AREA", location=loc)
        L = bpy.context.object
        L.data.energy = power
        L.data.size = 0.3
        L.rotation_euler = (Vector((0, 0, 0)) - Vector(loc)).to_track_quat("-Z", "Y").to_euler()
    bpy.ops.object.camera_add(location=(0.12, -0.3, 0.05))
    cam = bpy.context.object
    cam.data.lens = 85
    cam.rotation_euler = (Vector((0, 0, 0)) - cam.location).to_track_quat("-Z", "Y").to_euler()
    scene.camera = cam
    scene.render.filepath = PREVIEW
    bpy.ops.render.render(write_still=True)
    for ob in list(scene.objects):
        if ob.type in ("LIGHT", "CAMERA"):
            bpy.data.objects.remove(ob)

bpy.ops.export_scene.gltf(filepath=OUT, export_format="GLB", export_apply=True, export_yup=True,
                          export_materials="EXPORT")
print("wrote", OUT)
