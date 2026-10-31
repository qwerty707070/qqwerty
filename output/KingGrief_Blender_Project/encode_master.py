#!/usr/bin/env python3
"""Encode Blender proxy frames to review MP4 and 4K/60 master."""
from __future__ import annotations
import argparse, subprocess
from pathlib import Path
import imageio_ffmpeg
ROOT=Path(__file__).resolve().parent
OUT=ROOT.parent
ASSETS=ROOT/'assets'
parser=argparse.ArgumentParser()
parser.add_argument('--frames',type=Path,default=Path('/tmp/KingGrief_Base_Frames'))
parser.add_argument('--fps',type=int,default=12)
parser.add_argument('--duration',type=int,default=100)
parser.add_argument('--no-preview',action='store_true')
a=parser.parse_args()
ff=imageio_ffmpeg.get_ffmpeg_exe(); seq=a.frames/'frame_%06d.png'; audio=ASSETS/'KingGrief_Audio_Master.mp3'
expected=a.duration*a.fps
missing=[i for i in range(1,expected+1) if not (a.frames/f'frame_{i:06d}.png').exists()]
if missing: raise SystemExit(f'Proxy incomplete: {len(missing)} frames missing, first={missing[0]}')
if not audio.exists(): raise SystemExit(f'Missing soundtrack: {audio}')
def run(cmd): print('RUN',' '.join(map(str,cmd)),flush=True); subprocess.run(cmd,check=True)
if not a.no_preview:
    preview=OUT/'KingGrief_Blender_Preview_720p30.mp4'
    vf='minterpolate=fps=30:mi_mode=mci:mc_mode=obmc:me_mode=bidir:vsbmc=1,scale=1280:720:flags=lanczos,setsar=1,format=yuv420p'
    cmd=[ff,'-hide_banner','-y','-loglevel','warning','-threads','2','-framerate',str(a.fps),'-start_number','1','-i',str(seq),'-i',str(audio),'-vf',vf,'-map','0:v:0','-map','1:a:0','-t',str(a.duration),'-r','30','-fps_mode','cfr','-c:v','libx264','-preset','veryfast','-crf','23','-maxrate','3M','-bufsize','6M','-pix_fmt','yuv420p','-c:a','aac','-b:a','160k','-ar','48000','-ac','2','-metadata','title=KingGrief • Blender trailer preview','-metadata','comment=Blender-rendered proxy edit for review','-movflags','+faststart',str(preview)]
    run(cmd); print(f'PREVIEW {preview} {preview.stat().st_size:,} bytes',flush=True)
master=OUT/'KingGrief_Blender_Trailer_4K60.mp4'
vf='minterpolate=fps=60:mi_mode=mci:mc_mode=obmc:me_mode=bidir:vsbmc=1,scale=3840:2160:flags=lanczos,setsar=1,format=yuv420p'
cmd=[ff,'-hide_banner','-y','-loglevel','warning','-threads','2','-framerate',str(a.fps),'-start_number','1','-i',str(seq),'-i',str(audio),'-vf',vf,'-map','0:v:0','-map','1:a:0','-t',str(a.duration),'-r','60','-fps_mode','cfr','-c:v','libx264','-preset','veryfast','-crf','22','-maxrate','5M','-bufsize','10M','-pix_fmt','yuv420p','-c:a','aac','-b:a','192k','-ar','48000','-ac','2','-metadata','title=KingGrief • Blender 4K60 trailer','-metadata','comment=Blender Cycles CPU samples, motion-interpolated to 60 fps and upscaled to 4K','-movflags','+faststart',str(master)]
run(cmd); print(f'MASTER {master} {master.stat().st_size:,} bytes',flush=True)
