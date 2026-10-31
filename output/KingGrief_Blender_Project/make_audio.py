#!/usr/bin/env python3
"""Deterministically synthesize the original 100-second score and sound effects."""
from __future__ import annotations
import math, subprocess, wave
from pathlib import Path
import numpy as np
import imageio_ffmpeg

ROOT=Path(__file__).resolve().parent
ASSETS=ROOT/'assets'; ASSETS.mkdir(parents=True,exist_ok=True)
TMP=Path('/tmp/kinggrief_audio'); TMP.mkdir(parents=True,exist_ok=True)
SR=32000; SECONDS=100; N=SR*SECONDS
RNG=np.random.default_rng(7070)

def pan_add(bus,start,x,pan=0.0,gain=1.0):
    i=max(0,int(round(start*SR)))
    if i>=N: return
    x=np.asarray(x,dtype=np.float32)
    end=min(N,i+len(x)); x=x[:end-i]*gain
    p=max(-1.0,min(1.0,pan))
    bus[i:end,0]+=x*math.sqrt((1-p)*0.5)
    bus[i:end,1]+=x*math.sqrt((1+p)*0.5)

def tone(freq,dur,amp,kind='pad'):
    n=max(1,int(SR*dur)); t=np.arange(n,dtype=np.float32)/SR
    ph=2*np.pi*freq*t
    if kind=='bell':
        x=np.sin(ph)+.42*np.sin(ph*2.76+.2)+.17*np.sin(ph*5.4+.7)
        e=np.exp(-t*(2.5 if dur>0.6 else 4.4))*np.minimum(1,t/.004)
        return (x*e*amp*.42).astype(np.float32)
    if kind=='pluck':
        x=np.sin(ph)+.25*np.sin(2*ph+.2)+.09*np.sin(3*ph+.5)
        e=np.exp(-t*(3.8 if dur<.7 else 2.5))*np.minimum(1,t/.006)
        return (x*e*amp*.42).astype(np.float32)
    if kind=='bass':
        x=np.sin(ph)+.15*np.sin(ph*2)
        return (x*np.exp(-t*2.8)*np.minimum(1,t/.01)*amp*.5).astype(np.float32)
    x=np.sin(ph)+.25*np.sin(2*ph+.25)+.1*np.sin(3*ph+.4)
    env=np.minimum(1,t/max(.01,dur*.22))*np.minimum(1,np.maximum(0,(dur-t)/max(.02,dur*.28)))
    return (x*env*amp*.28).astype(np.float32)

def kick(bus,t,g):
    n=int(.48*SR); x=np.arange(n,dtype=np.float32)/SR
    f=43*x+39*(1-np.exp(-x*13))/13
    pan_add(bus,t,np.sin(2*np.pi*f)*np.exp(-x*8),0,g*.45)

def noise_hit(bus,t,dur,g,low=False,pan=0):
    n=max(1,int(dur*SR)); x=RNG.normal(0,1,n).astype(np.float32)
    if low:
        a=.05
        for i in range(1,n): x[i]=x[i-1]+a*(x[i]-x[i-1])
    else:
        smooth=x.copy(); a=.13
        for i in range(1,n): smooth[i]=smooth[i-1]+a*(x[i]-smooth[i-1])
        x=x-smooth
    tloc=np.arange(n,dtype=np.float32)/SR
    e=np.exp(-tloc*(3.2 if dur>.7 else 8.0))*np.minimum(1,tloc/.003)
    pan_add(bus,t,x*e,pan,g*.16)

def metal(bus,t,freq,g=.3,pan=0):
    n=int(.8*SR); tloc=np.arange(n,dtype=np.float32)/SR
    x=(np.sin(2*np.pi*freq*tloc)+.45*np.sin(2*np.pi*freq*1.71*tloc+.3)+.23*np.sin(2*np.pi*freq*2.38*tloc+.7))*np.exp(-tloc*5)
    pan_add(bus,t,x*np.minimum(1,tloc/.002),pan,g*.3)

def write_wav(path,a):
    peak=float(np.max(np.abs(a)))
    a=np.clip(a*min(.96/peak,1.0),-1,1)
    pcm=(a*32767).astype(np.int16)
    with wave.open(str(path),'wb') as w:
        w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR); w.writeframes(pcm.tobytes())

music=np.zeros((N,2),np.float32)
beat=60/96; bar=4*beat
chords=[(146.83,174.61,220.0,293.66),(116.54,146.83,174.61,233.08),(87.31,130.81,174.61,261.63),(130.81,164.81,196.0,261.63)]
for bi,start in enumerate(np.arange(0,SECONDS,bar)):
    chord=chords[bi%4]; g=.34 if start<8 else .52 if start<20 else .66 if start<60 else .48 if start<68 else .68 if start<87 else .78
    dur=min(bar,SECONDS-start)
    if start<60 or start>=66:
        for j,f in enumerate(chord): pan_add(music,start,tone(f,dur,.25*g,'pad'),-.25 if j%2==0 else .25)
    if start<61 or start>=77: pan_add(music,start,tone(chord[0]/2,dur,.3*g,'pad'),0)
# rhythmic pulse and bass movement
for k,t in enumerate(np.arange(0,SECONDS,beat)):
    if t<8 or 64<=t<69: continue
    intensity=.48 if t<20 else .75 if t<61 else .65 if t<88 else .88
    if k%4 in (0,2): kick(music,t,intensity)
    chord=chords[int(t/bar)%4]
    if k%2==0: pan_add(music,t+.012,tone(chord[0]/2,.36,.52*intensity,'bass'))
    if 15<t<61 and k%4==2: noise_hit(music,t+.01,.22,.40*intensity,False,(-.16 if k%8==2 else .16))
    if 12<t<96 and k%4==3: pan_add(music,t,tone(chord[2],.30,.18*intensity,'pluck'),.20)
# adventurous high motif
mel=[587.33,523.25,440,392,440,523.25,659.25,587.33,523.25,440,392,349.23,392,440,523.25,587.33]
for i in range(150):
    t=8.4+i*beat*.75
    if t>99 or 63<t<69: continue
    g=.16 if t<20 else .22 if t<62 else .18 if t<86 else .25
    pan_add(music,t,tone(mel[i%len(mel)],.55,g,'pluck'),-.24 if i%2==0 else .24)
for t,f in [(6.2,587.33),(14.8,784),(18.5,659),(54.8,523),(60,440),(67.1,392),(68.1,440),(69.1,523),(70.1,659),(71.1,784),(72.1,987.77),(73.1,1174.66),(78,659),(81,784),(89,523),(94,659),(97,784),(99,1174.66)]:
    pan_add(music,t,tone(f,1.6 if t<90 else 2.2,.22,'bell'),-.2 if int(t)%2 else .2)
# subtle cross-channel echo and soft transition swells
for d,g in [(.19,.12),(.37,.075),(.61,.035)]:
    n=int(d*SR); echo=music[:-n].copy()*g; music[n:,0]+=echo[:,1]; music[n:,1]+=echo[:,0]
for t,g,pan in [(0,.32,-.2),(8.5,.22,.15),(21.4,.32,-.1),(34.5,.25,.12),(48.5,.18,-.1),(59.2,.26,.1),(63,.36,-.1),(86.2,.40,.12)]:
    n=int(1.8*SR); x=RNG.normal(0,1,n).astype(np.float32); sm=x.copy()
    for i in range(1,n): sm[i]=sm[i-1]+.05*(x[i]-sm[i-1])
    tl=np.arange(n,dtype=np.float32)/SR; env=np.sin(np.minimum(1,tl/1.8)*math.pi/2)**2
    pan_add(music,t,sm*env,pan,g*.18)
t=np.arange(N,dtype=np.float32)/SR
music*=((np.minimum(1,t/1.0)*np.minimum(1,np.maximum(0,(SECONDS-t)/2.5)))[:,None])

sfx=np.zeros((N,2),np.float32)
# opening ambience and cut transitions
for t,g,p in [(0.4,.62,-.25),(8.8,.4,.2),(21.8,.55,-.18),(34.8,.42,.18),(48.7,.35,-.1),(59.4,.45,.15),(63.6,.66,-.2),(86.7,.7,.15)]: noise_hit(sfx,t,1.2,g,True,p)
# gear/chest/treasure
metal(sfx,9.7,640,.5,-.18); metal(sfx,10.25,810,.34,.15); noise_hit(sfx,11.9,.5,.45,True)
metal(sfx,12.65,930,.60,.08)
for i,f in enumerate((659.25,784,987.77,1174.66)): pan_add(sfx,13+i*.23,tone(f,.8,.28,'bell'),-.24+i*.15)
# fuse, breach and debris
noise_hit(sfx,21.7,1.8,.5,False,.05)
for t in (22.1,22.55,23.0,23.45,23.9): metal(sfx,t,1250+(t*7%200),.15)
kick(sfx,24,1.7); noise_hit(sfx,24,2.1,1.8,True); noise_hit(sfx,24.02,1.35,1.1,False,-.12); metal(sfx,24.15,86,.75)
for i,t in enumerate((24.4,24.7,25.1,25.45,26.0)): noise_hit(sfx,t,.3,.26,True,-.5+.25*i)
# sword swings and impacts
for i,t in enumerate((35.8,37.2,38.7,40.2,42.1,43.7,45.0,46.4,47.8)):
    noise_hit(sfx,t,.38,.4,False,-.42 if i%2==0 else .42); metal(sfx,t+.08,550+65*(i%4),.45,.4 if i%2==0 else -.4)
# team footsteps
for i,t in enumerate(np.arange(49.7,59.2,.43)): noise_hit(sfx,float(t),.1,.16,True,-.25 if i%2 else .25)
# star installation, light ignition, plaza reveal, finale
metal(sfx,68.2,392,.52,-.15)
for i,(t,f) in enumerate(zip((69,69.55,70.1,70.65,71.2,71.75,72.3,72.85),(392,440,523.25,587.33,659.25,784,987.77,1174.66))): pan_add(sfx,t,tone(f,.8,.31,'bell'),-.25+i*.07)
kick(sfx,74,1.0); noise_hit(sfx,74,1.6,.72,True); metal(sfx,74.25,523,.5,.1)
kick(sfx,87,1.45); noise_hit(sfx,87,2.2,1.3,True); noise_hit(sfx,87.05,1.3,.7,False,.05)
pan_add(sfx,89,tone(392,1.9,.20,'bell'),-.12); pan_add(sfx,94,tone(523,2.3,.23,'bell'),.08); pan_add(sfx,98.6,tone(784,2.6,.30,'bell'))
master=music*.78+sfx*.82
peak=float(np.max(np.abs(master)))
if peak>.93: master*=.93/peak

music_wav=TMP/'music.wav'; sfx_wav=TMP/'sfx.wav'; master_wav=TMP/'master.wav'
write_wav(music_wav,music); write_wav(sfx_wav,sfx); write_wav(master_wav,master)
ff=imageio_ffmpeg.get_ffmpeg_exe()
def encode(src,dst,codec,args): subprocess.run([ff,'-hide_banner','-loglevel','error','-y','-i',str(src),'-vn','-c:a',codec,*args,str(dst)],check=True)
encode(music_wav,ASSETS/'KingGrief_Soundtrack.flac','flac',['-compression_level','8'])
encode(sfx_wav,ASSETS/'KingGrief_SFX.flac','flac',['-compression_level','8'])
encode(master_wav,ASSETS/'KingGrief_Audio_Master.mp3','libmp3lame',['-b:a','192k','-ar','48000','-ac','2'])
print('Audio written:')
for p in sorted(ASSETS.glob('KingGrief_*')): print(p.name,p.stat().st_size)
