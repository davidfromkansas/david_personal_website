"""Herman Miller Aeron (size B, fully adjustable arms), from Herman Miller's own 3D model.

The model isn't kept in the repo. Download the "AutoCAD 3D" file from
https://www.hermanmiller.com/resources/3d-models-and-planning-tools/product-models/individual/aeron-chair-b-size-fully-adjustable-arms/
and convert it with scripts/dwg_to_obj.mjs to scripts/models/aeron.obj (or set AERON_OBJ).

Faces +Y (toward the desk). build() returns an empty that everything is parented to,
with its origin on the floor under the gas cylinder. Units are metres.
"""
import math
import os

import bpy
import bmesh

OBJ = os.environ.get("AERON_OBJ", os.path.join(os.path.dirname(os.path.abspath(__file__)), "models", "aeron.obj"))
INCH = 0.0254


def _mat(name, color, rough=0.5, metallic=0.0, weave=False):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    nt = m.node_tree
    p = nt.nodes["Principled BSDF"]
    p.inputs["Base Color"].default_value = (*color, 1)
    p.inputs["Roughness"].default_value = rough
    p.inputs["Metallic"].default_value = metallic
    if weave:
        # Pellicle: a fine see-through weave (the model has no UVs, so use object space).
        tc = nt.nodes.new("ShaderNodeTexCoord")
        ck = nt.nodes.new("ShaderNodeTexChecker")
        ck.inputs["Scale"].default_value = 450.0
        ck.inputs["Color1"].default_value = (1, 1, 1, 1)
        ck.inputs["Color2"].default_value = (0.4, 0.4, 0.4, 1)
        nt.links.new(tc.outputs["Object"], ck.inputs["Vector"])
        mr = nt.nodes.new("ShaderNodeMapRange")
        mr.inputs["To Min"].default_value = 0.6
        mr.inputs["To Max"].default_value = 0.85
        nt.links.new(ck.outputs["Fac"], mr.inputs["Value"])
        nt.links.new(mr.outputs["Result"], p.inputs["Alpha"])
    return m


def build():
    scene = bpy.context.scene
    if not os.path.exists(OBJ):
        raise SystemExit(f"Aeron model not found at {OBJ} (see scripts/chair_model.py)")
    graphite = (0.03, 0.03, 0.033)
    mats = {
        "SEAT-FRAME": _mat("aeron_frame", graphite, rough=0.4),
        "SEAT-CHASSIS": _mat("aeron_chassis", graphite, rough=0.45),
        "SEAT-BASE": _mat("aeron_base", (0.04, 0.04, 0.045), rough=0.3, metallic=0.6),
        "SEAT-SHAFT": _mat("aeron_shaft", (0.25, 0.25, 0.26), rough=0.2, metallic=1.0),
        "SEAT-ARMPAD": _mat("aeron_armpad", (0.02, 0.02, 0.02), rough=0.55),
        "SEAT-CASTER": _mat("aeron_caster", (0.01, 0.01, 0.01), rough=0.6),
    }
    mats["SEAT-FABRIC"] = mats["SEAT-FABRICBACK"] = _mat("aeron_pellicle", (0.02, 0.02, 0.022), rough=0.7, weave=True)

    before = set(scene.objects)
    bpy.ops.wm.obj_import(filepath=OBJ, forward_axis="Y", up_axis="Z")
    parts = [ob for ob in scene.objects if ob not in before]

    rig = bpy.data.objects.new("chair", None)
    scene.collection.objects.link(rig)
    for ob in parts:
        me = ob.data
        # 3DFACEs come in inches with mixed winding: scale to metres and face the
        # chair's front (+X in the file) toward +Y.
        bm = bmesh.new()
        bm.from_mesh(me)
        bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
        bm.to_mesh(me)
        bm.free()
        ob.scale = (INCH,) * 3
        ob.rotation_euler = (0, 0, math.radians(90))
        me.materials.clear()
        me.materials.append(mats.get(ob.name.split(".")[0], mats["SEAT-FRAME"]))
        ob.parent = rig
    for ob in parts:
        bpy.context.view_layer.objects.active = ob
        ob.select_set(True)
    bpy.ops.object.shade_smooth_by_angle(angle=math.radians(35))
    return rig
