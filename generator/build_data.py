# -*- coding: utf-8 -*-
"""Сборка data.js для интерактивной инфографики Реформации.
Единый источник данных — timeline5.py (узлы N, связи E, тексты INFO, события EVENTS, геометрия).
Чтобы добавить/изменить течение: правьте N / E / INFO / EVENTS в timeline5.py и запустите этот скрипт.
Выход: refapp/data.js (window.DATA) + refapp/reformation.svg (полная версия для печати/PDF)."""
import importlib.util, json, os

HERE=os.path.dirname(os.path.abspath(__file__))
ROOT=os.path.dirname(HERE)   # корень репозитория (рядом index.html)
spec=importlib.util.spec_from_file_location("t5",os.path.join(HERE,"timeline5.py"))
t5=importlib.util.module_from_spec(spec); spec.loader.exec_module(t5)

N,BOX,COL=t5.N,t5.BOX,t5.COL
W,H=t5.W,t5.H
colx,yof,CW,COLX0=t5.colx,t5.yof,t5.CW,t5.COLX0
years,KEY,EVENTS,RKC_YEAR=t5.years,t5.KEY,t5.EVENTS,t5.RKC_YEAR
GROUPS=t5.GROUPS

GROUP_INFO={
 "pre":"Предшественники Реформации и христианские гуманисты, подготовившие почву: критика папства, возврат к Писанию, перевод Библии на родные языки.",
 "lut":"Лютеранство — старейшая ветвь Реформации (Лютер, Меланхтон): оправдание только верой, Аугсбургское исповедание; церкви Германии и Скандинавии.",
 "ref":"Реформатство (кальвинизм) — традиция Цвингли и Кальвина: суверенитет Бога, пресвитерианское устройство. Сюда входят гугеноты, шотландские пресвитериане, нидерландская реформатская церковь.",
 "rad":"Радикальная Реформация — отвергавшие союз церкви с государством. По классификации Уильямса: анабаптисты, спиритуалисты и евангельские рационалисты.",
 "eng":"Английская Реформация — от разрыва Генриха VIII с Римом (via media) до пуритан, индепендентов, сепаратистов, квакеров и методистов.",
 "bap":"Баптисты — англо-американская традиция: крещение по вере, добровольная церковь, свобода совести (Джон Смит; общие и частные баптисты).",
 "ehb":"Российский ЕХБ — баптизм и евангельские христиане в России: от Воронина и штундизма к Союзу русских баптистов, ВСЕХБ и современным союзам.",
 "contra":"Контрреформация (католическая реформа) — ответ Рима: иезуиты, Тридентский собор, инквизиция; обновление изнутри и борьба с протестантизмом.",
}

nodes=[]
for nid,(c,y,ck,title,sub) in N.items():
    x0,y0,x1,y1=BOX[nid]
    nodes.append({"id":nid,"x":round(x0,1),"y":round(y0,1),"w":round(x1-x0,1),"h":round(y1-y0,1),
                  "color":COL[ck],"group":ck})

EVENT_INFO=t5.EVENT_INFO
events=[]
for y in years:
    short=EVENTS.get(y,"")
    info=EVENT_INFO.get(y, short or f"{y} год.")
    events.append({"year":str(y),"yy":round(yof(y),1),"key":(y in KEY),
                   "text":short,"info":info,"src":t5.date_src(y)})

GROUP_SRC={"pre":["needham3","schaff6","sannikov"],"lut":["macculloch","schaff7","needham3"],
 "ref":["macculloch","needham4","mcgrath_calvin"],"rad":["estep","needham3","menno_sann"],
 "eng":["needham4","macculloch"],"bap":["estep","needham4","sannikov"],
 "ehb":["sannikov"],"contra":["macculloch","needham3","trent"]}
groups=[]
for title,ck,c0,c1 in GROUPS:
    groups.append({"title":title,"key":ck,"color":COL[ck],"info":GROUP_INFO.get(ck,""),"src":GROUP_SRC.get(ck,[]),
                   "x0":round(colx(c0)-CW/2+8,1),"x1":round(colx(c1)+CW/2-8,1)})

groups.sort(key=lambda g:g["x0"])   # для корректных вертикальных разделителей
xs0=min(n["x"] for n in nodes); xs1=max(n["x"]+n["w"] for n in nodes); ys1=max(n["y"]+n["h"] for n in nodes)
# эпохи (динамический фон): диапазоны по строкам, попадающим в период
periods=[]
for i,(lab,a,b) in enumerate(getattr(t5,"PERIODS",[])):
    rws=[yof(y) for y in years if a<=y<b]
    if rws: periods.append({"label":lab,"yy0":round(min(rws)-t5.RS*0.55,1),"yy1":round(max(rws)+t5.RS*0.55,1),"alt":i%2})
# заголовки, меняющиеся по этапам (I — до 1054, II — 1054–1517, III — с 1517)
def _hx(c0,c1): return (round(colx(c0)-CW/2+8,1), round(colx(c1)+CW/2-8,1))
STAGEHEAD=[
 [("Восточные церкви","east",-6,-5),("Византийский Восток","eorth",-4,-1),("Древняя (Западная) Церковь","root",0,1),("Ранние ереси","ext",2,5)],
 [("Древний Восток","east",-6,-5),("Православие · Византия","eorth",-4,-2),("Русь","rus",-1,-1),("Католическая (Западная) Церковь","root",0,1),("Монашество · схоластика","root",2,5)],
 [("Православие","eorth",-4,-1),("Католичество","root",0,0),("Лютеранство","lut",1,1),("Реформатство","ref",2,3),("Радикальная","rad",4,8),("Английская линия","eng",9,11),("Баптисты","bap",12,13),("ЕХБ","ehb",14,15),("Контрреформация","contra",16,16)],
]
headers=[]
for _st,_segs in enumerate(STAGEHEAD):
    for lab,ck,c0,c1 in _segs:
        x0,x1=_hx(c0,c1); headers.append({"label":lab,"key":ck,"color":COL[ck],"stage":_st,"x0":x0,"x1":x1})
DATA={"W":W,"H":H,"bandY":round(yof(33),1),"rs":t5.RS,
      "cx0":round(xs0-34),"cx1":round(xs1+34),"cy0":40,"cy1":round(ys1+40),
      "svg":t5.svg_core,"nodes":nodes,"events":events,"groups":groups,"edges":t5.EDGES_JS,
      "bib":t5.BIB,"periods":periods,"headers":headers,
      "stageBounds":[round(yof(1054),1),round(yof(1517),1)],
      "stageNames":["I · Древняя Церковь (до 1054)","II · Разделённая Церковь (1054–1517)","III · Реформация → наши дни"]}

with open(os.path.join(ROOT,"data.js"),"w",encoding="utf-8") as f:   # пишем в корень репо, рядом с index.html
    f.write("window.DATA="+json.dumps(DATA,ensure_ascii=False)+";\n")

with open(os.path.join(HERE,"reformation.svg"),"w",encoding="utf-8") as f:   # статичная версия для печати/PDF
    f.write(f'<svg xmlns="http://www.w3.org/2000/svg" width="{W}" height="{H}" viewBox="0 0 {W} {H}">\n'+t5.svg_full+"\n</svg>\n")

print("OK. узлов:",len(nodes),"связей:",len(t5.EDGES_JS),"дат:",len(events),"| content:",DATA["cx0"],"..",DATA["cx1"])
