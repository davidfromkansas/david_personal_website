"""Model a Gear Aid HeroClip (medium, Stealth Black) and export it as a .glb for the
Favorites page, where it spins slowly (beach/src/spin.js).

Traced from Gear Aid's product photos and spec sheet (gearaid.com/products/heroclip-medium),
in its opened-out pose, 7.25" (184 mm) tall:
- a flat, machined aluminium clip, an oval with a wire-loop spring gate across its right side;
- a black swivel block (two halves that turn 360° against each other) riveted to the clip's
  top-left corner;
- a flat C-shaped hang hook riveted to the top of the block (it folds down over the clip),
  ending in a black rubber foot.
Everything lies in the XZ plane (mm below, metres in the file), +Z up, the front face is -Y.

Run: python3 export_heroclip.py OUT.glb [poster.png]
(the poster is the still shown until the model loads, saved as art/favorites/heroclip.webp)
"""
import math
import sys

import bpy
from mathutils import Matrix, Vector

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


ANODIZED = material("anodized", (0.035, 0.036, 0.04), 0.4, 1.0)
STEEL = material("steel", (0.62, 0.63, 0.65), 0.22, 1.0)
PLASTIC = material("plastic", (0.018, 0.018, 0.02), 0.55)
RUBBER = material("rubber", (0.022, 0.022, 0.024), 0.85)
MARK = material("mark", (0.75, 0.76, 0.78), 0.5, 0.3)


def smooth_path(pts, n=10):
    """Catmull-Rom through pts (open), n samples per span."""
    P = [Vector((x, z)) for x, z in pts]
    P = [2 * P[0] - P[1]] + P + [2 * P[-1] - P[-2]]
    out = []
    for i in range(1, len(P) - 2):
        p0, p1, p2, p3 = P[i - 1], P[i], P[i + 1], P[i + 2]
        for k in range(n):
            t = k / n
            out.append(0.5 * ((2 * p1) + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t * t
                              + (-p0 + 3 * p1 - 3 * p2 + p3) * t ** 3))
    out.append(P[-2])
    return out


def finish(ob, mat, bevel=1.2, segments=3):
    ob.data.materials.append(mat)
    b = ob.modifiers.new("bevel", "BEVEL")
    b.width = bevel * MM
    b.segments = segments
    b.limit_method = "ANGLE"
    b.angle_limit = math.radians(40)
    for p in ob.data.polygons:
        p.use_smooth = True
    return ob


def bar(name, pts, width, thick, mat, round_ends=True, bevel=1.2):
    """A flat machined bar of the given in-plane width and depth along pts (XZ, mm)."""
    c = smooth_path(pts)
    left, right = [], []
    for i, p in enumerate(c):
        d = (c[min(i + 1, len(c) - 1)] - c[max(i - 1, 0)]).normalized()
        nrm = Vector((-d.y, d.x))
        left.append(p + nrm * width / 2)
        right.append(p - nrm * width / 2)
    verts2d = left + right
    n = len(c)
    faces = [(i, i + 1, n + i + 1, n + i) for i in range(n - 1)]
    # Rounded ends: a fan of half-circle points around each end's centre.
    for end, sign in ((0, -1), (n - 1, 1)):
        if not round_ends:
            break
        p = c[end]
        fwd = (c[min(end + 1, n - 1)] - c[max(end - 1, 0)]).normalized()
        nrm = Vector((-fwd.y, fwd.x))   # towards the left edge
        ring = []
        for k in range(1, 8):
            a = math.pi * k / 8
            ring.append(len(verts2d))
            verts2d.append(p + (nrm * math.cos(a) + fwd * sign * math.sin(a)) * width / 2)
        centre = len(verts2d)
        verts2d.append(p)
        chain = [end] + ring + [n + end]
        for a, b in zip(chain, chain[1:]):
            faces.append((centre, a, b))
    verts = [(v.x * MM, -thick / 2 * MM, v.y * MM) for v in verts2d]
    me = bpy.data.meshes.new(name)
    me.from_pydata(verts, [], faces)
    me.validate()
    ob = bpy.data.objects.new(name, me)
    scene.collection.objects.link(ob)
    s = ob.modifiers.new("solid", "SOLIDIFY")
    s.thickness = thick * MM
    s.offset = 1
    s.use_even_offset = True
    bpy.context.view_layer.objects.active = ob
    bpy.ops.object.select_all(action="DESELECT")
    ob.select_set(True)
    bpy.ops.object.modifier_apply(modifier="solid")
    bpy.ops.object.mode_set(mode="EDIT")
    bpy.ops.mesh.select_all(action="SELECT")
    bpy.ops.mesh.normals_make_consistent(inside=False)
    bpy.ops.object.mode_set(mode="OBJECT")
    return finish(ob, mat, bevel)


def tube(name, pts, r, mat, cyclic=False):
    """A round wire (radius r mm) along pts in the XZ plane."""
    cu = bpy.data.curves.new(name, "CURVE")
    cu.dimensions = "3D"
    cu.bevel_depth = r * MM
    cu.bevel_resolution = 3
    cu.use_fill_caps = True
    sp = cu.splines.new("POLY")
    c = smooth_path(pts, 8)
    sp.points.add(len(c) - 1)
    for p, v in zip(sp.points, c):
        p.co = (v.x * MM, 0, v.y * MM, 1)
    sp.use_cyclic_u = cyclic
    ob = bpy.data.objects.new(name, cu)
    scene.collection.objects.link(ob)
    ob.data.materials.append(mat)
    return ob


def box(name, centre, along, length, width, depth, mat, bevel=2.5):
    """A rounded block centred at centre (XZ), its long side along the unit vector `along`."""
    bpy.ops.mesh.primitive_cube_add(size=1, location=(centre[0] * MM, 0, centre[1] * MM))
    ob = bpy.context.object
    ob.name = name
    ob.scale = (width * MM, depth * MM, length * MM)
    ob.rotation_euler = (0, math.atan2(along[0], along[1]), 0)
    bpy.ops.object.transform_apply(scale=True, rotation=True)
    finish(ob, mat, bevel, 4)
    return ob


def rivet(name, at, depth, r=3.0):
    """A domed steel rivet head on both faces of a part `depth` mm thick."""
    for side in (-1, 1):
        bpy.ops.mesh.primitive_uv_sphere_add(segments=32, ring_count=12, radius=1,
                                             location=(at[0] * MM, side * depth / 2 * MM, at[1] * MM))
        ob = bpy.context.object
        ob.name = name
        ob.scale = (r * MM, 1.3 * MM, r * MM)
        ob.data.materials.append(STEEL)
        for p in ob.data.polygons:
            p.use_smooth = True


# ---- Key points, traced from the spec sheet (origin: middle of the swivel block) ----
R_HOOK = Vector((-3.1, 17.6))   # rivet joining the hook to the block
R_CLIP = Vector((3.1, -17.8))   # rivet joining the block to the clip
AXIS = (R_HOOK - R_CLIP).normalized()

# The clip: an oval with its gap (and gate) on the right, the block at its top-left corner.
CLIP_T = 5.0
clip = [(42.5, -24.5), (40.5, -17.5), (33, -12.6), (21, -11.4), (10, -13.4), R_CLIP[:],
        (-2.8, -30), (-8.5, -49), (-11, -67), (-7.5, -81.5), (4, -89.5), (19, -90.5),
        (32, -85.5), (40.5, -76), (41.5, -69), (37.5, -64.5)]
bar("clip", clip, 7.6, CLIP_T, ANODIZED)
# Spring gate: a narrow loop of steel wire from the clip's upper right to its catch.
g0, g1 = Vector((40.0, -26.0)), Vector((33.5, -63.0))
gd = (g1 - g0).normalized()
gn = Vector((-gd.y, gd.x)) * 1.9
gate = [g0 + gn, g0 + gn * 0.3 + gd * 10, g1 + gn * 0.3 - gd * 4, g1 + gn,
        g1 + gd * 2.2, g1 - gn, g1 - gn * 0.3 - gd * 4, g0 - gn * 0.3 + gd * 10, g0 - gn, g0 - gd * 2.2]
tube("gate", [p[:] for p in gate], 0.8, STEEL, cyclic=True)
# Gate pivot pin and the catch lip it snaps under.
rivet("gate_pin", g0, CLIP_T, r=1.9)

# The swivel block: two halves turning against each other at the middle.
BLOCK_D = 10.5
half = 24.0
for nm, sign in (("block_top", 1), ("block_bottom", -1)):
    c = AXIS * sign * (half / 2 + 0.6)
    box(nm, c[:], AXIS[:], half, 13.0, BLOCK_D, PLASTIC)
box("swivel_ring", (0, 0), AXIS[:], 1.4, 11.6, 9.4, STEEL, bevel=0.5)
rivet("rivet_hook", R_HOOK, BLOCK_D)
rivet("rivet_clip", R_CLIP, BLOCK_D)

# The hang hook: a flat C, opening to the right, from the block round to its rubber foot.
hook = [R_HOOK[:], (-10.5, 24.5), (-19, 34), (-24.5, 46), (-25.5, 58.5), (-22, 69.5),
        (-14, 77.5), (-3.5, 81.5), (6.5, 80.5)]
bar("hook", hook, 6.4, 4.6, ANODIZED, bevel=1.0)
# The foot: a black rubber block on the hook's tip, with a rivet through it.
FOOT = Vector((9.5, 78.0))
box("foot", (FOOT + Vector((1.2, -1.6)))[:], (0.45, 0.89), 12.5, 12.0, 9.0, RUBBER, bevel=2.8)
rivet("rivet_foot", FOOT, 9.0, r=2.8)

# Laser-etched "GEAR AID" down the clip's left leg, on both faces, letters' tops to the inside.
def etch(body, at, size):
    down = Vector((-0.29, 0, -0.96))   # the leg's direction at `at`
    for side in (-1, 1):
        bpy.ops.object.text_add(location=(at[0] * MM, side * (CLIP_T / 2 + 0.03) * MM, at[1] * MM))
        t = bpy.context.object
        t.data.body = body
        t.data.size = size * MM
        t.data.extrude = 0.03 * MM
        t.data.align_x = "CENTER"
        t.data.align_y = "CENTER"
        # lay it flat on the face (normal towards `side`), then turn its baseline down the leg
        face = Matrix.Rotation(math.radians(90), 3, "X")
        if side > 0:
            face = Matrix.Rotation(math.pi, 3, "Z") @ face
        base = face @ Vector((1, 0, 0))
        turn = math.atan2(base.z, base.x) - math.atan2(down.z, down.x)
        t.rotation_euler = (Matrix.Rotation(turn, 3, "Y") @ face).to_euler()
        t.data.materials.append(MARK)


etch("GEAR AID", (-8.2, -47.0), 4.2)

# Bake curves and text to meshes, then centre the model on its bounding box.
bpy.ops.object.select_all(action="DESELECT")
for ob in list(scene.objects):
    if ob.type in ("CURVE", "FONT"):
        bpy.context.view_layer.objects.active = ob
        ob.select_set(True)
bpy.ops.object.convert(target="MESH")
for ob in scene.objects:
    if ob.type == "MESH" and ob.name.startswith("gate"):
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
    scene.cycles.samples = 48
    scene.render.resolution_x = scene.render.resolution_y = 600
    scene.render.film_transparent = True
    scene.render.image_settings.color_mode = "RGBA"
    world = bpy.data.worlds.new("w")
    world.use_nodes = True
    world.node_tree.nodes["Background"].inputs[0].default_value = (0.16, 0.18, 0.19, 1)
    scene.world = world
    for loc, power in (((0.5, -0.7, 0.5), 50), ((-0.5, -0.35, 0.15), 14), ((0, 0.6, 0.4), 40)):
        bpy.ops.object.light_add(type="AREA", location=loc)
        L = bpy.context.object
        L.data.energy = power
        L.data.size = 0.5
        L.rotation_euler = (Vector((0, 0, 0)) - Vector(loc)).to_track_quat("-Z", "Y").to_euler()
    bpy.ops.object.camera_add(location=(0.17, -0.47, 0.06))
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
