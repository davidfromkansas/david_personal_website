"""Render the background scenes and nav-tile art for the home screen (art/*.webp).

One small Blender set per section, lit for white type on the left third (Home is
the TV desk scene from build_scene.py):
  work     glossy steps climbing toward a light (focused, ambitious)
  writing  a notebook under a desk lamp at night (reflective, editorial)
  press    a studio mic under stage lights (energetic, conversational)
  fun      floating toy shapes on a candy backdrop (expressive, surprising)

Run: python3 build_home_art.py OUTDIR [work|writing|press|fun|all] [width_px] [samples]
Writes OUTDIR/<name>.png (16:9 background) and OUTDIR/<name>-tile.png (square).
"""
import math
import os
import random
import sys

import bpy
from mathutils import Vector

OUTDIR = sys.argv[1] if len(sys.argv) > 1 else "."
WHICH = sys.argv[2] if len(sys.argv) > 2 else "all"
RES = int(sys.argv[3]) if len(sys.argv) > 3 else 2400
SAMPLES = int(sys.argv[4]) if len(sys.argv) > 4 else 64


# ---- Helpers ----
def reset():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    sc = bpy.context.scene
    sc.render.engine = "CYCLES"
    sc.cycles.device = "CPU"
    sc.cycles.use_denoising = True
    sc.render.image_settings.file_format = "PNG"
    sc.render.image_settings.color_mode = "RGB"
    sc.view_settings.view_transform = "AgX"
    sc.view_settings.look = "AgX - Medium High Contrast"
    return sc


def mat(name, color, rough=0.5, metallic=0.0, emission=None, strength=1.0, coat=0.0, alpha=1.0):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    p = m.node_tree.nodes["Principled BSDF"]
    p.inputs["Base Color"].default_value = (*color, 1)
    p.inputs["Roughness"].default_value = rough
    p.inputs["Metallic"].default_value = metallic
    p.inputs["Coat Weight"].default_value = coat
    p.inputs["Alpha"].default_value = alpha
    if emission:
        p.inputs["Emission Color"].default_value = (*emission, 1)
        p.inputs["Emission Strength"].default_value = strength
    return m


def emit(name, color, strength):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    nt = m.node_tree
    nt.nodes.clear()
    e = nt.nodes.new("ShaderNodeEmission")
    e.inputs["Color"].default_value = (*color, 1)
    e.inputs["Strength"].default_value = strength
    o = nt.nodes.new("ShaderNodeOutputMaterial")
    nt.links.new(e.outputs[0], o.inputs["Surface"])
    return m


def put(ob, material, smooth=True):
    ob.data.materials.clear()
    ob.data.materials.append(material)
    if smooth and hasattr(ob.data, "polygons"):
        for p in ob.data.polygons:
            p.use_smooth = True
    return ob


def cube(size, loc, material, rot=(0, 0, 0), bevel=0.0, seg=4):
    bpy.ops.mesh.primitive_cube_add(size=1, location=loc, rotation=rot)
    ob = bpy.context.object
    ob.scale = size
    bpy.ops.object.transform_apply(scale=True)
    if bevel:
        b = ob.modifiers.new("b", "BEVEL")
        b.width = bevel
        b.segments = seg
    return put(ob, material, smooth=bool(bevel))


def cyl(r, depth, loc, material, rot=(0, 0, 0), verts=64, bevel=0.0):
    bpy.ops.mesh.primitive_cylinder_add(vertices=verts, radius=r, depth=depth, location=loc, rotation=rot)
    ob = bpy.context.object
    if bevel:
        b = ob.modifiers.new("b", "BEVEL")
        b.width = bevel
        b.segments = 3
        b.limit_method = "ANGLE"
    put(ob, material)
    ob.data.set_sharp_from_angle(angle=math.radians(40)) if hasattr(ob.data, "set_sharp_from_angle") else None
    return ob


def sphere(r, loc, material, scale=(1, 1, 1)):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=64, ring_count=32, radius=r, location=loc)
    ob = bpy.context.object
    ob.scale = scale
    return put(ob, material)


def torus(major, minor, loc, material, rot=(0, 0, 0)):
    bpy.ops.mesh.primitive_torus_add(major_radius=major, minor_radius=minor, major_segments=96,
                                     minor_segments=32, location=loc, rotation=rot)
    return put(bpy.context.object, material)


def area(loc, target, size, power, color=(1, 1, 1), visible=False, shape="SQUARE"):
    bpy.ops.object.light_add(type="AREA", location=loc)
    lt = bpy.context.object
    lt.data.shape = shape
    lt.data.size = size
    lt.data.energy = power
    lt.data.color = color
    lt.rotation_euler = (Vector(target) - Vector(loc)).to_track_quat("-Z", "Y").to_euler()
    lt.visible_camera = visible
    return lt


def point(loc, power, color, radius=0.05):
    bpy.ops.object.light_add(type="POINT", location=loc)
    lt = bpy.context.object
    lt.data.energy = power
    lt.data.color = color
    lt.data.shadow_soft_size = radius
    return lt


def sky(stops, strength=1.0):
    """World gradient by view height: stops = [(pos 0..1, (r, g, b)), ...] bottom to top."""
    sc = bpy.context.scene
    w = bpy.data.worlds.new("w")
    sc.world = w
    w.use_nodes = True
    nt = w.node_tree
    bg = nt.nodes["Background"]
    tc = nt.nodes.new("ShaderNodeTexCoord")
    sep = nt.nodes.new("ShaderNodeSeparateXYZ")
    mr = nt.nodes.new("ShaderNodeMapRange")
    mr.inputs["From Min"].default_value = -1
    mr.inputs["From Max"].default_value = 1
    ramp = nt.nodes.new("ShaderNodeValToRGB")
    nt.links.new(tc.outputs["Generated"], sep.inputs[0])
    nt.links.new(sep.outputs["Z"], mr.inputs["Value"])
    nt.links.new(mr.outputs["Result"], ramp.inputs["Fac"])
    nt.links.new(ramp.outputs["Color"], bg.inputs["Color"])
    els = ramp.color_ramp.elements
    while len(els) < len(stops):
        els.new(0.5)
    for el, (pos, col) in zip(els, stops):
        el.position = pos
        el.color = (*col, 1)
    bg.inputs["Strength"].default_value = strength


def camera(loc, target, lens, dof=None, fstop=2.8, name="cam"):
    bpy.ops.object.camera_add(location=loc)
    cam = bpy.context.object
    cam.name = name
    cam.data.lens = lens
    cam.rotation_euler = (Vector(target) - Vector(loc)).to_track_quat("-Z", "Y").to_euler()
    if dof:
        cam.data.dof.use_dof = True
        cam.data.dof.focus_distance = dof
        cam.data.dof.aperture_fstop = fstop
    return cam


def shoot(name, hero, tile, samples=SAMPLES):
    sc = bpy.context.scene
    sc.cycles.samples = samples
    for cam, suffix, res in ((hero, "", (RES, round(RES * 9 / 16))), (tile, "-tile", (512, 512))):
        if cam is None:
            continue
        sc.camera = cam
        sc.render.resolution_x, sc.render.resolution_y = res
        sc.render.filepath = os.path.join(OUTDIR, f"{name}{suffix}.png")
        bpy.ops.render.render(write_still=True)
        print("RENDERED", sc.render.filepath)


# ---- Work: glossy steps climbing toward a light ----
def work():
    reset()
    sky([(0.0, (0.0, 0.0, 0.0)), (0.5, (0.004, 0.006, 0.012)), (1.0, (0.01, 0.02, 0.04))], strength=1.0)
    floor = cube((40, 40, 0.1), (0, 0, -0.05), mat("floor", (0.01, 0.012, 0.016), rough=0.12, metallic=0.2))
    slab = mat("slab", (0.025, 0.03, 0.04), rough=0.18, metallic=0.5, coat=0.6)
    edge = emit("edge", (0.45, 0.75, 1.0), 6.0)
    steps = []
    for k in range(9):
        h = 0.35 + k * 0.42
        x = 1.0 + k * 0.62
        y = 2.0 + k * 0.35
        steps.append(cube((0.56, 1.6, h), (x, y, h / 2), slab, bevel=0.01))
        cube((0.56, 0.012, 0.012), (x, y - 0.8, h + 0.004), edge)
    # The light at the top of the climb.
    glow = sphere(0.22, (7.0, 5.4, 4.9), emit("goal", (1.0, 0.86, 0.62), 40.0))
    point((7.0, 5.3, 4.9), 900, (1.0, 0.8, 0.55), radius=0.3)
    for lt in (area((-3, -2, 6), (3, 3, 1), 6, 500, (0.35, 0.55, 1.0)),
               area((9, 7, 3), (4, 3, 1.5), 4, 400, (0.25, 0.45, 1.0))):
        lt.visible_glossy = False   # keep big light shapes out of the mirror floor
    hero = camera((-1.2, -6.5, 1.7), (3.6, 3.0, 2.0), 30)
    tile = camera((2.0, -2.6, 1.6), (4.6, 3.6, 2.8), 40, name="tile")
    shoot("work", hero, tile)


# ---- Writing: a notebook under a desk lamp at night ----
def writing():
    reset()
    sky([(0.0, (0.008, 0.01, 0.02)), (1.0, (0.02, 0.025, 0.05))], strength=1.0)
    wood = mat("wood", (0.12, 0.06, 0.03), rough=0.55, coat=0.1)
    nt = wood.node_tree
    p = nt.nodes["Principled BSDF"]
    wv = nt.nodes.new("ShaderNodeTexWave")
    wv.inputs["Scale"].default_value = 3.0
    wv.inputs["Distortion"].default_value = 6.0
    ramp = nt.nodes.new("ShaderNodeValToRGB")
    ramp.color_ramp.elements[0].color = (0.07, 0.035, 0.018, 1)
    ramp.color_ramp.elements[1].color = (0.16, 0.085, 0.045, 1)
    nt.links.new(wv.outputs["Fac"], ramp.inputs["Fac"])
    nt.links.new(ramp.outputs["Color"], p.inputs["Base Color"])
    cube((14, 9, 0.06), (0, 2.5, -0.03), wood)

    paper = mat("paper", (0.86, 0.82, 0.72), rough=0.7)
    pn = paper.node_tree
    pp = pn.nodes["Principled BSDF"]
    lines = pn.nodes.new("ShaderNodeTexWave")
    lines.wave_type = "BANDS"
    lines.bands_direction = "Y"
    lines.inputs["Scale"].default_value = 70
    lines.inputs["Distortion"].default_value = 0
    lr = pn.nodes.new("ShaderNodeValToRGB")
    lr.color_ramp.elements[0].position = 0.0
    lr.color_ramp.elements[0].color = (0.55, 0.62, 0.78, 1)
    lr.color_ramp.elements[1].position = 0.08
    lr.color_ramp.elements[1].color = (0.86, 0.82, 0.72, 1)
    tc = pn.nodes.new("ShaderNodeTexCoord")
    pn.links.new(tc.outputs["Object"], lines.inputs["Vector"])
    pn.links.new(lines.outputs["Fac"], lr.inputs["Fac"])
    pn.links.new(lr.outputs["Color"], pp.inputs["Base Color"])

    nx, ny = 0.75, -0.05
    for side in (-1, 1):
        pg = cube((0.42, 0.58, 0.018), (nx + side * 0.215, ny, 0.012 + 0.004 * (1 - side) / 2), paper,
                  rot=(0, side * math.radians(-3), 0), bevel=0.004)
    cube((0.88, 0.62, 0.012), (nx, ny, 0.004), mat("cover", (0.08, 0.10, 0.16), rough=0.6))
    pen = cyl(0.009, 0.36, (nx + 0.28, ny - 0.1, 0.04), mat("pen", (0.02, 0.02, 0.025), rough=0.25, metallic=0.6),
              rot=(0, math.radians(90), math.radians(28)), verts=24)
    # Stack of books.
    for k, (col, w, h) in enumerate([((0.32, 0.08, 0.07), 0.62, 0.07), ((0.10, 0.22, 0.25), 0.58, 0.06),
                                     ((0.55, 0.40, 0.18), 0.55, 0.05)]):
        z = sum(b[2] for b in [(0, 0, 0.07), (0, 0, 0.06), (0, 0, 0.05)][:k]) + h / 2
        cube((w, 0.42, h), (1.75, 0.55, z), mat(f"book{k}", col, rough=0.6), rot=(0, 0, math.radians(8 - k * 6)), bevel=0.006)
        cube((w - 0.02, 0.405, h - 0.012), (1.75 + 0.012, 0.55, z), paper, rot=(0, 0, math.radians(8 - k * 6)))
    # Mug.
    mug = mat("mug", (0.80, 0.78, 0.72), rough=0.25, coat=0.5)
    cyl(0.065, 0.14, (0.05, 0.25, 0.07), mug, verts=48)
    torus(0.04, 0.012, (0.13, 0.25, 0.075), mug, rot=(math.radians(90), 0, 0))
    cyl(0.058, 0.002, (0.05, 0.25, 0.13), mat("coffee", (0.05, 0.025, 0.012), rough=0.1), verts=48)
    # Desk lamp: base, two arms, a shade that glows inside.
    metal = mat("lamp", (0.55, 0.12, 0.08), rough=0.35, metallic=0.3)
    cyl(0.13, 0.03, (1.55, 0.95, 0.015), metal, verts=48, bevel=0.01)
    a = Vector((1.55, 0.95, 0.03))
    b = Vector((1.35, 0.75, 0.75))
    c = Vector((0.95, 0.30, 0.95))
    for p0, p1 in ((a, b), (b, c)):
        d = p1 - p0
        arm = cyl(0.02, d.length, (p0 + p1) / 2, metal, verts=16)
        arm.rotation_euler = d.to_track_quat("Z", "Y").to_euler()
    bpy.ops.mesh.primitive_cone_add(vertices=64, radius1=0.17, radius2=0.06, depth=0.22, end_fill_type="NOTHING",
                                    location=c + Vector((0, 0, -0.05)), rotation=(math.radians(-28), 0, math.radians(-38)))
    shade = put(bpy.context.object, mat("shade", (0.55, 0.12, 0.08), rough=0.35, metallic=0.3))
    shade.modifiers.new("s", "SOLIDIFY").thickness = 0.006
    bulb = sphere(0.045, c + Vector((0.02, 0.0, -0.12)), emit("bulb", (1.0, 0.85, 0.6), 30))
    bpy.ops.object.light_add(type="SPOT", location=c + Vector((0, 0, -0.08)))
    sp = bpy.context.object
    sp.data.energy = 140
    sp.data.color = (1.0, 0.78, 0.5)
    sp.data.spot_size = math.radians(80)
    sp.data.spot_blend = 0.6
    sp.data.shadow_soft_size = 0.04
    sp.rotation_euler = (Vector((nx, ny, 0)) - sp.location).to_track_quat("-Z", "Y").to_euler()
    area((-3, -3, 3), (0, 0, 0), 5, 12, (0.35, 0.45, 0.8))
    hero = camera((-0.55, -2.25, 1.25), (0.95, 0.25, 0.3), 32, dof=2.4, fstop=4)
    tile = camera((0.4, -1.2, 1.0), (0.85, 0.05, 0.05), 45, dof=1.45, fstop=4, name="tile")
    shoot("writing", hero, tile)


# ---- Press: a studio mic under stage lights ----
def press():
    reset()
    sky([(0.0, (0.01, 0.005, 0.02)), (1.0, (0.03, 0.01, 0.05))], strength=1.0)
    chrome = mat("chrome", (0.75, 0.76, 0.78), rough=0.12, metallic=1.0)
    black = mat("black", (0.015, 0.015, 0.018), rough=0.35, metallic=0.4)
    # Grille: a fine 3D checker of bright wire and dark holes (no UV poles, so no moire).
    grille = mat("grille", (0.5, 0.5, 0.52), rough=0.35, metallic=1.0)
    gn = grille.node_tree
    gp = gn.nodes["Principled BSDF"]
    tc = gn.nodes.new("ShaderNodeTexCoord")
    ck = gn.nodes.new("ShaderNodeTexChecker")
    ck.inputs["Scale"].default_value = 90
    ck.inputs["Color1"].default_value = (0.55, 0.55, 0.58, 1)
    ck.inputs["Color2"].default_value = (0.04, 0.04, 0.045, 1)
    gn.links.new(tc.outputs["Object"], ck.inputs["Vector"])
    gn.links.new(ck.outputs["Color"], gp.inputs["Base Color"])
    gn.links.new(ck.outputs["Fac"], gp.inputs["Metallic"])

    mx, my, mz = 1.3, 0.6, 1.5
    tilt = math.radians(-18)
    head = sphere(0.24, (mx, my, mz + 0.22), grille, scale=(1, 1, 1.55))
    cyl(0.25, 0.06, (mx, my, mz), chrome, verts=64, bevel=0.01)
    cyl(0.20, 0.38, (mx, my, mz - 0.22), black, verts=64, bevel=0.01)
    cyl(0.205, 0.02, (mx, my, mz - 0.41), chrome, verts=64)
    # Yoke and stand.
    torus(0.31, 0.016, (mx, my, mz - 0.08), chrome, rot=(math.radians(90), 0, 0))
    cyl(0.02, 1.0, (mx, my, mz - 0.85), chrome, verts=24)
    cyl(0.03, 0.5, (mx, my, mz - 1.4), black, verts=24)
    cyl(0.32, 0.04, (mx, my, 0.02), black, verts=64, bevel=0.01)
    # Bokeh lights behind, magenta and cyan, out of focus.
    rnd = random.Random(3)
    cols = [(1.0, 0.2, 0.6), (0.2, 0.8, 1.0), (1.0, 0.55, 0.2), (0.6, 0.3, 1.0)]
    for k in range(45):
        x = rnd.uniform(-5, 7)
        z = rnd.uniform(0.3, 4.5)
        sphere(rnd.uniform(0.05, 0.12), (x, rnd.uniform(7, 12), z), emit(f"bk{k}", rnd.choice(cols), rnd.uniform(8, 25)))
    # "ON AIR" light, softly blurred at the back left.
    bpy.ops.object.text_add(location=(3.4, 4.0, 2.9), rotation=(math.radians(90), 0, 0))
    t = bpy.context.object
    t.data.body = "ON AIR"
    t.data.size = 0.5
    t.data.align_x = "CENTER"
    t.data.extrude = 0.01
    put(t, emit("onair", (1.0, 0.12, 0.10), 14), smooth=False)
    cube((1.9, 0.04, 0.75), (3.4, 4.04, 3.05), mat("sign", (0.03, 0.01, 0.01), rough=0.5))
    area((-2.5, -1.0, 3.0), (mx, my, mz), 1.5, 260, (1.0, 0.25, 0.65))
    area((4.0, 0.5, 2.0), (mx, my, mz), 1.5, 300, (0.2, 0.75, 1.0))
    area((1.0, -3.0, 1.8), (mx, my, mz), 3.0, 60, (1.0, 0.95, 0.9))
    floor = cube((30, 30, 0.1), (0, 0, -0.05), mat("stage", (0.02, 0.015, 0.03), rough=0.25))
    hero = camera((-0.9, -3.2, 1.55), (0.85, 0.6, 1.35), 35, dof=4.0, fstop=1.2)
    tile = camera((mx - 0.5, my - 1.7, mz + 0.15), (mx, my, mz + 0.05), 50, dof=1.8, fstop=2, name="tile")
    shoot("press", hero, tile)


# ---- Fun: floating toy shapes on a candy backdrop ----
def fun():
    reset()
    sky([(0.0, (0.9, 0.7, 0.85)), (1.0, (0.7, 0.75, 1.0))], strength=0.3)
    # Curved cyclorama backdrop.
    bpy.ops.mesh.primitive_plane_add(size=1)
    cyc = bpy.context.object
    me = cyc.data
    import bmesh
    bm = bmesh.new()
    prof = [(y, 0.0) for y in (-6, -2, 0, 2)]
    prof += [(2 + 1.5 * math.sin(a), 1.5 - 1.5 * math.cos(a)) for a in [math.radians(d) for d in range(10, 91, 10)]]
    prof += [(3.5, 6.0)]
    rows = [[bm.verts.new((x, y, z)) for x in (-12, 12)] for y, z in prof]
    for a, b in zip(rows, rows[1:]):
        bm.faces.new((a[0], a[1], b[1], b[0]))
    bm.to_mesh(me)
    put(cyc, mat("cyc", (0.95, 0.38, 0.42), rough=0.8))
    cyc.modifiers.new("s", "SUBSURF").levels = 2

    def glossy(name, col):
        return mat(name, col, rough=0.18, coat=1.0)
    pink, yellow, teal, purple, blue, orange = (glossy("pink", (1.0, 0.25, 0.45)), glossy("yellow", (1.0, 0.75, 0.1)),
                                                glossy("teal", (0.05, 0.75, 0.65)), glossy("purple", (0.45, 0.2, 0.9)),
                                                glossy("blue", (0.15, 0.4, 1.0)), glossy("orange", (1.0, 0.42, 0.12)))
    torus(0.42, 0.17, (1.9, 0.8, 1.55), pink, rot=(math.radians(62), math.radians(18), 0))
    sphere(0.36, (2.95, 1.2, 0.85), yellow)
    cube((0.55, 0.55, 0.55), (1.15, 1.4, 0.75), teal, rot=(math.radians(25), math.radians(35), math.radians(10)), bevel=0.12, seg=6)
    bpy.ops.mesh.primitive_cone_add(vertices=64, radius1=0.3, depth=0.6, location=(3.1, 0.4, 2.05),
                                    rotation=(math.radians(150), math.radians(20), 0))
    put(bpy.context.object, purple)
    sphere(0.16, (2.4, 0.1, 2.4), blue)
    sphere(0.11, (0.6, 0.3, 1.75), orange)
    # A squiggle.
    cu = bpy.data.curves.new("squiggle", "CURVE")
    cu.dimensions = "3D"
    cu.bevel_depth = 0.055
    cu.bevel_resolution = 6
    sp = cu.splines.new("BEZIER")
    pts = [(3.4 + 0.5 * math.sin(t * 2.2), 1.6, 1.4 + t * 0.35) for t in [i * 0.5 for i in range(6)]]
    sp.bezier_points.add(len(pts) - 1)
    for bp, co in zip(sp.bezier_points, pts):
        bp.co = co
        bp.handle_left_type = bp.handle_right_type = "AUTO"
    sq = bpy.data.objects.new("squiggle", cu)
    bpy.context.scene.collection.objects.link(sq)
    sq.data.materials.append(blue)
    # Confetti.
    rnd = random.Random(11)
    for k in range(90):
        c = rnd.choice([pink, yellow, teal, purple, blue, orange])
        cube((0.05, 0.02, 0.004), (rnd.uniform(-0.5, 4.5), rnd.uniform(-0.6, 2.0), rnd.uniform(0.2, 3.0)), c,
             rot=(rnd.uniform(0, 3), rnd.uniform(0, 3), rnd.uniform(0, 3)))
    area((-2, -3, 4), (2, 1, 1), 4, 320, (1.0, 0.95, 0.9))
    area((5, -1, 2.5), (2, 1, 1.2), 3, 250, (0.7, 0.8, 1.0))
    area((2, 3, 4), (2, 1, 1), 3, 120, (1.0, 0.7, 0.8))
    hero = camera((-0.6, -4.6, 1.55), (1.45, 0.9, 1.45), 32)
    tile = camera((1.9, -1.8, 1.55), (1.9, 0.8, 1.45), 50, name="tile")
    shoot("fun", hero, tile)


SCENES = {"work": work, "writing": writing, "press": press, "fun": fun}
os.makedirs(OUTDIR, exist_ok=True)
for name, fn in SCENES.items():
    if WHICH in ("all", name):
        fn()
