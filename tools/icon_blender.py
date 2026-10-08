"""Rendu photoréaliste de l'icône dans Blender (Cycles) : un néon LED flexible en silicone laiteux, courbé,
qui diffuse un dégradé arc-en-ciel et se reflète sur un sol sombre et brillant.

    blender -b -P tools/icon_blender.py -- <sortie.png> [échantillons] [focale] [largeur] [hauteur]

Le halo (« bloom ») est ajouté ensuite par tools/make_icon.py (Pillow), plus simple et plus stable que le compositeur.
"""

import math
import sys

import bpy

argv = sys.argv[sys.argv.index("--") + 1 :] if "--" in sys.argv else []
OUT = argv[0] if argv else "/tmp/icon_raw.png"
SAMPLES = int(argv[1]) if len(argv) > 1 else 256
LENS = float(argv[2]) if len(argv) > 2 else 40.0  # plus petit = néon plus petit dans le cadre (icône ronde Android)
WIDTH = int(argv[3]) if len(argv) > 3 else 1024  # 2048 × 1000 : bannière de la fiche Play Store
HEIGHT = int(argv[4]) if len(argv) > 4 else 1024

# ── Scène vide ──
bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene

# ── Courbe du néon : une vague douce en S, posée sur le sol ──
curve_data = bpy.data.curves.new("neon", type="CURVE")
curve_data.dimensions = "3D"
curve_data.resolution_u = 48
curve_data.bevel_mode = "ROUND"
curve_data.bevel_depth = 0.21
curve_data.bevel_resolution = 8
curve_data.use_fill_caps = True
spline = curve_data.splines.new("BEZIER")
pts = [(-2.2, -1.25, 0.21), (-0.8, 1.05, 0.21), (0.8, -1.05, 0.21), (2.2, 1.25, 0.21)]
spline.bezier_points.add(len(pts) - 1)
for bp, co in zip(spline.bezier_points, pts):
    bp.co = co
    bp.handle_left_type = bp.handle_right_type = "AUTO"
neon = bpy.data.objects.new("neon", curve_data)
scene.collection.objects.link(neon)

# ── Matériau néon : silicone laiteux + émission arc-en-ciel le long du tube ──
mat = bpy.data.materials.new("neon")
mat.use_nodes = True
nt = mat.node_tree
nodes, links = nt.nodes, nt.links
bsdf = nodes.get("Principled BSDF")
bsdf.inputs["Base Color"].default_value = (0.08, 0.08, 0.09, 1)
bsdf.inputs["Roughness"].default_value = 0.35
if "Subsurface Weight" in bsdf.inputs:
    bsdf.inputs["Subsurface Weight"].default_value = 0.4
tex = nodes.new("ShaderNodeTexCoord")
sep = nodes.new("ShaderNodeSeparateXYZ")
links.new(tex.outputs["Object"], sep.inputs[0])
ramp = nodes.new("ShaderNodeValToRGB")
cr = ramp.color_ramp
stops = [
    (0.00, (1.0, 0.10, 0.20)),
    (0.18, (1.0, 0.45, 0.05)),
    (0.34, (1.0, 0.85, 0.10)),
    (0.50, (0.20, 1.0, 0.45)),
    (0.66, (0.10, 0.75, 1.0)),
    (0.83, (0.35, 0.30, 1.0)),
    (1.00, (0.95, 0.20, 0.95)),
]
cr.elements[0].position, cr.elements[0].color = stops[0][0], (*stops[0][1], 1)
cr.elements[1].position, cr.elements[1].color = stops[-1][0], (*stops[-1][1], 1)
for pos, col in stops[1:-1]:
    e = cr.elements.new(pos)
    e.color = (*col, 1)
# X objet (-2.4 → 2.4) ramené à 0 → 1 : le dégradé suit la longueur du tube, du rouge au violet.
xr = nodes.new("ShaderNodeMapRange")
xr.inputs["From Min"].default_value = -2.4
xr.inputs["From Max"].default_value = 2.4
links.new(sep.outputs["X"], xr.inputs["Value"])
links.new(xr.outputs["Result"], ramp.inputs["Fac"])
# Légères pulsations le long du tube : on devine les LED derrière le diffuseur.
wave = nodes.new("ShaderNodeTexWave")
wave.wave_type = "BANDS"
wave.bands_direction = "X"
wave.inputs["Scale"].default_value = 2.4
wave.inputs["Distortion"].default_value = 0.0
maprange = nodes.new("ShaderNodeMapRange")
maprange.inputs["To Min"].default_value = 1.28
maprange.inputs["To Max"].default_value = 1.52
links.new(tex.outputs["Object"], wave.inputs["Vector"])
links.new(wave.outputs["Fac"], maprange.inputs["Value"])
links.new(ramp.outputs["Color"], bsdf.inputs["Emission Color"])
links.new(maprange.outputs["Result"], bsdf.inputs["Emission Strength"])
neon.data.materials.append(mat)

# ── Sol sombre et brillant ──
bpy.ops.mesh.primitive_plane_add(size=40, location=(0, 0, 0))
floor = bpy.context.active_object
fmat = bpy.data.materials.new("floor")
fmat.use_nodes = True
fb = fmat.node_tree.nodes.get("Principled BSDF")
fb.inputs["Base Color"].default_value = (0.012, 0.012, 0.02, 1)
fb.inputs["Roughness"].default_value = 0.28
floor.data.materials.append(fmat)

# ── Une lumière douce au-dessus, pour modeler le silicone (reflet blanc sur le dessus du tube) ──
bpy.ops.object.light_add(type="AREA", location=(0.0, 3.5, 4.5))
area = bpy.context.active_object
area.data.energy = 0.0
area.data.size = 4
area.data.color = (0.85, 0.85, 1.0)
area.rotation_euler = (math.radians(-38), 0, 0)

# ── Monde : nuit violacée très sombre ──
world = bpy.data.worlds.new("nuit")
scene.world = world
world.use_nodes = True
world.node_tree.nodes["Background"].inputs["Color"].default_value = (0.010, 0.008, 0.020, 1)
world.node_tree.nodes["Background"].inputs["Strength"].default_value = 1.0

# ── Caméra : plongée à ~40°, cadrage carré centré ──
bpy.ops.object.camera_add(location=(0, -5.0, 5.6))
cam = bpy.context.active_object
cam.data.lens = LENS
from mathutils import Vector

direction = Vector((-0.12, 0.05, 0)) - cam.location
cam.rotation_euler = direction.to_track_quat("-Z", "Y").to_euler()
scene.camera = cam

# ── Rendu ──
scene.render.engine = "CYCLES"
prefs = bpy.context.preferences.addons["cycles"].preferences
for backend in ("OPTIX", "CUDA"):
    try:
        prefs.compute_device_type = backend
        prefs.get_devices()
        if any(d.type == backend for d in prefs.devices):
            for d in prefs.devices:
                d.use = d.type == backend
            scene.cycles.device = "GPU"
            break
    except Exception:
        continue
scene.cycles.samples = SAMPLES
scene.cycles.use_denoising = True
scene.render.resolution_x, scene.render.resolution_y = WIDTH, HEIGHT
scene.render.resolution_percentage = 100
scene.view_settings.view_transform = "Standard"
scene.render.image_settings.file_format = "PNG"
scene.render.filepath = OUT
bpy.ops.render.render(write_still=True)
print("Rendu écrit :", OUT)
