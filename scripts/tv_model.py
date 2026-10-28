"""Blender model of the early-2000s silver TV/DVD combo used on the site.

build("holdout") makes the screen glass a holdout (transparent in the render) for
the front-facing frame; build("crt") gives it dark, curved picture-tube glass for
the desk scene. Everything is parented to the returned empty, 1 unit = 25 cm.
"""
import math

import bpy
import bmesh

# ---- Dimensions (scene units; body front face at y = -D/2) ----
W, H, D = 2.0, 1.90, 1.40
FRONT = -D / 2
SCR_CZ = 1.115           # screen centre height
OPEN_W, OPEN_H, OPEN_R = 1.70, 1.32, 0.17    # opening on the bezel face
IN_W, IN_H, IN_R = 1.54, 1.17, 0.12          # bottom of the sloped lip
RECESS = 0.11
GLASS_W, GLASS_H, GLASS_R = 1.52, 1.15, 0.115
MARGIN_X, MARGIN_TOP, MARGIN_BOT = 0.012, 0.012, 0.05

scene = None

def mat(name, color, metallic=0.0, rough=0.5, coat=0.0, emission=None):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    p = m.node_tree.nodes["Principled BSDF"]
    p.inputs["Base Color"].default_value = (*color, 1)
    p.inputs["Metallic"].default_value = metallic
    p.inputs["Roughness"].default_value = rough
    p.inputs["Coat Weight"].default_value = coat
    if emission:
        p.inputs["Emission Color"].default_value = (*emission, 1)
        p.inputs["Emission Strength"].default_value = 3.0
    return m



def link(obj, material):
    obj.data.materials.clear()
    obj.data.materials.append(material)
    return obj


def rrect(w, h, r, seg=12):
    """Points of a rounded rectangle (x, z) centred on 0, counter-clockwise."""
    pts = []
    corners = [(w / 2 - r, h / 2 - r, 0), (-w / 2 + r, h / 2 - r, 90),
               (-w / 2 + r, -h / 2 + r, 180), (w / 2 - r, -h / 2 + r, 270)]
    for cx, cz, a0 in corners:
        for i in range(seg + 1):
            a = math.radians(a0 + 90 * i / seg)
            pts.append((cx + r * math.cos(a), cz + r * math.sin(a)))
    return pts


def loft(name, rings, cap_front=True, cap_back=True):
    """rings: list of (y, cz, w, h, r). Build a closed lofted solid."""
    bm = bmesh.new()
    loops = []
    for y, cz, w, h, r in rings:
        loops.append([bm.verts.new((x, y, z + cz)) for x, z in rrect(w, h, r)])
    n = len(loops[0])
    for a, b in zip(loops, loops[1:]):
        for i in range(n):
            j = (i + 1) % n
            bm.faces.new((a[i], a[j], b[j], b[i]))
    if cap_front:
        bm.faces.new(list(reversed(loops[0])))
    if cap_back:
        bm.faces.new(loops[-1])
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    ob = bpy.data.objects.new(name, me)
    scene.collection.objects.link(ob)
    return ob


def box(name, size, loc, material, bevel=0.0, seg=4):
    bpy.ops.mesh.primitive_cube_add(size=1, location=loc)
    ob = bpy.context.object
    ob.name = name
    ob.scale = size
    bpy.ops.object.transform_apply(scale=True)
    if bevel:
        m = ob.modifiers.new("bevel", "BEVEL")
        m.width = bevel
        m.segments = seg
        m.limit_method = "NONE"
    bpy.ops.object.shade_smooth()
    return link(ob, material)


def cyl(name, r, depth, loc, material, verts=48, bevel=0.0):
    bpy.ops.mesh.primitive_cylinder_add(vertices=verts, radius=r, depth=depth,
                                        location=loc, rotation=(math.pi / 2, 0, 0))
    ob = bpy.context.object
    ob.name = name
    if bevel:
        m = ob.modifiers.new("bevel", "BEVEL")
        m.width = bevel
        m.segments = 3
        m.limit_method = "ANGLE"
    bpy.ops.object.shade_smooth()
    return link(ob, material)


def text(name, body, size, loc, material, extrude=0.002, font_bold=True):
    bpy.ops.object.text_add(location=loc, rotation=(math.pi / 2, 0, 0))
    ob = bpy.context.object
    ob.name = name
    ob.data.body = body
    ob.data.size = size
    ob.data.align_x = "CENTER"
    ob.data.align_y = "CENTER"
    ob.data.extrude = extrude
    ob.data.space_character = 1.12
    try:
        ob.data.font = bpy.data.fonts.load("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf" if font_bold
                                           else "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf")
    except Exception:
        pass
    return link(ob, material)


def build(glass_mode="holdout"):
    global scene
    scene = bpy.context.scene
    before = set(scene.objects)
    SILVER = mat("silver", (0.56, 0.575, 0.60), metallic=0.75, rough=0.34, coat=0.2)
    SILVER_LT = mat("silver_light", (0.66, 0.67, 0.70), metallic=0.7, rough=0.28, coat=0.3)
    DARK = mat("dark", (0.018, 0.018, 0.02), rough=0.45)
    GASKET = mat("gasket", (0.008, 0.008, 0.009), rough=0.6)
    SLOT = mat("slot", (0.004, 0.004, 0.005), rough=0.7)
    PANEL = mat("panel", (0.16, 0.165, 0.175), metallic=0.4, rough=0.45)
    INK = mat("ink", (0.10, 0.105, 0.11), rough=0.5)
    LED = mat("led", (0.2, 0.9, 0.3), emission=(0.25, 1.0, 0.35))

    HOLDOUT = bpy.data.materials.new("glass_holdout")
    HOLDOUT.use_nodes = True
    nt = HOLDOUT.node_tree
    nt.nodes.clear()
    ho = nt.nodes.new("ShaderNodeHoldout")
    outn = nt.nodes.new("ShaderNodeOutputMaterial")
    nt.links.new(ho.outputs[0], outn.inputs["Surface"])


    # ---- Body: rounded box with the screen recess cut out ----
    body = loft("body", [
        (FRONT, H / 2, W, H, 0.16),
        (FRONT + 0.62, H / 2, W, H, 0.16),
    ])
    bev = body.modifiers.new("soft_edges", "BEVEL")
    bev.width = 0.07
    bev.segments = 10
    bev.limit_method = "ANGLE"
    bev.angle_limit = math.radians(60)
    bpy.context.view_layer.objects.active = body
    body.select_set(True)
    bpy.ops.object.modifier_apply(modifier="soft_edges")
    link(body, SILVER)

    cutter = loft("cutter", [
        (FRONT - 0.2, SCR_CZ, OPEN_W, OPEN_H, OPEN_R),
        (FRONT + 0.004, SCR_CZ, OPEN_W, OPEN_H, OPEN_R),
        (FRONT + RECESS, SCR_CZ, IN_W, IN_H, IN_R),
        (FRONT + 0.6, SCR_CZ, IN_W, IN_H, IN_R),
    ])
    boo = body.modifiers.new("recess", "BOOLEAN")
    boo.operation = "DIFFERENCE"
    boo.object = cutter
    boo.solver = "EXACT"
    bpy.ops.object.modifier_apply(modifier="recess")
    cutter.hide_render = True
    cutter.hide_viewport = True

    # Soften the lip where the bezel turns into the recess.
    lip = body.modifiers.new("lip", "BEVEL")
    lip.width = 0.012
    lip.segments = 4
    lip.limit_method = "ANGLE"
    lip.angle_limit = math.radians(20)
    bpy.ops.object.shade_smooth()
    for poly in body.data.polygons:
        poly.use_smooth = True
    try:
        body.data.set_sharp_from_angle(angle=math.radians(35))
    except Exception:
        pass

    # ---- Black gasket and the convex glass (holdout = transparent) ----
    gasket = loft("gasket", [
        (FRONT + RECESS - 0.004, SCR_CZ, IN_W + 0.02, IN_H + 0.02, IN_R),
        (FRONT + RECESS + 0.05, SCR_CZ, IN_W + 0.02, IN_H + 0.02, IN_R),
    ])
    link(gasket, GASKET)

    bm = bmesh.new()
    ring = [bm.verts.new((x, 0, z + SCR_CZ)) for x, z in rrect(GLASS_W, GLASS_H, GLASS_R)]
    face = bm.faces.new(ring)
    bmesh.ops.triangulate(bm, faces=[face])
    gme = bpy.data.meshes.new("glass")
    bm.to_mesh(gme)
    glass = bpy.data.objects.new("glass", gme)
    glass.location.y = FRONT + RECESS - 0.03
    scene.collection.objects.link(glass)
    link(glass, HOLDOUT)

    # ---- Lower deck ----
    DECK_TOP = SCR_CZ - OPEN_H / 2      # 0.455
    fz = FRONT - 0.0005

    text("brand", "DAVIDVISION", 0.046, (0, fz - 0.002, DECK_TOP - 0.052), INK, extrude=0.003)

    # DVD loader: raised rounded plate with a dark slot and a tiny logo.
    slot_z = DECK_TOP - 0.155
    plate = loft("slot_plate", [
        (fz - 0.012, slot_z, 0.96, 0.105, 0.03),
        (fz + 0.02, slot_z, 0.96, 0.105, 0.03),
    ])
    pb = plate.modifiers.new("b", "BEVEL"); pb.width = 0.008; pb.segments = 3
    link(plate, SILVER)
    slot = loft("slot", [
        (fz - 0.0135, slot_z + 0.006, 0.82, 0.016, 0.008),
        (fz - 0.010, slot_z + 0.006, 0.82, 0.016, 0.008),
    ])
    link(slot, SLOT)
    text("dvd_logo", "DVD", 0.024, (0, fz - 0.0135, slot_z - 0.030), INK, extrude=0.0008)

    # Button row under the loader.
    btn_z = slot_z - 0.115
    for i, x in enumerate([-0.30, -0.20, -0.10, 0.0, 0.10, 0.20, 0.30]):
        if i == 3:
            box("ir_window", (0.085, 0.01, 0.034), (x, fz - 0.004, btn_z), DARK, bevel=0.012)
            continue
        cyl(f"btn{i}", 0.022, 0.024, (x, fz - 0.008, btn_z), SILVER_LT, bevel=0.006)
        cyl(f"btn_ring{i}", 0.027, 0.006, (x, fz - 0.001, btn_z), DARK)

    # Power button + standby LED on the left.
    cyl("power_ring", 0.050, 0.006, (-0.76, fz - 0.001, slot_z - 0.04), DARK)
    cyl("power", 0.042, 0.03, (-0.76, fz - 0.012, slot_z - 0.04), SILVER_LT, bevel=0.01)
    cyl("led", 0.009, 0.01, (-0.62, fz - 0.003, slot_z - 0.04), LED)
    text("power_lbl", "POWER", 0.018, (-0.76, fz - 0.002, slot_z + 0.036), INK, extrude=0.0005, font_bold=False)

    # AV jacks on the right.
    jack_z = slot_z - 0.06
    box("jack_panel", (0.30, 0.006, 0.09), (0.70, fz - 0.002, jack_z), PANEL, bevel=0.025)
    for j, x in enumerate([0.61, 0.70, 0.79]):
        cyl(f"jack{j}", 0.026, 0.02, (x, fz - 0.010, jack_z), SILVER_LT, bevel=0.004)
        cyl(f"jack_hole{j}", 0.009, 0.02, (x, fz - 0.012, jack_z), SLOT)
    text("av_lbl", "VIDEO   L-AUDIO-R", 0.015, (0.70, fz - 0.002, jack_z + 0.068), INK, extrude=0.0005, font_bold=False)

    # Feet.
    for x in (-0.72, 0.72):
        box(f"foot{x}", (0.30, 0.5, 0.05), (x, FRONT + 0.35, 0.0), DARK, bevel=0.015)
    for ob in [o for o in scene.objects if o.name.startswith("foot")]:
        ob.location.z = 0.012

    # ---- Rear CRT housing (only seen when the set is turned) ----
    rear = loft("rear", [
        (FRONT + 0.50, H / 2 + 0.02, W * 0.94, H * 0.92, 0.14),
        (FRONT + 1.05, H / 2 + 0.06, W * 0.78, H * 0.78, 0.12),
        (FRONT + 1.75, H / 2 + 0.10, W * 0.52, H * 0.52, 0.10),
    ])
    rb = rear.modifiers.new("b", "BEVEL"); rb.width = 0.04; rb.segments = 6
    bpy.ops.object.select_all(action="DESELECT")
    bpy.context.view_layer.objects.active = rear
    rear.select_set(True)
    bpy.ops.object.shade_smooth()
    link(rear, SILVER)
    # Vent slots on the housing sides.
    for side in (-1, 1):
        for k in range(7):
            v = box(f"vent{side}{k}", (0.012, 0.32, 0.03), (0, FRONT + 0.85, H * 0.75 - k * 0.08), SLOT)
            v.location.x = side * (W * 0.43 - 0.0)

    if glass_mode == "crt":
        # Curved picture tube: concentric rings bulging toward the viewer.
        bm2 = bmesh.new()
        rings = []
        for f in (1.0, 0.85, 0.68, 0.5, 0.32, 0.15):
            bulge = 0.035 * (1 - f * f)
            rings.append([bm2.verts.new((x * f, -bulge, z * f + SCR_CZ)) for x, z in rrect(GLASS_W, GLASS_H, GLASS_R)])
        n = len(rings[0])
        for a, b in zip(rings, rings[1:]):
            for i in range(n):
                j = (i + 1) % n
                bm2.faces.new((a[i], a[j], b[j], b[i]))
        centre = bm2.verts.new((0, -0.035, SCR_CZ))
        for i in range(n):
            bm2.faces.new((rings[-1][i], rings[-1][(i + 1) % n], centre))
        bmesh.ops.recalc_face_normals(bm2, faces=bm2.faces)
        bm2.to_mesh(glass.data)
        for p in glass.data.polygons:
            p.use_smooth = True
        tube = mat("tube", (0.012, 0.016, 0.016), rough=0.06, coat=1.0)
        link(glass, tube)

    rig = bpy.data.objects.new("TV", None)
    scene.collection.objects.link(rig)
    for ob in set(scene.objects) - before - {rig}:
        if ob.parent is None:
            ob.parent = rig
    return rig, glass
