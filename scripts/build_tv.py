"""Render the front-facing TV frame used on the site (tv/*.webp).

The screen glass is a holdout, so it renders fully transparent and the website
shows through it. Run: python3 build_tv.py OUT.png [width_px] [samples]
"""
import math
import os
import sys

import bpy

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import tv_model  # noqa: E402
from tv_model import H, W  # noqa: E402

OUT = sys.argv[1] if len(sys.argv) > 1 else "tv.png"
RES_X = int(sys.argv[2]) if len(sys.argv) > 2 else 1600
SAMPLES = int(sys.argv[3]) if len(sys.argv) > 3 else 96
MARGIN_X, MARGIN_TOP, MARGIN_BOT = 0.012, 0.012, 0.05

bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene
tv_model.build("holdout")

# ---- Shadow catcher floor ----
bpy.ops.mesh.primitive_plane_add(size=10, location=(0, 0, -0.012))
floor = bpy.context.object
floor.is_shadow_catcher = True

# ---- Lights ----
def area(name, loc, rot, size, power, color=(1, 1, 1)):
    bpy.ops.object.light_add(type="AREA", location=loc, rotation=rot)
    l = bpy.context.object
    l.name = name
    l.data.size = size
    l.data.energy = power
    l.data.color = color
    return l

area("key", (-1.6, -1.9, 2.9), (math.radians(52), 0, math.radians(-40)), 1.6, 150, (1.0, 0.97, 0.93))
area("fill", (3.0, -3.0, 1.6), (math.radians(70), 0, math.radians(42)), 3.5, 90, (0.92, 0.95, 1.0))
area("top", (0, -0.6, 4.2), (math.radians(8), 0, 0), 2.5, 120)
area("bounce", (0, -2.5, -1.2), (math.radians(118), 0, 0), 3.0, 20, (1.0, 0.9, 0.92))

world = bpy.data.worlds.new("w")
scene.world = world
world.use_nodes = True
bg = world.node_tree.nodes["Background"]
# Studio gradient: bright overhead, darker floor, so the silver reads as metal.
wn = world.node_tree.nodes
tc = wn.new("ShaderNodeTexCoord")
sep = wn.new("ShaderNodeSeparateXYZ")
ramp = wn.new("ShaderNodeValToRGB")
world.node_tree.links.new(tc.outputs["Generated"], sep.inputs[0])
world.node_tree.links.new(sep.outputs["Z"], ramp.inputs["Fac"])
world.node_tree.links.new(ramp.outputs["Color"], bg.inputs["Color"])
ramp.color_ramp.elements[0].position = 0.40
ramp.color_ramp.elements[0].color = (0.05, 0.045, 0.05, 1)
ramp.color_ramp.elements[1].position = 0.62
ramp.color_ramp.elements[1].color = (1.0, 0.96, 0.97, 1)
bg.inputs["Strength"].default_value = 0.9

# ---- Orthographic front camera, cropped tight to the body ----
left, right = -W / 2 - MARGIN_X, W / 2 + MARGIN_X
bottom, top = -MARGIN_BOT, H + MARGIN_TOP
frame_w, frame_h = right - left, top - bottom
bpy.ops.object.camera_add(location=(0, -10, (top + bottom) / 2), rotation=(math.pi / 2, 0, 0))
cam = bpy.context.object
cam.data.type = "ORTHO"
cam.data.ortho_scale = frame_w
scene.camera = cam

scene.render.engine = "CYCLES"
scene.cycles.device = "CPU"
scene.cycles.samples = SAMPLES
scene.cycles.use_denoising = True
scene.render.film_transparent = True
scene.render.resolution_x = RES_X
scene.render.resolution_y = round(RES_X * frame_h / frame_w)
scene.render.resolution_percentage = 100
scene.render.image_settings.file_format = "PNG"
scene.render.image_settings.color_mode = "RGBA"
scene.view_settings.view_transform = "AgX"
scene.view_settings.look = "AgX - Medium High Contrast"
scene.render.filepath = OUT
bpy.ops.render.render(write_still=True)
print("RENDERED", OUT, scene.render.resolution_x, scene.render.resolution_y)
