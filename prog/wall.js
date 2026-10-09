/* O Púlpito · papel de parede da janela de projeção (+ editor simples)
   Usado no palco (editor e prévia) e no projecao.html (exibição).
   O arquivo original fica no IndexedDB deste navegador; os ajustes ficam em localStorage
   e são aplicados ao vivo com CSS — assim GIF e MP4 continuam animados. */
(function(){
'use strict';
const W={};
const ACCEPT='image/png,image/jpeg,image/gif,image/webp,video/mp4,.png,.jpg,.jpeg,.gif,.webp,.mp4';
const DEF={fit:'cover',x:50,y:50,zoom:100,rot:0,fh:false,fv:false,
  bri:100,con:100,sat:100,hue:0,temp:0,blur:0,sepia:0,gray:0,inv:0,
  ovColor:'#000000',ov:0,ovMode:'solid',vig:0,
  txt:'',txFont:'sans',txSize:6,txColor:'#ffffff',txPos:'center',txShadow:true,
  preset:'original'};
const FILTER_KEYS=['bri','con','sat','hue','temp','blur','sepia','gray','inv'];
const PRESETS=[
  {id:'original',n:'Original',f:{}},
  {id:'vivo',n:'Vivo',f:{sat:150,con:112}},
  {id:'quente',n:'Quente',f:{temp:40,sat:115,bri:104}},
  {id:'frio',n:'Frio',f:{temp:-40,sat:92}},
  {id:'pb',n:'P&B',f:{gray:100,con:115}},
  {id:'sepia',n:'Sépia',f:{sepia:85,con:105}},
  {id:'vintage',n:'Vintage',f:{sepia:35,sat:80,con:90,bri:106,temp:22}},
  {id:'drama',n:'Dramático',f:{con:145,sat:118,bri:88}},
  {id:'suave',n:'Suave',f:{con:85,bri:110,sat:85,blur:1}},
  {id:'noite',n:'Noite',f:{bri:58,sat:70,temp:-32}},
  {id:'letra',n:'Fundo p/ letra',f:{blur:10,bri:70,sat:90}},
  {id:'sonho',n:'Sonho',f:{blur:3,bri:115,sat:120,hue:-12,con:92}}
];
const FONTS={sans:'Inter,ui-sans-serif,system-ui,"Segoe UI",Arial,sans-serif',serif:'Georgia,"Times New Roman",serif',
  script:'"Brush Script MT","Segoe Script","Lucida Handwriting",cursive',mono:'ui-monospace,Consolas,monospace',display:'Impact,"Arial Black",sans-serif'};
W.DEF=DEF;W.PRESETS=PRESETS;W.ACCEPT=ACCEPT;
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const norm=p=>Object.assign({},DEF,p||{});
const esc=s=>String(s==null?'':s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
W.okType=f=>/^(image\/(png|jpeg|gif|webp)|video\/mp4)$/.test(f.type)||/\.(png|jpe?g|gif|webp|mp4)$/i.test(f.name||'');
W.kindOf=f=>/^video\//.test(f.type)||/\.mp4$/i.test(f.name||'')?'video':'img';

/* ---------- armazenamento ---------- */
const K=slug=>(slug||'_')+':__wall', KM=slug=>'pf.wall.'+(slug||'_');
let dbp=null;
function idb(){if(dbp)return dbp;dbp=new Promise((res,rej)=>{const r=indexedDB.open('pf-files',1);r.onupgradeneeded=()=>r.result.createObjectStore('files');r.onsuccess=()=>res(r.result);r.onerror=()=>rej(r.error)});return dbp}
async function tx(mode,fn){const d=await idb();return new Promise((res,rej)=>{const t=d.transaction('files',mode),st=t.objectStore('files');let out;const r=fn(st);if(r)r.onsuccess=()=>{out=r.result};t.oncomplete=()=>res(out);t.onerror=()=>rej(t.error)})}
W.meta=slug=>{try{return JSON.parse(localStorage.getItem(KM(slug))||'null')}catch(e){return null}};
W.setMeta=(slug,m)=>{try{if(m)localStorage.setItem(KM(slug),JSON.stringify(m));else localStorage.removeItem(KM(slug))}catch(e){}};
W.metaKey=KM;
const urls={};
W.load=async slug=>{
  const m=W.meta(slug);if(!m)return null;
  const ck=K(slug)+'#'+m.fv;
  if(!urls[ck]){const b=await tx('readonly',st=>st.get(K(slug)));if(!b)return null;urls[ck]=URL.createObjectURL(b)}
  return {meta:m,url:urls[ck]};
};
W.save=async(slug,blob,meta)=>{if(blob)await tx('readwrite',st=>st.put(blob,K(slug)));W.setMeta(slug,meta)};
W.remove=async slug=>{try{await tx('readwrite',st=>st.delete(K(slug)))}catch(e){}W.setMeta(slug,null)};

/* ---------- desenho (CSS) ---------- */
W.css=`.wl{position:absolute;inset:0;overflow:hidden;background:#000;container-type:size}
.wl>.wl-m{position:absolute;left:50%;top:50%;width:100%;height:100%;max-width:none;max-height:none;transform-origin:50% 50%;will-change:filter}
.wl>.wl-l{position:absolute;inset:0;pointer-events:none}
.wl>.wl-tx{position:absolute;inset:0;display:flex;justify-content:center;padding:6% 7%;text-align:center;white-space:pre-wrap;line-height:1.18;pointer-events:none;overflow:hidden}
.wl>.wl-tx span{max-width:100%;overflow-wrap:anywhere}`;
function filterOf(p,scale){
  return `brightness(${p.bri}%) contrast(${p.con}%) saturate(${p.sat}%) hue-rotate(${p.hue}deg) sepia(${p.sepia}%) grayscale(${p.gray}%) invert(${p.inv}%)`+(p.blur?` blur(${(p.blur*scale).toFixed(2)}px)`:'');
}
W.filterOf=p=>filterOf(norm(p),1);
function injectCss(id,css){if(document.getElementById(id))return;const s=document.createElement('style');s.id=id;s.textContent=css;document.head.appendChild(s)}
/* desenha (ou atualiza) o papel de parede dentro de el */
W.render=(el,src,kind,p)=>{
  injectCss('pf-wall-css',W.css);
  p=norm(p);
  if(!el.classList.contains('wl'))el.classList.add('wl');
  let m=el.querySelector('.wl-m');
  if(!src){el.innerHTML='';el._src=null;return}
  if(el._src!==src||!m){
    el.innerHTML='';
    m=document.createElement(kind==='video'?'video':'img');m.className='wl-m';
    if(kind==='video'){m.muted=true;m.loop=true;m.autoplay=true;m.playsInline=true;m.setAttribute('muted','');m.src=src;m.play&&m.play().catch(()=>{})}
    else{m.src=src;m.alt='';m.decoding='async'}
    m.draggable=false;
    el.append(m);
    ['tmp','ov','vig'].forEach(k=>{const d=document.createElement('div');d.className='wl-l wl-'+k;el.append(d)});
    const t=document.createElement('div');t.className='wl-tx';t.innerHTML='<span></span>';el.append(t);
    el._src=src;
    if(!el._ro&&window.ResizeObserver){el._ro=new ResizeObserver(()=>el._p&&apply(el,el._p));el._ro.observe(el)}
  }
  el._p=p;apply(el,p);
};
function apply(el,p){
  const m=el.querySelector('.wl-m');if(!m)return;
  const w=el.clientWidth||1280,h=el.clientHeight||720,sc=w/1000;
  const side=p.rot%180!==0;
  m.style.width=(side?h:w)+'px';m.style.height=(side?w:h)+'px';
  m.style.objectFit=p.fit==='fill'?'fill':p.fit==='contain'?'contain':'cover';
  m.style.objectPosition=p.x+'% '+p.y+'%';
  const z=p.zoom/100;
  m.style.transform=`translate(-50%,-50%) rotate(${p.rot}deg) scale(${p.fh?-z:z},${p.fv?-z:z})`;
  m.style.filter=filterOf(p,sc);
  const tmp=el.querySelector('.wl-tmp');
  tmp.style.background=p.temp>0?`rgba(255,138,30,${p.temp/170})`:p.temp<0?`rgba(40,120,255,${-p.temp/170})`:'transparent';
  tmp.style.mixBlendMode='soft-light';
  const ov=el.querySelector('.wl-ov'),a=p.ov/100,c=hexA(p.ovColor,a);
  ov.style.background=!a?'transparent':p.ovMode==='baixo'?`linear-gradient(to top,${c} 0%,${hexA(p.ovColor,0)} 70%)`:p.ovMode==='cima'?`linear-gradient(to bottom,${c} 0%,${hexA(p.ovColor,0)} 70%)`:c;
  const vg=el.querySelector('.wl-vig');
  vg.style.background=p.vig?`radial-gradient(ellipse at center,rgba(0,0,0,0) ${Math.max(10,62-p.vig*0.4)}%,rgba(0,0,0,${(p.vig/100*0.95).toFixed(2)}) 100%)`:'transparent';
  const t=el.querySelector('.wl-tx'),sp=t.firstChild;
  sp.textContent=p.txt||'';t.style.display=p.txt?'flex':'none';
  t.style.alignItems=p.txPos==='top'?'flex-start':p.txPos==='bottom'?'flex-end':'center';
  sp.style.fontFamily=FONTS[p.txFont]||FONTS.sans;sp.style.fontWeight=p.txFont==='script'?'400':'800';
  sp.style.fontSize=(p.txSize*w/100).toFixed(1)+'px';sp.style.color=p.txColor;
  sp.style.textShadow=p.txShadow?`0 ${(.18*sc).toFixed(1)}em ${(.6*sc).toFixed(1)}em rgba(0,0,0,.55),0 0 ${(2*sc).toFixed(1)}px rgba(0,0,0,.6)`:'none';
}
function hexA(hex,a){const n=parseInt(String(hex||'#000').slice(1),16)||0;return `rgba(${n>>16&255},${n>>8&255},${n&255},${(+a).toFixed(3)})`}

/* ---------- degradês prontos (para quem não tem imagem) ---------- */
const GRADS=[['Noite','#0f172a','#1e3a8a','#0b1020'],['Aurora','#052e2b','#0f766e','#86efac'],['Pôr do sol','#3b0764','#be185d','#f59e0b'],['Céu','#0c4a6e','#38bdf8','#e0f2fe'],['Vinho','#1a0508','#7f1d1d','#3f0d12'],['Grafite','#0a0a0a','#27272a','#52525b']];
function gradBlob(g){return new Promise(res=>{const c=document.createElement('canvas');c.width=1920;c.height=1080;const x=c.getContext('2d');
  const l=x.createLinearGradient(0,0,1920,1080);l.addColorStop(0,g[1]);l.addColorStop(.55,g[2]);l.addColorStop(1,g[3]);x.fillStyle=l;x.fillRect(0,0,1920,1080);
  const r=x.createRadialGradient(1300,300,0,1300,300,900);r.addColorStop(0,'rgba(255,255,255,.18)');r.addColorStop(1,'rgba(255,255,255,0)');x.fillStyle=r;x.fillRect(0,0,1920,1080);
  c.toBlob(b=>res(b),'image/png')})}

/* ---------- editor ---------- */
const ED_CSS=`
.wp-ed{position:fixed;inset:0;z-index:900;display:flex;align-items:center;justify-content:center;padding:18px;background:rgba(3,5,8,.62);-webkit-backdrop-filter:blur(12px);backdrop-filter:blur(12px);font-family:var(--font,Inter,system-ui,sans-serif);color:#eef4f8}
.wp-card{width:min(1240px,100%);max-height:calc(100vh - 36px);display:grid;grid-template-columns:minmax(0,1fr) 340px;grid-template-rows:auto minmax(0,1fr) auto;border-radius:22px;overflow:hidden;
  border:1px solid rgba(255,255,255,.14);background:linear-gradient(180deg,rgba(255,255,255,.07),rgba(255,255,255,.02)),rgba(12,15,22,.94);box-shadow:0 40px 120px rgba(0,0,0,.6)}
.wp-hd{grid-column:1/-1;display:flex;align-items:center;gap:12px;padding:14px 18px;border-bottom:1px solid rgba(255,255,255,.08)}
.wp-hd h3{margin:0;font-size:16px;font-weight:800;flex:1}
.wp-hd small{color:#8a96a5;font-size:12px;font-weight:500;margin-left:8px}
.wp-x{width:36px;height:36px;border-radius:50%;border:1px solid rgba(255,255,255,.18);background:rgba(255,255,255,.06);color:#fff;font-size:20px;cursor:pointer}
.wp-main{padding:16px;display:flex;flex-direction:column;gap:12px;min-width:0;min-height:0;overflow:auto}
.wp-stage{position:relative;width:100%;aspect-ratio:16/9;border-radius:14px;overflow:hidden;background:#000;border:1px solid rgba(255,255,255,.12);cursor:grab;touch-action:none;
  background-image:linear-gradient(45deg,#111 25%,transparent 25%),linear-gradient(-45deg,#111 25%,transparent 25%),linear-gradient(45deg,transparent 75%,#111 75%),linear-gradient(-45deg,transparent 75%,#111 75%);background-size:22px 22px;background-position:0 0,0 11px,11px -11px,-11px 0}
.wp-stage.drag{cursor:grabbing}
.wp-stage .wp-hint{position:absolute;left:10px;bottom:10px;z-index:3;padding:5px 10px;border-radius:999px;background:rgba(0,0,0,.55);font-size:11px;color:#cfd8e2;pointer-events:none}
.wp-stage .wp-cmp{position:absolute;right:10px;top:10px;z-index:3}
.wp-drop{position:absolute;inset:0;z-index:4;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:12px;text-align:center;padding:20px;background:rgba(8,10,14,.92);border:2px dashed rgba(143,240,194,.35);border-radius:14px;cursor:default}
.wp-drop[hidden]{display:none}
.wp-drop.over{border-color:#8ff0c2;background:rgba(10,30,20,.92)}
.wp-drop b{font-size:17px}.wp-drop span{font-size:13px;color:#9aa6b4;max-width:440px;line-height:1.5}
.wp-grads{display:flex;flex-wrap:wrap;gap:8px;justify-content:center;margin-top:4px}
.wp-grad{width:74px;height:42px;border-radius:9px;border:1px solid rgba(255,255,255,.2);cursor:pointer;color:#fff;font:700 10px/1 inherit;display:flex;align-items:flex-end;justify-content:center;padding-bottom:5px;text-shadow:0 1px 3px #000}
.wp-row{display:flex;align-items:center;gap:8px;flex-wrap:wrap}
.wp-file{flex:1;min-width:0;font-size:12.5px;color:#9aa6b4;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.wp-file b{color:#eef4f8}
.wp-b{height:36px;padding:0 13px;border-radius:11px;border:1px solid rgba(255,255,255,.16);background:rgba(255,255,255,.07);color:#eef4f8;font:800 11px/1 inherit;letter-spacing:.8px;cursor:pointer;display:inline-flex;align-items:center;gap:6px;white-space:nowrap}
.wp-b:hover:not([disabled]){border-color:rgba(255,255,255,.35)}
.wp-b[hidden]{display:none}
.wp-b[disabled]{opacity:.35;cursor:default}
.wp-b.p{background:linear-gradient(180deg,rgba(255,255,255,.5),rgba(255,255,255,0) 60%),rgba(170,255,210,.9);color:#05140c;border-color:rgba(255,255,255,.5)}
.wp-b.d:hover{border-color:#f87171;color:#fca5a5}
.wp-b.on{background:rgba(143,240,194,.2);border-color:rgba(143,240,194,.6)}
.wp-b svg{width:15px;height:15px}
.wp-b:focus-visible,.wp-tab:focus-visible,.wp-pr:focus-visible{outline:2px solid #8ff0c2;outline-offset:2px}
.wp-side{border-left:1px solid rgba(255,255,255,.08);display:flex;flex-direction:column;min-height:0}
.wp-tabs{display:flex;gap:4px;padding:10px;border-bottom:1px solid rgba(255,255,255,.08);flex-wrap:wrap}
.wp-tab{flex:1 1 auto;height:32px;padding:0 9px;border-radius:9px;border:1px solid transparent;background:transparent;color:#9aa6b4;font:800 10.5px/1 inherit;letter-spacing:.8px;cursor:pointer}
.wp-tab.on{background:rgba(255,255,255,.09);border-color:rgba(255,255,255,.16);color:#fff}
.wp-pane{padding:14px;overflow:auto;flex:1;min-height:0}
.wp-pane[hidden]{display:none}
.wp-presets{display:grid;grid-template-columns:repeat(3,1fr);gap:8px}
.wp-pr{border:1px solid rgba(255,255,255,.12);background:rgba(255,255,255,.04);border-radius:11px;padding:4px;cursor:pointer;color:#cfd8e2;font:700 11px/1.2 inherit;text-align:center}
.wp-pr .wl-thumb{position:relative;aspect-ratio:16/10;border-radius:8px;overflow:hidden;margin-bottom:5px;background:#000}
.wp-pr .wl-thumb img,.wp-pr .wl-thumb .wl-sw{position:absolute;inset:0;width:100%;height:100%;object-fit:cover}
.wp-pr.on{border-color:#8ff0c2;background:rgba(143,240,194,.12);color:#fff}
.wp-sl{display:grid;grid-template-columns:1fr auto;gap:4px 10px;align-items:center;margin-bottom:12px}
.wp-sl label{font-size:12.5px;font-weight:600;color:#cfd8e2}
.wp-sl output{font:700 11.5px/1 ui-monospace,Consolas,monospace;color:#8ff0c2;min-width:44px;text-align:right}
.wp-sl input[type=range]{grid-column:1/-1;width:100%;accent-color:#8ff0c2;height:22px;margin:0}
.wp-h{font:800 10px/1 inherit;letter-spacing:1.6px;color:#8ff0c2;margin:4px 0 10px}
.wp-sep{height:1px;background:rgba(255,255,255,.08);margin:14px 0}
.wp-seg{display:flex;gap:6px;flex-wrap:wrap;margin-bottom:12px}
.wp-seg .wp-b{flex:1;justify-content:center}
.wp-ta{width:100%;min-height:74px;resize:vertical;border-radius:11px;border:1px solid rgba(255,255,255,.14);background:rgba(0,0,0,.3);color:#fff;padding:10px;font:600 14px/1.4 inherit;box-sizing:border-box;margin-bottom:12px}
.wp-in{display:flex;align-items:center;gap:10px;margin-bottom:12px;font-size:12.5px;color:#cfd8e2}
.wp-in select{flex:1;height:34px;border-radius:10px;border:1px solid rgba(255,255,255,.14);background:#0b0f15;color:#fff;padding:0 8px;font:600 13px inherit}
.wp-in input[type=color]{width:44px;height:32px;border:1px solid rgba(255,255,255,.2);border-radius:8px;background:none;padding:2px;cursor:pointer}
.wp-sw{display:flex;gap:6px;flex-wrap:wrap}
.wp-sw button{width:24px;height:24px;border-radius:50%;border:2px solid rgba(255,255,255,.25);cursor:pointer}
.wp-ft{grid-column:1/-1;display:flex;align-items:center;gap:10px;flex-wrap:wrap;padding:12px 18px;border-top:1px solid rgba(255,255,255,.08)}
.wp-ft label{display:flex;align-items:center;gap:8px;font-size:12.5px;color:#cfd8e2;flex:1;min-width:220px}
.wp-ft input{accent-color:#8ff0c2;width:17px;height:17px}
@media(max-width:860px){.wp-card{grid-template-columns:1fr;grid-template-rows:auto auto auto auto;overflow:auto}.wp-side{border-left:0;border-top:1px solid rgba(255,255,255,.08)}}
`;
const IC={
  undo:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 14 4 9l5-5"/><path d="M4 9h11a5 5 0 0 1 0 10h-3"/></svg>',
  redo:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="m15 14 5-5-5-5"/><path d="M20 9H9a5 5 0 0 0 0 10h3"/></svg>',
  rl:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5"/></svg>',
  rr:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12a9 9 0 1 1-3-6.7L21 8"/><path d="M21 3v5h-5"/></svg>',
  fh:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v18"/><path d="M8 7 3 12l5 5z"/><path d="m16 7 5 5-5 5z"/></svg>',
  fv:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12h18"/><path d="M7 8l5-5 5 5z"/><path d="m7 16 5 5 5-5z"/></svg>',
  up:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 15V3"/><path d="m7 8 5-5 5 5"/><path d="M5 21h14"/></svg>',
  eye:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/></svg>'
};
const SL={ // ajustes: [rótulo, min, max, unidade]
  bri:['Brilho',0,200,'%'],con:['Contraste',0,200,'%'],sat:['Saturação',0,250,'%'],temp:['Temperatura (frio ↔ quente)',-100,100,''],
  hue:['Matiz (cor)',-180,180,'°'],blur:['Desfoque',0,30,''],sepia:['Sépia',0,100,'%'],gray:['Preto e branco',0,100,'%'],inv:['Inverter cores',0,100,'%'],
  zoom:['Zoom',100,400,'%'],x:['Posição na horizontal',0,100,'%'],y:['Posição na vertical',0,100,'%'],
  ov:['Força da cor por cima',0,100,'%'],vig:['Vinheta (bordas escuras)',0,100,'%'],txSize:['Tamanho do texto',2,20,'']
};
function slider(k,v){const s=SL[k];return `<div class="wp-sl"><label for="wp_${k}">${s[0]}</label><output id="wpo_${k}">${v}${s[3]}</output><input type="range" id="wp_${k}" data-k="${k}" min="${s[1]}" max="${s[2]}" step="1" value="${v}" title="Dois cliques voltam ao normal"></div>`}

W.openEditor=(slug,onDone)=>{
  injectCss('pf-wall-css',W.css);injectCss('pf-wall-ed',ED_CSS);
  const old=W.meta(slug);
  const st={p:norm(old&&old.p),file:null,src:null,kind:old&&old.kind||'img',name:old&&old.name||'',size:old&&old.size||0,changedFile:false,letras:old?old.letras!==false:true,hist:[],fut:[],cmp:false};
  const d=document.createElement('div');d.className='wp-ed';d.setAttribute('role','dialog');d.setAttribute('aria-modal','true');d.setAttribute('aria-label','Papel de parede da projeção');
  d.innerHTML=`<div class="wp-card">
  <div class="wp-hd"><h3>Papel de parede da projeção<small>aparece no telão quando não tem nada passando</small></h3><button type="button" class="wp-x" data-a="x" aria-label="Fechar">×</button></div>
  <div class="wp-main">
    <div class="wp-stage" id="wpStage"><div class="wl" id="wpWall"></div><span class="wp-hint">Arraste para enquadrar · rodinha do mouse = zoom</span>
      <button type="button" class="wp-b wp-cmp" data-a="cmp" title="Segure para ver o original">${IC.eye}ORIGINAL</button>
      <div class="wp-drop" id="wpDrop" hidden><b>Escolha a imagem ou o vídeo do fundo</b><span>PNG, JPG, JPEG, GIF (animado) ou MP4 (toca sem som, em repetição). Clique no botão ou arraste o arquivo para cá.</span>
        <button type="button" class="wp-b p" data-a="pick">${IC.up}ESCOLHER ARQUIVO</button><span>ou comece de um degradê:</span><div class="wp-grads">${GRADS.map((g,i)=>`<button type="button" class="wp-grad" data-g="${i}" style="background:linear-gradient(135deg,${g[1]},${g[2]} 55%,${g[3]})">${g[0]}</button>`).join('')}</div></div>
    </div>
    <div class="wp-row"><span class="wp-file" id="wpFile"></span>
      <button type="button" class="wp-b" data-a="undo" title="Desfazer (Ctrl+Z)" aria-label="Desfazer">${IC.undo}</button><button type="button" class="wp-b" data-a="redo" title="Refazer (Ctrl+Y)" aria-label="Refazer">${IC.redo}</button>
      <button type="button" class="wp-b" data-a="reset" title="Volta todos os ajustes ao normal">RESTAURAR</button>
      <button type="button" class="wp-b" data-a="pick">${IC.up}TROCAR ARQUIVO</button><button type="button" class="wp-b d" data-a="del" ${old?'':'hidden'}>REMOVER</button></div>
    <input type="file" id="wpInput" accept="${ACCEPT}" hidden>
  </div>
  <div class="wp-side">
    <div class="wp-tabs" role="tablist">${[['f','FILTROS'],['a','AJUSTES'],['e','ENQUADRAR'],['c','CAMADAS'],['t','TEXTO']].map(([k,n],i)=>`<button type="button" role="tab" class="wp-tab${i?'':' on'}" data-tab="${k}" aria-selected="${!i}">${n}</button>`).join('')}</div>
    <div class="wp-pane" data-pane="f"><div class="wp-presets" id="wpPresets"></div></div>
    <div class="wp-pane" data-pane="a" hidden>${['bri','con','sat','temp','hue','blur','sepia','gray','inv'].map(k=>slider(k,st.p[k])).join('')}</div>
    <div class="wp-pane" data-pane="e" hidden>
      <div class="wp-h">ENCAIXE</div><div class="wp-seg">${[['cover','PREENCHER'],['contain','CABER'],['fill','ESTICAR']].map(([v,n])=>`<button type="button" class="wp-b" data-fit="${v}">${n}</button>`).join('')}</div>
      ${slider('zoom',st.p.zoom)}${slider('x',st.p.x)}${slider('y',st.p.y)}
      <div class="wp-h">GIRAR E ESPELHAR</div><div class="wp-seg"><button type="button" class="wp-b" data-a="rl" aria-label="Girar para a esquerda">${IC.rl}</button><button type="button" class="wp-b" data-a="rr" aria-label="Girar para a direita">${IC.rr}</button><button type="button" class="wp-b" data-a="fh" aria-label="Espelhar na horizontal">${IC.fh}</button><button type="button" class="wp-b" data-a="fv" aria-label="Espelhar na vertical">${IC.fv}</button></div>
      <button type="button" class="wp-b" data-a="center">CENTRALIZAR</button></div>
    <div class="wp-pane" data-pane="c" hidden>
      <div class="wp-h">COR POR CIMA</div><div class="wp-in">Cor <input type="color" id="wp_ovColor" value="${st.p.ovColor}"><div class="wp-sw">${['#000000','#ffffff','#0f172a','#7f1d1d','#14532d','#78350f'].map(c=>`<button type="button" data-ovc="${c}" style="background:${c}" aria-label="Cor ${c}"></button>`).join('')}</div></div>
      ${slider('ov',st.p.ov)}<div class="wp-seg">${[['solid','INTEIRA'],['baixo','DEGRADÊ ↑'],['cima','DEGRADÊ ↓']].map(([v,n])=>`<button type="button" class="wp-b" data-ovm="${v}">${n}</button>`).join('')}</div>
      <div class="wp-sep"></div>${slider('vig',st.p.vig)}
      <p style="font-size:12px;color:#8a96a5;line-height:1.5;margin:0">Dica: escureça um pouco (cor preta 30–50%) para as letras aparecerem bem por cima.</p></div>
    <div class="wp-pane" data-pane="t" hidden>
      <div class="wp-h">TEXTO NO FUNDO</div><textarea class="wp-ta" id="wp_txt" placeholder="Ex.: Bem-vindos! · Igreja … · Culto de domingo" maxlength="160">${esc(st.p.txt)}</textarea>
      <div class="wp-in">Fonte <select id="wp_txFont"><option value="sans">Moderna</option><option value="serif">Clássica</option><option value="script">Manuscrita</option><option value="display">Impacto</option><option value="mono">Máquina</option></select></div>
      ${slider('txSize',st.p.txSize)}
      <div class="wp-in">Cor <input type="color" id="wp_txColor" value="${st.p.txColor}"><label style="display:flex;gap:6px;align-items:center;margin-left:auto"><input type="checkbox" id="wp_txShadow"> sombra</label></div>
      <div class="wp-seg">${[['top','EM CIMA'],['center','NO MEIO'],['bottom','EMBAIXO']].map(([v,n])=>`<button type="button" class="wp-b" data-txp="${v}">${n}</button>`).join('')}</div></div>
  </div>
  <div class="wp-ft"><label><input type="checkbox" id="wp_letras"> Mostrar também atrás das letras (textos anexados)</label>
    <button type="button" class="wp-b" data-a="x">CANCELAR</button><button type="button" class="wp-b p" data-a="save">SALVAR E MOSTRAR NO TELÃO</button></div>
</div>`;
  document.body.appendChild(d);
  const $=s=>d.querySelector(s),wall=$('#wpWall'),stage=$('#wpStage'),drop=$('#wpDrop'),inp=$('#wpInput');
  $('#wp_letras').checked=st.letras;$('#wp_txFont').value=st.p.txFont;$('#wp_txShadow').checked=st.p.txShadow;
  const draw=()=>{W.render(wall,st.src,st.kind,st.cmp?Object.assign({},DEF,{fit:st.p.fit,x:st.p.x,y:st.p.y,zoom:st.p.zoom,rot:st.p.rot,fh:st.p.fh,fv:st.p.fv}):st.p);syncUi()};
  function syncUi(){
    for(const k in SL){const i=d.querySelector('#wp_'+k);if(i&&document.activeElement!==i){i.value=st.p[k]}const o=d.querySelector('#wpo_'+k);if(o)o.textContent=st.p[k]+SL[k][3]}
    d.querySelectorAll('[data-fit]').forEach(b=>b.classList.toggle('on',b.dataset.fit===st.p.fit));
    d.querySelectorAll('[data-ovm]').forEach(b=>b.classList.toggle('on',b.dataset.ovm===st.p.ovMode));
    d.querySelectorAll('[data-txp]').forEach(b=>b.classList.toggle('on',b.dataset.txp===st.p.txPos));
    d.querySelectorAll('[data-a=fh]').forEach(b=>b.classList.toggle('on',st.p.fh));d.querySelectorAll('[data-a=fv]').forEach(b=>b.classList.toggle('on',st.p.fv));
    d.querySelectorAll('.wp-pr').forEach(b=>b.classList.toggle('on',b.dataset.pr===st.p.preset));
    $('[data-a=undo]').disabled=!st.hist.length;$('[data-a=redo]').disabled=!st.fut.length;
    const ovc=$('#wp_ovColor');if(document.activeElement!==ovc)ovc.value=st.p.ovColor;const txc=$('#wp_txColor');if(document.activeElement!==txc)txc.value=st.p.txColor;
    $('#wpFile').innerHTML=st.src?`<b>${esc(st.name||'arquivo')}</b> · ${st.kind==='video'?'vídeo (sem som, repete)':/gif$/i.test(st.name)?'GIF':'imagem'}${st.size?' · '+(st.size<1048576?Math.max(1,Math.round(st.size/1024))+' KB':(st.size/1048576).toFixed(1)+' MB'):''}`:'nenhum arquivo ainda';
    drop.hidden=!!st.src;
  }
  /* histórico */
  let snapT=0;
  const snap=()=>{const j=JSON.stringify(st.p);if(st.hist[st.hist.length-1]===j)return;st.hist.push(j);if(st.hist.length>80)st.hist.shift();st.fut=[]};
  const begin=()=>{if(!snapT)snap();clearTimeout(snapT);snapT=setTimeout(()=>{snapT=0},500)};
  const set=(o,keepPreset)=>{begin();Object.assign(st.p,o);if(!keepPreset&&FILTER_KEYS.some(k=>k in o))st.p.preset='';draw()};
  const undo=()=>{if(!st.hist.length)return;st.fut.push(JSON.stringify(st.p));st.p=JSON.parse(st.hist.pop());draw();thumbs()};
  const redo=()=>{if(!st.fut.length)return;st.hist.push(JSON.stringify(st.p));st.p=JSON.parse(st.fut.pop());draw();thumbs()};
  /* miniaturas dos filtros prontos */
  let thumbSrc=null;
  function thumbs(){
    const box=$('#wpPresets');
    box.innerHTML=PRESETS.map(pr=>`<button type="button" class="wp-pr" data-pr="${pr.id}"><div class="wl-thumb">${thumbSrc?`<img src="${thumbSrc}" alt="" style="filter:${filterOf(norm(pr.f),.12)}">`:`<div class="wl-sw" style="background:linear-gradient(135deg,#334155,#64748b);filter:${filterOf(norm(pr.f),.12)}"></div>`}</div>${pr.n}</button>`).join('');
    syncUi();
  }
  async function makeThumb(){
    thumbSrc=null;
    if(!st.src){thumbs();return}
    if(st.kind!=='video'){thumbSrc=st.src;thumbs();return}
    const v=document.createElement('video');v.muted=true;v.src=st.src;v.playsInline=true;v.preload='auto';
    await new Promise(r=>{v.onloadeddata=r;v.onerror=r;setTimeout(r,4000)});
    try{v.currentTime=Math.min(1,(v.duration||2)/3);await new Promise(r=>{v.onseeked=r;setTimeout(r,1500)});
      const c=document.createElement('canvas');c.width=320;c.height=180;const x=c.getContext('2d');x.drawImage(v,0,0,320,180);thumbSrc=c.toDataURL('image/jpeg',.8)}catch(e){}
    thumbs();
  }
  /* arquivo */
  function useFile(f,name){
    if(!W.okType(f)){alertMsg('Esse tipo não serve. Use PNG, JPG, JPEG, GIF ou MP4.');return}
    if(f.size>400*1048576){alertMsg('Arquivo grande demais (máximo 400 MB).');return}
    if(st.src&&st.changedFile)URL.revokeObjectURL(st.src);
    st.file=f;st.kind=W.kindOf(f);st.name=name||f.name||'fundo';st.size=f.size;st.src=URL.createObjectURL(f);st.changedFile=true;
    snap();Object.assign(st.p,{x:50,y:50,zoom:100,rot:0,fh:false,fv:false});draw();makeThumb();
  }
  function alertMsg(t){const h=$('.wp-hint');h.textContent=t;h.style.color='#fca5a5';setTimeout(()=>{h.textContent='Arraste para enquadrar · rodinha do mouse = zoom';h.style.color=''},3500)}
  inp.onchange=()=>{if(inp.files[0])useFile(inp.files[0]);inp.value=''};
  ['dragenter','dragover'].forEach(ev=>stage.addEventListener(ev,e=>{e.preventDefault();e.stopPropagation();drop.classList.add('over')}));
  ['dragleave','drop'].forEach(ev=>stage.addEventListener(ev,e=>{e.preventDefault();e.stopPropagation();drop.classList.remove('over')}));
  stage.addEventListener('drop',e=>{const f=e.dataTransfer&&e.dataTransfer.files[0];if(f)useFile(f)});
  d.addEventListener('dragover',e=>{e.preventDefault();e.stopPropagation()});d.addEventListener('drop',e=>{e.preventDefault();e.stopPropagation()});
  /* arrastar para enquadrar + zoom com a rodinha */
  let drg=null;
  stage.addEventListener('pointerdown',e=>{if(!st.src||e.target.closest('button'))return;e.preventDefault();stage.setPointerCapture(e.pointerId);stage.classList.add('drag');begin();drg={x:e.clientX,y:e.clientY,px:st.p.x,py:st.p.y}});
  stage.addEventListener('pointermove',e=>{if(!drg)return;const r=stage.getBoundingClientRect(),k=100/Math.max(1,st.p.zoom/100)*1.4;
    const sx=st.p.fh?-1:1,sy=st.p.fv?-1:1;
    st.p.x=Math.round(clamp(drg.px-(e.clientX-drg.x)/r.width*k*sx,0,100));st.p.y=Math.round(clamp(drg.py-(e.clientY-drg.y)/r.height*k*sy,0,100));draw()});
  const endDrag=()=>{if(drg){drg=null;stage.classList.remove('drag')}};
  stage.addEventListener('pointerup',endDrag);stage.addEventListener('pointercancel',endDrag);
  stage.addEventListener('wheel',e=>{if(!st.src)return;e.preventDefault();set({zoom:Math.round(clamp(st.p.zoom-(e.deltaY>0?6:-6),100,400))},true)},{passive:false});
  /* sliders */
  d.addEventListener('input',e=>{
    const k=e.target.dataset&&e.target.dataset.k;
    if(k){set({[k]:+e.target.value},!FILTER_KEYS.includes(k));return}
    if(e.target.id==='wp_txt')set({txt:e.target.value},true);
    if(e.target.id==='wp_ovColor')set({ovColor:e.target.value,ov:st.p.ov||40},true);
    if(e.target.id==='wp_txColor')set({txColor:e.target.value},true);
  });
  d.addEventListener('change',e=>{
    if(e.target.id==='wp_txFont')set({txFont:e.target.value},true);
    if(e.target.id==='wp_txShadow')set({txShadow:e.target.checked},true);
    if(e.target.id==='wp_letras')st.letras=e.target.checked;
  });
  d.addEventListener('dblclick',e=>{const k=e.target.dataset&&e.target.dataset.k;if(k)set({[k]:DEF[k]},!FILTER_KEYS.includes(k))});
  /* botões */
  const close=()=>{document.removeEventListener('keydown',onKey,true);d.remove();if(st.src&&st.changedFile)setTimeout(()=>URL.revokeObjectURL(st.src),2000)};
  d.addEventListener('click',async e=>{
    const t=e.target.closest('[data-tab]');
    if(t){d.querySelectorAll('[data-tab]').forEach(b=>{const on=b===t;b.classList.toggle('on',on);b.setAttribute('aria-selected',on)});d.querySelectorAll('[data-pane]').forEach(p=>p.hidden=p.dataset.pane!==t.dataset.tab);return}
    const pr=e.target.closest('[data-pr]');
    if(pr){const P=PRESETS.find(x=>x.id===pr.dataset.pr);const f={};FILTER_KEYS.forEach(k=>f[k]=DEF[k]);Object.assign(f,P.f,{preset:P.id});set(f,true);return}
    const g=e.target.closest('[data-g]');
    if(g){const G=GRADS[+g.dataset.g];const b=await gradBlob(G);useFile(new File([b],'Degradê '+G[0]+'.png',{type:'image/png'}),'Degradê '+G[0]);return}
    const fit=e.target.closest('[data-fit]');if(fit){set({fit:fit.dataset.fit},true);return}
    const ovm=e.target.closest('[data-ovm]');if(ovm){set({ovMode:ovm.dataset.ovm,ov:st.p.ov||45},true);return}
    const ovc=e.target.closest('[data-ovc]');if(ovc){set({ovColor:ovc.dataset.ovc,ov:st.p.ov||40},true);return}
    const txp=e.target.closest('[data-txp]');if(txp){set({txPos:txp.dataset.txp},true);return}
    const a=e.target.closest('[data-a]');if(!a)return;
    switch(a.dataset.a){
      case 'x':return close();
      case 'pick':return inp.click();
      case 'undo':return undo();
      case 'redo':return redo();
      case 'reset':snap();st.p=norm({txt:st.p.txt,txFont:st.p.txFont,txSize:st.p.txSize,txColor:st.p.txColor,txPos:st.p.txPos,txShadow:st.p.txShadow});draw();return;
      case 'rl':return set({rot:(st.p.rot+270)%360},true);
      case 'rr':return set({rot:(st.p.rot+90)%360},true);
      case 'fh':return set({fh:!st.p.fh},true);
      case 'fv':return set({fv:!st.p.fv},true);
      case 'center':return set({x:50,y:50,zoom:100},true);
      case 'del':
        if(!confirmBox(a))return;
        await W.remove(slug);close();onDone&&onDone(null);return;
      case 'save':{
        if(!st.src){alertMsg('Escolha um arquivo primeiro.');return}
        a.disabled=true;a.textContent='SALVANDO…';
        try{
          const m={v:Date.now(),fv:st.changedFile?Date.now():(old&&old.fv)||Date.now(),kind:st.kind,name:st.name,size:st.size,p:st.p,letras:st.letras,on:true};
          await W.save(slug,st.changedFile?st.file:null,m);close();onDone&&onDone(m);
        }catch(err){a.disabled=false;a.textContent='SALVAR E MOSTRAR NO TELÃO';alertMsg('Não deu para salvar: '+(err.message||err))}
        return}
    }
  });
  function confirmBox(btn){if(btn.dataset.sure){return true}btn.dataset.sure='1';btn.textContent='CLIQUE DE NOVO PARA REMOVER';setTimeout(()=>{if(btn.isConnected){delete btn.dataset.sure;btn.textContent='REMOVER'}},3000);return false}
  const cmp=$('[data-a=cmp]');
  const cmpOn=v=>{st.cmp=v;draw()};
  cmp.addEventListener('pointerdown',e=>{e.stopPropagation();cmpOn(true)});['pointerup','pointerleave'].forEach(ev=>cmp.addEventListener(ev,()=>st.cmp&&cmpOn(false)));
  function onKey(e){
    if(e.key==='Escape'){e.preventDefault();e.stopPropagation();close();return}
    const tg=e.target.tagName;if(tg==='TEXTAREA'||(tg==='INPUT'&&e.target.type!=='range'))return e.stopPropagation();
    if((e.ctrlKey||e.metaKey)&&(e.key==='z'||e.key==='Z')){e.preventDefault();e.shiftKey?redo():undo()}
    else if((e.ctrlKey||e.metaKey)&&(e.key==='y'||e.key==='Y')){e.preventDefault();redo()}
    e.stopPropagation();
  }
  document.addEventListener('keydown',onKey,true);
  /* abre com o fundo atual */
  (async()=>{
    if(old){try{const L=await W.load(slug);if(L){st.src=L.url;st.kind=L.meta.kind}}catch(e){}}
    draw();makeThumb();
    setTimeout(()=>($('[data-a=pick]')||$('[data-a=save]')).focus(),50);
  })();
  return d;
};
window.PFWall=W;
})();
