/* O Púlpito · aba Programação do palco */
(function(){
'use strict';
const C=window.PFCore;
const $=id=>document.getElementById(id);
let sess=null,P=null,cfg=null,editing=null,lastLive=null,client=null,comments={v:1,list:[],del:[]},pubTimer=0,lastRows='';
const DEF_CFG={acao:'auto',aviso:5,rolar:true,duck:true,lastDur:30,perguntarFim:true,seguir:false};
let lastSave=0;
const K=()=> 'pf.prog.'+sess.slug, KC=()=> 'pf.cfg.'+sess.slug, KL=()=> 'pf.live.'+sess.slug;

/* ---------------- arquivos (IndexedDB) ---------------- */
let dbp=null;
function idb(){
  if(dbp)return dbp;
  dbp=new Promise((res,rej)=>{const r=indexedDB.open('pf-files',1);r.onupgradeneeded=()=>r.result.createObjectStore('files');r.onsuccess=()=>res(r.result);r.onerror=()=>rej(r.error)});
  return dbp;
}
async function fput(k,blob){const d=await idb();return new Promise((res,rej)=>{const t=d.transaction('files','readwrite');t.objectStore('files').put(blob,k);t.oncomplete=res;t.onerror=()=>rej(t.error)})}
async function fget(k){const d=await idb();return new Promise((res,rej)=>{const r=d.transaction('files').objectStore('files').get(k);r.onsuccess=()=>res(r.result);r.onerror=()=>rej(r.error)})}
async function fdel(k){const d=await idb();return new Promise(res=>{const t=d.transaction('files','readwrite');t.objectStore('files').delete(k);t.oncomplete=res;t.onerror=res})}
const urlCache={};
async function urlOf(a){
  if(a.url)return a.url;
  if(urlCache[a.id])return urlCache[a.id];
  const b=await fget(sess.slug+':'+a.id);if(!b)throw new Error('arquivo não encontrado neste computador');
  return urlCache[a.id]=URL.createObjectURL(b);
}

/* ---------------- dados ---------------- */
function hoje(){const d=new Date();return d.getFullYear()+'-'+C.pad(d.getMonth()+1)+'-'+C.pad(d.getDate())}
function exemplo(){
  const n=Math.floor(C.nowMin()),ini=Math.round((n-20)/5)*5;
  return {id:C.uid(8),titulo:'Culto de domingo',data:hoje(),exemplo:true,auto:true,anexos:{},pub:null,items:C.fromModelo('domingo',C.fmt(ini))};
}
function guessTipo(t){
  t=String(t||'').toLowerCase();
  return /louv|m[uú]sic|canto|hino|adora/.test(t)?'louvor':/ora[cç]/.test(t)?'oracao':/prega|mensagem|palavra|serm/.test(t)?'palavra':
    /leitura|salmo|vers/.test(t)?'leitura':/aviso|acolhida|boas/.test(t)?'avisos':/oferta|d[ií]zimo/.test(t)?'oferta':/ceia/.test(t)?'ceia':
    /batism/.test(t)?'batismo':/interval|caf[eé]/.test(t)?'intervalo':'outro';
}
const ordered=()=>P.auto?P.items:C.sorted(P.items);
function normalize(){
  if(P.auto){const f=P.items.find(i=>C.toMin(i.hora)!=null);C.cascade(P.items,f?C.toMin(f.hora):Math.ceil(C.nowMin()/5)*5)}
  else P.items=C.sorted(P.items);
}
function proxDomingo(){const d=new Date();d.setDate(d.getDate()+((7-d.getDay())%7));return d.getFullYear()+'-'+C.pad(d.getMonth()+1)+'-'+C.pad(d.getDate())}
function load(){
  try{P=JSON.parse(localStorage.getItem(K()))}catch(e){P=null}
  if(!P||!Array.isArray(P.items))P=exemplo();
  P.anexos=P.anexos||{};
  if(P.auto==null)P.auto=false;
  P.items.forEach(i=>{if(!i.tipo)i.tipo=guessTipo(i.titulo)});
  try{cfg=Object.assign({},DEF_CFG,JSON.parse(localStorage.getItem(KC())||'{}'))}catch(e){cfg=Object.assign({},DEF_CFG)}
}
function save(){
  lastSave=Date.now();
  try{localStorage.setItem(K(),JSON.stringify(P))}catch(e){toast('Não deu para salvar (espaço cheio?)')}
  schedulePublish();
}
function saveCfg(){try{localStorage.setItem(KC(),JSON.stringify(cfg))}catch(e){}}
const toast=m=>{try{window.PF&&PF.toast?PF.toast(m):console.log(m)}catch(e){}};
const byName=()=>C.byName(P.anexos);
function uniqueName(n){
  n=C.cleanName(n);const has=x=>Object.values(P.anexos).some(a=>a.nome.toLowerCase()===x.toLowerCase());
  if(!has(n))return n;let i=2;while(has(n+i))i++;return n+i;
}

/* ---------------- montagem ---------------- */
function mount(){
  const host=$('panel-prog');
  host.innerHTML=`
  <div class="pg-wrap" id="pgWrap">
    <header class="pg-head">
      <div class="pg-titles">
        <input class="pg-title" id="pgTitle" aria-label="Título da programação" maxlength="80">
        <div class="pg-sub"><input type="date" id="pgDate" aria-label="Data"><span class="pg-church" id="pgChurch"></span></div>
      </div>
      <div class="pg-clock" aria-live="off"><span>AGORA</span><b id="pgNow">--:--</b></div>
      <div class="pg-actions">
        <button class="pg-btn pg-help" id="pgHelp" type="button" aria-label="Como funciona esta aba" title="Como funciona">?</button>
        <button class="pg-btn" id="pgModelos" type="button">MODELOS</button>
        <button class="pg-btn primary" id="pgAdd" type="button">+ MOMENTO</button>
        <button class="pg-btn" id="pgAttach" type="button">ANEXAR</button>
        <div class="pg-menu-wrap"><button class="pg-btn" id="pgExportBtn" type="button" aria-haspopup="menu" aria-expanded="false">EXPORTAR ▾</button>
          <div class="pg-menu" id="pgExportMenu" role="menu" hidden>
            <div class="pg-menu-h">IMAGEM</div>
            <button role="menuitem" data-x="pdf">PDF</button><button role="menuitem" data-x="jpeg">JPEG</button>
            <div class="pg-menu-h">SITE</div>
            <button role="menuitem" data-x="site">Site · só a programação, passando sozinha</button>
            <button role="menuitem" data-x="edit">Site editável · com comentários e arquivos</button>
          </div></div>
      </div>
    </header>
    <div class="pg-banner" id="pgExample" hidden>Este é um <b>exemplo</b> com horários perto de agora, para você ver as cores mudando. Edite à vontade, <button type="button" id="pgNew">comece de um modelo</button> ou <button type="button" id="pgTour2">veja como funciona</button>.</div>
    <section class="pg-sum" id="pgSum" aria-label="Resumo do culto"></section>
    <section class="pg-clock-card" id="pgClock" aria-label="Relógio do momento atual" hidden></section>
    <div class="pg-legend" aria-label="Legenda">
      ${['noar','prestes','agendado','passou','ignorado'].map(k=>`<span><i class="pg-dot st-${k}"></i>${C.STATES[k].label}</span>`).join('')}
      <span class="pg-sp"></span>
      <label class="pg-switch" id="pgCascade" title="Ligado: você informa só a duração de cada momento e os horários se ajustam sozinhos"><input type="checkbox" id="pgAuto" role="switch"><i aria-hidden="true"></i><span>Horários automáticos</span></label>
    </div>
    <div class="pg-body">
      <main class="pg-list" id="pgList" aria-label="Momentos da programação"></main>
      <aside class="pg-side">
        <section class="pg-box" id="pgPlayer" hidden>
          <h3>TOCANDO</h3>
          <div class="pg-pl"><b id="pgPlName">—</b><audio id="pgAudio" controls preload="auto"></audio>
          <button class="pg-btn sm" id="pgPlStop" type="button">PARAR</button></div>
        </section>
        <section class="pg-box pg-lib" id="pgLibBox">
          <h3>ANEXOS <span id="pgLibN">0</span></h3>
          <div id="pgLib" class="pg-lib-list"></div>
          <div class="pg-drophint">Arraste arquivos para qualquer lugar desta aba, ou digite <b>@</b> no texto de um momento.</div>
          <div class="pg-lib-add"><button class="pg-btn sm" id="pgAddLink" type="button">+ CANVA / YOUTUBE</button><button class="pg-btn sm" id="pgAddText" type="button">+ TEXTO</button></div>
        </section>
        <section class="pg-box" id="pgPubBox" hidden>
          <h3>PUBLICADO</h3><div id="pgPubInfo"></div>
        </section>
        <section class="pg-box" id="pgCmtBox" hidden>
          <h3>COMENTÁRIOS <span id="pgCmtN">0</span></h3><div id="pgCmts" class="pg-cmts"></div>
        </section>
      </aside>
    </div>
    <div class="pg-drop" id="pgDrop" aria-hidden="true"><div>Solte para anexar<small id="pgDropT">à biblioteca</small></div></div>
    <div class="pg-ac" id="pgAc" role="listbox" hidden></div>
    <input type="file" id="pgFile" multiple hidden>
  </div>`;
  // media no palco do slide
  const area=document.querySelector('#panel-slide .sl-area');
  if(area&&!$('pfMedia')){const m=document.createElement('div');m.id='pfMedia';m.className='pf-media';m.hidden=true;area.appendChild(m)}
  wire();
}

/* ---------------- render ---------------- */
function render(){
  $('pgTitle').value=P.titulo||'';$('pgDate').value=P.data||'';
  $('pgChurch').textContent=sess.nome;
  $('pgExample').hidden=!P.exemplo;
  const list=$('pgList');
  const items=ordered();
  const bn=byName();
  $('pgAuto').checked=!!P.auto;
  list.innerHTML=items.map(it=>it.id===editing?editHTML(it):rowHTML(it,bn)).join('')+
    `<button class="pg-addrow" type="button" id="pgAdd2">+ adicionar momento</button><div class="pg-now" id="pgNowLine" hidden><span id="pgNowLbl"></span></div>`;
  $('pgAdd2').onclick=addItem;
  renderLib();renderPub();renderComments();
  tick(true);
  if(editing){const f=list.querySelector('.pg-edit [name=titulo]');if(f&&!f.value)f.focus()}
}
function rowHTML(it,bn){
  const an=C.mentions(it.texto).map(n=>bn[n]).filter(Boolean),t=C.tipo(it.tipo);
  return `<article class="pg-item" data-id="${it.id}" tabindex="0" title="Clique para editar · arraste para mudar a ordem" style="--c:${t.color}" aria-label="${C.esc((it.hora||'sem hora')+' '+t.label+' '+it.titulo)}">
    <div class="pg-time"><b>${C.esc(it.hora||'--:--')}</b><small class="pg-until"></small></div>
    <div class="pg-rail"><span class="pg-dot"></span></div>
    <div class="pg-card">
      <div class="pg-top"><span class="pg-grip" aria-hidden="true" title="Arraste para mudar a ordem">⠿</span><span class="pg-tipo">${C.tipoIcon(it.tipo)}${t.label}</span><span class="pg-badge"></span>
        <span class="pg-acts"><button type="button" class="pg-tool" data-act="ign" title="${it.estado==='ignorado'?'Volta a contar este momento':'Pula este momento (fica preto)'}">${it.estado==='ignorado'?'REATIVAR':'IGNORAR'}</button><button type="button" class="pg-tool" data-act="edit">EDITAR</button></span></div>
      <h4>${C.esc(it.titulo||'(sem título)')}${+it.dur>0?`<small class="pg-dur">${C.dur(+it.dur)}</small>`:''}</h4>
      ${it.texto?`<div class="pg-text">${C.renderText(it.texto,bn)}</div>`:''}
      <div class="pg-bar"><i></i></div>
      ${an.length?`<div class="pg-tools">${an.slice(0,4).map(a=>`<button type="button" class="pg-use" data-use="${a.id}" title="Mostrar/tocar agora no palco">▶ ${C.esc(a.nome)}</button>`).join('')}</div>`:''}
    </div></article>`;
}
function editHTML(it){
  const first=ordered()[0]===it,ro=P.auto&&!first;
  return `<article class="pg-item editing" data-id="${it.id}" style="--c:${C.tipo(it.tipo).color}">
    <div class="pg-time">${ro?`<b>${C.esc(it.hora)}</b><small>automático</small>`:`<input type="time" name="hora" value="${C.esc(it.hora)}" aria-label="${P.auto?'Horário de início do culto':'Horário'}">${P.auto?'<small>início do culto</small>':''}`}</div>
    <div class="pg-rail"><span class="pg-dot"></span></div>
    <form class="pg-card pg-edit" autocomplete="off">
      <div class="pg-tipos" role="radiogroup" aria-label="Tipo de momento">${Object.entries(C.TIPOS).map(([k,t])=>`<label class="pg-tp" style="--c:${t.color}"><input type="radio" name="tipo" value="${k}" ${it.tipo===k?'checked':''}>${C.tipoIcon(k)}<span>${t.label}</span></label>`).join('')}</div>
      <input name="titulo" value="${C.esc(it.titulo)}" placeholder="Nome do momento (ex.: Louvor de abertura, Pregação, Santa Ceia)" aria-label="Nome do momento" maxlength="80">
      <div class="pg-ta-wrap"><textarea name="texto" rows="3" placeholder="O que vai acontecer, quem conduz… (opcional)" aria-label="Descrição">${C.esc(it.texto)}</textarea></div>
      <div class="pg-tip">Dica: digite <b>@</b> no texto para anexar slide do Canva, vídeo do YouTube, imagem, vídeo, música ou letra — ou arraste o arquivo para cá.</div>
      <div class="pg-edit-row">
        <label>Duração <input type="number" name="dur" min="1" max="600" value="${C.esc(it.dur)}" placeholder="${P.auto?'10':'auto'}" ${P.auto?'required':''}> min</label>
        <span class="pg-sp"></span>
        <button type="button" class="pg-tool danger" data-act="del">EXCLUIR</button>
        <button type="button" class="pg-tool" data-act="ign">${it.estado==='ignorado'?'REATIVAR':'IGNORAR'}</button>
        <button type="submit" class="pg-btn primary sm">CONCLUIR</button>
      </div>
    </form></article>`;
}
function renderLib(){
  const arr=Object.values(P.anexos).sort((a,b)=>a.nome.localeCompare(b.nome));
  $('pgLibN').textContent=arr.length;
  $('pgLib').innerHTML=arr.length?arr.map(a=>`<div class="pg-lib-it k-${a.kind}">
      <button type="button" class="pf-chip k-${a.kind}" data-anexo="${a.id}">${C.icon(a.kind)}@${C.esc(a.nome)}</button>
      <small>${C.esc(C.KIND_LABEL[a.kind]||'')} ${C.size(a.size)}</small>
      <button type="button" class="pg-mini" data-use="${a.id}" title="Usar agora" aria-label="Usar @${C.esc(a.nome)} agora">▶</button>
    </div>`).join(''):'<div class="pg-empty">Nenhum anexo ainda.</div>';
}

/* estados / linha do agora: roda a cada 10 s sem refazer a lista */
function tick(force){
  if(!P)return;
  const st=C.compute(P.items,{aviso:cfg.aviso,lastDur:cfg.lastDur,data:P.data});
  renderSummary(st);
  $('pgNow').textContent=C.fmt(Math.floor(st.now));
  document.querySelectorAll('#pgList .pg-item').forEach(el=>{
    const s=st.map[el.dataset.id];if(!s)return;
    el.className=el.className.replace(/\bst-\w+/g,'').trim()+' st-'+s.state;
    const b=el.querySelector('.pg-badge');
    if(b){
      let t='';
      if(s.state==='noar')t='NO AR · faltam '+Math.max(1,Math.ceil(s.end-st.now))+' min';
      else if(s.state==='prestes')t='EM '+Math.max(1,Math.ceil(s.inMin))+' MIN';
      else if(s.state==='ignorado')t='IGNORADO';
      else if(s.state==='passou')t=st.dayDiff<0?'':'FEITO';
      b.textContent=t;
    }
    const u=el.querySelector('.pg-until');if(u)u.textContent=s.end!=null?'até '+C.fmt(s.end):'';
    const bar=el.querySelector('.pg-bar i');if(bar)bar.style.width=Math.round(s.progress*100)+'%';
  });
  // linha do "agora" entre os itens
  const line=$('pgNowLine');
  if(line){
    const items=(st.dayDiff===0?ordered():[]).filter(i=>C.toMin(i.hora)!=null);
    const els=items.map(i=>document.querySelector('#pgList .pg-item[data-id="'+i.id+'"]'));
    let top=null;
    for(let i=0;i<items.length;i++){
      const a=C.toMin(items[i].hora),b=i+1<items.length?C.toMin(items[i+1].hora):st.map[items[i].id].end;
      if(st.now>=a&&st.now<b&&els[i]){
        const y1=els[i].offsetTop+12,y2=i+1<items.length&&els[i+1]?els[i+1].offsetTop+12:els[i].offsetTop+els[i].offsetHeight;
        top=y1+(y2-y1)*((st.now-a)/Math.max(1e-6,b-a));break;
      }
    }
    if(top==null&&items.length&&els[0]&&st.now<C.toMin(items[0].hora))top=els[0].offsetTop-6;
    line.hidden=top==null;if(top!=null){line.style.top=top+'px';$('pgNowLbl').textContent='agora '+C.fmt(Math.floor(st.now))}
  }
  // aba
  const tab=$('tab-prog'),meta=$('tsProgMeta');
  if(tab){tab.classList.toggle('pg-live',!!st.live);tab.classList.toggle('pg-soon',!st.live&&!!st.next&&st.map[st.next.id].state==='prestes')}
  if(meta)meta.textContent=st.live?st.live.titulo:(st.next?'próx. '+st.next.hora:'—');
  // auto-rolagem até o item no ar
  if(cfg.rolar&&st.live&&!editing&&document.body.classList.contains('tab-prog')&&(force||st.live.id!==tick._lastScroll)){
    const el=document.querySelector('#pgList .pg-item[data-id="'+st.live.id+'"]');
    if(el&&!force){el.scrollIntoView({block:'center',behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth'})}
    tick._lastScroll=st.live.id;
  }
  // entrou no ar?
  renderClock(st);
  const liveId=st.live?st.live.id:null;
  if(liveId!==lastLive){
    const prev=lastLive;lastLive=liveId;
    let stored=null;try{stored=localStorage.getItem(KL())}catch(e){}
    const novo=liveId&&stored!==hoje()+':'+liveId;
    if(novo)try{localStorage.setItem(KL(),hoje()+':'+liveId)}catch(e){}
    // o momento anterior acabou pelo relógio (e não por um clique)? pergunta "Acabou?"
    const pi=prev&&P.items.find(i=>i.id===prev),ps=pi&&st.map[pi.id];
    const natural=pi&&ps&&ps.state==='passou'&&st.now-ps.end<3&&Date.now()-lastSave>2500;
    if(natural&&cfg.perguntarFim&&st.dayDiff===0){askEnd(pi,novo?st.live:null);return}
    if(novo&&prev!==undefined)onLive(st.live);
  }
}
/* ---------------- relógio do momento atual + "Acabou?" ---------------- */
const mmss=sec=>{sec=Math.max(0,Math.round(sec));const h=Math.floor(sec/3600),m=Math.floor(sec%3600/60),x=sec%60;return (h?h+':'+C.pad(m):m)+':'+C.pad(x)};
const falta=sec=>{sec=Math.max(0,Math.round(sec));if(sec<60)return sec+' s';const m=Math.ceil(sec/60);return m<60?m+' min':Math.floor(m/60)+'h'+(m%60?' '+C.pad(m%60):'')};
const nowSec=()=>{const d=new Date();return d.getHours()*3600+d.getMinutes()*60+d.getSeconds()+d.getMilliseconds()/1000};
function curState(){return C.compute(P.items,{aviso:cfg.aviso,lastDur:cfg.lastDur,data:P.data})}
function renderClock(st){
  const box=$('pgClock');if(!box)return;
  const live=st.dayDiff===0?st.live:null;
  renderMini(st);
  if(!live){
    const items=ordered().filter(i=>C.toMin(i.hora)!=null&&i.estado!=='ignorado');
    if(!items.length){box.hidden=true;box._id=null;return}
    box.hidden=false;box.classList.remove('over','soon');box.style.setProperty('--c','#64748b');
    const nx=st.dayDiff===0&&st.next,key='idle|'+(nx?nx.id+nx.hora:'')+st.dayDiff;
    if(box._id!==key){box._id=key;
      box.innerHTML=`<div class="pg-ck-l"><small>RELÓGIO DO MOMENTO</small><b>${nx?'Próximo: '+C.esc(nx.titulo||C.tipo(nx.tipo).label):st.dayDiff>0?'O culto ainda não chegou':st.dayDiff<0?'Esta programação já aconteceu':'Nenhum momento no ar'}</b>
        <span class="pg-ck-plan">${nx?'começa às '+C.esc(nx.hora):st.dayDiff>0?'daqui a '+st.dayDiff+' dia'+(st.dayDiff>1?'s':''):'o relógio liga sozinho quando um momento começar'}</span></div>
        <div class="pg-ck-mid"><span class="pg-ck-time idle" data-next="${nx?C.toMin(nx.hora):''}">${nx?'':'--:--'}</span><span class="pg-ck-sub">${nx?'para começar':''}</span></div><div class="pg-ck-b"></div>`}
    const t=box.querySelector('.pg-ck-time[data-next]');if(t&&t.dataset.next)t.textContent=falta(+t.dataset.next*60-nowSec());
    return;
  }
  const s=st.map[live.id],t=C.tipo(live.tipo);
  box.hidden=false;box.style.setProperty('--c',t.color);
  if(box._id!==live.id+'|'+s.start+'|'+s.end){
    box._id=live.id+'|'+s.start+'|'+s.end;
    box.innerHTML=`<div class="pg-ck-l"><small>${C.tipoIcon(live.tipo)}${t.label} · AGORA</small><b>${C.esc(live.titulo||t.label)}</b>
        <span class="pg-ck-plan">${C.fmt(s.start)} – ${C.fmt(s.end)} · previsto ${C.dur(s.end-s.start)}</span></div>
      <div class="pg-ck-mid"><span class="pg-ck-time" aria-live="off"></span><span class="pg-ck-sub"></span></div>
      <div class="pg-ck-b"><button type="button" class="pg-btn sm" data-ck="atrasar" title="Dar mais tempo a este momento ou atrasar a programação">ATRASAR…</button>
        <button type="button" class="pg-btn sm primary" data-ck="fim" title="Este momento acabou: começa o próximo agora">TERMINOU ▸</button></div>
      <div class="pg-ck-bar"><i></i></div>`;
  }
  tickClock();
}
function tickClock(){
  const box=$('pgClock');if(!box)return;
  const st=curState(),live=st.live;
  renderMini(st);
  if(!live||st.dayDiff!==0){const t=box.querySelector('.pg-ck-time[data-next]');if(t&&t.dataset.next)t.textContent=falta(+t.dataset.next*60-nowSec());return}
  if(box.hidden)return;
  const s=st.map[live.id],ns=nowSec(),el=ns-s.start*60,tot=(s.end-s.start)*60,rest=tot-el;
  box.querySelector('.pg-ck-time').textContent=mmss(el);
  const sub=box.querySelector('.pg-ck-sub');
  sub.textContent=rest>=0?'faltam '+mmss(rest):'+'+mmss(-rest)+' além do previsto';
  box.classList.toggle('over',rest<0);box.classList.toggle('soon',rest>=0&&rest<=60);
  box.querySelector('.pg-ck-bar i').style.width=Math.min(100,el/Math.max(1,tot)*100)+'%';
}
/* relógio pequeno nas outras abas (Fundo e Projeção) */
function renderMini(st){
  let m=$('pfMini');
  if(!m){m=document.createElement('button');m.type='button';m.id='pfMini';m.className='pf-mini';m.title='Abrir a Programação';
    m.onclick=()=>PF.setTab('prog');document.body.appendChild(m)}
  const live=st.dayDiff===0?st.live:null,nx=st.dayDiff===0&&!live&&st.next;
  const show=!document.body.classList.contains('tab-prog')&&(live||(nx&&C.toMin(nx.hora)-st.now<=120));
  m.hidden=!show;if(!show)return;
  if(live){const s=st.map[live.id],t=C.tipo(live.tipo),el=nowSec()-s.start*60,rest=(s.end-s.start)*60-el;
    m.style.setProperty('--c',t.color);m.classList.toggle('over',rest<0);
    m.innerHTML=`<i></i><span class="pm-t">${C.esc(live.titulo||t.label)}</span><b>${mmss(el)}</b><span class="pm-r">${rest>=0?'faltam '+mmss(rest):'+'+mmss(-rest)}</span>`;
  }else{m.style.setProperty('--c','#93c5fd');m.classList.remove('over');
    m.innerHTML=`<i></i><span class="pm-t">Próximo: ${C.esc(nx.titulo||'')}</span><b>em ${falta(C.toMin(nx.hora)*60-nowSec())}</b><span class="pm-r">às ${C.esc(nx.hora)}</span>`}
}
/* tela "Acabou?" — só este cartão fica visível */
let ask=null;
function askEnd(item,pendingLive){
  if(ask&&ask.id===item.id)return;
  closeAsk();
  ask={id:item.id,pending:pendingLive};
  const slide=document.body.classList.contains('tab-slide');
  if(slide){ // na Projeção não tira a tela: só um aviso discreto
    const b=document.createElement('div');b.className='pg-ask-mini';b.id='pgAskMini';b.setAttribute('role','status');
    b.innerHTML=`<span>⏱ O tempo de <b>${C.esc(item.titulo||'momento')}</b> acabou</span><button type="button" class="pg-btn sm primary">RESPONDER</button>`;
    b.querySelector('button').onclick=()=>{b.remove();PF.setTab('prog');openFocus()};
    document.body.appendChild(b);ask.mini=b;
    return;
  }
  try{const a=document.getElementById('pe-app');if(a&&a.classList.contains('pe-open')&&window.PF)document.getElementById('pe-switchBtn').click()}catch(e){}
  if(!document.body.classList.contains('tab-prog'))PF.setTab('prog');
  openFocus();
}
function openFocus(view){
  if(!ask)return;
  const item=P.items.find(i=>i.id===ask.id);if(!item){closeAsk();return}
  const st=curState(),s=st.map[item.id],t=C.tipo(item.tipo),nx=nextAfter(item);
  let f=$('pgFocus');
  if(!f){f=document.createElement('div');f.id='pgFocus';f.className='pg-focus';f.setAttribute('role','alertdialog');f.setAttribute('aria-modal','true');f.setAttribute('aria-labelledby','pgFocQ');document.body.appendChild(f)}
  f.style.setProperty('--c',t.color);
  const main=`<p class="pg-fc-q" id="pgFocQ">Acabou?</p>
      <div class="pg-fc-btns">
        <button type="button" class="pg-btn primary big" data-fc="sim">SIM${nx?' — COMEÇAR '+C.esc((nx.titulo||C.tipo(nx.tipo).label).toUpperCase()):''} ▸</button>
        <button type="button" class="pg-btn big" data-fc="este">ATRASAR ESTE MOMENTO</button>
        <button type="button" class="pg-btn big" data-fc="tudo">ATRASAR TODA A PROGRAMAÇÃO</button>
      </div>
      <p class="pg-fc-help">Esc fecha e pergunta de novo depois · você pode desligar esta pergunta nas Configurações</p>`;
  const delay=v=>`<p class="pg-fc-q" id="pgFocQ">${v==='este'?'Atrasar só este momento':'Atrasar toda a programação'}</p>
      <p class="pg-fc-exp">${v==='este'?'Este momento ganha mais tempo. O próximo começa depois e fica mais curto, para <b>o culto terminar no mesmo horário</b>.':'Tudo daqui para frente anda junto. <b>O culto termina mais tarde.</b>'}</p>
      <div class="pg-fc-mins" role="radiogroup" aria-label="Quantos minutos">${[2,5,10,15,20].map(m=>`<button type="button" class="pg-chipm${m===5?' on':''}" data-m="${m}" role="radio" aria-checked="${m===5}">+${m} min</button>`).join('')}
        <label class="pg-fc-cust">outro <input type="number" min="1" max="180" id="pgFcN" value="5" aria-label="Minutos"> min</label></div>
      <p class="pg-fc-prev" id="pgFcPrev"></p>
      <div class="pg-fc-btns row"><button type="button" class="pg-btn big" data-fc="voltar">VOLTAR</button><button type="button" class="pg-btn primary big" data-fc="ok" data-v="${v}">ATRASAR</button></div>`;
  f.innerHTML=`<div class="pg-fc-card">
      <small class="pg-fc-k">${ask.manual?'RELÓGIO DO MOMENTO':'⏱ O TEMPO ACABOU'}</small>
      <div class="pg-fc-tp">${C.tipoIcon(item.tipo)}${t.label}</div>
      <h2>${C.esc(item.titulo||t.label)}</h2>
      <div class="pg-fc-clock" id="pgFcClock">--:--</div>
      <div class="pg-fc-sub" id="pgFcSub"></div>
      <div id="pgFcBody">${view?delay(view):main}</div></div>`;
  const prev=()=>{const n=Math.max(1,Math.round(+($('pgFcN')||{}).value||5)),v=view,sim=simulate(item.id,v,n);
    const p=$('pgFcPrev');if(p&&sim)p.innerHTML=v==='este'?`<b>${C.esc(item.titulo||'Este momento')}</b> vai até <b>${C.fmt(sim.endA)}</b>${sim.nx?` · <b>${C.esc(sim.nx.titulo)}</b> começa ${C.fmt(sim.nxStart)} e fica com ${C.dur(sim.nxDur)}`:''} · o culto termina <b>${C.fmt(sim.end)}</b>${sim.end>sim.oldEnd+.5?' <span class="warn">(não deu para absorver tudo)</span>':''}`
      :`<b>${C.esc(item.titulo||'Este momento')}</b> vai até <b>${C.fmt(sim.endA)}</b> · o culto termina <b>${C.fmt(sim.end)}</b> (antes ${C.fmt(sim.oldEnd)})`};
  f.onclick=e=>{
    const b=e.target.closest('[data-fc],[data-m]');if(!b)return;
    if(b.dataset.m){f.querySelectorAll('.pg-chipm').forEach(x=>{x.classList.toggle('on',x===b);x.setAttribute('aria-checked',x===b)});$('pgFcN').value=b.dataset.m;prev();return}
    const a=b.dataset.fc;
    if(a==='sim')return answerYes();
    if(a==='este'||a==='tudo')return openFocus(a);
    if(a==='voltar')return openFocus();
    if(a==='ok')return applyDelay(item.id,b.dataset.v,Math.max(1,Math.round(+$('pgFcN').value||5)));
  };
  f.oninput=e=>{if(e.target.id==='pgFcN'){f.querySelectorAll('.pg-chipm').forEach(x=>x.classList.toggle('on',x.dataset.m===e.target.value));prev()}};
  f.onkeydown=e=>{e.stopPropagation();if(e.key==='Escape'){snooze()}if(e.key==='Enter'&&e.target.id==='pgFcN'){e.preventDefault();f.querySelector('[data-fc=ok]').click()}};
  if(view)prev();
  const focusEl=f.querySelector(view?'[data-fc=ok]':'[data-fc=sim]');if(focusEl)focusEl.focus();
  clearInterval(ask.iv);ask.iv=setInterval(focusTick,500);focusTick();
}
function focusTick(){
  if(!ask)return;const item=P.items.find(i=>i.id===ask.id);if(!item)return;
  const s=curState().map[item.id];if(!s||s.start==null)return;
  const el=nowSec()-s.start*60,tot=(s.end-s.start)*60;
  const c=$('pgFcClock'),sb=$('pgFcSub');if(!c)return;
  c.textContent=mmss(el);
  sb.innerHTML=el>tot?`<span class="over">+${mmss(el-tot)}</span> além dos ${C.dur(s.end-s.start)} previstos`:`faltam ${mmss(tot-el)} de ${C.dur(s.end-s.start)}`;
}
function nextAfter(item){const L=ordered().filter(i=>i.estado!=='ignorado'&&C.toMin(i.hora)!=null);const k=L.indexOf(item);return k>=0?L[k+1]:null}
function closeAsk(){if(ask){clearInterval(ask.iv);if(ask.mini)ask.mini.remove()}const f=$('pgFocus');if(f)f.remove();const m=$('pgAskMini');if(m)m.remove();ask=null}
function snooze(){ // Esc: fecha e pergunta de novo em 2 minutos se nada mudar
  const a=ask;closeAsk();if(!a)return;
  setTimeout(()=>{const st=curState(),it=P.items.find(i=>i.id===a.id);if(it&&st.map[it.id].state==='passou'&&!ask&&lastLive!==a.id&&Date.now()-lastSave>2500){const lv=st.live;askEnd(it,null);if(ask)ask.pending=lv}},120000);
}
function answerYes(){
  const a=ask;closeAsk();if(!a)return;
  const st=curState();toast('Seguindo para o próximo momento');
  if(st.live&&(!a.pending||a.pending.id===st.live.id))onLive(st.live);
  render();
}
/* linha do tempo: [{it,start,end}] dos momentos que contam, em ordem */
function timeline(){
  const st=curState();
  return ordered().filter(i=>i.estado!=='ignorado'&&C.toMin(i.hora)!=null).map(it=>({it,start:st.map[it.id].start,end:st.map[it.id].end}));
}
function shiftTimeline(tl,id,kind,n){
  const k=tl.findIndex(x=>x.it.id===id);if(k<0)return null;
  tl=tl.map(x=>({it:x.it,start:x.start,end:x.end}));
  const oldEnd=tl[tl.length-1].end;
  // "agora" passou do fim previsto? o atraso conta a partir de agora
  const nowM=nowSec()/60,base=Math.max(tl[k].end,Math.floor(nowM));
  tl[k].end=base+n;
  if(kind==='tudo'){const d=tl[k].end-(k+1<tl.length?tl[k+1].start:tl[k].end);for(let j=k+1;j<tl.length;j++){tl[j].start+=d;tl[j].end+=d}}
  else{for(let j=k+1;j<tl.length;j++){if(tl[j].start>=tl[j-1].end)break;tl[j].start=tl[j-1].end;if(tl[j].end-tl[j].start<1)tl[j].end=tl[j].start+1}}
  return {tl,oldEnd};
}
function simulate(id,kind,n){
  const r=shiftTimeline(timeline(),id,kind,n);if(!r)return null;
  const k=r.tl.findIndex(x=>x.it.id===id),nx=r.tl[k+1];
  return {endA:r.tl[k].end,nx:nx&&nx.it,nxStart:nx&&nx.start,nxDur:nx&&(nx.end-nx.start),end:r.tl[r.tl.length-1].end,oldEnd:r.oldEnd};
}
function applyTimeline(tl){
  tl.forEach(x=>{
    const d=Math.max(1,Math.round(x.end-x.start));
    if(P.auto)x.it.dur=String(d);
    else{x.it.hora=C.fmt(Math.round(x.start));if(+x.it.dur>0||x===tl[tl.length-1])x.it.dur=String(d)}
  });
  if(P.auto&&tl.length){const f=P.items.find(i=>C.toMin(i.hora)!=null);if(f&&f===tl[0].it)f.hora=C.fmt(Math.round(tl[0].start))}
}
function applyDelay(id,kind,n){
  const r=shiftTimeline(timeline(),id,kind,n);if(!r)return;
  applyTimeline(r.tl);P.exemplo=false;normalize();save();
  try{localStorage.setItem(KL(),hoje()+':'+id)}catch(e){}lastLive=id;
  closeAsk();render();
  const it=P.items.find(i=>i.id===id);
  toast(kind==='tudo'?`Programação atrasada ${n} min — o culto termina mais tarde`:`+${n} min em "${it&&it.titulo||'momento'}" — o fim do culto foi mantido`);
}
function finishNow(){
  const st=curState(),live=st.live;if(!live)return;
  const s=st.map[live.id],nowM=nowSec()/60,el=Math.max(1,Math.floor(nowM-s.start)),tl=timeline(),k=tl.findIndex(x=>x.it.id===live.id);
  if(k<0)return;const d=(s.start+el)-tl[k].end;tl[k].end=s.start+el;
  for(let j=k+1;j<tl.length;j++){tl[j].start+=d;tl[j].end+=d}
  applyTimeline(tl);P.exemplo=false;normalize();save();closeAsk();render();toast('Próximo momento começou');
  const n=curState().live;if(n&&n.id!==live.id){try{localStorage.setItem(KL(),hoje()+':'+n.id)}catch(e){}lastLive=n.id;onLive(n)}
}
lastLive=undefined;

/* ---------------- resumo do culto ---------------- */
function renderSummary(st){
  const box=$('pgSum');if(!box)return;
  const items=ordered().filter(i=>C.toMin(i.hora)!=null);
  if(!items.length){box._h='';box.innerHTML=`<div class="pg-sum-empty">Nenhum momento ainda. <button type="button" class="pg-btn sm primary" data-mod>COMEÇAR DE UM MODELO</button> <button type="button" class="pg-btn sm" data-add>+ MOMENTO</button></div>`;return}
  const first=st.map[items[0].id].start,end=Math.max(...items.map(i=>st.map[i.id].end||0)),total=Math.max(1,end-first);
  const act=items.filter(i=>i.estado!=='ignorado');
  const segs=items.map(i=>{const s=st.map[i.id],t=C.tipo(i.tipo),w=i.estado==='ignorado'?0:Math.max(.4,(s.end-s.start)/total*100);
    return w?`<button type="button" class="pg-seg st-${s.state}" style="flex:${w} 0 0;--c:${t.color}" data-goto="${i.id}" title="${C.esc(i.hora+' · '+t.label+' · '+(i.titulo||''))}" aria-label="${C.esc(i.hora+' '+(i.titulo||t.label))}"></button>`:''}).join('');
  let now='',status='',btns='';
  if(st.dayDiff>0)status=`<b class="pg-s-fut">Daqui a ${st.dayDiff} dia${st.dayDiff>1?'s':''}</b> — as bolinhas começam a mudar sozinhas no dia.`;
  else if(st.dayDiff<0)status='<b>Esta programação já aconteceu.</b> Mude a data para usar de novo.';
  else{
    if(st.now>=first&&st.now<=end)now=`<i class="pg-seg-now" style="left:${((st.now-first)/total*100).toFixed(2)}%"></i>`;
    if(st.live){const s=st.map[st.live.id];
      status=`<span class="pg-dot st-noar"></span><b>Agora: ${C.esc(st.live.titulo||C.tipo(st.live.tipo).label)}</b> · faltam ${Math.max(1,Math.ceil(s.end-st.now))} min${st.next?` · depois: ${C.esc(st.next.titulo)}`:''}`;
    }else if(st.now<first)status=`Começa em <b>${C.dur(first-st.now)}</b>${st.next?` com ${C.esc(st.next.titulo)}`:''}.`;
    else status='<b>O culto terminou.</b>';
  }
  const tipos=[...new Set(act.map(i=>i.tipo||'outro'))];
  const html=`<div class="pg-sum-top"><div class="pg-sum-st">${status}</div><div class="pg-sum-b">${btns}</div></div>
    <div class="pg-tl" role="group" aria-label="Linha do tempo do culto">${segs}${now}</div>
    <div class="pg-sum-info"><span>Começa <b>${C.fmt(first)}</b></span><span>Termina <b>${C.fmt(end)}</b></span><span>Duração <b>${C.dur(total)}</b></span><span><b>${act.length}</b> momento${act.length===1?'':'s'}</span>
      <span class="pg-sp"></span>${tipos.map(k=>`<span class="pg-sum-tp" style="--c:${C.tipo(k).color}"><i></i>${C.tipo(k).label}</span>`).join('')}</div>`;
  if(box._h!==html){box._h=html;box.innerHTML=html}
}
function liveAdjust(kind){
  const st=C.compute(P.items,{aviso:cfg.aviso,lastDur:cfg.lastDur,data:P.data}),live=st.live;if(!live)return;
  const s=st.map[live.id];
  if(kind==='mais'){
    if(P.auto){live.dur=String(Math.round(s.end-s.start)+5)}
    else{P.items.forEach(i=>{const t=C.toMin(i.hora);if(i!==live&&t!=null&&t>s.start)i.hora=C.fmt(t+5)});if(+live.dur>0)live.dur=String(+live.dur+5)}
    toast('+5 min em "'+(live.titulo||'momento')+'" — o resto andou junto');
  }else{
    const el=Math.max(1,Math.floor(st.now-s.start));
    if(P.auto)live.dur=String(el);
    else{const delta=(s.start+el)-s.end;P.items.forEach(i=>{const t=C.toMin(i.hora);if(i!==live&&t!=null&&t>=s.end-1e-6)i.hora=C.fmt(t+delta)});if(+live.dur>0)live.dur=String(el)}
    toast('Próximo momento começou');
  }
  P.exemplo=false;normalize();save();render();
}
function setAuto(on){
  if(on===!!P.auto)return;
  if(on){
    const its=C.sorted(P.items),st=C.compute(its,{lastDur:cfg.lastDur});
    its.forEach(i=>{const s=st.map[i.id];if(!(+i.dur>0)&&s.start!=null)i.dur=String(Math.max(1,Math.round(s.end-s.start)))});
    P.items=its;
  }
  P.auto=on;normalize();save();render();
  toast(on?'Horários automáticos: mude a duração e os horários seguintes se ajustam':'Horários livres: cada momento tem a sua própria hora');
}
async function openModelos(){
  const ks=Object.keys(C.MODELOS);
  const pr=dialog(`<h3>Começar de um modelo</h3><p class="pg-hint" style="margin-top:-6px">Escolha um ponto de partida — depois é só ajustar nomes e durações.</p>
    <div class="pg-mods" role="radiogroup" aria-label="Modelos">${ks.map((k,i)=>{const m=C.MODELOS[k],tot=m.itens.reduce((a,x)=>a+x[2],0);
      return `<label class="pg-mod"><input type="radio" name="m" value="${k}" ${i===0?'checked':''}><b>${m.nome}</b><small>${m.desc}</small><span>${m.itens.length} momento${m.itens.length>1?'s':''} · ${C.dur(tot)}</span>
        <i class="pg-mod-bar">${m.itens.map(x=>`<em style="flex:${x[2]} 0 0;background:${C.tipo(x[1]).color}"></em>`).join('')}</i></label>`}).join('')}</div>
    <div class="pg-mod-f"><label class="pg-lbl">TÍTULO<input name="t" value="${C.esc(C.MODELOS[ks[0]].nome)}"></label><label class="pg-lbl">DATA<input type="date" name="d" value="${proxDomingo()}"></label><label class="pg-lbl">COMEÇA ÀS<input type="time" name="h" value="${C.MODELOS[ks[0]].inicio}"></label></div>
    ${P.items.length&&!P.exemplo?'<div class="pg-warn">Os momentos atuais serão trocados pelos do modelo. Os anexos continuam.</div>':''}`,
    f=>({k:f.querySelector('[name=m]:checked').value,t:f.t.value.trim(),d:f.d.value,h:f.h.value}),'USAR ESTE MODELO');
  const m=[...document.querySelectorAll('.pg-modal')].pop();
  if(m){m.querySelector('.pg-modal-card').classList.add('wide');let touched=false;m.querySelector('[name=t]').addEventListener('input',()=>touched=true);
    m.addEventListener('change',e=>{if(e.target.name!=='m')return;const md=C.MODELOS[e.target.value];if(!touched)m.querySelector('[name=t]').value=md.nome;m.querySelector('[name=h]').value=md.inicio})}
  const r=await pr;if(!r)return;
  P.items=C.fromModelo(r.k,r.h);P.titulo=r.t||C.MODELOS[r.k].nome;P.data=r.d||hoje();P.auto=true;P.exemplo=false;editing=null;
  save();render();$('panel-prog').scrollTop=0;toast('Pronto! Clique num momento para ajustar');
}
/* ---------------- tour "como funciona" (usa prog/tour.js) ---------------- */
const TOUR=[
  {el:'#pgSum',t:'O culto inteiro numa barra',d:'Cada cor é um tipo de momento (louvor, oração, pregação…) e a linha vermelha é o horário de agora. Clique numa cor para ir até aquele momento.'},
  {el:'#pgList .pg-item',t:'Cada cartão é um momento',d:'A bolinha mostra o estado pelo relógio: <b style="color:#4ade80">verde</b> no ar, <b style="color:#fb923c">laranja</b> vai começar, <b style="color:#93c5fd">azul</b> agendado, <b style="color:#94a3b8">cinza</b> já foi e <b>preta</b> ignorado. Clique no cartão para editar.'},
  {el:'#pgList .pg-item .pg-grip',up:'.pg-item',t:'Arraste para mudar a ordem',d:'Segure um cartão e arraste para cima ou para baixo (no celular/tablet, segure pela alça <b>⠿</b>). Os horários se ajustam sozinhos. No teclado: <kbd>Alt</kbd> + <kbd>↑</kbd> <kbd>↓</kbd>.'},
  {el:'#pgCascade',t:'Horários automáticos',d:'Ligado, você só diz quanto tempo cada momento dura e os horários se ajustam sozinhos. Atrasou? O relógio do momento (logo abaixo do resumo) resolve.'},
  {el:'#pgClock',t:'Relógio do momento',d:'Fica sempre à vista: antes do culto conta quanto falta para o próximo momento; durante, mostra há quanto tempo o momento atual está rodando e quanto falta (nas outras abas aparece pequeno, no canto). <b>TERMINOU</b> começa o próximo na hora; <b>ATRASAR…</b> dá mais tempo.'},
  {el:'#pgSum',t:'Quando o tempo acaba',d:'Ao fim de cada momento a tela vem para cá e pergunta <b>“Acabou?”</b>: <b>Sim</b> segue; <b>Atrasar este momento</b> dá mais minutos só a ele (o culto termina na mesma hora); <b>Atrasar toda a programação</b> empurra tudo. Na Projeção aparece só um aviso pequeno.'},
  {el:'#pgLibBox',t:'Anexos com @',d:'Digite <b>@</b> no texto de um momento para anexar slide do Canva, <b>vídeo do YouTube</b>, imagem, vídeo, música ou letra — ou arraste o arquivo para esta aba. O <b>▶</b> mostra na Projeção.'},
  {el:'#pgList .pg-item',t:'Vários anexos viram uma fila',d:'Quando o momento entra no ar, os anexos dele vão para a <b>Projeção</b> na ordem em que aparecem no texto. Vídeo ou música terminou? O palco pergunta <b>“Passar para o próximo?”</b>.'},
  {el:'#pgModelos',t:'Modelos prontos',d:'Comece de um culto de domingo, de oração, Santa Ceia ou casamento e ajuste o que precisar.'},
  {el:'#pgExportBtn',t:'Compartilhar',d:'Gere PDF ou imagem para mandar no grupo, ou um link que passa sozinho na tela das pessoas (com comentários, se quiser).'},
  {el:'#tsConfig',t:'Configurações',d:'Aqui você decide se o palco abre sozinho na Projeção os anexos (slide, vídeo, música) quando um momento começa — vem ligado.'}
];
function startTour(){if(window.PFTour)PFTour.start('prog',TOUR,'Programação')}
function tour(force){if(!window.PFTour)return;if(force)startTour();else PFTour.auto('prog',TOUR,'Programação',700)}

/* ---------------- ação ao entrar no ar ---------------- */
function anexosDo(it){const bn=byName();return C.mentions(it.texto).map(n=>bn[n]).filter(Boolean)}
const PALCO=['canva','imagem','video','pdf','texto','youtube'];
function onLive(it){
  const an=anexosDo(it).filter(a=>a.kind!=='link');
  toast('NO AR: '+(it.titulo||'momento'));
  if(cfg.acao==='nada'||!an.length)return;
  if(cfg.acao==='auto'){filaFrom(an,it.id,0);return}
  // perguntar
  let b=$('pgAsk');if(b)b.remove();
  b=document.createElement('div');b.id='pgAsk';b.className='pg-ask';b.setAttribute('role','alertdialog');b.setAttribute('aria-label','Momento no ar');
  b.innerHTML=`<span class="pg-dot st-noar"></span><div class="pg-ask-t"><small>NO AR AGORA</small><b>${C.esc(it.titulo)}</b></div>
    <button type="button" class="pg-btn sm primary" data-all>▶ USAR ${an.length>1?'OS '+an.length+' ANEXOS (FILA)':'@'+C.esc(an[0].nome)}</button>
    <button type="button" class="pg-btn sm" data-close>AGORA NÃO</button>`;
  document.body.appendChild(b);
  b.addEventListener('click',e=>{if(e.target.closest('[data-all]'))filaFrom(an,it.id,0);if(e.target.closest('[data-all],[data-close]'))b.remove()});
  setTimeout(()=>{if(b.isConnected)b.remove()},60000);
}

/* ---------------- janela de PROJEÇÃO (projecao.html, mesmo computador) ---------------- */
const PJ_CH='pulpito-projecao';
const pj={bc:null,last:0,media:null,st:null,was:false,laserT:0,black:false};
function pjOn(){return Date.now()-pj.last<3500}
function pjStart(){if(!pj.bc&&!pj.started){pj.started=true;pjInit()}mountPjBar()}
function pjInit(){
  try{pj.bc=new BroadcastChannel(PJ_CH);pj.bc.onmessage=e=>pjMsg(e.data||{})}catch(e){}
  setInterval(pjTick,1000);
  // YouTube tocando no próprio palco (sem janela de projeção): saber quando acaba
  window.addEventListener('message',e=>{
    if(!/^https:\/\/www\.youtube(-nocookie)?\.com$/.test(e.origin))return;
    let d;try{d=typeof e.data==='string'?JSON.parse(e.data):e.data}catch(x){return}
    const f=document.querySelector('#pfMedia iframe.yt');if(!d||!f||e.source!==f.contentWindow)return;
    const st=d.event==='onStateChange'?d.info:d.info&&d.info.playerState;
    if(d.info&&typeof d.info.currentTime==='number')pj.ytLocal={cur:d.info.currentTime,dur:d.info.duration||(pj.ytLocal&&pj.ytLocal.dur)||0,playing:st===1};
    if(st===0)onItemEnded(f.dataset.id);
  });
}
function ytCmdLocal(func,args){const f=document.querySelector('#pfMedia iframe.yt');if(f&&f.contentWindow)f.contentWindow.postMessage(JSON.stringify({event:'command',func,args:args||[]}),'*')}
function pjMsg(m){
  if(m.t==='hello'||m.t==='ping'){
    const was=pjOn();pj.last=Date.now();pj.st=m.st||null;
    if(m.t==='hello'||!was){pjSend();if(m.t==='hello')toast('Janela de projeção conectada')}
    if(!was)pjChanged();
    renderPjStatus();
  }else if(m.t==='ended'){onItemEnded(m.id)}
  else if(m.t==='black'){toggleBlack()}
  else if(m.t==='nav'){if(PF.canvaNav&&PF.canvaState&&PF.canvaState().url)PF.canvaNav(m.d>0?1:-1)}
  else if(m.t==='bye'){pj.last=0;pjChanged()}
}
function pjTick(){if(pj.was!==pjOn())pjChanged();renderPjStatus()}
function pjChanged(){pj.was=pjOn();renderPjBar();const a=pj.media&&P&&P.anexos[pj.media.id];if(a&&!$('pfMedia').hidden)renderMonitor(a)}
function pjState(){
  const cs=window.PF&&PF.canvaState?PF.canvaState():null;
  return {t:'state',slug:sess&&sess.slug,canva:cs&&cs.url?{url:cs.url,page:cs.page||1}:null,media:pj.media,black:pj.black,laser:window.PF&&PF.laserState?PF.laserState():null};
}
function pjSend(){try{pj.bc&&pj.bc.postMessage(pjState())}catch(e){}}
function pjSync(){clearTimeout(pjSync.t);pjSync.t=setTimeout(pjSend,30)}
function toggleBlack(v){
  pj.black=typeof v==='boolean'?v:!pj.black;
  document.body.classList.toggle('pj-black',pj.black);pjSend();renderPjBar();
  toast(pj.black?'Tela preta (aperte B para voltar)':'Tela de volta');
}
function pjLaser(l){try{pj.bc&&pj.bc.postMessage({t:'laser',laser:l})}catch(e){}}
function pjCmd(c){try{pj.bc&&pj.bc.postMessage({t:'cmd',c})}catch(e){}}
function openProjWindow(){
  const w=window.open('projecao.html','pulpito-projecao','popup=yes,width=1280,height=720');
  if(!w)toast('O navegador bloqueou a janela — permita pop-ups para este site');
  else toast('Arraste a janela para o telão e clique nela uma vez (tela cheia)');
}
function projUrl(){return location.href.replace(/[#?].*$/,'').replace(/[^/]*$/,'')+'projecao.html'}

/* ---------------- fila de anexos do momento ---------------- */
let fila={mid:null,ids:[],idx:-1,music:null,visual:null,ask:null};
function filaFrom(list,mid,start){
  fila={mid:mid||null,ids:list.map(a=>a.id),idx:-1,music:null,visual:null,ask:null};
  goFila(start||0,true);
}
function goFila(i,pair){
  if(i<0||i>=fila.ids.length)return;
  fila.idx=i;fila.ask=null;closePjAsk();
  const a=P.anexos[fila.ids[i]];if(!a)return;
  applyAnexo(a);
  // música + o próximo visual juntos (ex.: música e a letra dela)
  if(pair&&a.kind==='musica'){const nx=P.anexos[fila.ids[i+1]];if(nx&&nx.kind!=='musica'){fila.idx=i+1;applyAnexo(nx)}}
  renderPjBar();
}
function applyAnexo(a){
  if(a.kind==='musica'){fila.music=a.id;playAudio(a);return}
  if(a.kind==='link'){window.open(a.url,'_blank','noopener');return}
  fila.visual=a.id;
  if(a.kind==='canva'){closeMedia(true);PF.openCanva(a.url).catch(e=>toast(String(e.message||e)));return}
  if(PALCO.includes(a.kind)){showMedia(a);return}
  urlOf(a).then(u=>window.open(u,'_blank')).catch(e=>toast(String(e.message||e)));
}
/* um vídeo/música/YouTube terminou */
function onItemEnded(id){
  if(!id||(id!==fila.music&&id!==fila.visual))return;
  const k=fila.ids.indexOf(id),a=P.anexos[id];
  if(k>=0&&k<fila.ids.length-1){
    if(cfg&&cfg.seguir){const nx=P.anexos[fila.ids[k+1]];toast('Próximo: @'+(nx?nx.nome:''));goFila(k+1,true);return}
    fila.ask={id};renderPjBar();showPjAsk(a)}
  else toast((a?'@'+a.nome:'Arquivo')+' terminou'+(fila.ids.length>1?' — fim da fila':''));
}
function showPjAsk(a){
  closePjAsk();
  if(document.body.classList.contains('tab-slide'))return; // na aba Projeção a pergunta já aparece na barra
  const b=document.createElement('div');b.id='pjAskMini';b.className='pg-ask-mini pj';b.setAttribute('role','alertdialog');
  b.innerHTML=`<span><b>@${C.esc(a?a.nome:'')}</b> terminou · passar para o próximo?</span><button type="button" class="pg-btn sm primary" data-pj="sim">SIM</button><button type="button" class="pg-btn sm" data-pj="nao">NÃO</button>`;
  b.onclick=e=>{const x=e.target.closest('[data-pj]');if(x)pjAnswer(x.dataset.pj)};
  document.body.appendChild(b);
}
document.addEventListener('keydown',e=>{
  if(!fila.ask||e.ctrlKey||e.metaKey||e.altKey)return;
  const tg=e.target&&e.target.tagName;if(tg==='INPUT'||tg==='TEXTAREA'||tg==='SELECT'||tg==='BUTTON')return;
  if(document.querySelector('.pg-modal,.pf-tour'))return;
  if(e.key==='Enter'){e.preventDefault();e.stopPropagation();pjAnswer('sim')}
  else if(e.key==='Escape'){e.preventDefault();e.stopPropagation();pjAnswer('nao')}
},true);
function closePjAsk(){const b=$('pjAskMini');if(b)b.remove()}
function pjAnswer(v){
  const ask=fila.ask;fila.ask=null;closePjAsk();
  if(v==='sim')goFila(fila.ids.indexOf(ask?ask.id:fila.ids[fila.idx])+1,true);
  else if(v==='repetir'&&ask){const a=P.anexos[ask.id];if(a&&a.kind==='musica'){const au=$('pgAudio');au.currentTime=0;au.play().catch(()=>{})}else if(pjOn())pjCmd('restart');else localCmd('restart')}
  renderPjBar();
}

function localCmd(c){
  const vd=document.querySelector('#pfMedia video');
  if(vd){if(c==='restart'){vd.currentTime=0;vd.play().catch(()=>{})}else if(vd.paused)vd.play().catch(()=>{});else vd.pause();return}
  if(document.querySelector('#pfMedia iframe.yt')){if(c==='restart'){ytCmdLocal('seekTo',[0,true]);ytCmdLocal('playVideo')}else ytCmdLocal(pj.ytLocal&&pj.ytLocal.playing?'pauseVideo':'playVideo')}
}
/* ---------------- barra da fila / projeção (aba Projeção do palco) ---------------- */
function mountPjBar(){
  const panel=$('panel-slide');if(!panel||$('pjBar'))return;
  const bar=document.createElement('div');bar.className='pj-bar';bar.id='pjBar';
  panel.appendChild(bar);
  bar.addEventListener('click',e=>{
    const b=e.target.closest('[data-pj]');if(!b)return;const v=b.dataset.pj;
    if(v==='abrir')return openProjWindow();
    if(v==='black')return toggleBlack();
    if(v==='copiar'){navigator.clipboard.writeText(projUrl()).then(()=>toast('Link da projeção copiado'),()=>{});return}
    if(v==='ir')return goFila(+b.dataset.i,false);
    if(v==='prev')return goFila(fila.idx-1,false);
    if(v==='next')return goFila(fila.idx+1,true);
    if(v==='toggle'||v==='restart'){if(pjOn())pjCmd(v);else localCmd(v);return}
    pjAnswer(v);
  });
  renderPjBar();
}
function renderPjBar(){
  const bar=$('pjBar');if(!bar)return;
  const on=pjOn(),it=fila.mid&&P&&P.items.find(i=>i.id===fila.mid);
  const chips=fila.ids.map((id,k)=>{const a=P&&P.anexos[id];if(!a)return '';const cur=id===fila.visual||id===fila.music;
    return `<button type="button" class="pj-chip k-${a.kind}${cur?' on':''}${k===fila.idx?' at':''}" data-pj="ir" data-i="${k}" title="${C.esc(C.KIND_LABEL[a.kind]||'')}">${C.icon(a.kind)}@${C.esc(a.nome)}</button>`}).join('');
  const ask=fila.ask&&P&&P.anexos[fila.ask.id];
  const cur=fila.visual&&(pj.media&&pj.media.id===fila.visual?pj.media:P&&P.anexos[fila.visual]),timed=cur&&(cur.kind==='video'||cur.kind==='youtube');
  bar.innerHTML=`<div class="pj-st">${on?`<span class="pj-dot on"></span><b>Projeção conectada</b>`:`<button type="button" class="sl-btn primary" data-pj="abrir" id="pjOpen" title="Abre só a tela de projeção, sem botões, para colocar no telão">JANELA DE PROJEÇÃO ↗</button><button type="button" class="sl-btn" data-pj="copiar" aria-label="Copiar link da janela de projeção" title="Copiar o link"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="9" y="9" width="12" height="12" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg></button>`}</div>
    <div class="pj-fila" id="pjFila">${ask?`<div class="pj-ask" role="alertdialog"><span><b>@${C.esc(ask.nome)}</b> terminou. Passar para o próximo? <small class="pj-keys"><kbd>Enter</kbd> sim · <kbd>Esc</kbd> não</small></span><button type="button" class="sl-btn primary" data-pj="sim">SIM ▸</button><button type="button" class="sl-btn" data-pj="repetir">REPETIR</button><button type="button" class="sl-btn" data-pj="nao">NÃO</button></div>`
      :fila.ids.length?`<small>FILA${it?' · '+C.esc(it.titulo||''):''}</small><button type="button" class="sl-btn" data-pj="prev" aria-label="Anterior" ${fila.idx<=0?'disabled':''}>◀</button><div class="pj-chips">${chips}</div><button type="button" class="sl-btn" data-pj="next" aria-label="Próximo" ${fila.idx>=fila.ids.length-1?'disabled':''}>▶</button>`
      :`<small class="pj-empty">Os anexos do momento no ar aparecem aqui, em fila.</small>`}</div>
    <div class="pj-ctl"><button type="button" class="sl-btn${pj.black?' on':''}" data-pj="black" aria-pressed="${pj.black}" title="Deixa o telão preto na hora (tecla B)">${pj.black?'● TELA PRETA':'TELA PRETA'}</button>${timed?`<button type="button" class="sl-btn" data-pj="toggle" aria-label="Tocar ou pausar" title="Tocar / pausar"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 4l9 8-9 8z" fill="currentColor"/><path d="M18 5v14"/></svg></button><button type="button" class="sl-btn" data-pj="restart" aria-label="Voltar ao começo" title="Voltar ao começo"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5"/></svg></button><span class="pj-time" id="pjTime"></span>`:''}</div>`;
  renderPjStatus();
}
function renderPjStatus(){
  const t=$('pjTime');if(!t)return;
  const st=pj.st;if(pjOn()&&st&&st.dur){t.textContent=mmss(st.cur)+' / '+mmss(st.dur)+(st.playing?'':' ⏸');return}
  const v=document.querySelector('#pfMedia video'),y=document.querySelector('#pfMedia iframe.yt')&&pj.ytLocal;
  t.textContent=v&&v.duration?mmss(v.currentTime)+' / '+mmss(v.duration)+(v.paused?' ⏸':''):y&&y.dur?mmss(y.cur)+' / '+mmss(y.dur)+(y.playing?'':' ⏸'):'';
}

/* ---------------- mostrar no palco / na projeção ---------------- */
async function use(a,item){
  if(!a)return;
  const list=item?anexosDo(item).filter(x=>x.kind!=='link'):[];
  if(item&&list.includes(a))filaFrom(list,item.id,list.indexOf(a));
  else filaFrom([a],null,0);
}
async function showMedia(a){
  pj.media={id:a.id,kind:a.kind,nome:a.nome,url:a.url||null,texto:a.kind==='texto'?(a.texto||''):null,yt:a.kind==='youtube'?C.ytId(a.url):null};
  pjSend();
  await renderMonitor(a);
  if(!pjOn())PF.setTab('slide'); // sem janela de projeção, o palco mostra
  PF.refreshBar&&PF.refreshBar();
  const pg=$('slPage');if(pg)pg.textContent='@'+a.nome;
}
async function renderMonitor(a){
  const m=$('pfMedia');if(!m)return;
  const old=m.querySelector('video');if(old)old.pause();
  let inner='';
  try{
    if(a.kind==='texto')inner=`<div class="pf-media-text">${C.esc(a.texto||'').replace(/\n/g,'<br>')}</div>`;
    else if(pjOn()&&(a.kind==='video'||a.kind==='youtube'||a.kind==='pdf'))
      inner=`<div class="pf-mon">${C.icon(a.kind)}<b>@${C.esc(a.nome)}</b><span>passando na janela de projeção</span><small>tocar, pausar e voltar ao começo: na barra de baixo</small></div>`;
    else if(a.kind==='youtube')inner=`<iframe class="yt" data-id="${a.id}" src="${C.ytEmbed(C.ytId(a.url),{origin:location.origin})}" title="${C.esc(a.nome)}" allow="autoplay; encrypted-media; picture-in-picture" referrerpolicy="strict-origin-when-cross-origin"></iframe>`;
    else{
      const u=await urlOf(a);
      if(a.kind==='imagem')inner=`<img src="${u}" alt="${C.esc(a.nome)}">`;
      else if(a.kind==='video')inner=`<video src="${u}" controls autoplay playsinline></video>`;
      else if(a.kind==='pdf')inner=`<iframe src="${u}#toolbar=0&view=Fit" title="${C.esc(a.nome)}"></iframe>`;
    }
  }catch(e){inner=`<div class="pf-mon"><b>${C.esc(e.message||e)}</b></div>`}
  m.innerHTML=inner+`<span class="pf-media-tag">${C.icon(a.kind)}@${C.esc(a.nome)}${pjOn()?' · na projeção':''}</span><button type="button" class="pf-media-x" aria-label="Fechar mídia">×</button>`;
  m.querySelector('.pf-media-x').onclick=()=>closeMedia();
  const v=m.querySelector('video');if(v)v.addEventListener('ended',()=>onItemEnded(a.id));
  const yf=m.querySelector('iframe.yt');if(yf)yf.addEventListener('load',()=>{let n=0;const go=()=>{if(n++>15||!yf.isConnected)return;yf.contentWindow.postMessage(JSON.stringify({event:'listening',id:1,channel:'widget'}),'*');setTimeout(go,500)};go()});
  m.hidden=false;document.body.classList.add('pf-media-on');
}
function closeMedia(silent){
  const m=$('pfMedia');
  if(pj.media){pj.media=null;pjSend()}
  if(fila.visual&&silent!==true)fila.visual=null;
  if(!m||m.hidden){renderPjBar();return}
  const v=m.querySelector('video');if(v)v.pause();
  m.hidden=true;m.innerHTML='';document.body.classList.remove('pf-media-on');
  PF.refreshBar&&PF.refreshBar();renderPjBar();
}
let pgDucked=false;
async function playAudio(a){
  const au=$('pgAudio');
  au.src=await urlOf(a);$('pgPlName').textContent='@'+a.nome;$('pgPlayer').hidden=false;au.dataset.id=a.id;
  if(cfg.duck&&typeof window.setDuck==='function'&&!(PF.isDucked&&PF.isDucked())){window.setDuck(true);pgDucked=true}
  try{await au.play()}catch(e){toast('Clique em ▶ no player para tocar')}
}
function stopAudio(){
  const au=$('pgAudio');au.pause();au.removeAttribute('src');au.load();$('pgPlayer').hidden=true;fila.music=null;
  if(pgDucked&&typeof window.setDuck==='function'){window.setDuck(false)}pgDucked=false;renderPjBar();
}

/* ---------------- edição ---------------- */
function addItem(){
  let it;
  if(P.auto){it={id:C.uid(8),hora:'',dur:'10',tipo:'outro',titulo:'',texto:'',estado:'auto'};P.items.push(it)}
  else{
    const items=C.sorted(P.items),lastT=items.length?C.toMin(items[items.length-1].hora):null;
    const h=lastT!=null?C.fmt(lastT+15):C.fmt(Math.ceil(C.nowMin()/5)*5);
    it={id:C.uid(8),hora:h,dur:'',tipo:'outro',titulo:'',texto:'',estado:'auto'};P.items.push(it);
  }
  P.exemplo=false;editing=it.id;normalize();save();render();
  const el=document.querySelector('#pgList .pg-item.editing');if(el)el.scrollIntoView({block:'center'});
}
function commitEdit(el){
  const it=P.items.find(i=>i.id===el.dataset.id);if(!it)return;
  const h=el.querySelector('[name=hora]');if(h&&h.value)it.hora=h.value;
  const tp=el.querySelector('[name=tipo]:checked');if(tp)it.tipo=tp.value;
  it.titulo=el.querySelector('[name=titulo]').value.trim();
  it.texto=el.querySelector('[name=texto]').value;
  const d=el.querySelector('[name=dur]').value;it.dur=d&&+d>0?String(Math.round(+d)):(P.auto?'10':'');
  P.exemplo=false;
}
function reorder(ids,movedId){
  const by=Object.fromEntries(P.items.map(i=>[i.id,i])),neu=ids.map(id=>by[id]).filter(Boolean);
  P.items.forEach(i=>{if(!neu.includes(i))neu.push(i)});
  if(P.auto){const start=P.items[0]&&P.items[0].hora;P.items=neu;if(start&&P.items[0])P.items[0].hora=start}
  else{const times=C.sorted(P.items).map(i=>i.hora);neu.forEach((it,k)=>{it.hora=times[k]});P.items=neu}
  P.exemplo=false;normalize();save();render();
  const el=movedId&&document.querySelector('#pgList .pg-item[data-id="'+movedId+'"]');
  if(el){el.classList.add('flash');setTimeout(()=>el.classList.remove('flash'),1200);el.focus({preventScroll:true})}
}
function move(it,dir){
  const ids=ordered().map(i=>i.id),i=ids.indexOf(it.id),j=i+dir;if(i<0||j<0||j>=ids.length)return;
  ids.splice(i,1);ids.splice(j,0,it.id);reorder(ids,it.id);
}
/* arrastar os cartões para mudar a ordem */
let drag=null,dragClick=false;
function wireDrag(){
  const list=$('pgList'),panel=$('panel-prog');
  list.addEventListener('pointerdown',e=>{
    if(e.button!==0||drag)return;
    const item=e.target.closest('.pg-item');if(!item||item.classList.contains('editing'))return;
    if(e.target.closest('button,a,input,textarea,select'))return;
    if(e.pointerType!=='mouse'&&!e.target.closest('.pg-grip'))return; // no toque, arraste pela alça ⠿
    if(e.pointerType==='mouse')e.preventDefault(); // não seleciona texto ao arrastar
    drag={item,x0:e.clientX,y0:e.clientY,pid:e.pointerId,on:false};
  });
  addEventListener('pointermove',e=>{
    if(!drag||e.pointerId!==drag.pid)return;
    if(!drag.on){if(Math.hypot(e.clientX-drag.x0,e.clientY-drag.y0)<6)return;startDrag()}
    e.preventDefault();
    drag.ghost.style.transform='translate3d(0,'+(e.clientY-drag.y0)+'px,0) rotate(.6deg)';
    const others=[...list.querySelectorAll('.pg-item')].filter(x=>x!==drag.item);
    const before=others.find(x=>{const r=x.getBoundingClientRect();return e.clientY<r.top+r.height/2});
    const ref=before||$('pgAdd2');
    if(drag.item.nextElementSibling!==ref)list.insertBefore(drag.item,ref);
    const pr=panel.getBoundingClientRect();
    if(e.clientY<pr.top+90)panel.scrollTop-=14;else if(e.clientY>pr.bottom-70)panel.scrollTop+=14;
  },{passive:false});
  const stop=commit=>{
    if(!drag)return;const d=drag;drag=null;
    if(!d.on)return;
    d.ghost.remove();d.item.classList.remove('pg-dragging');document.body.classList.remove('pg-drag');
    dragClick=true;setTimeout(()=>{dragClick=false},0);
    if(commit)reorder([...list.querySelectorAll('.pg-item')].map(x=>x.dataset.id),d.item.dataset.id);else render();
  };
  addEventListener('pointerup',e=>{if(drag&&e.pointerId===drag.pid)stop(true)});
  addEventListener('pointercancel',()=>stop(false));
  addEventListener('keydown',e=>{if(drag&&drag.on&&e.key==='Escape'){e.stopPropagation();stop(false)}},true);
  list.addEventListener('click',e=>{if(dragClick){e.stopPropagation();e.preventDefault()}},true);
  // teclado: Alt + ↑/↓ no cartão
  list.addEventListener('keydown',e=>{
    if(!e.altKey||(e.key!=='ArrowUp'&&e.key!=='ArrowDown'))return;
    const item=e.target.closest&&e.target.closest('.pg-item');if(!item||item.classList.contains('editing'))return;
    const it=P.items.find(i=>i.id===item.dataset.id);if(!it)return;
    e.preventDefault();e.stopPropagation();move(it,e.key==='ArrowUp'?-1:1);
  });
}
function startDrag(){
  const it=drag.item,r=it.getBoundingClientRect(),g=it.cloneNode(true);
  g.classList.add('pg-ghost');g.removeAttribute('tabindex');g.setAttribute('aria-hidden','true');
  Object.assign(g.style,{left:r.left+'px',top:r.top+'px',width:r.width+'px'});
  document.body.appendChild(g);drag.ghost=g;drag.on=true;
  it.classList.add('pg-dragging');document.body.classList.add('pg-drag');
}
function finishEdit(){
  const el=document.querySelector('#pgList .pg-item.editing');if(el)commitEdit(el);
  editing=null;hideAc();normalize();save();render();
}

/* ---------------- @ autocompletar ---------------- */
let ac={ta:null,start:0,sel:0,opts:[]};
function acCheck(ta){
  const v=ta.value.slice(0,ta.selectionStart);
  const m=/(^|\s)@([\p{L}\p{N}_-]*)$/u.exec(v);
  if(!m){hideAc();return}
  const q=m[2].toLowerCase();
  const arr=Object.values(P.anexos).filter(a=>a.nome.toLowerCase().startsWith(q)||a.nome.toLowerCase().includes(q)).slice(0,6);
  ac={ta,start:ta.selectionStart-m[2].length-1,sel:0,opts:[
    ...arr.map(a=>({t:'a',a})),
    {t:'file',label:'Anexar arquivo (slide, imagem, vídeo, música)…'},
    {t:'link',label:'Link do Canva ou do YouTube…'},
    {t:'text',label:'Texto (letra, versículo)…'}
  ]};
  drawAc();
}
function drawAc(){
  const box=$('pgAc'),ta=ac.ta;if(!ta)return;
  box.innerHTML=ac.opts.map((o,i)=>`<div role="option" class="pg-ac-it${i===ac.sel?' on':''}" data-i="${i}" aria-selected="${i===ac.sel}">${o.t==='a'?C.icon(o.a.kind)+'<b>@'+C.esc(o.a.nome)+'</b><small>'+C.esc(C.KIND_LABEL[o.a.kind]||'')+'</small>':'<span class="pg-ac-plus">+</span>'+C.esc(o.label)}</div>`).join('');
  const r=ta.getBoundingClientRect(),w=$('pgWrap').getBoundingClientRect();
  box.style.left=(r.left-w.left)+'px';box.style.top=(r.bottom-w.top+$('pgWrap').scrollTop+4)+'px';box.style.width=Math.min(360,r.width)+'px';
  box.hidden=false;
}
function hideAc(){const b=$('pgAc');if(b)b.hidden=true;ac.ta=null}
async function acPick(i){
  const o=ac.opts[i],ta=ac.ta;if(!o||!ta)return;
  const start=ac.start,end=ta.selectionStart;hideAc();
  let a=null;
  if(o.t==='a')a=o.a;
  else if(o.t==='file'){const fs=await pickFiles();for(const f of fs){const x=await addFile(f);if(x){a=x;break}}}
  else if(o.t==='link')a=await addLink();
  else if(o.t==='text')a=await addText();
  if(!a){ta.focus();return}
  const ins='@'+a.nome+' ';
  ta.value=ta.value.slice(0,start)+ins+ta.value.slice(end);
  ta.focus();ta.selectionStart=ta.selectionEnd=start+ins.length;
}
function pickFiles(){
  return new Promise(res=>{const f=$('pgFile');f.value='';f.onchange=()=>res([...f.files]);f.click()});
}

/* ---------------- anexos: nomear ---------------- */
function dialog(html,onOk,okLabel){
  return new Promise(res=>{
    const d=document.createElement('div');d.className='pg-modal';d.setAttribute('role','dialog');d.setAttribute('aria-modal','true');
    d.innerHTML=`<form class="pg-modal-card">${html}<div class="pg-modal-btns"><button type="button" class="pg-btn" data-x>CANCELAR</button><button type="submit" class="pg-btn primary">${okLabel||'OK'}</button></div></form>`;
    document.body.appendChild(d);
    const f=d.querySelector('form'),first=f.querySelector('input,textarea');if(first){first.focus();first.select&&first.select()}
    const close=v=>{d.remove();res(v)};
    d.querySelector('[data-x]').onclick=()=>close(null);
    d.addEventListener('keydown',e=>{e.stopPropagation();if(e.key==='Escape')close(null)});
    f.onsubmit=e=>{e.preventDefault();const v=onOk(f);if(v!==false)close(v)};
  });
}
function nameField(def,hint){
  return `<label class="pg-lbl">NOME PARA USAR COM @</label><div class="pg-at"><span>@</span><input name="nome" value="${C.esc(def)}" maxlength="24" pattern="[\\p{L}\\p{N}_\\-]+" required></div><div class="pg-hint">${hint||'Sem espaços. Ex.: SlidePr, LetraHino, VideoAbertura'}</div>`;
}
async function addFile(file,dropName){
  const kind=C.kind(file.type,file.name);
  const nome=await dialog(`<h3>${C.icon(kind)} Anexar ${C.esc(C.KIND_LABEL[kind]||'arquivo').toLowerCase()}</h3>
    <div class="pg-file"><b>${C.esc(file.name)}</b><small>${C.size(file.size)}</small></div>${nameField(uniqueName(dropName||file.name))}`,
    f=>uniqueName(f.nome.value));
  if(!nome)return null;
  const id=C.uid(8);
  let texto;if(kind==='texto'&&file.size<200000){try{texto=await file.text()}catch(e){}}
  try{await fput(sess.slug+':'+id,file)}catch(e){toast('Não deu para guardar o arquivo: '+e.message);return null}
  const a={id,nome,kind,mime:file.type,size:file.size,arquivo:file.name,texto};
  P.anexos[id]=a;save();renderLib();toast('@'+nome+' anexado');
  return a;
}
async function addLink(){
  const r=await dialog(`<h3>${C.icon('canva')} Link do Canva ou do YouTube</h3><label class="pg-lbl">LINK</label><input name="url" placeholder="https://www.canva.com/design/…  ou  https://youtu.be/…" required>${nameField('Slide','Sem espaços. Ex.: SlidePr, VideoAbertura. O YouTube abre limpo, sem sugestões.')}`,
    f=>({url:f.url.value.trim(),nome:uniqueName(f.nome.value)}));
  if(!r||!r.url)return null;
  const url=/^https?:\/\//i.test(r.url)?r.url:'https://'+r.url;
  const kind=C.kind('','',url);
  const a={id:C.uid(8),nome:(kind==='youtube'&&r.nome.startsWith('Slide'))?uniqueName('Video'):r.nome,kind,url};
  P.anexos[a.id]=a;save();renderLib();return a;
}
async function addText(){
  const r=await dialog(`<h3>${C.icon('texto')} Texto</h3><label class="pg-lbl">TEXTO (aparece grande no palco)</label><textarea name="t" rows="6" required></textarea>${nameField('Texto')}`,
    f=>({t:f.t.value,nome:uniqueName(f.nome.value)}));
  if(!r||!r.t.trim())return null;
  const a={id:C.uid(8),nome:r.nome,kind:'texto',texto:r.t,size:r.t.length};
  P.anexos[a.id]=a;save();renderLib();return a;
}
async function preview(a){
  let body='';
  try{
    if(a.kind==='imagem')body=`<img class="pg-prev" src="${await urlOf(a)}" alt="">`;
    else if(a.kind==='video')body=`<video class="pg-prev" src="${await urlOf(a)}" controls></video>`;
    else if(a.kind==='musica')body=`<audio src="${await urlOf(a)}" controls style="width:100%"></audio>`;
    else if(a.kind==='texto')body=`<div class="pg-prev-t">${C.esc(a.texto||'').replace(/\n/g,'<br>')}</div>`;
    else if(a.url)body=`<div class="pg-prev-t"><a href="${C.esc(a.url)}" target="_blank" rel="noopener">${C.esc(a.url)}</a></div>`;
  }catch(e){body=`<div class="pg-hint">${C.esc(e.message)}</div>`}
  const r=await dialog(`<h3>${C.icon(a.kind)} @${C.esc(a.nome)} <small>${C.esc(C.KIND_LABEL[a.kind]||'')} ${C.size(a.size)}</small></h3>${body}
    ${nameField(a.nome,'Renomear: as menções nos itens são atualizadas.')}
    <div class="pg-prev-acts"><button type="button" class="pg-btn sm primary" data-use>▶ USAR AGORA</button><button type="button" class="pg-btn sm danger" data-rm>REMOVER</button></div>`,
    f=>({nome:f.nome.value}));
  if(r&&r.nome&&C.cleanName(r.nome)!==a.nome)rename(a,r.nome);
}
function rename(a,n){
  const old=a.nome;a.nome='';const nn=uniqueName(n);a.nome=nn;
  const re=new RegExp('@'+old.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+'(?![\\p{L}\\p{N}_-])','giu');
  P.items.forEach(it=>{it.texto=String(it.texto||'').replace(re,'@'+nn)});
  save();render();toast('@'+old+' → @'+nn);
}
async function removeAnexo(a){
  delete P.anexos[a.id];try{await fdel(sess.slug+':'+a.id)}catch(e){}
  if(urlCache[a.id]){URL.revokeObjectURL(urlCache[a.id]);delete urlCache[a.id]}
  save();render();toast('@'+a.nome+' removido');
}

/* ---------------- arrastar e soltar ---------------- */
let dragDepth=0;
function wireDrop(){
  const host=$('panel-prog'),ov=$('pgDrop');
  const hasFiles=e=>[...(e.dataTransfer&&e.dataTransfer.types||[])].some(t=>t==='Files'||t==='text/uri-list');
  host.addEventListener('dragenter',e=>{if(!hasFiles(e))return;e.preventDefault();dragDepth++;ov.classList.add('on')});
  host.addEventListener('dragleave',()=>{if(--dragDepth<=0){dragDepth=0;ov.classList.remove('on')}});
  host.addEventListener('dragover',e=>{if(!hasFiles(e))return;e.preventDefault();
    const it=document.elementsFromPoint(e.clientX,e.clientY).map(x=>x.closest&&x.closest('.pg-item')).find(Boolean);
    document.querySelectorAll('.pg-item.drop-on').forEach(x=>x!==it&&x.classList.remove('drop-on'));
    if(it)it.classList.add('drop-on');
    $('pgDropT').textContent=it?'no item "'+(P.items.find(i=>i.id===it.dataset.id)||{}).titulo+'"':'à biblioteca de anexos';
  });
  host.addEventListener('drop',async e=>{
    if(!hasFiles(e))return;e.preventDefault();dragDepth=0;ov.classList.remove('on');
    const itEl=document.elementsFromPoint(e.clientX,e.clientY).map(x=>x.closest&&x.closest('.pg-item')).find(Boolean);
    document.querySelectorAll('.pg-item.drop-on').forEach(x=>x.classList.remove('drop-on'));
    const ta=e.target.closest&&e.target.closest('textarea');
    const files=[...e.dataTransfer.files];
    const added=[];
    if(files.length){for(const f of files){const a=await addFile(f);if(a)added.push(a)}}
    else{const u=(e.dataTransfer.getData('text/uri-list')||e.dataTransfer.getData('text/plain')||'').split('\n')[0].trim();
      if(u){const n=await dialog(`<h3>${C.icon(C.kind('','',u))} Link</h3><div class="pg-file"><b>${C.esc(u)}</b></div>${nameField(/canva/i.test(u)?'Slide':'Link')}`,f=>uniqueName(f.nome.value));
        if(n){const a={id:C.uid(8),nome:n,kind:C.kind('','',u),url:u};P.anexos[a.id]=a;added.push(a)}}}
    if(!added.length)return;
    const mention=added.map(a=>'@'+a.nome).join(' ');
    if(ta){const p=ta.selectionStart||ta.value.length;ta.value=ta.value.slice(0,p)+(p&&!/\s$/.test(ta.value.slice(0,p))?' ':'')+mention+' '+ta.value.slice(p);return}
    if(itEl){const it=P.items.find(i=>i.id===itEl.dataset.id);if(it){it.texto=(it.texto?it.texto.replace(/\s*$/,' '):'')+mention;P.exemplo=false}}
    save();render();
  });
}

/* ---------------- publicação (MQTT) ---------------- */
function pubPayload(){
  const an={};
  Object.values(P.anexos).forEach(a=>{an[a.id]={id:a.id,nome:a.nome,kind:a.kind,size:a.size||0,url:a.url||undefined,texto:a.kind==='texto'&&(a.texto||'').length<20000?a.texto:undefined}});
  return {v:1,igreja:sess.nome,titulo:P.titulo,data:P.data,items:ordered().map(i=>({id:i.id,hora:i.hora,dur:i.dur,tipo:i.tipo,titulo:i.titulo,texto:i.texto,estado:i.estado})),anexos:an,cfg:{aviso:cfg.aviso,lastDur:cfg.lastDur},at:Date.now()};
}
function ensureClient(){
  if(client||!P.pub)return;
  const topics=[C.topicProg(P.pub.id)];if(P.pub.key)topics.push(C.topicComments(P.pub.id,P.pub.key));
  client=C.connect(topics,(t,o,ret)=>{
    if(P.pub&&P.pub.key&&t===C.topicComments(P.pub.id,P.pub.key)){
      const before=new Set(comments.list.map(c=>c.id));
      const merged=C.mergeComments(comments,o);
      const novo=merged.list.filter(c=>!before.has(c.id));
      comments=merged;renderComments();
      if(!ret&&novo.length)toast('Novo comentário de '+(novo[novo.length-1].autor||'alguém'));
    }
  },st=>{if(st==='ready')publishNow();renderPub()});
}
function schedulePublish(){if(!P||!P.pub)return;clearTimeout(pubTimer);pubTimer=setTimeout(publishNow,600)}
function publishNow(){
  if(!P.pub||!client||client.state!=='ready')return;
  client.publish(C.topicProg(P.pub.id),JSON.stringify(pubPayload()),true);
}
function siteUrl(edit){
  const base=location.href.replace(/[#?].*$/,'').replace(/[^/]*$/,'');
  return base+'programacao.html#'+P.pub.id+(edit&&P.pub.key?'.'+P.pub.key:'');
}
function publicar(edit){
  if(!P.pub)P.pub={id:C.uid(10)};
  if(edit&&!P.pub.key)P.pub.key=C.uid(8);
  save();ensureClient();
  if(client&&edit&&client.state==='ready'){/* reassinar com comentários */client.ws&&client.ws.close();client=null;ensureClient()}
  publishNow();renderPub();
  return siteUrl(edit);
}
function despublicar(){
  if(client&&P.pub){client.publish(C.topicProg(P.pub.id),'',true);if(P.pub.key)client.publish(C.topicComments(P.pub.id,P.pub.key),'',true)}
  setTimeout(()=>{try{client&&client.ws&&client.ws.close()}catch(e){}client=null},400);
  P.pub=null;comments={v:1,list:[],del:[]};save();render();toast('Site despublicado');
}
function renderPub(){
  const box=$('pgPubBox');if(!box)return;
  if(!P.pub){box.hidden=true;$('pgCmtBox').hidden=true;return}
  box.hidden=false;
  const on=client&&client.state==='ready';
  $('pgPubInfo').innerHTML=`<div class="pg-pub-st"><i class="${on?'on':''}"></i>${on?'ao vivo — mudanças aparecem na hora':'conectando…'}</div>
    <div class="pg-pub-l"><small>SITE</small><input readonly value="${C.esc(siteUrl(false))}"><button type="button" class="pg-mini" data-copy="${C.esc(siteUrl(false))}" aria-label="Copiar link do site">⧉</button></div>
    ${P.pub.key?`<div class="pg-pub-l"><small>EDITÁVEL</small><input readonly value="${C.esc(siteUrl(true))}"><button type="button" class="pg-mini" data-copy="${C.esc(siteUrl(true))}" aria-label="Copiar link editável">⧉</button></div>`:''}
    <div class="pg-pub-acts"><button type="button" class="pg-btn sm" id="pgDl">BAIXAR .HTML</button><button type="button" class="pg-btn sm danger" id="pgUnpub">DESPUBLICAR</button></div>`;
  $('pgCmtBox').hidden=!P.pub.key;
  $('pgDl').onclick=baixarSite;$('pgUnpub').onclick=despublicar;
}
function renderComments(){
  const box=$('pgCmts');if(!box)return;
  $('pgCmtN').textContent=comments.list.length;
  const bn=byName(),items={};P.items.forEach(i=>items[i.id]=i);
  box.innerHTML=comments.list.length?comments.list.slice().reverse().map(c=>{
    const fbn=Object.assign({},bn);(c.files||[]).forEach(f=>{fbn[String(f.nome).toLowerCase()]={id:'c:'+c.id+':'+f.nome,nome:f.nome,kind:f.kind}});
    return `<div class="pg-cmt"><div class="pg-cmt-h"><b>${C.esc(c.autor||'Anônimo')}</b><small>${C.ago(c.at)}${c.item&&items[c.item]?' · '+C.esc(items[c.item].titulo):''}</small>
      <button type="button" class="pg-mini" data-cdel="${c.id}" aria-label="Apagar comentário">×</button></div>
      <div class="pg-cmt-t">${C.renderText(c.texto,fbn)}</div>
      ${(c.files||[]).map(f=>`<button type="button" class="pg-save" data-csave="${c.id}" data-f="${C.esc(f.nome)}">${C.icon(f.kind)} salvar @${C.esc(f.nome)} nos anexos</button>`).join('')}</div>`}).join(''):'<div class="pg-empty">Ninguém comentou ainda.</div>';
}
async function baixarSite(){
  try{
    const r=await fetch('programacao.html');let h=await r.text();
    const core=await (await fetch('prog/core.js')).text(),cc=await (await fetch('prog/core-comments.js')).text();
    const data=pubPayload();
    h=h.replace('<script src="prog/core.js"></script>','<script>'+core+'<\/script>').replace('<script src="prog/core-comments.js"></script>','<script>'+cc+'<\/script>')
       .replace('<script src="prog/mqtt.js"></script>','').replace('<!--PF_EMBED-->','<script>window.PF_EMBED='+JSON.stringify(data).replace(/</g,'\\u003c')+'<\/script>');
    const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([h],{type:'text/html'}));a.download=(C.cleanName(P.titulo)||'programacao')+'.html';a.click();
    setTimeout(()=>URL.revokeObjectURL(a.href),4000);
  }catch(e){toast('Não deu para gerar o arquivo: '+e.message)}
}

/* ---------------- exportar imagem ---------------- */
function loadScript(src){return new Promise((res,rej)=>{const s=document.createElement('script');s.src=src;s.onload=res;s.onerror=()=>rej(new Error('não carregou '+src));document.head.appendChild(s)})}
async function exportImage(fmt){
  toast('Gerando '+fmt.toUpperCase()+'…');
  try{
    if(!window.htmlToImage)await loadScript('prog/vendor/html-to-image.js');
    if(fmt==='pdf'&&!window.PDFLib)await loadScript('prog/vendor/pdf-lib.min.js');
  }catch(e){toast(e.message);return}
  const st=C.compute(P.items,{aviso:cfg.aviso,lastDur:cfg.lastDur,data:P.data});
  const bn=byName();
  const el=document.createElement('div');el.className='pg-print';
  const dataTxt=P.data?new Date(P.data+'T12:00').toLocaleDateString('pt-BR',{weekday:'long',day:'numeric',month:'long',year:'numeric'}):'';
  el.innerHTML=`<div class="pp-h"><small>${C.esc(sess.nome)}</small><h1>${C.esc(P.titulo)}</h1><span>${C.esc(dataTxt)}</span></div>
    ${ordered().map(it=>{const s=st.map[it.id],tp=C.tipo(it.tipo);return `<div class="pp-it st-${s.state}" style="--c:${tp.color}"><div class="pp-t">${C.esc(it.hora||'--:--')}</div><span class="pg-dot st-${s.state}"></span>
      <div class="pp-c"><small class="pp-tp">${tp.label}${+it.dur>0?' · '+C.dur(+it.dur):''}</small><b>${C.esc(it.titulo)}</b>${it.estado==='ignorado'?' <em>(não acontecerá)</em>':''}${it.texto?`<p>${C.renderText(it.texto,bn).replace(/<svg[\s\S]*?<\/svg>/g,'')}</p>`:''}</div></div>`}).join('')}
    <div class="pp-f">Gerado com O Púlpito · ${new Date().toLocaleString('pt-BR')}</div>`;
  document.body.appendChild(el);
  const name=(C.cleanName(P.titulo)||'programacao');
  const save=(href,fn)=>{const a=document.createElement('a');a.href=href;a.download=fn;document.body.appendChild(a);a.click();a.remove()};
  try{
    const opt={pixelRatio:2,backgroundColor:'#0a0d13',style:{left:'0',top:'0',position:'static'}};
    if(fmt==='jpeg'){
      save(await htmlToImage.toJpeg(el,Object.assign({quality:.92},opt)),name+'.jpg');
    }else{
      const cv=await htmlToImage.toCanvas(el,opt);
      const {PDFDocument,rgb}=PDFLib;const doc=await PDFDocument.create();
      const PW=595.28,PH=841.89,scale=PW/cv.width,sliceH=Math.floor(PH/scale);
      for(let y=0;y<cv.height;y+=sliceH){
        const h=Math.min(sliceH,cv.height-y);
        const c2=document.createElement('canvas');c2.width=cv.width;c2.height=h;c2.getContext('2d').drawImage(cv,0,y,cv.width,h,0,0,cv.width,h);
        const jpg=await doc.embedJpg(await (await fetch(c2.toDataURL('image/jpeg',.92))).arrayBuffer());
        const page=doc.addPage([PW,PH]);
        page.drawRectangle({x:0,y:0,width:PW,height:PH,color:rgb(10/255,13/255,19/255)});
        page.drawImage(jpg,{x:0,y:PH-h*scale,width:PW,height:h*scale});
      }
      doc.setTitle(P.titulo||'Programação');doc.setAuthor(sess.nome);
      const bytes=await doc.save();
      const u=URL.createObjectURL(new Blob([bytes],{type:'application/pdf'}));save(u,name+'.pdf');setTimeout(()=>URL.revokeObjectURL(u),5000);
    }
    toast('Pronto: '+fmt.toUpperCase());
  }catch(e){toast('Falhou: '+(e&&e.message||e))}
  finally{el.remove()}
}

/* ---------------- configurações ---------------- */
function openConfig(){
  const d=document.createElement('div');d.className='pg-modal';d.setAttribute('role','dialog');d.setAttribute('aria-modal','true');d.setAttribute('aria-label','Configurações');
  d.innerHTML=`<div class="pg-modal-card wide">
    <h3>Configurações</h3>
    <div class="cf-sec"><h4>PROGRAMAÇÃO</h4>
      <label class="cf-row"><span>Quando um item entrar <b>no ar</b><small>o que o palco faz com os anexos (slide, YouTube, imagem, vídeo, texto, música): no automático eles vão em fila para a Projeção</small></span>
        <select id="cfAcao"><option value="nada">Não fazer nada</option><option value="perguntar">Mostrar aviso com botão "usar"</option><option value="auto">Usar automaticamente</option></select></label>
      <label class="cf-row"><span>Bolinha laranja (<b>prestes a acontecer</b>)<small>quantos minutos antes</small></span><input type="number" id="cfAviso" min="1" max="60"></label>
      <label class="cf-row"><span>Duração do último item<small>quando ele não tiver duração própria (min)</small></span><input type="number" id="cfLast" min="5" max="600"></label>
      <label class="cf-row"><span>Perguntar <b>"Acabou?"</b> quando o tempo de um momento terminar<small>a tela vai para a Programação (menos se estiver na Projeção) e pergunta se pode seguir ou atrasar</small></span><input type="checkbox" id="cfFim"></label>
      <label class="cf-row"><span>Passar sozinho para o próximo anexo<small>quando um vídeo, YouTube ou música da fila terminar, sem perguntar</small></span><input type="checkbox" id="cfSeguir"></label>
      <label class="cf-row"><span>Rolar sozinho até o momento no ar</span><input type="checkbox" id="cfRolar"></label>
      <label class="cf-row"><span>Abaixar a música do Fundo ao tocar música anexada</span><input type="checkbox" id="cfDuck"></label>
    </div>
    <div class="cf-sec"><h4>DADOS</h4>
      <div class="cf-row"><span>Backup da programação<small>sem os arquivos (eles ficam neste computador)</small></span>
        <span class="cf-btns"><button type="button" class="pg-btn sm" id="cfExp">BAIXAR</button><button type="button" class="pg-btn sm" id="cfImp">RESTAURAR</button></span></div>
      <div class="cf-row"><span>Nova programação<small>começar de um modelo (mantém os anexos)</small></span><button type="button" class="pg-btn sm danger" id="cfNew">NOVA</button></div>
    </div>
    <div class="cf-sec"><h4>CONTA</h4>
      <div class="cf-row"><span>Igreja<small>login simulado neste navegador (desenvolvimento)</small></span><b>${C.esc(sess.nome)}</b></div>
      <div class="cf-row"><span></span><button type="button" class="pg-btn sm danger" id="cfOut">SAIR</button></div>
    </div>
    <div class="pg-modal-btns"><button type="button" class="pg-btn primary" data-x>FECHAR</button></div>
    <input type="file" id="cfFile" accept="application/json" hidden></div>`;
  document.body.appendChild(d);
  const q=id=>d.querySelector('#'+id);
  q('cfAcao').value=cfg.acao;q('cfAviso').value=cfg.aviso;q('cfLast').value=cfg.lastDur;q('cfRolar').checked=cfg.rolar;q('cfFim').checked=cfg.perguntarFim!==false;q('cfDuck').checked=cfg.duck;q('cfSeguir').checked=!!cfg.seguir;
  const upd=()=>{cfg.acao=q('cfAcao').value;cfg.aviso=Math.max(1,+q('cfAviso').value||5);cfg.lastDur=Math.max(5,+q('cfLast').value||30);cfg.rolar=q('cfRolar').checked;cfg.perguntarFim=q('cfFim').checked;cfg.duck=q('cfDuck').checked;cfg.seguir=q('cfSeguir').checked;saveCfg();tick();schedulePublish()};
  d.querySelectorAll('select,input').forEach(x=>x.addEventListener('change',upd));
  const close=()=>{d.remove();$('tsConfig')&&$('tsConfig').focus()};
  d.querySelector('[data-x]').onclick=close;d.addEventListener('keydown',e=>{e.stopPropagation();if(e.key==='Escape')close()});
  d.addEventListener('click',e=>{if(e.target===d)close()});
  q('cfOut').onclick=()=>PFAuth.sair();
  q('cfNew').onclick=()=>{close();openModelos()};
  q('cfExp').onclick=()=>{const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([JSON.stringify({programacao:P,config:cfg},null,2)],{type:'application/json'}));a.download='programacao-backup.json';a.click()};
  q('cfImp').onclick=()=>q('cfFile').click();
  q('cfFile').onchange=async()=>{try{const o=JSON.parse(await q('cfFile').files[0].text());if(!o.programacao||!Array.isArray(o.programacao.items))throw new Error('arquivo inválido');
    const keepPub=P.pub;P=o.programacao;P.pub=keepPub;P.anexos=Object.assign({},P.anexos||{});if(o.config)cfg=Object.assign({},DEF_CFG,o.config);saveCfg();save();render();toast('Programação restaurada');close()}catch(e){toast('Não deu: '+e.message)}};
  q('cfAcao').focus();
}
/* confirmação em 2 cliques (sem diálogo do navegador) */
function confirmar(btn){
  if(btn.dataset.sure)return true;
  const t=btn.textContent;btn.dataset.sure='1';btn.textContent='CLIQUE DE NOVO';
  setTimeout(()=>{btn.textContent=t;delete btn.dataset.sure},2500);return false;
}

/* ---------------- eventos ---------------- */
function wire(){
  $('pgTitle').addEventListener('input',e=>{P.titulo=e.target.value;P.exemplo=false;save()});
  $('pgDate').addEventListener('change',e=>{P.data=e.target.value;save()});
  $('pgAdd').onclick=addItem;
  $('pgNew').onclick=openModelos;$('pgTour2').onclick=startTour;
  $('pgModelos').onclick=openModelos;$('pgHelp').onclick=startTour;
  $('pgAuto').addEventListener('change',e=>setAuto(e.target.checked));
  $('pgAttach').onclick=async()=>{for(const f of await pickFiles())await addFile(f)};
  $('pgAddLink').onclick=addLink;$('pgAddText').onclick=addText;
  $('pgPlStop').onclick=stopAudio;
  $('pgAudio').addEventListener('ended',()=>{if(pgDucked&&typeof window.setDuck==='function')window.setDuck(false);pgDucked=false;onItemEnded($('pgAudio').dataset.id)});
  const eb=$('pgExportBtn'),em=$('pgExportMenu');
  eb.onclick=e=>{e.stopPropagation();em.hidden=!em.hidden;eb.setAttribute('aria-expanded',String(!em.hidden))};
  document.addEventListener('click',e=>{if(!em.hidden&&!e.target.closest('.pg-menu-wrap')){em.hidden=true;eb.setAttribute('aria-expanded','false')}});
  em.addEventListener('click',async e=>{
    const b=e.target.closest('[data-x]');if(!b)return;em.hidden=true;
    const x=b.dataset.x;
    if(x==='pdf'||x==='jpeg')return exportImage(x);
    const url=publicar(x==='edit');
    try{await navigator.clipboard.writeText(url);toast('Link copiado: '+(x==='edit'?'site editável':'site'))}catch(_){toast('Link pronto na lateral')}
  });
  const wrap=$('pgWrap');
  wrap.addEventListener('click',e=>{
    const lv=e.target.closest('[data-live]');if(lv){liveAdjust(lv.dataset.live);return}
    const ck=e.target.closest('[data-ck]');if(ck){if(ck.dataset.ck==='fim')finishNow();else{const l=curState().live;if(l){closeAsk();ask={id:l.id,manual:true};openFocus()}}return}
    const gt=e.target.closest('[data-goto]');if(gt){const el=document.querySelector('#pgList .pg-item[data-id="'+gt.dataset.goto+'"]');if(el){el.scrollIntoView({block:'center',behavior:'smooth'});el.classList.add('flash');setTimeout(()=>el.classList.remove('flash'),1400);el.focus({preventScroll:true})}return}
    if(e.target.closest('[data-mod]')){openModelos();return}
    if(e.target.closest('[data-add]')){addItem();return}
    const chip=e.target.closest('.pf-chip[data-anexo]');if(chip){e.stopPropagation();const a=P.anexos[chip.dataset.anexo];if(a)preview(a).then(()=>{});return}
    const u=e.target.closest('[data-use]');if(u){const row=u.closest('.pg-item');use(P.anexos[u.dataset.use],row&&P.items.find(i=>i.id===row.dataset.id));return}
    const cp=e.target.closest('[data-copy]');if(cp){navigator.clipboard.writeText(cp.dataset.copy).then(()=>toast('Link copiado'),()=>{});return}
    const cd=e.target.closest('[data-cdel]');if(cd){if(!confirmar(cd))return;comments=C.mergeComments(comments,{list:[],del:[cd.dataset.cdel]});comments.list=comments.list.filter(c=>c.id!==cd.dataset.cdel);
      if(client)client.publish(C.topicComments(P.pub.id,P.pub.key),JSON.stringify(comments),true);renderComments();return}
    const cs=e.target.closest('[data-csave]');if(cs){const c=comments.list.find(x=>x.id===cs.dataset.csave),f=c&&(c.files||[]).find(x=>x.nome===cs.dataset.f);
      if(f){const b=C.dataToBlob(f.data);addFile(new File([b],f.arquivo||f.nome,{type:b.type}),f.nome)}return}
    const item=e.target.closest('.pg-item');
    const act=e.target.closest('[data-act]');
    if(item&&act){
      const it=P.items.find(i=>i.id===item.dataset.id);if(!it)return;
      if(act.dataset.act==='ign'){if(item.classList.contains('editing'))commitEdit(item);it.estado=it.estado==='ignorado'?'auto':'ignorado';normalize();save();render();return}
      if(act.dataset.act==='up'||act.dataset.act==='down'){if(item.classList.contains('editing'))commitEdit(item);move(it,act.dataset.act==='up'?-1:1);return}
      if(act.dataset.act==='del'){if(!confirmar(act))return;const first=P.items[0]===it&&P.items[1];if(first)P.items[1].hora=it.hora;P.items=P.items.filter(i=>i!==it);editing=null;normalize();save();render();return}
      if(act.dataset.act==='edit'){if(editing)finishEdit();editing=it.id;render();return}
    }
    if(item&&!item.classList.contains('editing')&&!e.target.closest('button,a')){if(editing)finishEdit();editing=item.dataset.id;render()}
  });
  // abrir o anexo de dentro de um chip ainda dentro do modal de preview
  document.addEventListener('click',e=>{
    const m=e.target.closest('.pg-modal');if(!m)return;
    const ch=m.querySelector('h3');if(!ch)return;
    if(e.target.closest('[data-use]')||e.target.closest('[data-rm]')){
      const nm=(ch.textContent.match(/@([\p{L}\p{N}_-]+)/u)||[])[1];const a=nm&&byName()[nm.toLowerCase()];
      if(!a)return;
      if(e.target.closest('[data-use]')){m.remove();use(a)}
      else if(confirmar(e.target.closest('[data-rm]'))){m.remove();removeAnexo(a)}
    }
  });
  wrap.addEventListener('submit',e=>{if(e.target.closest('.pg-edit')){e.preventDefault();finishEdit()}});
  wrap.addEventListener('input',e=>{if(e.target.matches('.pg-edit textarea'))acCheck(e.target)});
  wrap.addEventListener('keydown',e=>{
    const ta=e.target.matches&&e.target.matches('.pg-edit textarea')?e.target:null;
    if(ta&&ac.ta===ta&&!$('pgAc').hidden){
      if(e.key==='ArrowDown'){e.preventDefault();ac.sel=(ac.sel+1)%ac.opts.length;drawAc();return}
      if(e.key==='ArrowUp'){e.preventDefault();ac.sel=(ac.sel-1+ac.opts.length)%ac.opts.length;drawAc();return}
      if(e.key==='Enter'||e.key==='Tab'){e.preventDefault();acPick(ac.sel);return}
      if(e.key==='Escape'){e.preventDefault();hideAc();return}
    }
    if(e.target.closest&&e.target.closest('.pg-edit')){
      e.stopPropagation(); // não deixa as teclas do palco (espaço = fala, setas = slides) agirem enquanto digita
      if(e.key==='Escape'){e.preventDefault();finishEdit()}
      if(e.key==='Enter'&&(e.ctrlKey||e.metaKey)){e.preventDefault();finishEdit()}
      return;
    }
    if(e.key==='Enter'&&e.target.classList&&e.target.classList.contains('pg-item')){editing=e.target.dataset.id;render()}
  });
  $('pgAc').addEventListener('mousedown',e=>{const o=e.target.closest('[data-i]');if(o){e.preventDefault();acPick(+o.dataset.i)}});
  wrap.addEventListener('focusout',e=>{if(e.target.matches&&e.target.matches('.pg-edit textarea'))setTimeout(()=>{if(document.activeElement!==ac.ta)hideAc()},150)});
  ['pgTitle','pgDate'].forEach(id=>$(id).addEventListener('keydown',e=>e.stopPropagation()));
  wireDrop();wireDrag();
}

/* ---------------- início ---------------- */
async function init(s){
  sess=s;load();mount();render();
  if(P.pub)ensureClient();
  setInterval(()=>tick(),10000);
  setInterval(tickClock,1000);
  pjStart();
  // o relógio da aba e os estados também mudam quando a aba é aberta
  new MutationObserver(()=>{if(document.body.classList.contains('tab-prog'))tick(true)}).observe(document.body,{attributes:true,attributeFilter:['class']});
  const cb=$('tsConfig');if(cb)cb.onclick=openConfig;
  const ch=$('tsChurch');if(ch){ch.textContent=s.nome;ch.onclick=openConfig}
}
function showUrl(url){const id=C.ytId(url);if(!id)return false;const a={id:'yt-'+id,kind:'youtube',nome:'YouTube',url};fila={mid:null,ids:[],idx:-1,music:null,visual:a.id,ask:null};showMedia(a);renderPjBar();return true}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>setTimeout(pjStart,0));else setTimeout(pjStart,0);
window.PFProg={toggleBlack,isBlack:()=>pj.black,showUrl,pjSync,pjLaser,pjOn,openProjWindow,tour,init,closeMedia,mediaOn:()=>document.body.classList.contains('pf-media-on'),use,openConfig,_state:()=>({P,cfg,comments})};
if(window.PFAuth)PFAuth.ready.then(s=>{if(s&&document.getElementById('panel-prog'))init(s)});
})();
