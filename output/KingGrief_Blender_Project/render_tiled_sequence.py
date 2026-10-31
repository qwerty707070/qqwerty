#!/usr/bin/env python3
"""Render a native 3840x2160 Cycles sequence as four denoised tiles per time sample.
This limits peak RAM; JPEG tiles remain in /tmp and are assembled by encode_tiled_master.py.
"""
from __future__ import annotations
import argparse, sys, time
from pathlib import Path
import bpy
ROOT=Path(__file__).resolve().parent
BLEND=ROOT/'KingGrief_Trailer.blend'
DEFAULT_OUT=Path('/tmp/KingGrief_4K_Tiles')
parser=argparse.ArgumentParser()
parser.add_argument('--blend',type=Path,default=BLEND)
parser.add_argument('--out',type=Path,default=DEFAULT_OUT)
parser.add_argument('--fps',type=int,default=12,choices=(6,8,10,12,15,20,24,30,60))
parser.add_argument('--samples',type=int,default=1)
parser.add_argument('--start-index',type=int,default=0,help='zero-based time sample')
parser.add_argument('--end-index',type=int,default=None,help='exclusive zero-based time sample')
parser.add_argument('--force',action='store_true')
argv=sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else sys.argv[1:]
a=parser.parse_args(argv)
bpy.ops.wm.open_mainfile(filepath=str(a.blend))
s=bpy.context.scene
s.render.engine='CYCLES'; s.cycles.device='CPU'; s.cycles.samples=a.samples; s.cycles.use_denoising=True
s.cycles.use_adaptive_sampling=False; s.cycles.max_bounces=2; s.cycles.diffuse_bounces=1; s.cycles.glossy_bounces=0
s.render.threads_mode='FIXED'; s.render.threads=2; s.render.use_persistent_data=False
s.render.resolution_x=3840; s.render.resolution_y=2160; s.render.resolution_percentage=100
s.render.image_settings.file_format='JPEG'; s.render.image_settings.color_mode='RGB'; s.render.image_settings.quality=94
s.render.image_settings.color_depth='8'; s.render.use_file_extension=True
s.render.use_compositing=False; s.render.use_sequencer=False
count=100*a.fps; start=max(0,a.start_index); end=count if a.end_index is None else min(count,a.end_index)
if end<=start: raise SystemExit(f'Invalid sample range {start}:{end}/{count}')
tiles=[('top_left',0.0,0.5,0.5,1.0),('top_right',0.5,1.0,0.5,1.0),('bottom_left',0.0,0.5,0.0,0.5),('bottom_right',0.5,1.0,0.0,0.5)]
for name,*_ in tiles: (a.out/name).mkdir(parents=True,exist_ok=True)
print(f'NATIVE_TILED_RENDER 3840x2160 @ {a.fps} fps; Cycles samples={a.samples}; samples {start}:{end}/{count}',flush=True)
print(f'BLEND={a.blend} OUT={a.out}',flush=True)
t0=time.monotonic()
for i in range(start,end):
    frame=1+round(i*60/a.fps); s.frame_set(frame)
    for name,x0,x1,y0,y1 in tiles:
        path=a.out/name/f'frame_{i+1:06d}.jpg'
        if path.exists() and path.stat().st_size>1000 and not a.force: continue
        s.render.use_border=True; s.render.use_crop_to_border=True
        s.render.border_min_x=x0; s.render.border_max_x=x1
        s.render.border_min_y=y0; s.render.border_max_y=y1
        bpy.ops.render.render(write_still=False)
        bpy.data.images['Render Result'].save_render(str(path),scene=s)
    if (i-start+1)%2==0 or i+1==end:
        elapsed=time.monotonic()-t0; done=i-start+1; rate=done/max(elapsed,0.001); remain=(end-i-1)/max(rate,0.00001)
        print(f'PROGRESS sample={i+1}/{count} frames={done} | {rate:.4f} frames/s | ETA={remain/3600:.2f} h',flush=True)
print(f'TILED_RENDER_COMPLETE samples={start}:{end} elapsed={time.monotonic()-t0:.1f}s',flush=True)
