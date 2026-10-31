#!/usr/bin/env python3
"""Build an editable, procedural 100-second KingGrief Blender trailer scene.
Run with Blender 4.5's Python (the bpy wheel also works with the supplied shims).
All sets, voxel props, characters, cameras, lighting and animation are authored here.
"""
from __future__ import annotations
import math, random
from pathlib import Path
import bpy
from mathutils import Vector, Matrix

ROOT=Path(__file__).resolve().parent
ASSETS=ROOT/'assets'
ASSETS.mkdir(parents=True,exist_ok=True)
BLEND=ROOT/'KingGrief_Trailer.blend'
FPS=60
DURATION=100
END_FRAME=FPS*DURATION
RNG=random.Random(7070)

bpy.ops.wm.read_factory_settings(use_empty=True)
scene=bpy.context.scene
scene.frame_start=1
scene.frame_end=END_FRAME
scene.render.engine='CYCLES'
scene.cycles.device='CPU'
scene.cycles.samples=16
scene.cycles.use_denoising=True
scene.cycles.max_bounces=4
scene.cycles.diffuse_bounces=2
scene.cycles.glossy_bounces=1
scene.render.threads_mode='FIXED'
scene.render.threads=2
scene.render.resolution_x=3840
scene.render.resolution_y=2160
scene.render.resolution_percentage=100
scene.render.fps=FPS
scene.render.fps_base=1.0
scene.render.image_settings.file_format='PNG'
scene.render.image_settings.color_mode='RGB'
scene.render.image_settings.color_depth='8'
scene.render.image_settings.compression=10
scene.render.filepath='//renders/KingGrief_'
scene.render.use_file_extension=True
scene.render.use_compositing=False
scene.render.use_sequencer=False
scene.view_settings.view_transform='AgX'
scene.render.film_transparent=False
scene.render.resolution_percentage=100
scene['Production']='KingGrief cinematic trailer'
scene['Authenticity']='Stylized concept reconstruction; live server map not supplied'
scene['Master target']='3840x2160, 60 fps, 100 seconds'

# Collections
COLS={}
for name in ('World','Characters','Animated','Lights','Cameras','Typography'):
    c=bpy.data.collections.new(name)
    scene.collection.children.link(c)
    COLS[name]=c

# Materials
PALETTE={
 'night':((0.025,0.035,0.07,1),0.0,0.8,None),
 'ground':((0.10,0.12,0.13,1),0.0,0.85,None),
 'stone':((0.28,0.31,0.34,1),0.0,0.8,None),
 'stone_dark':((0.11,0.13,0.16,1),0.0,0.9,None),
 'stone_light':((0.47,0.48,0.48,1),0.0,0.75,None),
 'wood':((0.27,0.14,0.075,1),0.0,0.72,None),
 'wood_light':((0.50,0.27,0.11,1),0.0,0.65,None),
 'wood_dark':((0.12,0.065,0.04,1),0.0,0.8,None),
 'bark':((0.19,0.10,0.05,1),0.0,0.9,None),
 'leaf_green':((0.09,0.30,0.14,1),0.0,0.82,None),
 'leaf_pine':((0.07,0.25,0.15,1),0.0,0.82,None),
 'leaf_rust':((0.52,0.16,0.045,1),0.0,0.8,None),
 'leaf_gold':((0.78,0.34,0.055,1),0.0,0.75,None),
 'leaf_copper':((0.58,0.23,0.08,1),0.0,0.78,None),
 'snow':((0.82,0.88,0.92,1),0.0,0.6,None),
 'copper':((0.62,0.28,0.12,1),0.35,0.42,None),
 'copper_light':((0.86,0.47,0.19,1),0.25,0.38,None),
 'patina':((0.11,0.35,0.27,1),0.2,0.55,None),
 'gold':((0.83,0.49,0.075,1),0.6,0.28,None),
 'gold_glow':((1.0,0.62,0.11,1),0.25,0.28,(1.0,0.42,0.045,1.8)),
 'bulb_warm':((1.0,0.56,0.16,1),0.1,0.25,(1.0,0.36,0.055,2.5)),
 'bulb_blue':((0.12,0.60,1.0,1),0.1,0.25,(0.05,0.35,1.0,1.7)),
 'red':((0.62,0.035,0.025,1),0.0,0.58,None),
 'red_glow':((1.0,0.10,0.025,1),0.1,0.35,(1.0,0.06,0.015,1.6)),
 'ember':((1.0,0.25,0.045,1),0.0,0.45,(1.0,0.12,0.02,2.2)),
 'silver':((0.68,0.75,0.81,1),0.18,0.34,(0.13,0.17,0.20,0.24)),
 'leather':((0.18,0.075,0.035,1),0.0,0.75,None),
 'skin_warm':((0.73,0.43,0.26,1),0.0,0.72,None),
 'skin_light':((0.88,0.65,0.46,1),0.0,0.75,None),
 'skin_dark':((0.31,0.16,0.11,1),0.0,0.8,None),
 'hair':((0.055,0.035,0.028,1),0.0,0.82,None),
 'shirt_lime':((0.27,0.60,0.20,1),0.0,0.7,None),
 'shirt_crimson':((0.62,0.08,0.055,1),0.0,0.7,None),
 'shirt_cream':((0.78,0.68,0.48,1),0.0,0.72,None),
 'shirt_teal':((0.05,0.32,0.32,1),0.0,0.72,None),
 'pants_blue':((0.12,0.25,0.48,1),0.0,0.8,None),
 'pants_charcoal':((0.11,0.13,0.17,1),0.0,0.86,None),
 'text':((1.0,0.79,0.43,1),0.25,0.35,(0.75,0.31,0.055,0.5)),
}
MATS={}
for name,(base,metal,rough,emission) in PALETTE.items():
    m=bpy.data.materials.new(name)
    m.diffuse_color=base
    m.use_nodes=True
    bs=m.node_tree.nodes.get('Principled BSDF')
    bs.inputs['Base Color'].default_value=base
    bs.inputs['Metallic'].default_value=metal
    bs.inputs['Roughness'].default_value=rough
    if emission:
        em=bs.inputs.get('Emission Color') or bs.inputs.get('Emission')
        if em: em.default_value=emission[:4]
        es=bs.inputs.get('Emission Strength')
        if es: es.default_value=emission[3]
    MATS[name]=m

# Shared unit-cube meshes make the animated characters inexpensive to build.
CUBE_FACES=((0,1,2,3),(4,7,6,5),(0,4,5,1),(1,5,6,2),(2,6,7,3),(4,0,3,7))
CUBE_VERTS=((-0.5,-0.5,-0.5),(0.5,-0.5,-0.5),(0.5,0.5,-0.5),(-0.5,0.5,-0.5),(-0.5,-0.5,0.5),(0.5,-0.5,0.5),(0.5,0.5,0.5),(-0.5,0.5,0.5))
CUBE_MESH={}
for mn,mat in MATS.items():
    mesh=bpy.data.meshes.new('unit cube '+mn)
    mesh.from_pydata(CUBE_VERTS,[],CUBE_FACES)
    mesh.materials.append(mat)
    mesh.update()
    CUBE_MESH[mn]=mesh

def sec_frame(sec): return 1+int(round(sec*FPS))
def link_obj(obj,coll): coll.objects.link(obj); return obj

def cube_obj(name,loc,dims,mat,parent=None,coll='Animated'):
    obj=bpy.data.objects.new(name,CUBE_MESH[mat]); COLS[coll].objects.link(obj)
    if parent: obj.parent=parent
    obj.location=loc; obj.scale=dims
    return obj

def empty_obj(name,loc=(0,0,0),parent=None,coll='Animated'):
    obj=bpy.data.objects.new(name,None); COLS[coll].objects.link(obj)
    obj.empty_display_type='PLAIN_AXES'; obj.empty_display_size=0.18
    if parent: obj.parent=parent
    obj.location=loc
    return obj

class VoxelBatch:
    def __init__(self,name,coll='World'):
        self.name=name; self.coll=COLS[coll]; self.data={}
    def cube(self,loc,dims,mat): self.data.setdefault(mat,[]).append((tuple(loc),tuple(dims)))
    def build(self):
        for mat,items in self.data.items():
            verts=[]; faces=[]
            for (cx,cy,cz),(dx,dy,dz) in items:
                base=len(verts)
                verts.extend((cx+x*dx,cy+y*dy,cz+z*dz) for x,y,z in CUBE_VERTS)
                faces.extend(tuple(base+j for j in face) for face in CUBE_FACES)
            mesh=bpy.data.meshes.new(self.name+'_'+mat)
            mesh.from_pydata(verts,[],faces); mesh.materials.append(MATS[mat]); mesh.update()
            obj=bpy.data.objects.new(self.name+' • '+mat,mesh); self.coll.objects.link(obj)
        return self

def key(obj,attr,sec,value,index=-1):
    if index>=0: getattr(obj,attr)[index]=value
    else: setattr(obj,attr,value)
    obj.keyframe_insert(data_path=attr,frame=sec_frame(sec),index=index)

def smooth_keys(obj,attr,kind='BEZIER'):
    ad=getattr(obj,'animation_data',None)
    if not ad or not ad.action: return
    try: curves=ad.action.fcurves
    except Exception: return
    for fc in curves:
        if fc.data_path==attr:
            for kp in fc.keyframe_points:
                kp.interpolation=kind
                if kind=='BEZIER': kp.handle_left_type='AUTO_CLAMPED'; kp.handle_right_type='AUTO_CLAMPED'

def look_at(obj,target):
    obj.rotation_euler=(Vector(target)-obj.location).to_track_quat('-Z','Y').to_euler()

def text_obj(name,body,loc,size,mat='text',rot=(math.pi/2,0,0),extrude=0.015):
    data=bpy.data.curves.new(name,'FONT'); data.body=body; data.size=size; data.extrude=extrude; data.bevel_depth=0.003; data.align_x='CENTER'; data.align_y='CENTER'
    data.materials.append(MATS[mat])
    obj=bpy.data.objects.new(name,data); COLS['Typography'].objects.link(obj)
    obj.location=loc; obj.rotation_euler=rot
    return obj

def add_area(name,loc,target,energy,color=(1.0,0.55,0.25),size=6):
    data=bpy.data.lights.new(name,'AREA'); data.energy=energy; data.shape='DISK'; data.size=size; data.color=color[:3]
    obj=bpy.data.objects.new(name,data); COLS['Lights'].objects.link(obj); obj.location=loc; look_at(obj,target)
    return obj

def add_point(name,loc,power,color=(1.0,0.45,0.12),radius=1.0):
    data=bpy.data.lights.new(name,'POINT'); data.energy=power; data.color=color[:3]; data.shadow_soft_size=radius
    obj=bpy.data.objects.new(name,data); COLS['Lights'].objects.link(obj); obj.location=loc
    return obj

def add_tree(batch,x,y,z=0,scale=1.0,evergreen=False,snow=False):
    bark='bark'; leaf='leaf_pine' if evergreen else RNG.choice(['leaf_rust','leaf_gold','leaf_copper'])
    batch.cube((x,y,z+0.95*scale),(0.62*scale,0.62*scale,1.9*scale),bark)
    for level in range(5):
        h=z+(1.9+level*0.78)*scale
        width=(4.3-level*0.72)*scale
        depth=(2.4-level*0.3)*scale
        batch.cube((x,y,h),(width,depth,1.05*scale),leaf)
        if level<4:
            for sx in (-0.62,0.62):
                batch.cube((x+sx*width*0.48,y,h-0.05*scale),(0.9*scale,depth*0.85,0.78*scale),leaf)
        if snow and level%2==0:
            batch.cube((x,y-0.02*scale,h+0.57*scale),(width*0.58,depth*0.52,0.12*scale),'snow')

def add_lantern(batch,x,y,z=4.0,mat='bulb_warm'):
    batch.cube((x,y,z),(0.24,0.24,0.34),'gold')
    batch.cube((x,y,z-0.23),(0.34,0.34,0.12),mat)

def add_present(batch,x,y,z,color='red'):
    batch.cube((x,y,z+0.35),(0.85,0.72,0.7),color)
    batch.cube((x,y-0.01,z+0.36),(0.12,0.74,0.74),'gold')
    batch.cube((x,y,z+0.36),(0.88,0.12,0.74),'gold')

def make_character(name,base,shirt='shirt_lime',pants='pants_blue',skin='skin_warm',scale=1.0,copper=False):
    root=empty_obj(name+' • root',base,coll='Characters'); root.empty_display_size=0.5
    shirt_mat='copper' if copper else shirt; pant_mat='copper' if copper else pants; skin_mat='copper_light' if copper else skin; hair_mat='patina' if copper else 'hair'
    def part(label,loc,dims,mat,parent=root): return cube_obj(name+' • '+label,loc,tuple(v*scale for v in dims),mat,parent,'Characters')
    part('torso',(0,0,1.12),(0.66,0.40,0.74),shirt_mat)
    part('belt',(0,-0.015,0.78),(0.67,0.43,0.14),'leather')
    part('buckle',(0,-0.24,0.78),(0.14,0.06,0.16),'gold')
    part('head',(0,0,1.78),(0.62,0.55,0.62),skin_mat)
    part('hair cap',(0,0,2.08),(0.65,0.58,0.18),hair_mat)
    part('fringe',(-0.16,-0.30,1.90),(0.34,0.08,0.18),hair_mat)
    part('hair side',(0.29,-0.02,1.84),(0.12,0.50,0.35),hair_mat)
    eye='gold_glow' if copper else 'snow'
    part('eye L',(-0.14,-0.29,1.79),(0.10,0.04,0.10),eye)
    part('eye R',(0.14,-0.29,1.79),(0.10,0.04,0.10),eye)
    part('pupil L',(-0.14,-0.32,1.79),(0.045,0.026,0.06),'hair')
    part('pupil R',(0.14,-0.32,1.79),(0.045,0.026,0.06),'hair')
    arms=[]; legs=[]
    for side,label in [(-1,'L'),(1,'R')]:
        pivot=empty_obj(name+' • '+label+' arm pivot',(side*0.40*scale,0,1.43*scale),root,'Characters')
        cube_obj(name+' • '+label+' sleeve',(0,0,-0.31*scale),(0.24*scale,0.30*scale,0.62*scale),shirt_mat,pivot,'Characters')
        cube_obj(name+' • '+label+' hand',(0,-0.02*scale,-0.64*scale),(0.22*scale,0.28*scale,0.20*scale),skin_mat,pivot,'Characters')
        arms.append(pivot)
        lp=empty_obj(name+' • '+label+' leg pivot',(side*0.18*scale,0,0.76*scale),root,'Characters')
        cube_obj(name+' • '+label+' leg',(0,0,-0.30*scale),(0.26*scale,0.32*scale,0.60*scale),pant_mat,lp,'Characters')
        cube_obj(name+' • '+label+' boot',(0,-0.07*scale,-0.60*scale),(0.29*scale,0.44*scale,0.22*scale),'leather',lp,'Characters')
        legs.append(lp)
    return {'root':root,'arms':arms,'legs':legs}

def make_duel_sword(name,arm_pivot,rest_arm_x):
    rig=empty_obj(name+' • sword rig',(0,-0.015,-0.65),arm_pivot,'Characters')
    rig.rotation_euler=(0,0,0)
    cube_obj(name+' • pommel',(0,0,-0.03),(0.16,0.13,0.16),'gold',rig,'Characters')
    cube_obj(name+' • grip',(0,0,0.13),(0.13,0.13,0.32),'leather',rig,'Characters')
    cube_obj(name+' • crossguard',(0,0,0.30),(0.14,0.52,0.13),'gold',rig,'Characters')
    cube_obj(name+' • blade',(0,0,0.78),(0.18,0.12,1.10),'silver',rig,'Characters')
    cube_obj(name+' • tip',(0,0,1.41),(0.15,0.12,0.16),'silver',rig,'Characters')
    return rig

def make_clash_sword(name,base,lean):
    """A readable foreground blade, animated only during sword-contact beats."""
    root=empty_obj(name+' • impact rig',base,coll='Animated')
    root.rotation_euler=(0,lean,0)
    cube_obj(name+' • pommel',(0,0,-0.03),(0.17,0.14,0.16),'gold',root,'Animated')
    cube_obj(name+' • grip',(0,0,0.16),(0.14,0.13,0.34),'leather',root,'Animated')
    cube_obj(name+' • crossguard',(0,0,0.40),(0.62,0.14,0.14),'gold',root,'Animated')
    cube_obj(name+' • blade',(0,0,1.35),(0.20,0.13,1.72),'silver',root,'Animated')
    cube_obj(name+' • tip',(0,0,2.27),(0.16,0.13,0.18),'silver',root,'Animated')
    contacts=(37.55,40.55,44.15)
    key(root,'scale',35.0,(0.001,0.001,0.001))
    for t in contacts:
        key(root,'scale',t-0.18,(0.001,0.001,0.001))
        key(root,'scale',t,(1,1,1)); key(root,'scale',t+0.12,(1,1,1))
        key(root,'scale',t+0.42,(0.001,0.001,0.001))
    key(root,'scale',49.0,(0.001,0.001,0.001))
    smooth_keys(root,'scale')
    return root

def create_camera(name,s0,s1,loc0,targ0,loc1,targ1,lens):
    data=bpy.data.cameras.new(name+' lens'); data.lens=lens; data.sensor_width=36
    cam=bpy.data.objects.new(name,data); COLS['Cameras'].objects.link(cam)
    cam.location=loc0; look_at(cam,targ0); key(cam,'location',s0,loc0); key(cam,'rotation_euler',s0,tuple(cam.rotation_euler))
    cam.location=loc1; look_at(cam,targ1); key(cam,'location',s1,loc1); key(cam,'rotation_euler',s1,tuple(cam.rotation_euler))
    smooth_keys(cam,'location'); smooth_keys(cam,'rotation_euler')
    marker=scene.timeline_markers.new(name,frame=sec_frame(s0)); marker.camera=cam
    return cam

# Global warm sunset, used as a restrained fill behind the practical set lights.
world=bpy.data.worlds.new('KingGrief • dusk world'); scene.world=world; world.use_nodes=True
world.node_tree.nodes['Background'].inputs['Color'].default_value=(0.055,0.035,0.055,1)
world.node_tree.nodes['Background'].inputs['Strength'].default_value=0.32
sun_data=bpy.data.lights.new('Soft autumn sun','SUN'); sun_data.energy=1.2; sun_data.angle=math.radians(8)
sun=bpy.data.objects.new('Soft autumn sun',sun_data); COLS['Lights'].objects.link(sun); sun.location=(65,-45,70); look_at(sun,(65,0,0))

# SET 01 • Autumn valley / in-world credits plaque
X_FOREST=0
b=VoxelBatch('Autumn valley')
b.cube((X_FOREST,0,-0.35),(72,72,0.7),'ground')
for y in range(-18,23,2):
    for x in range(-3,4):
        if abs(x)<=2: b.cube((X_FOREST+x*1.0,y,0.08),(0.95,1.9,0.16),'stone_dark' if (x+y)%4 else 'stone_light')
for x,y,s in [(-12,-8,1.2),(12,-8,1.1),(-15,2,1.5),(14,4,1.3),(-10,13,1.2),(10,14,1.3),(-19,-1,1.4),(19,0,1.45),(-5,21,1.0),(6,22,1.0)]: add_tree(b,x,y,0,s,False,False)
# timber entry arch and welcoming plaque
for x in (-5.5,5.5):
    b.cube((x,-1,3.1),(0.55,0.7,6.2),'wood_dark')
    b.cube((x,-1,6.3),(1.0,1.0,0.55),'wood_light')
b.cube((0,-1,6.7),(12.2,0.75,0.72),'wood')
b.cube((0,-1.42,5.15),(9.4,0.20,2.15),'wood_dark')
b.build()
text_obj('Opening plaque title','KINGGRIEF',(0,-1.56,5.48),0.78,'text')
text_obj('Opening plaque creators','_qwerty_70   •   domep444543   •   mistrKristalik',(0,-1.57,4.78),0.25,'snow',extrude=0.006)
for x,y in [(-7,-2),(7,-2),(-8,8),(8,8)]: add_point('Valley lantern',(x,y,2.4),160,(1.0,0.35,0.10),1.2)
add_area('Valley sunset fill',(0,-8,12),(0,0,3),950,(1.0,0.50,0.25),10)

# SET 02 • Workshop, turning gear, chest and rising treasure
X_WORK=140
b=VoxelBatch('Lantern workshop')
b.cube((X_WORK,0,-0.30),(42,34,0.6),'stone_dark')
b.cube((X_WORK,4,4),(28,0.8,8),'wood_dark')
for x in (X_WORK-13,X_WORK-6,X_WORK+6,X_WORK+13): b.cube((x,3.4,4),(0.7,1.0,8),'wood_light')
for x in range(-14,15,4): b.cube((X_WORK+x,2.4,8.1),(4.1,1.0,0.5),'wood')
for y in (-8,8):
    for x in (-12,-6,0,6,12):
        b.cube((X_WORK+x,y,1.4),(0.48,0.48,2.8),'wood_dark')
        b.cube((X_WORK+x,y,2.8),(0.75,0.75,0.20),'wood_light')
# workbench and store shelves
b.cube((X_WORK-6,-1,1.1),(7,1.5,0.7),'wood_light')
for x in (X_WORK-8.6,X_WORK-3.4): b.cube((x,-1,0.55),(0.55,1.0,1.1),'wood_dark')
for z in (3.0,5.0): b.cube((X_WORK+8,1.5,z),(6,0.7,0.35),'wood_light')
for x in (X_WORK+6,X_WORK+8,X_WORK+10):
    for z in (3.5,5.5): b.cube((x,1.5,z+0.4),(0.8,0.65,0.65),'gold' if int(x)%2 else 'leaf_green')
b.build()
# Rotating cog-wheel in a vertical plane
gear=empty_obj('Workshop • rotating gear',(X_WORK-5,-3.0,3.3),coll='Animated')
for j in range(12):
    a=2*math.pi*j/12
    tooth=cube_obj(f'Gear tooth {j+1}',(1.45*math.sin(a),0,1.45*math.cos(a)),(0.52,0.32,0.65),'gold',gear)
    tooth.rotation_euler[1]=a
hub=cube_obj('Gear hub',(0,-0.05,0),(0.92,0.42,0.92),'wood_dark',gear)
cube_obj('Gear axle',(0,-0.34,0),(0.36,0.24,0.36),'gold',gear)
key(gear,'rotation_euler',8,(0,0,0)); key(gear,'rotation_euler',21.8,(0,math.tau*1.6,0)); smooth_keys(gear,'rotation_euler','LINEAR')
# chest base and lid, open around 11 seconds
chest=empty_obj('Workshop chest',(X_WORK+4,-3.2,0),coll='Animated')
cube_obj('Chest body',(0,0,0.55),(2.4,1.6,1.1),'wood_dark',chest)
cube_obj('Chest front band',(0,-0.82,0.55),(2.42,0.12,0.18),'gold',chest)
cube_obj('Chest clasp',(0,-0.9,0.72),(0.34,0.12,0.42),'gold',chest)
lid=empty_obj('Chest opening lid',(0,0.58,1.05),chest,'Animated')
cube_obj('Chest lid',(0,-0.58,0.06),(2.5,1.45,0.28),'wood_light',lid)
cube_obj('Chest lid trim',(0,-0.58,-0.08),(2.46,1.48,0.10),'gold',lid)
key(lid,'rotation_euler',8.0,(0,0,0)); key(lid,'rotation_euler',10.6,(math.radians(-72),0,0)); key(lid,'rotation_euler',16.0,(math.radians(-72),0,0)); smooth_keys(lid,'rotation_euler')
for i,(dx,mat) in enumerate([(-0.55,'gold'),(0,'gold_glow'),(0.55,'silver')]):
    loot=cube_obj(f'Rising relic {i+1}',(X_WORK+4+dx,-3.0,1.5),(0.46,0.46,0.5),mat,coll='Animated')
    key(loot,'location',8,(X_WORK+4+dx,-3.0,1.4)); key(loot,'location',12,(X_WORK+4+dx,-3.0,3.2+i*0.15)); key(loot,'location',16,(X_WORK+4+dx,-3.0,3.4+i*0.15)); smooth_keys(loot,'location')
for x,y in [(X_WORK-10,-5),(X_WORK+10,-5),(X_WORK-11,3),(X_WORK+11,3)]: add_point('Workshop torch',(x,y,4.0),260,(1.0,0.32,0.08),1.5)
add_area('Workshop firelight',(X_WORK,-8,9),(X_WORK,0,2),850,(1.0,0.43,0.16),8)

# SET 03 • Stone breach / staged TNT raid
X_RAID=280
b=VoxelBatch('Stone breach')
b.cube((X_RAID,0,-0.3),(44,36,0.6),'ground')
# fortress wall with a broken doorway
for x in range(-15,16):
    for z in range(0,6):
        if abs(x)>3 or z>2:
            b.cube((X_RAID+x,5,z+0.5),(0.95,0.8,0.95),'stone_dark' if (x+z)%5 else 'stone')
for x in (-15,15): b.cube((X_RAID+x,5,5.8),(3,1.0,1.0),'wood_dark')
for x,y in [(-12,-7),(12,-7),(-16,3),(16,3)]:
    add_tree(b,x+X_RAID,y,0,0.85,True,False)
for x in range(-4,5): b.cube((X_RAID+x,-8,0.25),(0.9,1.0,0.5),'stone_light')
b.build()
# stacked TNT cubes
for j in range(3):
    tnt=cube_obj(f'TNT crate {j+1}',(X_RAID+(j-1)*0.92,-1.2,0.58+j*0.8),(0.84,0.84,0.72),'red',coll='Animated')
    cube_obj(f'TNT band {j+1}',(X_RAID+(j-1)*0.92,-1.64,0.58+j*0.8),(0.86,0.08,0.12),'snow',tnt,'Animated')
text_obj('TNT block label','TNT',(X_RAID,-1.72,1.4),0.42,'snow')
# breach rubble and flying cubes
for i in range(28):
    ang=2*math.pi*i/28; rad=RNG.uniform(0.7,3.2); z=RNG.uniform(0.8,4.3)
    mat=RNG.choice(['stone_light','wood_light','stone','ember'])
    obj=cube_obj(f'Breach debris {i+1}',(X_RAID+rad*math.cos(ang),-0.2+rad*math.sin(ang),z),(RNG.uniform(0.25,0.7),RNG.uniform(0.25,0.7),RNG.uniform(0.25,0.7)),mat,coll='Animated')
    key(obj,'scale',22.0,(0.001,0.001,0.001)); key(obj,'location',23.9,(X_RAID+0.1*math.cos(ang),-0.3+0.1*math.sin(ang),0.8)); key(obj,'scale',23.9,(0.001,0.001,0.001))
    key(obj,'location',24.15,(X_RAID+rad*math.cos(ang),-0.2+rad*math.sin(ang),z)); key(obj,'scale',24.15,tuple(obj.scale)); key(obj,'location',26.0,(X_RAID+rad*1.2*math.cos(ang),-0.2+rad*1.2*math.sin(ang),max(0.4,z-1.0))); smooth_keys(obj,'location')
# radial glowing blast blocks grow and fade
for i in range(24):
    ang=2*math.pi*i/24; rad=RNG.uniform(0.8,2.4)
    obj=cube_obj(f'Blast voxel {i+1}',(X_RAID,-0.4,2.4),(0.5,0.5,0.5),'ember' if i%3 else 'snow',coll='Animated')
    obj.location=(X_RAID,-0.4,2.4)
    key(obj,'scale',22.0,(0.001,0.001,0.001)); key(obj,'scale',23.9,(0.001,0.001,0.001)); key(obj,'location',24.0,(X_RAID+rad*math.cos(ang),-0.4+rad*math.sin(ang),2.4+0.75*math.sin(ang*2)))
    key(obj,'scale',24.0,(0.001,0.001,0.001)); key(obj,'scale',24.25,(0.35,0.35,0.35)); key(obj,'scale',25.1,(0.001,0.001,0.001))
blast_light=add_point('Breach flash',(X_RAID,-1,2.2),0,(1.0,0.22,0.04),2.0)
for t,p in [(22,0),(23.8,0),(24.0,2200),(24.18,1800),(24.8,0),(35,0)]: key(blast_light.data,'energy',t,p)
raider=make_character('Breach scout',(X_RAID-3.4,-4,0),'shirt_cream','pants_charcoal','skin_light')
raider2=make_character('Breach partner',(X_RAID+4.0,-3.8,0),'shirt_crimson','pants_charcoal','skin_dark')
for a,v in [(22,-0.2),(23.3,-1.0),(24.0,0.35),(25.0,-0.15),(34.9,-0.15)]: key(raider['arms'][1],'rotation_euler',a,(v,0,0))
for x,y in [(X_RAID-10,-3),(X_RAID+10,-3)]: add_point('Raid torch',(x,y,4.0),300,(1.0,0.22,0.06),1.4)
add_area('Breach torch key',(X_RAID,-10,8),(X_RAID,0,2),900,(1.0,0.30,0.10),7)

# SET 04 • Torchlit PvP, clear crossed swords and small impact sparks
X_PVP=420
b=VoxelBatch('PvP arena')
b.cube((X_PVP,0,-0.3),(38,34,0.6),'stone_dark')
for ix in range(-9,10):
    for iy in range(-6,7):
        if ix*ix+iy*iy<88: b.cube((X_PVP+ix,iy,0.05),(0.95,0.95,0.1),'stone_light' if (ix+2*iy)%7==0 else 'stone')
for x in (-9,9):
    b.cube((X_PVP+x,0,0.8),(0.5,15,1.6),'wood_dark')
    for y in (-6,-3,0,3,6): b.cube((X_PVP+x,y,1.8),(0.8,0.8,0.3),'wood_light')
for x,y in [(-7,-5),(7,-5),(-7,5),(7,5)]:
    b.cube((X_PVP+x,y,2.1),(0.7,0.7,4.2),'wood')
    add_lantern(b,X_PVP+x,y,4.6)
for x,y,s in [(-12,7,0.85),(12,7,0.9),(-12,-7,0.9),(12,-7,0.85)]: add_tree(b,X_PVP+x,y,0,s,False,False)
b.build()
duel_a=make_character('Duelist lime',(X_PVP-1.8,-0.5,0),'shirt_lime','pants_blue','skin_warm')
duel_b=make_character('Duelist crimson',(X_PVP+1.8,0.16,0),'shirt_crimson','pants_charcoal','skin_dark')
duel_a['root'].rotation_euler.z=1.15; duel_b['root'].rotation_euler.z=-1.15
sword_a=make_duel_sword('Lime duelist',duel_a['arms'][1],-0.18)
sword_b=make_duel_sword('Crimson duelist',duel_b['arms'][1],0.20)
impact_a=make_clash_sword('Foreground lime sword',(X_PVP-1.35,-1.05,0.55),0.88)
impact_b=make_clash_sword('Foreground crimson sword',(X_PVP+1.35,-1.00,0.55),-0.88)
for t,v in [(35,-0.18),(36.7,-0.12),(37.35,-1.02),(38,0.65),(39.15,-0.22),(40.5,-0.95),(41.15,0.55),(42.2,-0.12),(43.8,-0.9),(44.5,0.25),(46,-0.1),(48.8,-0.18)]: key(duel_a['arms'][1],'rotation_euler',t,(v,0,0))
for t,v in [(35,0.2),(37.1,-0.75),(37.9,0.60),(39,-0.2),(40.2,-0.95),(40.95,0.62),(42.3,-0.2),(43.9,-0.8),(44.6,0.38),(46,0.1),(48.8,0.2)]: key(duel_b['arms'][1],'rotation_euler',t,(v,0,0))
smooth_keys(duel_a['arms'][1],'rotation_euler'); smooth_keys(duel_b['arms'][1],'rotation_euler')
for i,t in enumerate((37.55,40.55,44.15)):
    for j,(dx,dy,dz) in enumerate(((0,0,0),(-0.13,-0.04,0.09),(0.12,0.06,-0.08))):
        spark=cube_obj(f'Sword clash spark {i+1}.{j+1}',(X_PVP+dx,-0.82+dy,1.52+dz),(0.12,0.12,0.12),'gold_glow',coll='Animated')
        spark.rotation_euler=(0.3+0.2*j,0.5,0.4+0.35*j)
        peak=0.20 if j==0 else 0.13
        for tt,sz in ((t-0.12,0.005),(t,peak),(t+0.20,0.005)): key(spark,'scale',tt,(sz,sz,sz))
        smooth_keys(spark,'scale')
for x,y in [(X_PVP-4,-4),(X_PVP+4,-3)]: add_area('PvP torch fill',(x,y,7),(X_PVP,0,1),600,(1.0,0.38,0.13),5)

# SET 05 • Team bridge rally
X_TEAM=560
b=VoxelBatch('Timber team bridge')
b.cube((X_TEAM,0,-0.3),(42,36,0.6),'ground')
for y in range(-9,10):
    b.cube((X_TEAM,y,0.2),(7.0,1.0,0.35),'wood_light' if y%3==0 else 'wood')
for x in (-3.8,3.8):
    b.cube((X_TEAM+x,0,1.0),(0.35,20,1.6),'wood_dark')
    for y in range(-9,10,3): b.cube((X_TEAM+x,y,1.8),(0.55,0.55,0.28),'gold')
for x,y in [(-10,-4),(10,-4),(-11,7),(11,7)]: add_tree(b,X_TEAM+x,y,0,1.0,False,False)
b.build()
team_colors=[('shirt_lime','pants_blue','skin_warm'),('shirt_crimson','pants_charcoal','skin_dark'),('shirt_teal','pants_blue','skin_light'),('shirt_cream','pants_charcoal','skin_warm')]
team=[]
for i,(shirt,pants,skin) in enumerate(team_colors):
    dx=(-1.4,1.4,-0.5,0.5)[i]; y=(-4.5,-5.5,-7.0,-8.0)[i]
    ch=make_character(f'Team member {i+1}',(X_TEAM+dx,y,0),shirt,pants,skin,scale=0.9)
    team.append(ch)
    key(ch['root'],'location',49,(X_TEAM+dx,y,0)); key(ch['root'],'location',60,(X_TEAM+dx,3.0+i*0.55,0)); smooth_keys(ch['root'],'location')
    for j,lp in enumerate(ch['legs']):
        key(lp,'rotation_euler',49,(0,0,0)); key(lp,'rotation_euler',52,(0.35 if j==0 else -0.35,0,0)); key(lp,'rotation_euler',55,(-0.35 if j==0 else 0.35,0,0)); key(lp,'rotation_euler',58,(0.35 if j==0 else -0.35,0,0)); key(lp,'rotation_euler',60,(0,0,0)); smooth_keys(lp,'rotation_euler')
for x,y in [(X_TEAM-3,-4),(X_TEAM+3,-4)]: add_point('Bridge lantern',(x,y,3.2),220,(1.0,0.38,0.13),1.2)
add_area('Team dusk fill',(X_TEAM,-10,8),(X_TEAM,0,1),700,(1.0,0.48,0.23),7)

# SET 06-08 • Snow-dusted plaza, three copper figures, star installation and address gate
X_TREE=700
b=VoxelBatch('Snow plaza')
b.cube((X_TREE,0,-0.35),(52,42,0.7),'stone_dark')
# radial stepping stones
for r in range(1,10):
    b.cube((X_TREE,-r*1.6,0.06),(5.0,1.1,0.14),'stone_light' if r%3==0 else 'stone')
for x,y,s in [(-18,-6,1.1),(18,-6,1.1),(-20,7,1.2),(20,7,1.2),(-15,15,1.0),(15,15,1.0)]: add_tree(b,X_TREE+x,y,0,s,False,True)
# central voxel fir (visible from all reveal angles)
trunk_x=X_TREE
b.cube((trunk_x,0,1.45),(1.0,1.0,2.9),'bark')
for level in range(7):
    z=2.0+level*0.9
    width=(8.0-level*0.84)
    depth=max(2.2,width*0.46)
    b.cube((trunk_x,0,z),(width,depth,1.15),'leaf_pine')
    # layered front/side branch blocks create a stepped conical silhouette
    if level<6:
        for dx in (-0.7,0.7): b.cube((trunk_x+dx*width*0.48,-0.2,z-0.04),(1.1,depth*0.8,0.8),'leaf_green')
    if level in (1,3,5):
        b.cube((trunk_x,-depth*0.34,z+0.64),(width*0.72,depth*0.50,0.18),'snow')
# Four front-facing lights per tier are individual keyframed objects, so ignition is visibly bottom-up.
tree_lights=[]
for level in range(7):
    z=2.25+level*0.9; width=8-level*0.84; depth=max(2.2,width*0.46)
    for j,frac in enumerate((-0.42,-0.14,0.14,0.42)):
        tree_lights.append((trunk_x+frac*width,-depth*0.53,z,'bulb_warm' if (j+level)%2==0 else 'bulb_blue',level))
# gifts
for i,(dx,dy,mat) in enumerate([(-2.2,-1.5,'red'),(2.0,-1.3,'shirt_teal'),(-1.1,1.8,'gold'),(1.4,2.0,'leaf_rust')]): add_present(b,X_TREE+dx,dy,0.1,mat)
# scaffold to the left of the tree; statues stand on three clearly stacked tiers
scafx=X_TREE-7.5
for z in (1.25,3.9,6.55):
    b.cube((scafx,-1.0,z),(3.9,2.2,0.28),'wood_dark')
    for dx in (-1.65,1.65): b.cube((scafx+dx,-1.0,z-1.2),(0.24,0.24,2.4),'wood_light')
    b.cube((scafx,-1.0,z+0.18),(3.7,0.16,0.16),'gold')
b.build()
# Animated bulbs sit just beyond the visible front foliage; tiers light in ascending order.
for i,(x,y,z,mat,level) in enumerate(tree_lights):
    bulb=cube_obj(f'Tree light tier {level+1}.{i+1}',(x,y,z),(0.24,0.24,0.24),mat,coll='Animated')
    ignite=64.0+level*0.72
    key(bulb,'scale',60,(0.001,0.001,0.001))
    key(bulb,'scale',ignite,(0.001,0.001,0.001))
    key(bulb,'scale',ignite+0.16,(0.24,0.24,0.24))
    key(bulb,'scale',72,(0.24,0.24,0.24))
# copper figures placed vertically on scaffold platforms
copper_bottom=make_character('Copper figure • lower',(scafx,-1.0,1.43),'copper','copper','copper_light',scale=1.0,copper=True)
copper_middle=make_character('Copper figure • middle',(scafx,-1.0,4.08),'copper','copper','copper_light',scale=1.0,copper=True)
copper_upper=make_character('Copper figure • star lifter',(scafx,-1.0,6.73),'copper','copper','copper_light',scale=1.0,copper=True)
# upper figure reaches toward the star
for t,v in [(60,-0.3),(63,-1.0),(66,-0.55),(69,0.2),(72,0.0)]: key(copper_upper['arms'][1],'rotation_euler',t,(v,0,0))
snow_star=empty_obj('Star lift path',(X_TREE,-0.7,0),coll='Animated')
# extruded five-point star, front and back faces
outer=1.55; inner=0.68; pts=[]
for i in range(10):
    a=math.pi/2+i*math.pi/5; r=outer if i%2==0 else inner
    pts.append((r*math.cos(a),r*math.sin(a)))
verts=[]
for yy in (-0.22,0.22):
    for xx,zz in pts: verts.append((xx,yy,zz))
faces=[tuple(range(10)),tuple(range(19,9,-1))]
for i in range(10): faces.append((i,(i+1)%10,10+(i+1)%10,10+i))
mesh=bpy.data.meshes.new('voxel star volume mesh'); mesh.from_pydata(verts,[],faces); mesh.materials.append(MATS['gold_glow']); mesh.update()
star=bpy.data.objects.new('Tree • radiant yellow volume star',mesh); COLS['Animated'].objects.link(star); star.parent=snow_star
bev=star.modifiers.new('Soft block edges','BEVEL'); bev.width=0.08; bev.segments=1
star.modifiers.new('Weighted face normals','WEIGHTED_NORMAL')
# Star rises into place from the upper copper figure's hand.
key(snow_star,'location',60,(X_TREE-2.0,-0.7,6.6)); key(snow_star,'location',66,(X_TREE-0.8,-0.7,8.3)); key(snow_star,'location',69,(X_TREE,-0.7,9.65)); key(snow_star,'location',72,(X_TREE,-0.7,9.65)); smooth_keys(snow_star,'location')
key(star,'rotation_euler',60,(0,0,-0.12)); key(star,'rotation_euler',69,(0,0,0)); key(star,'rotation_euler',72,(0,0,0)); smooth_keys(star,'rotation_euler')
# plaza lanterns / framing and final address gate
for x,y in [(X_TREE-12,-7),(X_TREE+12,-7),(X_TREE-15,6),(X_TREE+15,6)]:
    b2=VoxelBatch('Plaza lantern')
    b2.cube((x,y,1.3),(0.65,0.65,2.6),'wood_dark'); b2.cube((x,y,2.7),(0.9,0.9,0.22),'gold'); b2.build()
    add_point('Plaza practical',(x,y,3.0),280,(1.0,0.44,0.13),1.3)
# End gate is offset to the right so the tree never occludes the server address.
ADDR_X=X_TREE+15.0; ADDR_Y=4.0
for x in (ADDR_X-8,ADDR_X+8): cube_obj('Address gate post',(x,ADDR_Y,4.2),(0.7,1.0,8.4),'wood_dark',coll='World')
cube_obj('Address gate header',(ADDR_X,ADDR_Y,8.4),(17.0,1.2,0.85),'wood',coll='World')
cube_obj('Address sign board',(ADDR_X,ADDR_Y-0.65,5.6),(13.0,0.25,2.8),'wood_dark',coll='World')
text_obj('Address sign title','KINGGRIEF',(ADDR_X,ADDR_Y-0.82,6.15),0.78,'text')
text_obj('Address sign domain','kinggrief.pickme.cloud',(ADDR_X,ADDR_Y-0.84,5.12),0.57,'snow',extrude=0.01)
add_area('Plaza amber key',(X_TREE,-10,14),(X_TREE,0,4),1500,(1.0,0.55,0.30),12)
add_area('Plaza blue rim',(X_TREE+12,8,10),(X_TREE,0,4),900,(0.16,0.40,1.0),10)

# Cameras and editorial cuts
cam_specs=[
 ('CAM 01 • valley fly-in',0,8,(-2,-26,18),(0,-1,5.0),(0,-15,8.2),(0,-1,5.0),30),
 ('CAM 02 • workshop treasure',8,22,(X_WORK-8,-14,7.6),(X_WORK+1,-2.5,2.4),(X_WORK-2,-10,5.5),(X_WORK+1.5,-2.8,2.3),36),
 ('CAM 03 • TNT breach',22,35,(X_RAID-7,-15,7.5),(X_RAID,-0.5,2.2),(X_RAID-1.8,-9,4.0),(X_RAID,-0.5,2.3),36),
 ('CAM 04 • duel wide',35,41,(X_PVP-0.7,-10.4,4.5),(X_PVP,-0.15,1.35),(X_PVP+0.7,-9.1,4.0),(X_PVP,-0.15,1.35),42),
 ('CAM 05 • sword clash close',41,49,(X_PVP-0.35,-8.0,3.45),(X_PVP,-0.15,1.35),(X_PVP+0.45,-7.2,3.15),(X_PVP,-0.15,1.35),55),
 ('CAM 06 • team bridge',49,60,(X_TEAM-7,-14,6.4),(X_TEAM,0,1.6),(X_TEAM-1.0,-10.4,4.0),(X_TEAM,-1,1.5),36),
 ('CAM 07 • star installation',60,72,(X_TREE-3.5,-18,10.3),(X_TREE-4.0,-0.5,5.4),(X_TREE+0.4,-15.0,9.0),(X_TREE-2.0,-0.5,6.5),40),
 ('CAM 08 • plaza reveal',72,87,(X_TREE+12,-26,15),(X_TREE+5,0,5.2),(X_TREE+2,-21,10.5),(X_TREE+5,1,4.8),24),
 ('CAM 09 • server address',87,100,(X_TREE+8,-14,6.8),(ADDR_X,ADDR_Y-0.65,5.45),(X_TREE+9,-12,6.3),(ADDR_X,ADDR_Y-0.65,5.45),40),
]
cameras=[]
for spec in cam_specs: cameras.append(create_camera(*spec))
scene.camera=cameras[0]
for sec,label in [(0,'01 • Autumn valley'),(8,'02 • Workshop / relics'),(22,'03 • TNT breach'),(35,'04 • PvP wide'),(41,'05 • Sword clash'),(49,'06 • Team formation'),(60,'07 • Star installation'),(72,'08 • Plaza reveal'),(87,'09 • Server address')]: scene.timeline_markers.new(label,frame=sec_frame(sec))

# Packed original score/SFX mix in the VSE for source-project playback.
audio=ASSETS/'KingGrief_Audio_Master.mp3'
if audio.exists():
    try:
        editor=scene.sequence_editor_create()
        strip=editor.strips.new_sound('KingGrief • original score and sound design',str(audio),channel=1,frame_start=1)
        strip.volume=1.0
        strip.sound.pack()
    except Exception as exc: print('VSE audio pack warning:',exc)
try: bpy.ops.file.pack_all()
except Exception as exc: print('Pack warning:',exc)

bpy.context.scene.frame_set(1)
bpy.ops.wm.save_as_mainfile(filepath=str(BLEND))
print('BLENDER_PROJECT_SAVED',BLEND)
print('OBJECTS',len(bpy.data.objects),'MATERIALS',len(bpy.data.materials),'CAMERAS',len(cameras),'FRAMES',scene.frame_end)
