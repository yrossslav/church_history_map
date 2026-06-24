/* Интерактивная инфографика Реформации — движок. Данные: window.DATA (data.js). */
(function(){
const D=window.DATA, W=D.W, H=D.H;
const CX0=D.cx0, CX1=D.cx1, CY0=D.cy0, CY1=D.cy1;       // границы содержимого
const CW=CX1-CX0, CH=CY1-CY0;
const LEFT=64, TOPH=34;                                  // таймлайн слева, шапка сверху
const vp=document.getElementById('viewport'), scene=document.getElementById('scene'),
      grid=document.getElementById('grid'),
      card=document.getElementById('card'), topbar=document.getElementById('topbar'),
      axisbar=document.getElementById('axisbar'), datetip=document.getElementById('datetip'),
      tip=document.getElementById('tip'), hint=document.getElementById('hint'),
      stageTitle=document.getElementById('stagetitle');
const GBX=[];for(let i=0;i<D.groups.length-1;i++)GBX.push((D.groups[i].x1+D.groups[i+1].x0)/2);  // границы ветвей
/* индексы узлов: группа, центр, заголовок + направленные связи (родитель→потомок) */
const NG={},NCEN={};
D.nodes.forEach(n=>{NG[n.id]=n.group;NCEN[n.id]=[n.x+n.w/2,n.y+n.h/2];});
/* структурные связи-«банты» (на главной карте рисуются подложками; здесь — для родословной/окна ветви) */
const STRUCT=[['imperial','rcc','solid','Западная (латинская) церковь'],['imperial','byz','solid','Восточная (греческая) церковь'],
  ['rcc','wyc','dash','предтечи Реформации'],['rcc','iez','solid','Контрреформация'],['rcc','ref_era','solid','Реформация'],
  ['ref_era','lut','solid',''],['ref_era','zwi','solid',''],['ref_era','ana','solid',''],
  ['ref_era','ang','solid',''],['ref_era','soc','solid',''],['ref_era','spirit','solid',''],['ref_era','tyn','solid',''],
  ['rusr','dukhob','dash','из православной среды']];
// боковые связи-влияния между традициями: показываются на карте, но НЕ определяют происхождение (не тянут родословную в чужое дерево)
const NOFLOW=new Set(['lutc>ierem','refc>lukaris','qua>dukhob','eras>lut','eras>tyn','eras>zwi','eras>hub']);
const ALLEDGES=D.edges.concat(STRUCT);
const PAR={},CHI={};
ALLEDGES.forEach((e,k)=>{if(NOFLOW.has(e[0]+'>'+e[1]))return;(CHI[e[0]]=CHI[e[0]]||[]).push([e[1],k]);(PAR[e[1]]=PAR[e[1]]||[]).push([e[0],k]);});
const hlGroups=new Set();    // ветви, выделенные через легенду (мультивыбор)

scene.innerHTML='<svg id="diagram" width="'+W+'" height="'+H+'" viewBox="0 0 '+W+' '+H+'" style="overflow:visible">'+D.svg+'</svg>';

const clamp=(v,a,b)=>v<a?a:(v>b?b:v);
let tx=0,ty=0,scale=1,raf=null;
function availW(){return innerWidth-LEFT;}
function availH(){return innerHeight-TOPH;}
function fitScale(){return Math.min(availW()/CW, availH()/CH);}
function bounds(){return {min:fitScale()*0.4, max:3.5};}        // можно отдалить заметно дальше
function clampScale(s){const b=bounds();return clamp(s,b.min,b.max);}
function clampPan(){const keep=90, aL=LEFT, aR=innerWidth, aT=TOPH, aB=innerHeight;
  // свобода как в Miro: двигаем куда угодно (любой элемент — в центр, можно «выехать» за край),
  // удерживаем лишь узкую полоску содержимого (keep), чтобы совсем не потеряться
  tx = clamp(tx, (aL+keep)-CX1*scale, (aR-keep)-CX0*scale);
  ty = clamp(ty, (aT+keep)-CY1*scale, (aB-keep)-CY0*scale);
}
function schedule(){if(raf)return;raf=requestAnimationFrame(()=>{raf=null;render();});}
function render(){
  scene.style.transform='translate('+tx+'px,'+ty+'px) scale('+scale+')';
  const _tw=(TOPH-ty)/scale,sb=D.stageBounds||[1e18,1e18];let cs=0;if(_tw>=sb[0])cs=1;if(_tw>=sb[1])cs=2;
  for(const s of segEls){if(s.h.stage!==cs){s.el.style.display='none';continue;}   // заголовки текущего этапа
    const x0=tx+s.h.x0*scale,w=(s.h.x1-s.h.x0)*scale;
    if(x0+w<LEFT-2||x0>innerWidth){s.el.style.display='none';continue;}
    s.el.style.display='flex';s.el.style.left=x0+'px';s.el.style.width=w+'px';
    s.lbl.style.opacity=(w<s.tw+12)?'0':'1';}
  if(stageTitle)stageTitle.textContent=(D.stageNames||[])[cs]||'';
  let gl='';const bh=Math.max(6,D.rs*0.84*scale);              // высота полосы ключевой даты (масштабируется)
  for(const t of tickEls){const y=ty+t.yy*scale;t.sy=y;
    t.el.style.top=y+'px';t.el.style.display=(y<TOPH-6||y>innerHeight+6)?'none':'block';
    if(y>TOPH-bh&&y<innerHeight+bh){
      if(t.key) gl+='<rect class="kb" x="'+LEFT+'" y="'+(y-bh/2).toFixed(1)+'" width="'+(innerWidth-LEFT)+'" height="'+bh.toFixed(1)+'"/>';
      gl+='<line class="'+(t.key?'k':'')+'" x1="'+LEFT+'" y1="'+y.toFixed(1)+'" x2="'+innerWidth+'" y2="'+y.toFixed(1)+'"/>';}}
  for(const xb of GBX){const x=tx+xb*scale; if(x>LEFT-1&&x<innerWidth+1) gl+='<line x1="'+x.toFixed(1)+'" y1="'+TOPH+'" x2="'+x.toFixed(1)+'" y2="'+innerHeight+'"/>';}
  let pl='';                                                    // фон-эпохи (тянутся слева направо, движутся с полотном)
  for(const p of (D.periods||[])){const y0=Math.max(ty+p.yy0*scale,0),y1=Math.min(ty+p.yy1*scale,innerHeight);
    if(y1<=0||y0>=innerHeight)continue;
    pl+='<rect class="per'+(p.alt?' alt':'')+'" x="0" y="'+y0.toFixed(1)+'" width="'+innerWidth+'" height="'+(y1-y0).toFixed(1)+'"/>';
    pl+='<text class="perlab" x="'+(LEFT+10)+'" y="'+(Math.max(y0,TOPH)+16).toFixed(1)+'">'+p.label+'</text>';}
  grid.innerHTML=pl+gl;                                         // фон-эпохи + сетка + ключевые даты — динамические
  updateMinimap();
}
function zoomAt(f,cx,cy){const ns=clampScale(scale*f);tx=cx-(cx-tx)*ns/scale;ty=cy-(cy-ty)*ns/scale;scale=ns;clampPan();schedule();}
function centerOn(wx,wy){tx=LEFT+availW()/2-wx*scale; ty=TOPH+availH()/2-wy*scale; clampPan(); schedule();}

/* ——— залипающая шапка ветвей (сверху, кликабельная, сворачивается) ——— */
const mctx=document.createElement('canvas').getContext('2d');mctx.font='bold 12px "DejaVu Sans",Arial';
const segEls=(D.headers||[]).map(h=>{const el=document.createElement('div');el.className='gseg';
  el.style.background=h.color;const lbl=document.createElement('span');lbl.className='lbl';lbl.textContent=h.label;el.appendChild(lbl);
  el.addEventListener('click',ev=>{ev.stopPropagation();if(h.key)focusGroup(h.key);});
  el.addEventListener('mousemove',ev=>showTip(h.label,ev.clientX,ev.clientY));
  el.addEventListener('mouseleave',hideTip);
  topbar.appendChild(el);return {h,el,lbl,tw:mctx.measureText(h.label).width};});

/* ——— залипающий таймлайн СЛЕВА (даты + события, dock-эффект) ——— */
const tickEls=D.events.map(e=>{const el=document.createElement('div');
  el.className='ytick'+(e.key?' key':'');
  el.innerHTML=(e.key?'<span class="dot"></span>':'')+'<span class="yr">'+e.year+'</span>';
  el.dataset.t=e.year;el.dataset.i=e.info||e.text||'—';el.dataset.c=e.key?'#8a6a16':'#7a5a1e';
  el.dataset.src=(e.src||[]).join(',');
  el.addEventListener('click',ev=>{ev.stopPropagation();showCard(el,LEFT+12,el.sy);clearFocus();});
  axisbar.appendChild(el);return {yy:e.yy,el,sy:0,text:e.text,year:e.year,key:e.key};});

axisbar.addEventListener('mousemove',e=>{const cy=e.clientY,SIG=72,AMP=0.95;let near=null,nd=1e9;
  for(const t of tickEls){const dy=t.sy-cy,k=Math.exp(-(dy*dy)/(SIG*SIG)),sc=1+AMP*k;
    t.el.style.transform='translateY(-50%) scale('+sc+')';t.el.style.zIndex=Math.round(k*10);
    if(Math.abs(dy)<nd){nd=Math.abs(dy);near=t;}}
  if(near){datetip.querySelector('.dy').textContent=near.year;
    datetip.querySelector('.dt').textContent=near.text||'—';
    datetip.style.display='block';datetip.style.top=clamp(near.sy,TOPH+12,innerHeight-72)+'px';}
});
axisbar.addEventListener('mouseleave',()=>{for(const t of tickEls)t.el.style.transform='translateY(-50%)';datetip.style.display='none';});

/* ——— миникарта (справа снизу) ——— */
const mm=document.getElementById('minimap'),mmW=150,mmH=Math.round(150*CH/CW),mmk=mmW/CW;
let gg='<svg width="'+mmW+'" height="'+mmH+'" viewBox="'+CX0+' '+CY0+' '+CW+' '+CH+'">';
gg+='<rect x="'+CX0+'" y="'+CY0+'" width="'+CW+'" height="'+CH+'" fill="#efe6d3"/>';
for(const n of D.nodes) gg+='<rect x="'+n.x+'" y="'+n.y+'" width="'+n.w+'" height="'+n.h+'" rx="6" fill="'+n.color+'"/>';
gg+='<rect id="mmview" x="0" y="0" width="10" height="10"/></svg>';
mm.innerHTML=gg;const mmview=document.getElementById('mmview');
function updateMinimap(){const x=(LEFT-tx)/scale,y=(TOPH-ty)/scale,w=availW()/scale,h=availH()/scale;
  mmview.setAttribute('x',x);mmview.setAttribute('y',y);mmview.setAttribute('width',w);mmview.setAttribute('height',h);}
let mmDrag=false;
function mmGo(e){const r=mm.querySelector('svg').getBoundingClientRect();
  centerOn(CX0+(e.clientX-r.left)/mmk, CY0+(e.clientY-r.top)/mmk);}
mm.addEventListener('mousedown',e=>{mmDrag=true;mmGo(e);e.preventDefault();e.stopPropagation();});  // тянем — окно следует за мышкой
addEventListener('mousemove',e=>{if(mmDrag)mmGo(e);});
addEventListener('mouseup',()=>{mmDrag=false;});

/* ——— зум/панорама ——— */
vp.addEventListener('wheel',e=>{e.preventDefault();zoomAt(e.deltaY<0?1.13:1/1.13,e.clientX,e.clientY);},{passive:false});
let drag=false,moved=false,px,py;
vp.addEventListener('mousedown',e=>{if(e.button!==0)return;drag=true;moved=false;px=e.clientX;py=e.clientY;});
addEventListener('mouseup',()=>{drag=false;});
addEventListener('mousemove',e=>{if(!drag)return;if(Math.abs(e.clientX-px)+Math.abs(e.clientY-py)>3)moved=true;
  tx+=e.clientX-px;ty+=e.clientY-py;px=e.clientX;py=e.clientY;clampPan();schedule();});
let lt=null,ld=null;
vp.addEventListener('touchstart',e=>{if(e.touches.length===1)lt=[e.touches[0].clientX,e.touches[0].clientY];
  else if(e.touches.length===2)ld=Math.hypot(e.touches[0].clientX-e.touches[1].clientX,e.touches[0].clientY-e.touches[1].clientY);},{passive:false});
vp.addEventListener('touchmove',e=>{e.preventDefault();
  if(e.touches.length===1&&lt){tx+=e.touches[0].clientX-lt[0];ty+=e.touches[0].clientY-lt[1];lt=[e.touches[0].clientX,e.touches[0].clientY];clampPan();schedule();}
  else if(e.touches.length===2&&ld){const nd=Math.hypot(e.touches[0].clientX-e.touches[1].clientX,e.touches[0].clientY-e.touches[1].clientY);
    const mx=(e.touches[0].clientX+e.touches[1].clientX)/2,my=(e.touches[0].clientY+e.touches[1].clientY)/2;zoomAt(nd/ld,mx,my);ld=nd;}},{passive:false});

/* ——— hover-увеличение блоков (без переупорядочивания DOM) ——— */
vp.querySelectorAll('.node').forEach(n=>{
  n.addEventListener('mouseenter',()=>{const p=n.parentNode;if(p.lastChild!==n)p.appendChild(n);  // поверх остальных
    let f=1.6;try{const bb=n.getBBox();f=clamp(64/(bb.height*scale),1.25,4);}catch(_){}
    n.style.transform='scale('+f+')';n.classList.add('hov');});
  n.addEventListener('mouseleave',()=>{n.style.transform='';n.classList.remove('hov');});
});

/* ——— hover по линиям → имя связи (тултип); клик → описание ——— */
let lastEdge=null;
vp.addEventListener('mousemove',e=>{if(drag){hideTip();return;}const ed=e.target.closest('.edge');
  if(ed){lastEdge=ed;showTip(ed.getAttribute('data-t')||'',e.clientX,e.clientY);}
  else if(lastEdge){lastEdge=null;hideTip();}});

/* ——— тултип (имя) ——— */
function showTip(text,mx,my){if(!text){hideTip();return;}tip.textContent=text;tip.style.display='block';
  const w=tip.offsetWidth;let x=mx+14,y=my+16;if(x+w>innerWidth-6)x=mx-w-14;if(x<6)x=6;tip.style.left=x+'px';tip.style.top=y+'px';}
function hideTip(){tip.style.display='none';}

/* ——— карточка + подсветка ветви ——— */
function clearFocus(){vp.classList.remove('focus');
  vp.querySelectorAll('.edge.on').forEach(e=>e.classList.remove('on'));
  vp.querySelectorAll('.node.sel').forEach(n=>n.classList.remove('sel'));
  vp.querySelectorAll('.node.hl').forEach(n=>n.classList.remove('hl'));
  hlGroups.clear();
  const lg=document.getElementById('legend');if(lg)lg.querySelectorAll('.gi.act').forEach(x=>x.classList.remove('act'));}
function applyHL(){                                          // мультивыделение ветвей: объединение выбранных ярко, остальное гаснет
  vp.querySelectorAll('.node.sel').forEach(n=>n.classList.remove('sel'));
  vp.querySelectorAll('.edge.on').forEach(e=>e.classList.remove('on'));
  const lg=document.getElementById('legend');
  if(!hlGroups.size){vp.classList.remove('focus');if(lg)lg.querySelectorAll('.gi.act').forEach(x=>x.classList.remove('act'));return;}
  vp.classList.add('focus');                                // затемняем всё, кроме выбранного
  const ids=new Set(D.nodes.filter(n=>hlGroups.has(n.group)).map(n=>n.id));
  ids.forEach(id=>{const n=vp.querySelector('.node[data-id="'+CSS.escape(id)+'"]');if(n)n.classList.add('sel');});
  D.edges.forEach((e,k)=>{if(ids.has(e[0])&&ids.has(e[1])){const ed=document.getElementById('edge'+k);if(ed)ed.classList.add('on');}});
  if(lg)lg.querySelectorAll('.gi').forEach(x=>x.classList.toggle('act',hlGroups.has(x.getAttribute('data-grp'))));}

/* ——— окно «ветвь целиком / сравнение»: перекомпоновка по поколениям + зум/пан + клик→карточка ——— */
const treeview=document.getElementById('treeview'),tvbody=treeview.querySelector('.tvbody'),tvt=treeview.querySelector('.tvt');
function lineageSet(id){const seen=new Set([id]);
  (function up(x){(PAR[x]||[]).forEach(([p])=>{if(!seen.has(p)){seen.add(p);up(p);}});})(id);
  (function down(x){(CHI[x]||[]).forEach(([c])=>{if(!seen.has(c)){seen.add(c);down(c);}});})(id);
  return seen;}
function twrap(s,m){const w=(s||'').split(/\s+/),out=[];let cur='';
  w.forEach(x=>{if((cur+' '+x).trim().length>m){if(cur)out.push(cur);cur=x;}else cur=(cur?cur+' ':'')+x;});
  if(cur)out.push(cur);return out.length>2?[out[0],out.slice(1).join(' ').slice(0,m-1)+'…']:out;}
const NODEBY={};D.nodes.forEach(n=>NODEBY[n.id]=n);
NODEBY['ref_era']={id:'ref_era',title:'Реформация',sub:'1517',color:'#8a6a16'};   // синтетический узел-эпоха (только для дерева/родословной)
const NYEAR={},NINFO={};vp.querySelectorAll('.node').forEach(n=>{const id=n.getAttribute('data-id');
  NYEAR[id]=n.getAttribute('data-year')||'';NINFO[id]=n.getAttribute('data-i')||'';});
NYEAR['ref_era']='1517';NINFO['ref_era']='';
let TT={x:0,y:0,s:1},tvg=null,tvsvg=null,lastTW=0,lastTH=0;
function tApply(){if(tvg)tvg.setAttribute('transform','translate('+TT.x+' '+TT.y+') scale('+TT.s+')');}
function fitTree(){const r=tvbody.getBoundingClientRect();const s=Math.min((r.width-40)/lastTW,(r.height-50)/lastTH,1.5);
  TT.s=s>0?s:0.3;TT.x=(r.width-lastTW*TT.s)/2;TT.y=Math.max(16,(r.height-lastTH*TT.s)/2);tApply();}
function renderTree(idset,title,focal){
  const ids=new Set(idset),kids={},par={},elab={},etyp={};ids.forEach(id=>{kids[id]=[];par[id]=[];});
  ALLEDGES.forEach(e=>{if(NOFLOW.has(e[0]+'>'+e[1])||!ids.has(e[0])||!ids.has(e[1]))return;
    kids[e[0]].push(e[1]);par[e[1]].push(e[0]);elab[e[0]+'>'+e[1]]=e[3]||'';etyp[e[0]+'>'+e[1]]=e[2]||'solid';});
  // вертикаль — поколения (longest-path); горизонталь — раскладка ДЕРЕВА (каждое поддерево в своей полосе, ветви не накладываются)
  const rank={};(function(){const f=id=>{if(id in rank)return rank[id];if(!par[id].length)return rank[id]=0;
    let r=0;par[id].forEach(p=>{r=Math.max(r,f(p)+1);});return rank[id]=r;};[...ids].forEach(f);})();
  let maxr=0;[...ids].forEach(id=>{if(rank[id]>maxr)maxr=rank[id];});
  const prim={},tkids={};[...ids].forEach(id=>tkids[id]=[]);
  [...ids].forEach(id=>{prim[id]=par[id].length?par[id].slice().sort((a,b)=>rank[b]-rank[a])[0]:null;});  // осн. родитель — ближайший по поколению
  [...ids].forEach(id=>{if(prim[id]!=null)tkids[prim[id]].push(id);});
  [...ids].forEach(id=>tkids[id].sort((a,b)=>(parseInt(NYEAR[a])||0)-(parseInt(NYEAR[b])||0)));   // дети — по году слева→направо
  const roots=[...ids].filter(id=>prim[id]==null).sort((a,b)=>(parseInt(NYEAR[a])||0)-(parseInt(NYEAR[b])||0));
  const xcol={};let leaf=0;
  function place(id){const ch=tkids[id];if(!ch.length){xcol[id]=leaf++;return;}ch.forEach(place);xcol[id]=(xcol[ch[0]]+xcol[ch[ch.length-1]])/2;}
  roots.forEach(place);
  const COLW=196,ROWH=104,BW=152,BH=56,dim={},pos={};
  [...ids].forEach(id=>{const root=prim[id]==null;dim[id]=root?{w:188,h:76,big:true}:{w:BW,h:BH,big:false};});
  [...ids].forEach(id=>{const dd=dim[id];pos[id]={x:xcol[id]*COLW+COLW/2-dd.w/2,y:rank[id]*ROWH,w:dd.w,h:dd.h};});
  let edges='',hits='',boxes='';
  Object.keys(kids).forEach(a=>kids[a].forEach(b=>{const pa=pos[a],pb=pos[b];if(!pa||!pb)return;
    const key=a+'>'+b,x1=pa.x+pa.w/2,y1=pa.y+pa.h,x2=pb.x+pb.w/2,y2=pb.y,my=(y1+y2)/2,mx=(x1+x2)/2,
      d='M'+x1+' '+y1+' C '+x1+' '+my+' '+x2+' '+my+' '+x2+' '+y2;
    edges+='<path d="'+d+'" fill="none" stroke="#9c8a6a" stroke-width="2"'+(etyp[key]==='dash'?' stroke-dasharray="6,5"':'')+'/>'
      +'<polygon points="'+x2+','+y2+' '+(x2-5)+','+(y2-8)+' '+(x2+5)+','+(y2-8)+'" fill="#9c8a6a"/>';
    if(elab[key]&&rank[b]-rank[a]===1){           // подпись связи — в зазоре между соседними рядами (без наложений)
      const lt=elab[key].length>26?elab[key].slice(0,25)+'…':elab[key],lw=lt.length*5.6+12;
      edges+='<g><rect x="'+(mx-lw/2).toFixed(1)+'" y="'+(my-9)+'" width="'+lw.toFixed(1)+'" height="18" rx="5" fill="#fcf8ee" stroke="#d6c9b2"/>'
        +'<text x="'+mx.toFixed(1)+'" y="'+(my+4)+'" text-anchor="middle" font-size="10.5" fill="#5a482e" font-family="DejaVu Sans,Arial">'+esc(lt)+'</text></g>';}
    hits+='<path class="te" data-e="'+esc(key)+'" data-l="'+esc(elab[key]||'')+'" d="'+d+'" fill="none" stroke="#000" stroke-opacity="0" stroke-width="16"/>';}));
  [...ids].forEach(id=>{const n=NODEBY[id],p=pos[id];if(!n||!p)return;
    const big=dim[id].big,ls=twrap(n.title,big?16:19),yr=NYEAR[id]||'',fs=big?13.5:11.5,lh=big?16:14,pad=big?21:17;
    const ty=p.y+pad+((p.h-pad)-(ls.length-1)*lh)/2+3;
    boxes+='<g class="tn'+(id===focal?' foc':'')+(big?' big':'')+'" data-id="'+id+'"><rect x="'+p.x+'" y="'+p.y+'" width="'+p.w+'" height="'+p.h+'" rx="9" fill="'+n.color+'"/>';
    if(yr)boxes+='<text x="'+(p.x+10)+'" y="'+(p.y+(big?16:14))+'" font-size="'+(big?10.5:9.5)+'" fill="#ffffff" fill-opacity="0.8" font-family="DejaVu Sans,Arial">'+esc(yr)+'</text>';
    ls.forEach((l,i)=>boxes+='<text x="'+(p.x+p.w/2)+'" y="'+(ty+i*lh)+'" text-anchor="middle" font-size="'+fs+'" font-weight="bold" fill="#fff" font-family="DejaVu Sans,Arial">'+esc(l)+'</text>');
    boxes+='</g>';});
  lastTW=Math.max(1,leaf)*COLW;lastTH=maxr*ROWH+92;
  tvbody.innerHTML='<svg id="tvsvg" width="100%" height="100%"><g id="tvg">'+edges+hits+boxes+'</g></svg>';
  tvg=tvbody.querySelector('#tvg');tvsvg=tvbody.querySelector('#tvsvg');
  tvt.textContent=title||'Ветвь';treeview.classList.add('open');hideTip();requestAnimationFrame(fitTree);}
function ancSet(id){const s=new Set([id]);(function up(x){(PAR[x]||[]).forEach(([p])=>{if(!s.has(p)){s.add(p);up(p);}});})(id);return s;}
function descSet(id){const s=new Set([id]);(function dn(x){(CHI[x]||[]).forEach(([c])=>{if(!s.has(c)){s.add(c);dn(c);}});})(id);return s;}
function showFocal(id,mode){const ids=mode==='anc'?ancSet(id):mode==='desc'?descSet(id):lineageSet(id);
  const nm=(NODEBY[id]?NODEBY[id].title:id)+' — '+(mode==='anc'?'откуда произошло':mode==='desc'?'что произошло от неё':'предки и потомки');
  showTree(ids,nm,id,mode);}
let treeHist=[],treeIdx=-1;                       // история просмотренных ветвей (вперёд/назад)
function showTree(idset,title,focal,mode){treeHist=treeHist.slice(0,treeIdx+1);
  treeHist.push({ids:[...idset],title:title||'Ветвь',focal:focal||null,mode:mode||null});treeIdx=treeHist.length-1;
  const h=treeHist[treeIdx];renderTree(new Set(h.ids),h.title,h.focal);updateTreeNav();}
function navTree(d){const i=treeIdx+d;if(i<0||i>=treeHist.length)return;treeIdx=i;const h=treeHist[i];
  renderTree(new Set(h.ids),h.title,h.focal);updateTreeNav();}
function updateTreeNav(){const cur=treeHist[treeIdx]||{};
  const b=treeview.querySelector('.tvnav[data-n="back"]'),f=treeview.querySelector('.tvnav[data-n="fwd"]');
  if(b)b.disabled=treeIdx<=0;if(f)f.disabled=treeIdx>=treeHist.length-1;
  treeview.querySelectorAll('.tvmode').forEach(mb=>{const m=mb.getAttribute('data-m');
    mb.style.display=cur.focal?'':'none';mb.classList.toggle('on',cur.mode===m);
    mb.disabled=!!cur.focal&&((m==='anc'&&!(PAR[cur.focal]||[]).length)||(m==='desc'&&!(CHI[cur.focal]||[]).length)||(m==='both'&&!((PAR[cur.focal]||[]).length||(CHI[cur.focal]||[]).length)));});}
treeview.querySelectorAll('.tvnav').forEach(b=>b.addEventListener('click',()=>navTree(b.getAttribute('data-n')==='back'?-1:1)));
treeview.querySelectorAll('.tvmode').forEach(mb=>mb.addEventListener('click',()=>{const cur=treeHist[treeIdx];if(cur&&cur.focal&&!mb.disabled)showFocal(cur.focal,mb.getAttribute('data-m'));}));
treeview.querySelector('.cl').addEventListener('click',()=>treeview.classList.remove('open'));
tvbody.addEventListener('wheel',e=>{if(!treeview.classList.contains('open'))return;e.preventDefault();
  const r=tvbody.getBoundingClientRect(),cx=e.clientX-r.left,cy=e.clientY-r.top,f=e.deltaY<0?1.12:1/1.12,ns=clamp(TT.s*f,0.1,4);
  TT.x=cx-(cx-TT.x)*ns/TT.s;TT.y=cy-(cy-TT.y)*ns/TT.s;TT.s=ns;tApply();},{passive:false});
let tdrag=false,tmoved=false,tpx=0,tpy=0;
tvbody.addEventListener('mousedown',e=>{tdrag=true;tmoved=false;tpx=e.clientX;tpy=e.clientY;});
addEventListener('mousemove',e=>{if(!tdrag)return;if(Math.abs(e.clientX-tpx)+Math.abs(e.clientY-tpy)>3)tmoved=true;
  TT.x+=e.clientX-tpx;TT.y+=e.clientY-tpy;tpx=e.clientX;tpy=e.clientY;tApply();});
addEventListener('mouseup',()=>{tdrag=false;});
let tlt=null,tld=null;                            // тач: один палец — двигать, два — масштаб
tvbody.addEventListener('touchstart',e=>{if(e.touches.length===1){tlt=[e.touches[0].clientX,e.touches[0].clientY];tmoved=false;}
  else if(e.touches.length===2){tld=Math.hypot(e.touches[0].clientX-e.touches[1].clientX,e.touches[0].clientY-e.touches[1].clientY);}},{passive:true});
tvbody.addEventListener('touchmove',e=>{if(!treeview.classList.contains('open'))return;e.preventDefault();
  if(e.touches.length===1&&tlt){const dx=e.touches[0].clientX-tlt[0],dy=e.touches[0].clientY-tlt[1];if(Math.abs(dx)+Math.abs(dy)>3)tmoved=true;
    TT.x+=dx;TT.y+=dy;tlt=[e.touches[0].clientX,e.touches[0].clientY];tApply();}
  else if(e.touches.length===2&&tld){const r=tvbody.getBoundingClientRect(),nd=Math.hypot(e.touches[0].clientX-e.touches[1].clientX,e.touches[0].clientY-e.touches[1].clientY),
    mx=(e.touches[0].clientX+e.touches[1].clientX)/2-r.left,my=(e.touches[0].clientY+e.touches[1].clientY)/2-r.top,ns=clamp(TT.s*nd/tld,0.1,4);
    TT.x=mx-(mx-TT.x)*ns/TT.s;TT.y=my-(my-TT.y)*ns/TT.s;TT.s=ns;tld=nd;tmoved=true;tApply();}},{passive:false});
tvbody.addEventListener('touchend',()=>{tlt=null;tld=null;});
let EDGEEL=null;function edgeEls(){if(EDGEEL)return EDGEEL;EDGEEL={};D.edges.forEach((e,k)=>{const el=document.getElementById('edge'+k);if(el)EDGEEL[e[0]+'>'+e[1]]=el;});return EDGEEL;}
tvbody.addEventListener('click',e=>{if(tmoved)return;
  const te=e.target.closest('.te');                          // клик по связи → её описание
  if(te){const el=edgeEls()[te.getAttribute('data-e')];if(el)showCard(el,Math.min(e.clientX,innerWidth-360),Math.max(70,e.clientY-40));return;}
  const g=e.target.closest('.tn');if(!g)return;               // клик по узлу → его карточка
  const el=vp.querySelector('.node[data-id="'+CSS.escape(g.getAttribute('data-id'))+'"]');
  if(el)showCard(el,Math.min(e.clientX,innerWidth-360),Math.max(70,e.clientY-40));});
tvbody.addEventListener('mousemove',e=>{if(tdrag)return;const te=e.target.closest('.te');showTip(te?te.getAttribute('data-l'):'',e.clientX,e.clientY);});
tvbody.addEventListener('mouseleave',hideTip);
treeview.querySelectorAll('.tvctl button').forEach(b=>b.addEventListener('click',()=>{const z=b.getAttribute('data-z');
  if(z==='fit'){fitTree();return;}const r=tvbody.getBoundingClientRect(),cx=r.width/2,cy=r.height/2,f=z==='in'?1.25:1/1.25,ns=clamp(TT.s*f,0.1,4);
  TT.x=cx-(cx-TT.x)*ns/TT.s;TT.y=cy-(cy-TT.y)*ns/TT.s;TT.s=ns;tApply();}));
let ADJ=null;
function adj(){if(ADJ)return ADJ;ADJ={};D.edges.forEach((e,k)=>{(ADJ[e[0]]=ADJ[e[0]]||[]).push([e[1],k]);(ADJ[e[1]]=ADJ[e[1]]||[]).push([e[0],k]);});return ADJ;}
function focusBranch(startIds){clearFocus();vp.classList.add('focus');
  const a=adj(),seen=new Set(),onE=new Set(),stack=[];
  startIds.forEach(s=>{if(s){seen.add(s);stack.push(s);}});
  while(stack.length){const cur=stack.pop();(a[cur]||[]).forEach(([nb,k])=>{onE.add(k);if(!seen.has(nb)){seen.add(nb);stack.push(nb);}});}
  onE.forEach(k=>{const ed=document.getElementById('edge'+k);if(ed)ed.classList.add('on');});
  seen.forEach(nid=>{const n=vp.querySelector('.node[data-id="'+CSS.escape(nid)+'"]');if(n)n.classList.add('sel');});}
function focusLineage(id){clearFocus();vp.classList.add('focus');               // линия преемства: предки + потомки
  const seen=new Set([id]),onE=new Set();
  (function up(x){(PAR[x]||[]).forEach(([p,k])=>{onE.add(k);if(!seen.has(p)){seen.add(p);up(p);}});})(id);
  (function down(x){(CHI[x]||[]).forEach(([c,k])=>{onE.add(k);if(!seen.has(c)){seen.add(c);down(c);}});})(id);
  onE.forEach(k=>{const ed=document.getElementById('edge'+k);if(ed)ed.classList.add('on');});
  seen.forEach(nid=>{const n=vp.querySelector('.node[data-id="'+CSS.escape(nid)+'"]');if(n)n.classList.add('sel');});}
function focusGroup(ck){clearFocus();vp.classList.add('focus');                 // всё направление целиком
  const ids=new Set(D.nodes.filter(n=>n.group===ck).map(n=>n.id));
  D.edges.forEach((e,k)=>{if(ids.has(e[0])&&ids.has(e[1])){const ed=document.getElementById('edge'+k);if(ed)ed.classList.add('on');}});
  ids.forEach(nid=>{const n=vp.querySelector('.node[data-id="'+CSS.escape(nid)+'"]');if(n)n.classList.add('sel');});}
function srcLinks(keys){return keys.filter(Boolean).map(k=>{const b=(D.bib||{})[k]||{t:k,u:''};
  return '<div class="si">'+(b.u?'<a href="'+b.u+'" target="_blank" rel="noopener">'+b.t+'</a>':b.t+' <span class="nolink">— онлайн-ссылку не нашёл</span>')+'</div>';}).join('');}
function showCard(el,mx,my){const t=el.getAttribute('data-t')||el.dataset.t||'',
  i=el.getAttribute('data-i')||el.dataset.i||'',c=el.getAttribute('data-c')||el.dataset.c||'#6E1423';
  card.querySelector('.hd').textContent=t;card.querySelector('.hd').style.background=c;
  const bd=card.querySelector('.bd');bd.textContent=i;
  const yr=el.getAttribute('data-year')||'',why=el.getAttribute('data-why')||'';
  if(why){const dn=document.createElement('div');dn.className='datenote';dn.textContent='📅 '+(yr?yr+' — ':'')+why;bd.insertBefore(dn,bd.firstChild);}
  const site=el.getAttribute('data-site')||el.dataset.site||'';
  if(site){const sl=document.createElement('div');sl.className='sitelink';
    sl.innerHTML='<a href="'+site+'" target="_blank" rel="noopener">Официальный сайт ↗</a>';bd.appendChild(sl);}
  const _nid=el.getAttribute('data-id')||'';
  if(_nid&&(PAR[_nid]||[]).length){const tb=document.createElement('button');tb.className='treebtn';tb.textContent='↑ Откуда произошло (предки)';
    tb.addEventListener('click',ev=>{ev.stopPropagation();showFocal(_nid,'anc');});bd.appendChild(tb);}
  if(_nid&&(CHI[_nid]||[]).length){const tb=document.createElement('button');tb.className='treebtn';tb.textContent='↓ Что произошло от неё (потомки)';
    tb.addEventListener('click',ev=>{ev.stopPropagation();showFocal(_nid,'desc');});bd.appendChild(tb);}
  const sa=el.getAttribute('data-src')||el.dataset.src||'';
  if(sa){const k=sa.split(',').filter(Boolean);if(k.length){const sd=document.createElement('div');
    sd.className='src';sd.innerHTML='<div class="st">Источники</div>'+srcLinks(k);bd.appendChild(sd);}}
  card.style.display='block';hideTip();
  const w=card.offsetWidth,h=card.offsetHeight;
  let cx=mx+18,cy=my+18;if(cx+w>innerWidth-8)cx=mx-w-18;if(cx<8)cx=8;if(cy+h>innerHeight-8)cy=innerHeight-h-8;if(cy<8)cy=8;
  card.style.left=cx+'px';card.style.top=cy+'px';}
function hideCard(){card.style.display='none';clearFocus();}
vp.addEventListener('click',e=>{if(moved)return;const el=e.target.closest('.it');
  if(!el){hideCard();return;}
  showCard(el,e.clientX,e.clientY);
  const id=el.getAttribute('data-id');
  if(id){focusLineage(id);}                                    // клик по течению → линия преемства (предки + потомки)
  else{const m=/^edge(\d+)$/.exec(el.id||'');if(m){focusLineage(D.edges[+m[1]][1]);}else{clearFocus();}}  // клик по стрелке → родословная потомка
  e.stopPropagation();});
card.querySelector('.cl').addEventListener('click',hideCard);
addEventListener('keydown',e=>{if(e.key==='Escape'){hideCard();treeview.classList.remove('open');}});

/* ——— меню (справа) ——— */
const menu=document.getElementById('menu');
document.getElementById('burger').addEventListener('click',()=>menu.classList.toggle('open'));
function bindToggle(id,cls){const c=document.getElementById(id);c.addEventListener('change',()=>{document.body.classList.toggle(cls,!c.checked);schedule();});}
bindToggle('t-top','no-top');bindToggle('t-axis','no-axis');bindToggle('t-map','no-map');
document.getElementById('resetView').addEventListener('click',()=>{initView();menu.classList.remove('open');});
document.getElementById('showBib').addEventListener('click',()=>{menu.classList.remove('open');clearFocus();
  card.querySelector('.hd').textContent='Источники';card.querySelector('.hd').style.background='#6E1423';
  const bd=card.querySelector('.bd');bd.textContent='';
  const sd=document.createElement('div');sd.className='src';sd.style.margin='0';
  sd.innerHTML='<div class="st">Литература (онлайн-ссылки, где доступно)</div>'+srcLinks(Object.keys(D.bib||{}));
  bd.appendChild(sd);card.style.display='block';
  card.style.left=Math.max(8,(innerWidth-Math.min(380,innerWidth-16))/2)+'px';card.style.top='64px';});

/* ——— поиск по карте ——— */
const sq=document.getElementById('sq'),sres=document.getElementById('sresults'),searchBox=document.getElementById('search');
const esc=s=>(s||'').replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
function searchHits(q){q=q.trim().toLowerCase();if(!q)return [];
  const t=[],i=[];                                  // сперва совпадения в названии/подписи, затем — в описании (со сниппетом)
  D.nodes.forEach(n=>{const ts=((n.title||'')+' '+(n.sub||'')).toLowerCase();
    if(ts.includes(q)){t.push({n,snip:''});return;}
    const inf=NINFO[n.id]||'',k=inf.toLowerCase().indexOf(q);
    if(k>=0){const a=Math.max(0,k-32),b=Math.min(inf.length,k+q.length+50);
      i.push({n,snip:(a>0?'…':'')+inf.slice(a,b).trim()+(b<inf.length?'…':'')});}});
  return t.concat(i).slice(0,14);}
function hlSnip(text,q){const i=text.toLowerCase().indexOf(q);if(i<0)return esc(text);
  return esc(text.slice(0,i))+'<b>'+esc(text.slice(i,i+q.length))+'</b>'+esc(text.slice(i+q.length));}
function renderSearch(){const hits=searchHits(sq.value);sres.innerHTML='';
  if(!hits.length){sres.style.display='none';return;}
  const q=sq.value.trim().toLowerCase();
  hits.forEach(h=>{const n=h.n,d=document.createElement('div');d.className='sr';
    d.innerHTML='<span class="sg" style="background:'+n.color+'"></span>'+esc(n.title)+(n.sub?' <span class="ss">· '+esc(n.sub)+'</span>':'')
      +(h.snip?'<div class="sx">'+hlSnip(h.snip,q)+'</div>':'');
    d.addEventListener('click',()=>{goToNode(n.id);});sres.appendChild(d);});
  sres.style.display='block';}
function goToNode(id){const c=NCEN[id];if(!c)return;sres.style.display='none';sq.value='';
  const fam=FAMOF[NG[id]];                                   // если семья скрыта — раскроем
  if(fam&&hiddenFam.has(fam)){hiddenFam.delete(fam);const cb=document.querySelector('#fams input[data-fam="'+fam+'"]');if(cb)cb.checked=true;applyVis();}
  scale=clampScale(Math.min(bounds().max,1.5));centerOn(c[0],c[1]);focusLineage(id);
  const n=vp.querySelector('.node[data-id="'+CSS.escape(id)+'"]');if(n)showCard(n,innerWidth/2,Math.max(118,innerHeight*0.26));}
sq.addEventListener('input',renderSearch);
sq.addEventListener('keydown',e=>{if(e.key==='Enter'){const h=searchHits(sq.value);if(h[0])goToNode(h[0].n.id);}
  else if(e.key==='Escape'){sq.value='';sres.style.display='none';sq.blur();}});
addEventListener('click',e=>{if(searchBox&&!searchBox.contains(e.target))sres.style.display='none';});

/* ——— легенда (цвета ветвей + типы линий) ——— */
const GNAME={anc:'Древняя Церковь',ext:'Ереси и маргинальные',root:'Западное Средневековье',pre:'Предшественники Реформации',
  contra:'Католичество · Контрреформация',lut:'Лютеранство',ref:'Реформатство (кальвинизм)',rad:'Радикальная Реформация',
  eng:'Английская традиция',bap:'Баптисты',ehb:'Евангельские христиане-баптисты',pent:'Евангельские · пятидесятники',
  mod:'Современное богословие',east:'Церковь Востока · дохалкидонские',eorth:'Православие (греко-славянское)',rus:'Русское православие'};
const legend=document.getElementById('legend');
(function(){const col={};D.nodes.forEach(n=>{if(!(n.group in col))col[n.group]=n.color;});
  const order=['anc','ext','east','eorth','rus','root','pre','contra','lut','ref','rad','eng','bap','ehb','pent','mod'];
  const keys=order.filter(g=>col[g]).concat(Object.keys(col).filter(g=>order.indexOf(g)<0));
  let h='<div class="lt">Ветви <span class="lh">(клик — выделить)</span></div>';
  keys.forEach(g=>{h+='<div class="li gi" data-grp="'+g+'"><span class="sw" style="background:'+col[g]+'"></span>'+(GNAME[g]||g)+'</div>';});
  h+='<div class="ln"><div class="lt">Линии</div>'+
     '<div class="li"><svg width="34" height="10"><line x1="2" y1="5" x2="32" y2="5" stroke="#7a5a1e" stroke-width="2.5"/></svg>прямое происхождение</div>'+
     '<div class="li"><svg width="34" height="10"><line x1="2" y1="5" x2="32" y2="5" stroke="#7a5a1e" stroke-width="2.5" stroke-dasharray="5 4"/></svg>влияние · реакция · типология</div></div>';
  legend.innerHTML=h;
  legend.querySelectorAll('.gi').forEach(li=>li.addEventListener('click',()=>{        // клик — добавить/убрать ветвь к выделению (можно несколько; остальные НЕ тухнут)
    const g=li.getAttribute('data-grp'),fam=FAMOF[g];
    if(fam&&hiddenFam.has(fam)){hiddenFam.delete(fam);const cb=document.querySelector('#fams input[data-fam="'+fam+'"]');if(cb)cb.checked=true;applyVis();}
    if(hlGroups.has(g))hlGroups.delete(g);else hlGroups.add(g);
    applyHL();}));})();
document.getElementById('toggleLegend').addEventListener('click',()=>legend.classList.toggle('open'));
document.getElementById('compareTree').addEventListener('click',()=>{        // объединить выбранные в легенде ветви в одном окне
  if(!hlGroups.size){legend.classList.add('open');return;}
  const ids=new Set(D.nodes.filter(n=>hlGroups.has(n.group)).map(n=>n.id));
  showTree(ids,'Сравнение ветвей: '+[...hlGroups].map(g=>GNAME[g]||g).join(' · '));});

/* ——— сворачивание/разворачивание семейств ветвей ——— */
const FAMOF={anc:'anc',ext:'ext',east:'east',eorth:'east',rus:'east',root:'west',pre:'west',contra:'west',
  lut:'ref',ref:'ref',rad:'ref',eng:'evang',bap:'evang',pent:'mod',ehb:'mod',mod:'mod'};
const FAMS=[['anc','Древняя Церковь'],['east','Православный Восток'],['west','Католический Запад'],
  ['ref','Реформация'],['evang','Англ. линия · баптисты'],['mod','Новое время · евангельские'],['ext','Ереси · маргинальные']];
const hiddenFam=new Set(['ext']);                            // стартовый вид легче: ереси/маргинальные свёрнуты
function famHidden(id){const g=NG[id];return !!(g&&hiddenFam.has(FAMOF[g]));}
function applyVis(){
  vp.querySelectorAll('.node').forEach(n=>{n.style.display=famHidden(n.getAttribute('data-id'))?'none':'';});
  vp.querySelectorAll('g.cline').forEach(g=>{const f=g.getAttribute('data-f'),t=g.getAttribute('data-tt');
    g.style.display=((f&&famHidden(f))||(t&&famHidden(t)))?'none':'';});
  D.edges.forEach((e,k)=>{const ed=document.getElementById('edge'+k);if(ed)ed.style.display=(famHidden(e[0])||famHidden(e[1]))?'none':'';});}
const famsBox=document.getElementById('fams');
FAMS.forEach(([key,name])=>{const l=document.createElement('label');
  l.innerHTML='<input type="checkbox" data-fam="'+key+'"'+(hiddenFam.has(key)?'':' checked')+'> '+name;
  l.querySelector('input').addEventListener('change',e=>{e.target.checked?hiddenFam.delete(key):hiddenFam.add(key);applyVis();});
  famsBox.appendChild(l);});
document.getElementById('showAll').addEventListener('click',()=>{hiddenFam.clear();
  famsBox.querySelectorAll('input').forEach(c=>c.checked=true);applyVis();});
applyVis();

/* ——— стартовый вид: у банта Реформации ——— */
function initView(){scale=clampScale(Math.min(availW()/CW, bounds().max));
  tx=LEFT+(availW()-CW*scale)/2 - CX0*scale; ty=TOPH+availH()*0.18 - D.bandY*scale; clampPan(); schedule();}
addEventListener('resize',()=>{clampPan();schedule();});
initView();
setTimeout(()=>{if(hint){hint.style.opacity='0';setTimeout(()=>hint.remove(),600);}},5500);
})();
