#!/usr/bin/env python3
"""Render a 3840x2160 still using four denoised Cycles tiles (lower peak RAM)."""
from __future__ import annotations
import argparse, subprocess, time, sys
from pathlib import Path
import bpy, imageio_ffmpeg
from mathutils import Vector
ROOT=Path(__file__).resolve().parent
OUT=ROOT.parent/'KingGrief_Thumbnail_4K.jpg'
parser=argparse.ArgumentParser()
parser.add_argument('--width',type=int,default=3840); parser.add_argument('--height',type=int,default=2160)
parser.add_argument('--time',type=float,default=78.0); parser.add_argument('--samples',type=int,default=2)
argv=sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else sys.argv[1:]
a=parser.parse_args(argv)
if a.width%2 or a.height%2: raise SystemExit('Tile render requires even dimensions')
bpy.ops.wm.open_mainfile(filepath=str(ROOT/'KingGrief_Trailer.blend'))
s=bpy.context.scene
s.render.engine='CYCLES'; s.cycles.device='CPU'; s.cycles.samples=a.samples; s.cycles.use_denoising=True
s.cycles.use_adaptive_sampling=False; s.cycles.max_bounces=3; s.cycles.diffuse_bounces=1; s.cycles.glossy_bounces=1
s.render.threads_mode='FIXED'; s.render.threads=2; s.render.use_persistent_data=False
s.render.resolution_x=a.width; s.render.resolution_y=a.height; s.render.resolution_percentage=100
s.render.image_settings.file_format='PNG'; s.render.image_settings.color_mode='RGB'; s.render.image_settings.color_depth='8'; s.render.image_settings.compression=6
s.render.use_compositing=False; s.render.use_sequencer=False
# Disable shot-cut markers only in this temporary thumbnail render.
for marker in s.timeline_markers: marker.camera=None
s.frame_set(1+round(a.time*60))
# Dedicated wide composition keeps the tree, all three copper figures and the address board in frame.
cam_data=bpy.data.cameras.new('Thumbnail • 4K wide'); cam_data.lens=24; cam_data.sensor_width=36
cam=bpy.data.objects.new('Thumbnail • 4K wide',cam_data); s.collection.objects.link(cam)
cam.location=(705.0,-24.0,12.0)
target=Vector((705.0,2.5,5.2)); cam.rotation_euler=(target-Vector(cam.location)).to_track_quat('-Z','Y').to_euler()
s.camera=cam

tmp=Path('/tmp/KingGrief_Thumbnail_tiles'); tmp.mkdir(exist_ok=True)
# Blender's border coordinates use a bottom-left origin. Every tile is exactly half-frame.
tiles=[('top_left',0.0,0.5,0.5,1.0),('top_right',0.5,1.0,0.5,1.0),('bottom_left',0.0,0.5,0.0,0.5),('bottom_right',0.5,1.0,0.0,0.5)]
t0=time.monotonic()
for name,x0,x1,y0,y1 in tiles:
    s.render.use_border=True; s.render.use_crop_to_border=True
    s.render.border_min_x=x0; s.render.border_max_x=x1; s.render.border_min_y=y0; s.render.border_max_y=y1
    bpy.ops.render.render(write_still=False)
    path=tmp/f'{name}.png'; bpy.data.images['Render Result'].save_render(str(path),scene=s)
    print(f'TILE {name} {path.stat().st_size:,} bytes',flush=True)
# Reassemble the native 4K tile images without scaling.
ff=imageio_ffmpeg.get_ffmpeg_exe()
inputs=[]
for name,*_ in tiles: inputs.extend(['-i',str(tmp/f'{name}.png')])
fc='[0:v][1:v]hstack=inputs=2[top];[2:v][3:v]hstack=inputs=2[bottom];[top][bottom]vstack=inputs=2[out]'
assembled=tmp/'KingGrief_Thumbnail_assembled.png'
subprocess.run([ff,'-hide_banner','-loglevel','error','-y',*inputs,'-filter_complex',fc,'-map','[out]','-frames:v','1',str(assembled)],check=True)
subprocess.run([ff,'-hide_banner','-loglevel','error','-y','-i',str(assembled),'-frames:v','1','-q:v','2',str(OUT)],check=True)
print(f'THUMBNAIL_RENDER {a.width}x{a.height} at {a.time:.2f}s: {time.monotonic()-t0:.1f}s',flush=True)
print(f'THUMBNAIL {OUT} {OUT.stat().st_size:,} bytes',flush=True)
