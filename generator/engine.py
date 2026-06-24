# -*- coding: utf-8 -*-
"""Движок карты истории христианства: грузит data/*.yaml и строит SVG + раскладку.
Экспортирует svg_core/svg_full и данные (N, BOX, EVENTS, …) для build.py. Файлов сам не пишет."""
from PIL import ImageFont
import html, json, os
BASE=os.path.dirname(os.path.abspath(__file__))
def _findfont(names):
    for d in ["/usr/share/fonts/truetype/dejavu","/Library/Fonts","/System/Library/Fonts/Supplemental","/usr/share/fonts"]:
        for n in names:
            p=os.path.join(d,n)
            if os.path.exists(p): return p
    return None
F=_findfont(["DejaVuSans.ttf","Arial.ttf","Arial Unicode.ttf"]) or "DejaVuSans.ttf"
FB=_findfont(["DejaVuSans-Bold.ttf","Arial Bold.ttf","Arial.ttf"]) or F
FF="DejaVu Sans, Arial, sans-serif"
CREAM="#F7F1E3"; INK="#2B2420"; MUTED="#6B5D52"; GRID="#E2D8C4"
AXIS="#967814"; WHITE="#FFFFFF"; EDGE="#8C7C6A"; LBLBG="#FCF8EE"; LBLBD="#D6C9B2"; GOLD="#C8A24B"

# ====== КОНТЕНТ ИЗ data/*.yaml (карточки, события, источники) ======
import yaml, glob
_D=os.path.join(BASE,"data")
def _ly(p): return yaml.safe_load(open(p,encoding="utf-8")) or {}
_cfg=_ly(os.path.join(_D,"config.yaml"))
COL=_cfg["colors"]; WIDE={k:tuple(v) for k,v in _cfg.get("wide",{}).items()}
LIVE=set(_cfg.get("live",[])); PERIODS=[tuple(p) for p in _cfg.get("periods",[])]
KEY=set(_cfg.get("key",[]))
_geo=_cfg["geometry"]; COLX0=_geo["COLX0"]; CW=_geo["CW"]; TOP=_geo["TOP"]; PXY=_geo["PXY"]; MINGAP=_geo["MINGAP"]; NCOLS=_geo["NCOLS"]; RKC_YEAR=_geo["RKC_YEAR"]
BIB=_ly(os.path.join(_D,"sources.yaml"))
N={}; INFO={}; SRC={}; E=[]; EDGE_INFO={}; SITE={}; WHY={}
for _f in sorted(glob.glob(os.path.join(_D,"branches","*.yaml"))):
    for c in _ly(_f):
        nid=c["id"]; N[nid]=(c["column"],c["year"],c["branch"],c["title"],c.get("sub",""))
        if c.get("info"): INFO[nid]=c["info"]
        if c.get("sources"): SRC[nid]=c["sources"]
        if c.get("site"): SITE[nid]=c["site"]
        if c.get("datenote"): WHY[nid]=c["datenote"]
        for e in c.get("edges",[]):
            E.append((nid,e["to"],e.get("type","solid"),e.get("label","")))
            if e.get("info"): EDGE_INFO[(nid,e["to"])]=e["info"]
EVENTS={}; EVENT_INFO={}; EVENT_SRC={}
for _y,_d in _ly(os.path.join(_D,"events.yaml")).items():
    _y=int(_y); EVENTS[_y]=_d["name"]
    if _d.get("info"): EVENT_INFO[_y]=_d["info"]
    if _d.get("key"): KEY.add(_y)
    EVENT_SRC[_y]=_d.get("sources",[])
# ====== СТРУКТУРА (из config.yaml) ======
GROUPS=[tuple(g) for g in _cfg.get("groups",[])]
SUBGROUPS=[tuple(s) for s in _cfg.get("subgroups",[])]
BAND_CHILD=[tuple(b) for b in _cfg.get("band_children",[])]
BAND_INFO=_cfg.get("band_info",{})
HUS_BAND=_cfg.get("hus_band","")
GROUP_INFO=_cfg.get("group_info",{}); GROUP_SRC=_cfg.get("group_src",{}); STAGES=_cfg.get("stages",{})

years=sorted(set([y for(_,y,_,_,_) in N.values()]+list(EVENTS)+[1517,RKC_YEAR]))
ROW={y:i for i,y in enumerate(years)}
EVX0,EVX1=26,376; YRX=450; AXISX=474          # координаты печатной оси (внутреннее)
RS=76; W=COLX0+NCOLS*CW+30                     # COLX0,CW,TOP,NCOLS,PXY,MINGAP,RKC_YEAR — из config.yaml
# ось времени: ПРОПОРЦИОНАЛЬНАЯ, но с минимальным зазором между соседними годами,
# чтобы плотные эпохи (Реформация) не наезжали, а разрежённые (Средневековье) шли по времени.
_Y0=years[0]; _ypos={}; _prev=None
for _y in years:
    _py=TOP+(_y-_Y0)*PXY
    if _prev is not None and _py<_prev+MINGAP: _py=_prev+MINGAP
    _ypos[_y]=_py; _prev=_py
def yof(y): return _ypos[y]
H=int(_ypos[years[-1]]+90)
BANDY=yof(1517); RKCY=yof(RKC_YEAR)
def colx(c): return COLX0+c*CW+CW//2
BANDX0=COLX0-6; BANDX1=W-20
_fc={}
def fnt(sz,b=False):
    k=(sz,b)
    if k not in _fc:
        try: _fc[k]=ImageFont.truetype(FB if b else F,sz)
        except Exception: _fc[k]=ImageFont.load_default()
    return _fc[k]
def textlen(s,sz,b=False): return fnt(sz,b).getlength(s)
def wrap(text,sz,b,maxw):
    out=[]
    for part in text.split("\n"):
        cur=""
        for w in part.split():
            t=(cur+" "+w).strip()
            if textlen(t,sz,b)<=maxw:cur=t
            else:
                if cur:out.append(cur)
                cur=w
        if cur:out.append(cur)
    return out
def esc(s): return html.escape(str(s),quote=True)

LINES=[];HIT=[];LABELS=[];BOXES=[];EDGES_JS=[]
def lineto(x1,y1,x2,y2,dash=None):
    a=f'<line x1="{x1:.1f}" y1="{y1:.1f}" x2="{x2:.1f}" y2="{y2:.1f}" stroke="{EDGE}" stroke-width="1.7"'
    if dash:a+=' stroke-dasharray="7,5"'
    LINES.append(a+'/>')
def arrow(x,y): LINES.append(f'<polygon points="{x:.1f},{y:.1f} {x-5.5:.1f},{y-8.5:.1f} {x+5.5:.1f},{y-8.5:.1f}" fill="{EDGE}"/>')
def tspans(buf,cx,cy_mid,lines,sz,fill,b=False,anchor="middle"):
    if not lines:return
    lh=sz*1.22;total=lh*len(lines);y0=cy_mid-total/2+sz*0.80
    fw='bold' if b else 'normal'
    for i,ln in enumerate(lines):
        buf.append(f'<text x="{cx:.1f}" y="{y0+i*lh:.1f}" font-family="{FF}" font-size="{sz}" font-weight="{fw}" fill="{fill}" text-anchor="{anchor}">{esc(ln)}</text>')
def label(cx,cy,text):
    if not text:return
    lines=wrap(text,10,False,150);lh=10*1.18
    tw=max(textlen(l,10) for l in lines);th=lh*len(lines);pad=4
    LABELS.append(f'<rect x="{cx-tw/2-pad:.1f}" y="{cy-th/2-pad:.1f}" width="{tw+2*pad:.1f}" height="{th+2*pad:.1f}" rx="4" fill="{LBLBG}" stroke="{LBLBD}" stroke-width="1"/>')
    tspans(LABELS,cx,cy,lines,10,"#5A482E")
def hitline(pts,info,title,eid=None,src=""):
    # широкая НЕскалируемая зона клика (одинаково удобно при любом зуме); подсветка — через CSS
    p=" ".join(f"{x:.1f},{y:.1f}" for x,y in pts)
    idr=f' id="{eid}"' if eid else ""
    HIT.append(f'<polyline points="{p}" fill="none" stroke="#000" stroke-opacity="0" stroke-width="26" vector-effect="non-scaling-stroke" class="it edge"{idr} data-t="{esc(title)}" data-i="{esc(info)}" data-c="#7a5a1e" data-src="{esc(src)}"/>')

BOX={}
_FULLX0=colx(-6)-CW/2+8
# узлы-категории, растянутые на колонки своих под-ветвей (col_left, col_right)
# WIDE (категории-«зонтики») загружено из config.yaml в начале файла
for nid,(c,y,ck,title,sub) in N.items():
    cx=colx(c);cy=yof(y);bw=CW-18
    if nid=="apost":                       # Апостольская Церковь — широкая плашка
        BOX[nid]=(_FULLX0,cy-26,BANDX1,cy+26);continue
    if nid in WIDE:                        # категория накрывает свои под-ветви
        cl,cr=WIDE[nid];x0=colx(cl)-CW/2+6;x1=colx(cr)+CW/2-6
        tl=wrap(title,12,True,(x1-x0)-16);sl=wrap(sub,10,False,(x1-x0)-16) if sub else []
        h=10+len(tl)*12*1.18+(5+len(sl)*10*1.18 if sl else 0)+10
        BOX[nid]=(x0,cy-h/2,x1,cy+h/2);continue
    tl=wrap(title,12,True,bw-16);sl=wrap(sub,10,False,bw-16) if sub else []
    h=10+len(tl)*12*1.18+(5+len(sl)*10*1.18 if sl else 0)+10
    BOX[nid]=(cx-bw/2,cy-h/2,cx+bw/2,cy+h/2)

def conn(a,b,kind,lab):
    x0,y0,x1,y1=BOX[a];xb0,yb0,xb1,yb1=BOX[b]
    pcx=(x0+x1)/2;pby=y1;ccx=(xb0+xb1)/2;cty=yb0;dd=(kind=="dash")
    seg=[]
    def L(ax,ay,bx,by):
        s=f'<line x1="{ax:.1f}" y1="{ay:.1f}" x2="{bx:.1f}" y2="{by:.1f}" stroke="{EDGE}" stroke-width="1.7"'
        if dd:s+=' stroke-dasharray="7,5"'
        seg.append(s+'/>')
    if abs(pcx-ccx)<2:
        L(pcx,pby,ccx,cty);pts=[(pcx,pby),(ccx,cty)]
    else:
        midy=(pby+cty)/2
        L(pcx,pby,pcx,midy);L(pcx,midy,ccx,midy);L(ccx,midy,ccx,cty)
        pts=[(pcx,pby),(pcx,midy),(ccx,midy),(ccx,cty)]
    seg.append(f'<polygon points="{ccx:.1f},{cty:.1f} {ccx-5.5:.1f},{cty-8.5:.1f} {ccx+5.5:.1f},{cty-8.5:.1f}" fill="{EDGE}"/>')
    LINES.append(f'<g class="cline" data-f="{a}" data-tt="{b}">'+"".join(seg)+'</g>')   # помечена концами — для скрытия по семейству
    ta=N[a][3].replace("\n"," ");tb=N[b][3].replace("\n"," ")
    info=EDGE_INFO.get((a,b)) or ((lab+". ") if lab else "")+f"Связь: {ta} → {tb}."
    eidx=len(EDGES_JS);EDGES_JS.append([a,b,kind,lab]);hitline(pts,info,f"{ta} → {tb}",f"edge{eidx}",",".join(SRC.get(b,[])))
for a,b,kind,lab in E: conn(a,b,kind,lab)
for i,(ch,lab) in enumerate(BAND_CHILD):
    xb0,yb0,xb1,yb1=BOX[ch];ccx=(xb0+xb1)/2
    LINES.append(f'<g class="cline" data-tt="{ch}"><line x1="{ccx:.1f}" y1="{BANDY+24:.1f}" x2="{ccx:.1f}" y2="{yb0:.1f}" stroke="{EDGE}" stroke-width="1.7"/><polygon points="{ccx:.1f},{yb0:.1f} {ccx-5.5:.1f},{yb0-8.5:.1f} {ccx+5.5:.1f},{yb0-8.5:.1f}" fill="{EDGE}"/></g>')
    info=BAND_INFO.get(ch) or (("РЕФОРМАЦИЯ → "+N[ch][3].replace(chr(10)," ")+". ")+(lab+"." if lab else ""))
    hitline([(ccx,BANDY+24),(ccx,yb0)],info,"Реформация → "+N[ch][3].replace(chr(10)," "),f"edgeb{i}",",".join(SRC.get(ch,[])))
gx0,gy0,gx1,gy1=BOX["hus"];gcx=(gx0+gx1)/2
lineto(gcx,gy1,gcx,BANDY-24,True)
hitline([(gcx,gy1),(gcx,BANDY-24)],"Ян Гус и гуситы — предтечи Реформации; их идеи прямо повлияли на Лютера, который признавал: «мы все гуситы».","Гус → Реформация","edgehus","schaff6,needham3,sannikov")
bcx=(BANDX0+BANDX1)/2
lineto(bcx,RKCY+24,bcx,BANDY-24);arrow(bcx,BANDY-24)
hitline([(bcx,RKCY+24),(bcx,BANDY-24)],"Реформация выросла из позднесредневековой Западной (Римско-католической) церкви как протест против её злоупотреблений.","Западная церковь → Реформация","edgerkc","needham3,macculloch,sannikov")
wx0,wy0,wx1,wy1=BOX["wyc"];wcx=(wx0+wx1)/2
lineto(wcx,RKCY+24,wcx,wy0,True);arrow(wcx,wy0)
hitline([(wcx,RKCY+24),(wcx,wy0)],"Критика изнутри: Джон Уиклиф — «утренняя звезда Реформации» (критика папства, перевод Библии на английский).","Западная церковь → Уиклиф","edgewyc","schaff6,needham3")
ix0,iy0,ix1,iy1=BOX["iez"];icx=(ix0+ix1)/2
lineto(icx,RKCY+24,icx,iy0,True);arrow(icx,iy0)
hitline([(icx,RKCY+24),(icx,iy0)],"Реформа себя: Контрреформация — внутреннее обновление Римско-католической церкви (иезуиты, Тридентский собор).","Западная церковь → Контрреформация","edgeiez","macculloch,needham3")
# крест → Апостольская церковь (вертикаль к кресту над бантом)
_ap=BOX["apost"];_acx=(_ap[0]+_ap[2])/2
lineto(_acx,_ap[1]-58,_acx,_ap[1],False)
# западная линия: Имперская церковь → Западная церковь
_im=BOX["imperial"];_wx=colx(0)
lineto(_wx,_im[3],_wx,RKCY-24,False);arrow(_wx,RKCY-24)
hitline([(_wx,_im[3]),(_wx,RKCY-24)],"Западная (латинская) церковь — продолжение древней Церкви на Западе; позднее Римско-католическая.","Древняя → Западная церковь","edgewest","needham3,sannikov")
# восточная линия: Имперская церковь → Восточная (православная) церковь
_ex=colx(-2)
lineto(_wx,_im[3]+16,_ex,_im[3]+16,False);lineto(_ex,_im[3]+16,_ex,RKCY-24,False);arrow(_ex,RKCY-24)
hitline([(_wx,_im[3]+16),(_ex,_im[3]+16),(_ex,RKCY-24)],"Восточная (православная) церковь — продолжение древней Церкви на греческом Востоке.","Древняя → Восточная церковь","edgeeast","sannikov,needham3")
# восточная церковь → Византийская церковь (греческий ствол, от него Русь и греческое православие)
if "byz" in BOX: lineto(_ex,RKCY+24,_ex,BOX["byz"][1],False);arrow(_ex,BOX["byz"][1])
# западная церковь → средневековое папство (от него ордена, схоластика, предшественники)
if "rcc" in BOX: lineto(colx(1),RKCY+24,colx(1),BOX["rcc"][1],False);arrow(colx(1),BOX["rcc"][1])
# Великий раскол 1054 (Восток ↔ Запад) — пунктир
_rx=colx(-1);_sy=yof(1054)
lineto(_rx,_sy,_wx,_sy,True)
hitline([(_rx,_sy),(_wx,_sy)],"Великий раскол 1054 года окончательно разделил христианский Восток (православие) и латинский Запад (католичество).","Великий раскол · 1054","edgeschism1054","sannikov,needham3,macculloch")
# «живые» ветви тянутся к низу (до наших дней)
_BOT=H-46
for _id in LIVE:
    if _id in BOX:
        _b=BOX[_id];_bcx=(_b[0]+_b[2])/2
        if _b[3]<_BOT-40:
            LINES.append(f'<line x1="{_bcx:.1f}" y1="{_b[3]:.1f}" x2="{_bcx:.1f}" y2="{_BOT:.1f}" stroke="{EDGE}" stroke-width="1.6" stroke-dasharray="2,7" stroke-opacity="0.65"/>')
            LINES.append(f'<circle cx="{_bcx:.1f}" cy="{_BOT:.1f}" r="3.5" fill="{EDGE}"/>')

# боксы (интерактивные группы)
for nid,(c,y,ck,title,sub) in N.items():
    x0,y0,x1,y1=BOX[nid];col=COL[ck];cx=(x0+x1)/2
    info=INFO.get(nid,"")
    if nid=="apost":                       # широкая плашка «АПОСТОЛЬСКАЯ ЦЕРКОВЬ»
        BOXES.append(f'<g class="it node" data-id="apost" data-t="{esc(title)}" data-i="{esc(info)}" data-c="{COL["anc"]}" data-src="{",".join(SRC.get("apost",[]))}" data-year="{y}" data-why="{esc(WHY.get("apost",""))}">')
        BOXES.append(f'<rect x="{x0:.1f}" y="{y0:.1f}" width="{x1-x0:.1f}" height="{y1-y0:.1f}" rx="9" fill="{COL["anc"]}"/>')
        tspans(BOXES,cx,(y0+y1)/2,["АПОСТОЛЬСКАЯ ЦЕРКОВЬ"],18,WHITE,b=True)
        BOXES.append('</g>');continue
    BOXES.append(f'<g class="it node" data-id="{nid}" data-t="{esc(title.replace(chr(10)," "))}" data-i="{esc(info)}" data-c="{col}" data-src="{",".join(SRC.get(nid,[]))}" data-site="{esc(SITE.get(nid,""))}" data-year="{y}" data-why="{esc(WHY.get(nid,""))}">')
    if nid=="mun":
        BOXES.append(f'<rect x="{x0:.1f}" y="{y0:.1f}" width="{x1-x0:.1f}" height="{y1-y0:.1f}" rx="9" fill="{col}" stroke="#D8C8E0" stroke-width="1.4" stroke-dasharray="6,4"/>')
    else:
        BOXES.append(f'<rect x="{x0:.1f}" y="{y0:.1f}" width="{x1-x0:.1f}" height="{y1-y0:.1f}" rx="9" fill="{col}"/>')
    tl=wrap(title,12,True,(x1-x0)-16);sl=wrap(sub,10,False,(x1-x0)-16) if sub else []
    lh1=12*1.18;lh2=10*1.18;tot=lh1*len(tl)+(5+lh2*len(sl) if sl else 0);y0t=(y0+y1)/2-tot/2+12*0.80
    for i,ln in enumerate(tl):
        BOXES.append(f'<text x="{cx:.1f}" y="{y0t+i*lh1:.1f}" font-family="{FF}" font-size="12" font-weight="bold" fill="{WHITE}" text-anchor="middle">{esc(ln)}</text>')
    if sl:
        ys=y0t+lh1*len(tl)+5
        for i,ln in enumerate(sl):
            BOXES.append(f'<text x="{cx:.1f}" y="{ys+i*lh2:.1f}" font-family="{FF}" font-size="10" fill="#F0E4D6" text-anchor="middle">{esc(ln)}</text>')
    BOXES.append('</g>')

year_nodes={}
for nid,(c,y,ck,title,sub) in N.items(): year_nodes.setdefault(y,[]).append(title.replace("\n"," "))

GX0=COLX0-16
# ——— полосы ключевых дат (на полотне, под боксами) ———
KEYB=[]
for y in years:
    if y in KEY:
        yy=yof(y)
        KEYB.append(f'<rect x="{GX0}" y="{yy-RS*0.42:.1f}" width="{W-20-GX0}" height="{RS*0.84:.1f}" fill="{GOLD}" fill-opacity="0.16"/>')
        KEYB.append(f'<rect x="{GX0}" y="{yy-RS*0.42:.1f}" width="6" height="{RS*0.84:.1f}" fill="{GOLD}"/>')
# ——— сетка: горизонтали по датам + вертикали-разделители ветвей ———
# Только для ПЕЧАТНОЙ версии. В приложении эти линии рисует движок в ЭКРАННЫХ координатах,
# поэтому они идут прямо от таймлайна (слева) и от шапки (сверху) и двигаются вместе с экраном.
GRIDP=[]
for y in years:
    yy=yof(y);GRIDP.append(f'<line x1="{GX0}" y1="{yy}" x2="{W-20}" y2="{yy}" stroke="{GRID}" stroke-width="1"/>')
for gi in range(len(GROUPS)-1):
    xb=(colx(GROUPS[gi][3])+CW/2 + colx(GROUPS[gi+1][2])-CW/2)/2
    GRIDP.append(f'<line x1="{xb:.1f}" y1="{TOP-20}" x2="{xb:.1f}" y2="{H-40}" stroke="{GRID}" stroke-width="1"/>')
# ——— схема ———
DIAG=[]
# большие линии-«банты»: Западная и Восточная церковь (наравне)
DIAG.append(f'<rect x="{BANDX0}" y="{RKCY-24}" width="{BANDX1-BANDX0}" height="48" rx="8" fill="{COL["root"]}"/>')
tspans(DIAG,(BANDX0+BANDX1)/2,RKCY,["Западная Церковь"],18,WHITE,b=True)
_EX0=colx(-6)-CW/2+8;_EX1=colx(-1)+CW/2-8
DIAG.append(f'<rect x="{_EX0:.1f}" y="{RKCY-24}" width="{_EX1-_EX0:.1f}" height="48" rx="8" fill="{COL["eorth"]}"/>')
tspans(DIAG,(_EX0+_EX1)/2,RKCY,["Восточная (Православная) Церковь"],15,WHITE,b=True)
DIAG.append(f'<rect x="{BANDX0}" y="{BANDY-24}" width="{BANDX1-BANDX0}" height="48" rx="8" fill="{COL["lut"]}"/>')
tspans(DIAG,(BANDX0+BANDX1)/2,BANDY,["РЕФОРМАЦИЯ · 1517"],19,WHITE,b=True)
# Крест — Христос (основание всех церквей)
_apx=BOX["apost"];_cxx=(_apx[0]+_apx[2])/2;_cyy=_apx[1]-58
DIAG.append('<g class="it" data-t="Иисус Христос" data-i="Иисус Христос — основание Церкви; от Него, через апостолов в день Пятидесятницы (~33 г.), берут начало все церкви и течения христианства." data-c="#6E1423" data-src="">')
DIAG.append(f'<rect x="{_cxx-5:.1f}" y="{_cyy-18:.1f}" width="10" height="46" rx="2" fill="#6E1423"/>')
DIAG.append(f'<rect x="{_cxx-15:.1f}" y="{_cyy-4:.1f}" width="30" height="10" rx="2" fill="#6E1423"/>')
DIAG.append('</g>')
DIAG+=LINES
DIAG+=HIT
DIAG+=BOXES
DIAG+=LABELS
tspans(DIAG,W/2,66,["История христианства · генеалогия церквей и течений (I–XXI вв.)"],26,COL["lut"],b=True)
tspans(DIAG,W/2,106,["клик — карточка · наведение на блок — увеличение · колесо — зум · перетаскивание — двигать · золотые полосы (◆) — ключевые даты"],13,MUTED)
CORE=DIAG   # приложение: без фона, без сетки и без ключевых полос (их даёт страница и движок)

# ——— CHROME: встроенная ось времени + шапки (для статичной/печатной версии) ———
CHROME=[]
CHROME.append(f'<line x1="{AXISX}" y1="{TOP-40}" x2="{AXISX}" y2="{H-50}" stroke="{AXIS}" stroke-width="2.6"/>')
for y in years:
    yy=yof(y)
    if y in KEY:
        r=8.5
        CHROME.append(f'<rect x="{AXISX-r:.1f}" y="{yy-r:.1f}" width="{2*r:.1f}" height="{2*r:.1f}" fill="{GOLD}" stroke="#8a6a16" stroke-width="1.2" transform="rotate(45 {AXISX} {yy})"/>')
        tspans(CHROME,YRX,yy,[str(y)],18,"#8a6a16",b=True,anchor="end")
        if y in EVENTS: tspans(CHROME,EVX1,yy,wrap(EVENTS[y],12,True,EVX1-EVX0),12,"#5A3C14",b=True,anchor="end")
    else:
        CHROME.append(f'<circle cx="{AXISX}" cy="{yy}" r="4.5" fill="{AXIS}"/>')
        tspans(CHROME,YRX,yy,[("до 1517" if y==RKC_YEAR else str(y))],14,"#5A3C14",b=True,anchor="end")
        if y in EVENTS: tspans(CHROME,EVX1,yy,wrap(EVENTS[y],11,False,EVX1-EVX0),11,INK,anchor="end")
for title,ck,c0,c1 in GROUPS:
    xl=colx(c0)-CW/2+8;xr=colx(c1)+CW/2-8
    CHROME.append(f'<rect x="{xl:.1f}" y="296" width="{xr-xl:.1f}" height="38" rx="8" fill="{COL[ck]}"/>')
    tspans(CHROME,(xl+xr)/2,315,wrap(title,12,True,(xr-xl)-12),12,WHITE,b=True)
for title,ck,c0,c1 in SUBGROUPS:
    xl=colx(c0)-CW/2+10;xr=colx(c1)+CW/2-10
    CHROME.append(f'<rect x="{xl:.1f}" y="338" width="{xr-xl:.1f}" height="22" rx="5" fill="{CREAM}" stroke="{COL[ck]}" stroke-width="1"/>')
    tspans(CHROME,(xl+xr)/2,349,[title],10,COL[ck],b=True)

BG=[f'<rect x="0" y="0" width="{W}" height="{H}" fill="{CREAM}"/>']
svg_core="\n".join(CORE)
svg_full="\n".join(BG+GRIDP+KEYB+CORE+CHROME)
print("engine ok:",W,H,"узлов",len(N),"связей",len(HIT))
