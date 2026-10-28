"""Render the opening scene: the TV turned slightly on a bamboo desk, with a
Herman Miller Aeron pushed in under the desk (needs scripts/models/aeron.obj,
see chair_model.py).

Writes, for each camera (desk = 16:9 desktop, phone = 9:16 portrait):
  OUTDIR/scene-<cam>.png        the beauty render (screen off)
  OUTDIR/scene-<cam>-mask.png   white where the picture tube is visible
  OUTDIR/scene.json             screen corners and TV bounds, as 0..1 of the image
Run: python3 build_scene.py OUTDIR [width_px] [samples] [desk|phone|home|all]
"""
import json
import math
import os
import sys

import bpy
from bpy_extras.object_utils import world_to_camera_view
from mathutils import Euler, Matrix, Vector

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import chair_model  # noqa: E402
import tv_model  # noqa: E402

OUTDIR = sys.argv[1] if len(sys.argv) > 1 else "."
RES = int(sys.argv[2]) if len(sys.argv) > 2 else 1920
SAMPLES = int(sys.argv[3]) if len(sys.argv) > 3 else 128
WHICH = sys.argv[4] if len(sys.argv) > 4 else "both"

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


def plank_material(name, tone_a, tone_b, brick_w, row_h, rough, coat, mortar=0.0015, mortar_col=None):
    """Long staggered strips (bamboo laminate, floorboards) from a brick texture."""
    m, p = principled(name, tone_a, rough=rough, coat=coat)
    nt = m.node_tree
    tc = nt.nodes.new("ShaderNodeTexCoord")
    br = nt.nodes.new("ShaderNodeTexBrick")
    br.offset = 0.37
    br.squash = 1.0
    br.inputs["Color1"].default_value = (*tone_a, 1)
    br.inputs["Color2"].default_value = (*tone_b, 1)
    br.inputs["Mortar"].default_value = (*(mortar_col or tone_b), 1)
    br.inputs["Scale"].default_value = 1.0
    br.inputs["Mortar Size"].default_value = mortar
    br.inputs["Brick Width"].default_value = brick_w
    br.inputs["Row Height"].default_value = row_h
    br.inputs["Bias"].default_value = 0.0
    nz = nt.nodes.new("ShaderNodeTexNoise")
    nz.inputs["Scale"].default_value = 18.0
    nz.inputs["Detail"].default_value = 6.0
    # Stretch the noise along the strips so it reads as grain.
    mp = nt.nodes.new("ShaderNodeMapping")
    mp.inputs["Scale"].default_value = (0.08, 1.0, 1.0)
    nt.links.new(tc.outputs["Object"], mp.inputs["Vector"])
    nt.links.new(mp.outputs["Vector"], nz.inputs["Vector"])
    nt.links.new(tc.outputs["Object"], br.inputs["Vector"])
    mix = nt.nodes.new("ShaderNodeMix")
    mix.data_type = "RGBA"
    mix.blend_type = "MULTIPLY"
    mix.inputs["Factor"].default_value = 0.35
    nt.links.new(br.outputs["Color"], mix.inputs["A"])
    nt.links.new(nz.outputs["Color"], mix.inputs["B"])
    nt.links.new(mix.outputs["Result"], p.inputs["Base Color"])
    bump = nt.nodes.new("ShaderNodeBump")
    bump.inputs["Strength"].default_value = 0.08
    nt.links.new(br.outputs["Fac"], bump.inputs["Height"])
    nt.links.new(bump.outputs["Normal"], p.inputs["Normal"])
    return m


BAMBOO = plank_material("bamboo", (0.60, 0.40, 0.17), (0.38, 0.21, 0.07), 0.45, 0.022, 0.30, 0.35,
                        mortar=0.05, mortar_col=(0.30, 0.15, 0.05))
FLOOR = plank_material("floor", (0.11, 0.065, 0.04), (0.085, 0.05, 0.03), 1.2, 0.14, 0.45, 0.1,
                       mortar=0.006, mortar_col=(0.03, 0.02, 0.015))
WALL, _ = principled("wall", (0.20, 0.17, 0.16), rough=0.85)
STEEL, _ = principled("steel", (0.025, 0.025, 0.028), rough=0.35, metallic=0.6)
CASE, _ = principled("dvd_case", (0.01, 0.01, 0.012), rough=0.3)
CASE_ART = [principled(f"art{i}", c, rough=0.4)[0] for i, c in enumerate(
    [(0.55, 0.08, 0.12), (0.05, 0.18, 0.45), (0.75, 0.55, 0.10)])]
REMOTE, _ = principled("remote", (0.035, 0.035, 0.04), rough=0.4)


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


# ---- Room ----
bpy.ops.mesh.primitive_plane_add(size=12, location=(0, 0, 0))
floor = bpy.context.object
floor.data.materials.append(FLOOR)
cube("wall", (12, 0.1, 5), (0, 0.50, 2.5), WALL)
cube("skirting", (12, 0.02, 0.09), (0, 0.44, 0.045), STEEL)

# ---- Bamboo desk on a black steel frame ----
cube("desk_top", (1.50, 0.75, 0.032), (0, 0, DESK_TOP - 0.016), BAMBOO, bevel=0.004)
for x in (-0.68, 0.68):
    cube(f"leg{x}", (0.06, 0.06, DESK_TOP - 0.06), (x, 0, (DESK_TOP - 0.06) / 2 + 0.02), STEEL, bevel=0.004)
    cube(f"foot{x}", (0.07, 0.68, 0.03), (x, 0, 0.02), STEEL, bevel=0.006)
    cube(f"rail{x}", (0.06, 0.62, 0.04), (x, 0, DESK_TOP - 0.052), STEEL, bevel=0.004)
cube("crossbar", (1.30, 0.04, 0.08), (0, 0.22, DESK_TOP - 0.08), STEEL, bevel=0.004)

# ---- TV ----
rig, glass = tv_model.build("crt")
rig.scale = (0.25, 0.25, 0.25)
# The room light is flatter than the studio the frame was shot in; darken the
# plastic a touch so it still reads as silver rather than white.
for name, col in (("silver", (0.46, 0.47, 0.49)), ("silver_light", (0.54, 0.55, 0.57))):
    bpy.data.materials[name].node_tree.nodes["Principled BSDF"].inputs["Base Color"].default_value = (*col, 1)
rig.rotation_euler = (0, 0, TV_YAW)
rig.location = (-0.30, 0.04, DESK_TOP - 0.25 * 0.012)

# A few DVD cases and the remote next to the set.
for i, (dz, rot) in enumerate([(0.0, 4), (0.015, -6), (0.03, 11)]):
    c = cube(f"dvd{i}", (0.135, 0.19, 0.014), (0.10, 0.08, DESK_TOP + 0.007 + dz), CASE, bevel=0.002,
             rot=(0, 0, math.radians(rot)))
    c.data.materials.append(CASE_ART[i])
    # Cover art on the top face only.
    for poly in c.data.polygons:
        if poly.normal.z > 0.9:
            poly.material_index = 1
cube("remote", (0.05, 0.19, 0.022), (0.30, -0.14, DESK_TOP + 0.011), REMOTE, bevel=0.008,
     rot=(0, 0, math.radians(-24)))

# A framed print above the desk.
cube("frame", (0.62, 0.03, 0.46), (0.25, 0.43, 1.55), STEEL, bevel=0.004)
PRINT, pp = principled("print", (1, 1, 1), rough=0.6)
nt = PRINT.node_tree
grad = nt.nodes.new("ShaderNodeTexGradient")
tcp = nt.nodes.new("ShaderNodeTexCoord")
mpp = nt.nodes.new("ShaderNodeMapping")
mpp.inputs["Rotation"].default_value = (0, math.radians(90), 0)
nt.links.new(tcp.outputs["Generated"], mpp.inputs["Vector"])
nt.links.new(mpp.outputs["Vector"], grad.inputs["Vector"])
ramp = nt.nodes.new("ShaderNodeValToRGB")
ramp.color_ramp.elements[0].color = (0.45, 0.10, 0.17, 1)
ramp.color_ramp.elements[1].color = (0.75, 0.38, 0.12, 1)
nt.links.new(grad.outputs["Fac"], ramp.inputs["Fac"])
nt.links.new(ramp.outputs["Color"], pp.inputs["Base Color"])
cube("print", (0.54, 0.01, 0.38), (0.25, 0.414, 1.55), PRINT)

# ---- Aeron pushed in under the desk ----
chair = chair_model.build()
chair.location = (0.34, -0.15, 0)
chair.rotation_euler = (0, 0, math.radians(6))

# ---- Light ----
def area(name, loc, target, size, power, color):
    bpy.ops.object.light_add(type="AREA", location=loc)
    lt = bpy.context.object
    lt.name = name
    lt.data.size = size
    lt.data.energy = power
    lt.data.color = color
    d = Vector(target) - Vector(loc)
    lt.rotation_euler = d.to_track_quat("-Z", "Y").to_euler()
    lt.visible_camera = False
    lt.visible_glossy = False
    return lt


area("window", (-2.4, -1.4, 2.2), (-0.2, 0.0, 0.8), 2.2, 165, (1.0, 0.93, 0.84))
area("fill", (1.8, -2.6, 1.6), (0.0, 0.0, 0.9), 2.5, 55, (0.80, 0.86, 1.0))
area("rim", (1.6, 0.3, 2.0), (-0.2, 0.0, 0.9), 1.0, 90, (1.0, 0.78, 0.6))
area("wallwash", (0.0, -0.6, 2.6), (0.0, 0.45, 1.4), 1.5, 60, (1.0, 0.86, 0.80))

world = bpy.data.worlds.new("w")
scene.world = world
world.use_nodes = True
bg = world.node_tree.nodes["Background"]
bg.inputs["Color"].default_value = (0.06, 0.05, 0.055, 1)
bg.inputs["Strength"].default_value = 0.6

# ---- Cameras ----
CAMS = {
    "desk": dict(loc=(-0.70, -2.45, 1.40), target=(0.0, 0.0, 0.92), lens=38, res=(RES, round(RES * 9 / 16))),
    "phone": dict(loc=(-0.50, -2.05, 1.40), target=(-0.08, 0.0, 0.80), lens=30,
                  res=(round(RES * 9 / 16), RES)),
    # Home screen background: the same view with the lens shifted so the desk sits
    # on the right, leaving the left for the navigation and type.
    "home": dict(loc=(-0.70, -2.45, 1.40), target=(0.0, 0.0, 0.92), lens=34, shift=(-0.2, 0.0),
                 res=(RES, round(RES * 9 / 16))),
}

scene.render.engine = "CYCLES"
scene.cycles.device = "CPU"
scene.cycles.use_denoising = True
scene.render.resolution_percentage = 100
scene.render.image_settings.file_format = "PNG"
scene.view_settings.view_transform = "AgX"
scene.view_settings.look = "AgX - Medium High Contrast"


def glass_corners():
    """Picture-tube corners in world space (tl, tr, br, bl), on the tube face."""
    g = tv_model
    hw, hh = g.GLASS_W / 2, g.GLASS_H / 2
    y = g.FRONT + g.RECESS - 0.03 - 0.012
    local = [Vector((-hw, y, g.SCR_CZ + hh)), Vector((hw, y, g.SCR_CZ + hh)),
             Vector((hw, y, g.SCR_CZ - hh)), Vector((-hw, y, g.SCR_CZ - hh))]
    bpy.context.view_layer.update()
    return [rig.matrix_world @ v for v in local]


def tv_bounds():
    pts = []
    for ob in rig.children:
        if ob.type != "MESH" or ob.hide_render:
            continue
        pts += [ob.matrix_world @ Vector(c) for c in ob.bound_box]
    return pts


def to_image(cam, pts):
    out = []
    for p in pts:
        v = world_to_camera_view(scene, cam, p)
        out.append([round(v.x, 5), round(1 - v.y, 5)])
    return out


meta = {}
for name, c in CAMS.items():
    if WHICH not in ("all", "both", name):
        continue
    bpy.ops.object.camera_add(location=c["loc"])
    cam = bpy.context.object
    cam.name = f"cam_{name}"
    cam.data.lens = c["lens"]
    cam.data.sensor_fit = "AUTO"
    cam.data.shift_x, cam.data.shift_y = c.get("shift", (0, 0))
    d = Vector(c["target"]) - Vector(c["loc"])
    cam.rotation_euler = d.to_track_quat("-Z", "Y").to_euler()
    scene.camera = cam
    scene.render.resolution_x, scene.render.resolution_y = c["res"]

    # Beauty pass.
    scene.cycles.samples = SAMPLES
    scene.render.film_transparent = False
    scene.render.image_settings.color_mode = "RGB"
    scene.render.filepath = os.path.join(OUTDIR, f"scene-{name}.png")
    bpy.ops.render.render(write_still=True)

    bpy.context.view_layer.update()
    xs = to_image(cam, tv_bounds())
    meta[name] = {
        "width": c["res"][0], "height": c["res"][1],
        "screen": to_image(cam, glass_corners()),
        "tv": [min(p[0] for p in xs), min(p[1] for p in xs), max(p[0] for p in xs), max(p[1] for p in xs)],
    }
    print("META", name, json.dumps(meta[name]))

# ---- Mask pass: white where the tube is visible, transparent elsewhere ----
white = bpy.data.materials.new("mask_white")
white.use_nodes = True
nt = white.node_tree
nt.nodes.clear()
em = nt.nodes.new("ShaderNodeEmission")
em.inputs["Strength"].default_value = 1.0
o = nt.nodes.new("ShaderNodeOutputMaterial")
nt.links.new(em.outputs[0], o.inputs["Surface"])
hold = bpy.data.materials.new("mask_hold")
hold.use_nodes = True
nt = hold.node_tree
nt.nodes.clear()
h = nt.nodes.new("ShaderNodeHoldout")
o = nt.nodes.new("ShaderNodeOutputMaterial")
nt.links.new(h.outputs[0], o.inputs["Surface"])
for ob in scene.objects:
    if ob.type in ("MESH", "FONT", "CURVE"):
        mats = ob.data.materials
        for i in range(len(mats)):
            mats[i] = white if ob is glass else hold
        if not len(mats):
            mats.append(hold)
scene.cycles.samples = 16
scene.cycles.use_denoising = False
scene.render.film_transparent = True
scene.render.image_settings.color_mode = "RGBA"
scene.view_settings.view_transform = "Standard"
scene.view_settings.look = "None"
for name, c in CAMS.items():
    if name not in meta:
        continue
    scene.camera = bpy.data.objects[f"cam_{name}"]
    scene.render.resolution_x, scene.render.resolution_y = c["res"]
    scene.render.filepath = os.path.join(OUTDIR, f"scene-{name}-mask.png")
    bpy.ops.render.render(write_still=True)

path = os.path.join(OUTDIR, "scene.json")
old = json.load(open(path)) if os.path.exists(path) else {}
old.update(meta)
json.dump(old, open(path, "w"), indent=1)
print("WROTE", path)
