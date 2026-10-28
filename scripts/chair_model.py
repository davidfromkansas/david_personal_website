"""Mesh-back office chair in the shape of a Herman Miller Aeron (size B), in metres.

Faces +Y (toward the desk). build() returns an empty that everything is parented to,
with its origin on the floor under the gas cylinder.
"""
import math

import bpy
import bmesh
from mathutils import Vector

SEAT_Z = 0.45


def _mat(name, color, rough=0.5, metallic=0.0, alpha=1.0, weave=False):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    p = m.node_tree.nodes["Principled BSDF"]
    p.inputs["Base Color"].default_value = (*color, 1)
    p.inputs["Roughness"].default_value = rough
    p.inputs["Metallic"].default_value = metallic
    if weave:
        # Pellicle: a fine see-through weave.
        nt = m.node_tree
        tc = nt.nodes.new("ShaderNodeTexCoord")
        ck = nt.nodes.new("ShaderNodeTexChecker")
        ck.inputs["Scale"].default_value = 260.0
        ck.inputs["Color1"].default_value = (1, 1, 1, 1)
        ck.inputs["Color2"].default_value = (0.45, 0.45, 0.45, 1)
        nt.links.new(tc.outputs["UV"], ck.inputs["Vector"])
        mr = nt.nodes.new("ShaderNodeMapRange")
        mr.inputs["To Min"].default_value = alpha - 0.2
        mr.inputs["To Max"].default_value = alpha
        nt.links.new(ck.outputs["Fac"], mr.inputs["Value"])
        nt.links.new(mr.outputs["Result"], p.inputs["Alpha"])
    elif alpha < 1:
        p.inputs["Alpha"].default_value = alpha
    return m


def _tube(name, pts, radius, material, cyclic=False, flat=1.0):
    cu = bpy.data.curves.new(name, "CURVE")
    cu.dimensions = "3D"
    cu.bevel_depth = radius
    cu.bevel_resolution = 4
    cu.use_fill_caps = True
    sp = cu.splines.new("POLY")
    sp.points.add(len(pts) - 1)
    for p, v in zip(sp.points, pts):
        p.co = (*v, 1)
    sp.use_cyclic_u = cyclic
    ob = bpy.data.objects.new(name, cu)
    bpy.context.scene.collection.objects.link(ob)
    ob.data.materials.append(material)
    return ob


def _surface(name, fn, nu, nv, material):
    """Grid surface from fn(u, v) -> (x, y, z), u and v in 0..1, with UVs."""
    bm = bmesh.new()
    uv = bm.loops.layers.uv.new()
    vs = [[bm.verts.new(fn(i / nu, j / nv)) for i in range(nu + 1)] for j in range(nv + 1)]
    for j in range(nv):
        for i in range(nu):
            f = bm.faces.new((vs[j][i], vs[j][i + 1], vs[j + 1][i + 1], vs[j + 1][i]))
            for loop, (a, b) in zip(f.loops, [(i, j), (i + 1, j), (i + 1, j + 1), (i, j + 1)]):
                loop[uv].uv = (a / nu, b / nv)
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    for p in me.polygons:
        p.use_smooth = True
    ob = bpy.data.objects.new(name, me)
    bpy.context.scene.collection.objects.link(ob)
    ob.data.materials.append(material)
    return ob, vs


def _outline(fn, nu, nv):
    """Points around the border of a _surface grid, in order."""
    pts = [fn(i / nu, 0) for i in range(nu + 1)]
    pts += [fn(1, j / nv) for j in range(1, nv + 1)]
    pts += [fn(i / nu, 1) for i in range(nu - 1, -1, -1)]
    pts += [fn(0, j / nv) for j in range(nv - 1, 0, -1)]
    return pts


def _box(name, size, loc, material, rot=(0, 0, 0), bevel=0.01):
    bpy.ops.mesh.primitive_cube_add(size=1, location=loc, rotation=rot)
    ob = bpy.context.object
    ob.name = name
    ob.scale = size
    bpy.ops.object.transform_apply(scale=True)
    m = ob.modifiers.new("b", "BEVEL")
    m.width = bevel
    m.segments = 4
    bpy.ops.object.shade_smooth()
    ob.data.materials.append(material)
    return ob


def _cyl(name, r, depth, loc, material, rot=(0, 0, 0)):
    bpy.ops.mesh.primitive_cylinder_add(vertices=32, radius=r, depth=depth, location=loc, rotation=rot)
    ob = bpy.context.object
    ob.name = name
    bpy.ops.object.shade_smooth()
    ob.data.materials.append(material)
    return ob


def build():
    scene = bpy.context.scene
    before = set(scene.objects)
    frame = _mat("aeron_frame", (0.035, 0.035, 0.038), rough=0.45)
    alu = _mat("aeron_base", (0.05, 0.05, 0.055), rough=0.3, metallic=0.7)
    mesh = _mat("aeron_pellicle", (0.02, 0.02, 0.022), rough=0.7, alpha=0.82, weave=True)
    rubber = _mat("aeron_caster", (0.01, 0.01, 0.01), rough=0.6)

    # Five-star base with casters.
    for k in range(5):
        a = math.radians(90 + k * 72)
        d = Vector((math.cos(a), math.sin(a), 0))
        leg = _box(f"leg{k}", (0.30, 0.05, 0.035), (0, 0, 0), alu, bevel=0.012)
        leg.location = d * 0.16 + Vector((0, 0, 0.085))
        leg.rotation_euler = (0, math.radians(6), a)
        _cyl(f"caster{k}", 0.028, 0.035, tuple(d * 0.32 + Vector((0, 0, 0.032))), rubber,
             rot=(math.pi / 2, 0, a + math.pi / 2))
        _cyl(f"stem{k}", 0.008, 0.04, tuple(d * 0.32 + Vector((0, 0, 0.07))), alu)
    _cyl("hub", 0.05, 0.06, (0, 0, 0.09), alu)
    _cyl("column", 0.028, 0.26, (0, 0, 0.24), alu)
    _box("mechanism", (0.20, 0.24, 0.06), (0, -0.02, SEAT_Z - 0.06), frame, bevel=0.015)

    # Seat: a framed, slightly dished pellicle, wider at the front, waterfall edge.
    def seat(u, v):
        w = 0.40 + 0.08 * v                       # back (v=0) to front (v=1)
        x = (u - 0.5) * w
        y = -0.21 + v * 0.44
        z = SEAT_Z + 0.02 - 0.018 * math.sin(math.pi * u) * math.sin(math.pi * v)
        z -= 0.03 * max(0, v - 0.85) / 0.15      # waterfall front
        return (x, y, z)
    _surface("seat", seat, 16, 12, mesh)
    _tube("seat_frame", _outline(seat, 16, 12), 0.013, frame, cyclic=True)

    # Back: taller than wide, widest at the shoulders, cupped, leaning back, lumbar bulge.
    lean = math.radians(14)
    def back(u, v):
        w = 0.29 + 0.18 * math.sin(min(1, v * 1.3) * math.pi / 2)
        w *= 1 - 0.22 * (max(0, v - 0.86) / 0.14) ** 2   # rounded shoulders
        s = (u - 0.5) * 2
        x = s * w / 2
        h = v * 0.60
        cup = 0.06 * s * s
        lumbar = 0.03 * math.exp(-((v - 0.28) / 0.14) ** 2)
        y = -0.26 - h * math.sin(lean) + cup + lumbar
        z = SEAT_Z + 0.12 + h * math.cos(lean)
        return (x, y, z)
    _surface("back", back, 16, 18, mesh)
    _tube("back_frame", _outline(back, 16, 18), 0.014, frame, cyclic=True)

    # Spine joining the back to the seat mechanism.
    bx, by, bz = back(0.5, 0.0)
    _tube("spine", [(0, -0.05, SEAT_Z - 0.06), (0, -0.20, SEAT_Z - 0.05), (0, by - 0.04, bz - 0.05),
                    (0, by - 0.03, bz + 0.02)], 0.03, frame)

    # Height-adjustable arms: post from under the seat, pad on top.
    for side in (-1, 1):
        x = side * 0.27
        _tube(f"arm_post{side}", [(side * 0.10, -0.08, SEAT_Z - 0.05), (x, -0.08, SEAT_Z - 0.05),
                                  (x, -0.10, SEAT_Z + 0.08), (x, -0.08, SEAT_Z + 0.19)], 0.017, frame)
        _box(f"arm_pad{side}", (0.075, 0.24, 0.028), (x, -0.06, SEAT_Z + 0.205), frame, bevel=0.012)

    rig = bpy.data.objects.new("chair", None)
    scene.collection.objects.link(rig)
    for ob in set(scene.objects) - before - {rig}:
        if ob.parent is None:
            ob.parent = rig
    return rig
