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
  vp.querySelectorAll('.node.sel').forEach(n=>n.classList.remove('sel'));}
let ADJ=null;
function adj(){if(ADJ)return ADJ;ADJ={};D.edges.forEach((e,k)=>{(ADJ[e[0]]=ADJ[e[0]]||[]).push([e[1],k]);(ADJ[e[1]]=ADJ[e[1]]||[]).push([e[0],k]);});return ADJ;}
function focusBranch(startIds){clearFocus();vp.classList.add('focus');
  const a=adj(),seen=new Set(),onE=new Set(),stack=[];
  startIds.forEach(s=>{if(s){seen.add(s);stack.push(s);}});
  while(stack.length){const cur=stack.pop();(a[cur]||[]).forEach(([nb,k])=>{onE.add(k);if(!seen.has(nb)){seen.add(nb);stack.push(nb);}});}
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
  if(id){focusBranch([id]);}                                   // клик по течению → вся ветвь
  else{const m=/^edge(\d+)$/.exec(el.id||'');if(m){focusBranch(D.edges[+m[1]]);}else{clearFocus();}}  // клик по стрелке → ветвь её концов
  e.stopPropagation();});
card.querySelector('.cl').addEventListener('click',hideCard);
addEventListener('keydown',e=>{if(e.key==='Escape')hideCard();});

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

/* ——— стартовый вид: у банта Реформации ——— */
function initView(){scale=clampScale(Math.min(availW()/CW, bounds().max));
  tx=LEFT+(availW()-CW*scale)/2 - CX0*scale; ty=TOPH+availH()*0.18 - D.bandY*scale; clampPan(); schedule();}
addEventListener('resize',()=>{clampPan();schedule();});
initView();
setTimeout(()=>{if(hint){hint.style.opacity='0';setTimeout(()=>hint.remove(),600);}},5500);
})();
