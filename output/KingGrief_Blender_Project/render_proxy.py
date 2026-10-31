#!/usr/bin/env python3
"""Render temporal samples of the 4K/60 Blender scene using Cycles CPU."""
from __future__ import annotations
import argparse, sys, time
from pathlib import Path
import bpy

ROOT=Path(__file__).resolve().parent
BLEND=ROOT/'KingGrief_Trailer.blend'
parser=argparse.ArgumentParser()
parser.add_argument('--blend',type=Path,default=BLEND)
parser.add_argument('--out',type=Path,default=Path('/tmp/KingGrief_Base_Frames'))
parser.add_argument('--fps',type=int,default=12,choices=(12,15,20,24,30))
parser.add_argument('--width',type=int,default=960)
parser.add_argument('--height',type=int,default=540)
parser.add_argument('--samples',type=int,default=1)
parser.add_argument('--start-index',type=int,default=0,help='zero-based input sample')
parser.add_argument('--end-index',type=int,default=None,help='exclusive zero-based input sample')
parser.add_argument('--force',action='store_true')
argv=sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else sys.argv[1:]
args=parser.parse_args(argv)

bpy.ops.wm.open_mainfile(filepath=str(args.blend))
scene=bpy.context.scene
scene.render.engine='CYCLES'; scene.cycles.device='CPU'; scene.cycles.samples=args.samples
scene.cycles.use_denoising=True; scene.cycles.use_adaptive_sampling=False
scene.cycles.max_bounces=2; scene.cycles.diffuse_bounces=1; scene.cycles.glossy_bounces=0
scene.cycles.transmission_bounces=0; scene.cycles.volume_bounces=0
scene.render.threads_mode='FIXED'; scene.render.threads=2; scene.render.use_persistent_data=True
scene.render.resolution_x=args.width; scene.render.resolution_y=args.height; scene.render.resolution_percentage=100
scene.render.fps=60; scene.render.image_settings.file_format='PNG'; scene.render.image_settings.color_mode='RGB'
scene.render.image_settings.color_depth='8'; scene.render.image_settings.compression=10
scene.render.use_file_extension=True; scene.render.use_compositing=False; scene.render.use_sequencer=False
args.out.mkdir(parents=True,exist_ok=True)
count=round(100*args.fps); start=max(0,args.start_index); end=count if args.end_index is None else min(count,args.end_index)
if end<=start: raise SystemExit(f'Invalid index range {start}:{end}; total {count}')
print(f'BLEND={args.blend}',flush=True)
print(f'PROXY={args.width}x{args.height} @{args.fps} fps, samples={args.samples}, samples={start}:{end}/{count}',flush=True)
started=time.monotonic()
for i in range(start,end):
    output=args.out/f'frame_{i+1:06d}.png'
    if output.exists() and output.stat().st_size>1000 and not args.force: continue
    frame=1+round(i*60/args.fps)
    scene.frame_set(frame)
    bpy.ops.render.render(write_still=False)
    bpy.data.images['Render Result'].save_render(str(output),scene=scene)
    if (i-start+1)%10==0 or i+1==end:
        elapsed=time.monotonic()-started; done=i-start+1
        rate=done/max(elapsed,0.001); remain=(end-i-1)/max(rate,0.0001)
        print(f'PROGRESS {i+1}/{count} | {rate:.3f} frames/s | ETA {remain/3600:.2f} h',flush=True)
print(f'PROXY_RENDER_COMPLETE {start}:{end} elapsed={time.monotonic()-started:.1f}s',flush=True)
