# -*- coding: utf-8 -*-
"""Сборка data.js из данных в data/*.yaml.
Контент правят в data/branches/*.yaml, data/events.yaml, data/sources.yaml, data/config.yaml;
рендер — в engine.py. Этот скрипт: engine → ../data.js (рядом с index.html) + generator/reformation.svg.
Запуск: python3 build.py"""
import importlib.util, json, os

HERE=os.path.dirname(os.path.abspath(__file__))
ROOT=os.path.dirname(HERE)   # корень репозитория (рядом index.html)
spec=importlib.util.spec_from_file_location("eng",os.path.join(HERE,"engine.py"))
eng=importlib.util.module_from_spec(spec); spec.loader.exec_module(eng)

N,BOX,COL=eng.N,eng.BOX,eng.COL
W,H=eng.W,eng.H
colx,yof,CW,COLX0=eng.colx,eng.yof,eng.CW,eng.COLX0
years,KEY,EVENTS,RKC_YEAR=eng.years,eng.KEY,eng.EVENTS,eng.RKC_YEAR
GROUPS=eng.GROUPS

GROUP_INFO=eng.GROUP_INFO   # из data/config.yaml

nodes=[]
for nid,(c,y,ck,title,sub) in N.items():
    x0,y0,x1,y1=BOX[nid]
    nodes.append({"id":nid,"x":round(x0,1),"y":round(y0,1),"w":round(x1-x0,1),"h":round(y1-y0,1),
                  "color":COL[ck],"group":ck,"title":title,"sub":sub or ""})

EVENT_INFO=eng.EVENT_INFO
events=[]
for y in years:
    short=EVENTS.get(y,"")
    info=EVENT_INFO.get(y, short or f"{y} год.")
    events.append({"year":str(y),"yy":round(yof(y),1),"key":(y in KEY),
                   "text":short,"info":info,"src":eng.EVENT_SRC.get(y,["sannikov","needham3"])})

GROUP_SRC=eng.GROUP_SRC   # из data/config.yaml
groups=[]
for title,ck,c0,c1 in GROUPS:
    groups.append({"title":title,"key":ck,"color":COL[ck],"info":GROUP_INFO.get(ck,""),"src":GROUP_SRC.get(ck,[]),
                   "x0":round(colx(c0)-CW/2+8,1),"x1":round(colx(c1)+CW/2-8,1)})

groups.sort(key=lambda g:g["x0"])   # для корректных вертикальных разделителей
xs0=min(n["x"] for n in nodes); xs1=max(n["x"]+n["w"] for n in nodes); ys1=max(n["y"]+n["h"] for n in nodes)
# эпохи (динамический фон): диапазоны по строкам, попадающим в период
periods=[]
for i,(lab,a,b) in enumerate(getattr(eng,"PERIODS",[])):
    rws=[yof(y) for y in years if a<=y<b]
    if rws: periods.append({"label":lab,"yy0":round(min(rws)-eng.RS*0.55,1),"yy1":round(max(rws)+eng.RS*0.55,1),"alt":i%2})
# заголовки, меняющиеся по этапам — из data/config.yaml (stages.headers)
def _hx(c0,c1): return (round(colx(c0)-CW/2+8,1), round(colx(c1)+CW/2-8,1))
STAGES=eng.STAGES
headers=[]
for _st,_segs in enumerate(STAGES.get("headers",[])):
    for lab,ck,c0,c1 in _segs:
        x0,x1=_hx(c0,c1); headers.append({"label":lab,"key":ck,"color":COL[ck],"stage":_st,"x0":x0,"x1":x1})
DATA={"W":W,"H":H,"bandY":round(yof(33),1),"rs":eng.RS,
      "cx0":round(xs0-34),"cx1":round(xs1+34),"cy0":40,"cy1":round(ys1+40),
      "svg":eng.svg_core,"nodes":nodes,"events":events,"groups":groups,"edges":eng.EDGES_JS,
      "bib":eng.BIB,"periods":periods,"headers":headers,
      "stageBounds":[round(yof(y),1) for y in STAGES.get("bounds_years",[1054,1517])],
      "stageNames":STAGES.get("names",[])}

with open(os.path.join(ROOT,"data.js"),"w",encoding="utf-8") as f:   # пишем в корень репо, рядом с index.html
    f.write("window.DATA="+json.dumps(DATA,ensure_ascii=False)+";\n")

with open(os.path.join(HERE,"reformation.svg"),"w",encoding="utf-8") as f:   # статичная версия для печати/PDF
    f.write(f'<svg xmlns="http://www.w3.org/2000/svg" width="{W}" height="{H}" viewBox="0 0 {W} {H}">\n'+eng.svg_full+"\n</svg>\n")

print("OK. узлов:",len(nodes),"связей:",len(eng.EDGES_JS),"дат:",len(events),"| content:",DATA["cx0"],"..",DATA["cx1"])
