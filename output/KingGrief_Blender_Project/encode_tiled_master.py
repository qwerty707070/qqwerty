#!/usr/bin/env python3
"""Assemble native 4K Blender tile sequences and encode preview/master MP4s."""
from __future__ import annotations
import argparse, subprocess
from pathlib import Path
import imageio_ffmpeg
ROOT=Path(__file__).resolve().parent; OUTPUT=ROOT.parent; ASSETS=ROOT/'assets'
parser=argparse.ArgumentParser()
parser.add_argument('--tiles',type=Path,default=Path('/tmp/KingGrief_4K_Tiles'))
parser.add_argument('--fps',type=int,default=12); parser.add_argument('--duration',type=int,default=100)
parser.add_argument('--no-preview',action='store_true')
a=parser.parse_args()
ff=imageio_ffmpeg.get_ffmpeg_exe(); audio=ASSETS/'KingGrief_Audio_Master.mp3'; count=a.fps*a.duration
names=('top_left','top_right','bottom_left','bottom_right')
for name in names:
    missing=[i for i in range(1,count+1) if not (a.tiles/name/f'frame_{i:06d}.jpg').exists()]
    if missing: raise SystemExit(f'{name}: {len(missing)} missing tile frames; first={missing[0]}')
if not audio.exists(): raise SystemExit(f'Missing soundtrack: {audio}')
def input_args():
    args=[]
    for name in names: args.extend(['-framerate',str(a.fps),'-start_number','1','-i',str(a.tiles/name/'frame_%06d.jpg')])
    return args
base='[0:v][1:v]hstack=inputs=2[top];[2:v][3:v]hstack=inputs=2[bottom];[top][bottom]vstack=inputs=2[base]'
def run(cmd): print('RUN',' '.join(map(str,cmd)),flush=True); subprocess.run(cmd,check=True)
if not a.no_preview:
    preview=OUTPUT/'KingGrief_Blender_Preview_720p30.mp4'
    fc=base+ ';[base]minterpolate=fps=30:mi_mode=mci:mc_mode=obmc:me_mode=bidir:vsbmc=1,scale=1280:720:flags=lanczos,setsar=1,format=yuv420p[v]'
    cmd=[ff,'-hide_banner','-y','-loglevel','warning','-filter_complex_threads','2',*input_args(),'-i',str(audio),'-filter_complex',fc,'-map','[v]','-map','4:a:0','-t',str(a.duration),'-r','30','-fps_mode','cfr','-c:v','libx264','-preset','veryfast','-crf','23','-maxrate','3M','-bufsize','6M','-pix_fmt','yuv420p','-c:a','aac','-b:a','160k','-ar','48000','-ac','2','-metadata','title=KingGrief • Blender trailer preview','-metadata','comment=Native 4K Blender frames, motion-interpolated to 30 fps then downscaled for review','-movflags','+faststart',str(preview)]
    run(cmd); print(f'PREVIEW {preview} {preview.stat().st_size:,} bytes',flush=True)
master=OUTPUT/'KingGrief_Blender_Trailer_4K60.mp4'
fc=base+ ';[base]minterpolate=fps=60:mi_mode=mci:mc_mode=obmc:me_mode=bidir:vsbmc=1,setsar=1,format=yuv420p[v]'
cmd=[ff,'-hide_banner','-y','-loglevel','warning','-filter_complex_threads','2',*input_args(),'-i',str(audio),'-filter_complex',fc,'-map','[v]','-map','4:a:0','-t',str(a.duration),'-r','60','-fps_mode','cfr','-c:v','libx264','-preset','veryfast','-crf','22','-maxrate','5M','-bufsize','10M','-pix_fmt','yuv420p','-c:a','aac','-b:a','192k','-ar','48000','-ac','2','-metadata','title=KingGrief • Blender 4K60 trailer','-metadata','comment=Native 3840x2160 Cycles Blender frames sampled at 12 fps and motion-interpolated to 60 fps; not native 60 fps sampling','-movflags','+faststart',str(master)]
run(cmd); print(f'MASTER {master} {master.stat().st_size:,} bytes',flush=True)
