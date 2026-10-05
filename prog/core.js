/* O Púlpito · Programação — regras compartilhadas (palco e página pública) */
(function(){
'use strict';
const C={};
C.pad=n=>String(n).padStart(2,'0');
C.toMin=h=>{const m=/^(\d{1,2}):(\d{2})/.exec(h||'');return m?(+m[1])*60+(+m[2]):null};
C.fmt=min=>{min=((Math.floor(min)%1440)+1440)%1440;return C.pad(Math.floor(min/60))+':'+C.pad(min%60)};
C.dur=m=>{m=Math.round(m);const h=Math.floor(m/60),r=m%60;return h?(h+'h'+(r?C.pad(r):'')):r+' min'};
C.today=()=>{const d=new Date();return d.getFullYear()+'-'+C.pad(d.getMonth()+1)+'-'+C.pad(d.getDate())};
C.dayDiff=data=>{if(!data)return 0;const a=new Date(data+'T12:00'),b=new Date(C.today()+'T12:00');return Math.round((a-b)/864e5)};
C.nowMin=()=>{const d=new Date();return d.getHours()*60+d.getMinutes()+d.getSeconds()/60};
C.uid=(n=10)=>{const A='23456789abcdefghjkmnpqrstuvwxyz';const b=crypto.getRandomValues(new Uint8Array(n));let s='';for(const x of b)s+=A[x%A.length];return s};
C.esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
C.sorted=items=>items.slice().sort((a,b)=>{const x=C.toMin(a.hora),y=C.toMin(b.hora);return (x==null?1e9:x)-(y==null?1e9:y)});

/* estado de cada item pelo relógio */
C.STATES={
  noar:{label:'No ar',color:'#4ade80'},
  prestes:{label:'Prestes a acontecer',color:'#fb923c'},
  ignorado:{label:'Ignorado',color:'#050505'},
  passou:{label:'Já aconteceu',color:'#64748b'},
  agendado:{label:'Agendado',color:'#93c5fd'},
  semhora:{label:'Sem horário',color:'#334155'}
};
C.compute=(items,opt)=>{
  opt=opt||{};
  const aviso=opt.aviso!=null?+opt.aviso:5,lastDur=opt.lastDur!=null?+opt.lastDur:30,now=opt.now!=null?opt.now:C.nowMin();
  const list=C.sorted(items).filter(i=>C.toMin(i.hora)!=null);
  const act=list.filter(i=>i.estado!=='ignorado');
  const res={};let live=null,next=null;const dd=C.dayDiff(opt.data);
  list.forEach(it=>{
    const start=C.toMin(it.hora);
    let end;
    if(+it.dur>0)end=start+(+it.dur);
    else{const nx=act.find(j=>C.toMin(j.hora)>start);end=nx?C.toMin(nx.hora):start+lastDur}
    let st;
    if(it.estado==='ignorado')st='ignorado';
    else if(dd>0)st='agendado';
    else if(dd<0)st='passou';
    else if(now>=start&&now<end)st='noar';
    else if(now<start&&start-now<=aviso)st='prestes';
    else if(now>=end)st='passou';
    else st='agendado';
    res[it.id]={state:st,start,end,progress:st==='noar'?(now-start)/Math.max(1e-6,end-start):st==='passou'?1:0,inMin:start-now};
    if(st==='noar'&&(!live||start>=res[live.id].start))live=it;
    if((st==='prestes'||st==='agendado')&&!next)next=it;
  });
  items.forEach(it=>{if(!res[it.id])res[it.id]={state:'semhora',start:null,end:null,progress:0}});
  return {map:res,live,next,now,dayDiff:dd};
};

/* anexos */
C.MENTION=/@([\p{L}\p{N}_-]+)/gu;
C.cleanName=s=>{
  const n=String(s||'').normalize('NFC').replace(/\.[a-z0-9]{1,5}$/i,'').replace(/[^\p{L}\p{N}_-]+/gu,'').slice(0,24);
  return n||'Anexo';
};
C.ytId=u=>{const m=String(u||'').match(/(?:youtube(?:-nocookie)?\.com\/(?:watch\?(?:[^#]*&)?v=|embed\/|shorts\/|live\/)|youtu\.be\/)([\w-]{11})/);return m?m[1]:null};
/* player do YouTube "limpo": sem sugestões no fim, sem anotações; domínio sem cookies */
C.ytEmbed=(id,o)=>'https://www.youtube-nocookie.com/embed/'+id+'?autoplay=1&rel=0&modestbranding=1&playsinline=1&iv_load_policy=3&disablekb=1&fs=0&enablejsapi=1'+(o&&o.mute?'&mute=1':'')+(o&&o.origin?'&origin='+encodeURIComponent(o.origin):'');
C.TIMED=['video','musica','youtube'];
C.kind=(mime,name,url)=>{
  mime=mime||'';name=(name||'').toLowerCase();
  if(url&&/canva\.(com|link)/i.test(url))return 'canva';
  if(url&&C.ytId(url))return 'youtube';
  if(url)return 'link';
  if(mime.startsWith('image/'))return 'imagem';
  if(mime.startsWith('video/'))return 'video';
  if(mime.startsWith('audio/'))return 'musica';
  if(mime==='application/pdf'||name.endsWith('.pdf'))return 'pdf';
  if(mime.startsWith('text/')||/\.(txt|md)$/.test(name))return 'texto';
  if(/\.(pptx?|key|odp)$/.test(name))return 'slides';
  return 'arquivo';
};
C.KIND_LABEL={canva:'Slide (Canva)',youtube:'YouTube',link:'Link',imagem:'Imagem',video:'Vídeo',musica:'Música',pdf:'PDF',texto:'Texto',slides:'Slides',arquivo:'Arquivo'};
const P={
  youtube:'<rect x="2" y="5" width="20" height="14" rx="4"/><path d="m10 9 5 3-5 3z"/>',
  canva:'<rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8M12 17v4"/>',
  slides:'<rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8M12 17v4"/>',
  link:'<path d="M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7l-1.7 1.7"/><path d="M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7l1.7-1.7"/>',
  imagem:'<rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-5-5L5 21"/>',
  video:'<rect x="2" y="5" width="14" height="14" rx="2"/><path d="m22 8-6 4 6 4V8z"/>',
  musica:'<path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/>',
  pdf:'<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/><path d="M8 13h8M8 17h5"/>',
  texto:'<path d="M4 6h16M4 12h16M4 18h10"/>',
  arquivo:'<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/>'
};
C.icon=(k,cls)=>'<svg class="'+(cls||'pf-ic')+'" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'+(P[k]||P.arquivo)+'</svg>';
C.size=b=>!b?'':b<1024?b+' B':b<1048576?(b/1024).toFixed(0)+' KB':(b/1048576).toFixed(1)+' MB';

/* texto com @menções -> HTML com "chips" */
C.renderText=(text,byName,opt)=>{
  opt=opt||{};
  let out='',last=0;const s=String(text||'');
  s.replace(C.MENTION,(m,name,idx)=>{
    out+=C.esc(s.slice(last,idx));last=idx+m.length;
    const a=byName[name.toLowerCase()];
    if(a)out+='<button type="button" class="pf-chip k-'+a.kind+'" data-anexo="'+C.esc(a.id)+'" title="'+C.esc(C.KIND_LABEL[a.kind]||'Anexo')+'">'+C.icon(a.kind)+'@'+C.esc(a.nome)+'</button>';
    else out+='<span class="pf-chip-miss" title="Anexo não encontrado">@'+C.esc(name)+'</span>';
    return m;
  });
  out+=C.esc(s.slice(last));
  return out.replace(/\n/g,'<br>');
};
C.mentions=text=>{const r=[];String(text||'').replace(C.MENTION,(m,n)=>{r.push(n.toLowerCase());return m});return r};
C.byName=anexos=>{const o={};Object.values(anexos||{}).forEach(a=>{o[String(a.nome).toLowerCase()]=a});return o};

/* tipos de momento (cor + ícone) */
C.TIPOS={
  louvor:{label:'Louvor',color:'#a78bfa',ic:'<path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/>'},
  oracao:{label:'Oração',color:'#60a5fa',ic:'<path d="M12 3c-2 3-5 7-5 11a5 5 0 0 0 10 0c0-4-3-8-5-11z"/>'},
  palavra:{label:'Pregação',color:'#f59e0b',ic:'<path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20V3H6.5A2.5 2.5 0 0 0 4 5.5z"/><path d="M4 19.5A2.5 2.5 0 0 0 6.5 22H20v-5"/>'},
  leitura:{label:'Leitura',color:'#fbbf24',ic:'<path d="M2 4h7a3 3 0 0 1 3 3v13a2 2 0 0 0-2-2H2zM22 4h-7a3 3 0 0 0-3 3v13a2 2 0 0 1 2-2h8z"/>'},
  avisos:{label:'Avisos',color:'#94a3b8',ic:'<path d="M3 11v2a1 1 0 0 0 1 1h2l5 4V6L6 10H4a1 1 0 0 0-1 1z"/><path d="M16 8a5 5 0 0 1 0 8"/>'},
  oferta:{label:'Ofertas',color:'#34d399',ic:'<path d="M20 12v9H4v-9"/><path d="M2 7h20v5H2z"/><path d="M12 22V7M12 7H7.5a2.5 2.5 0 1 1 0-5C11 2 12 7 12 7zM12 7h4.5a2.5 2.5 0 1 0 0-5C13 2 12 7 12 7z"/>'},
  ceia:{label:'Santa Ceia',color:'#f87171',ic:'<path d="M8 22h8M12 15v7M7 2h10l-1 7a4 4 0 0 1-8 0z"/>'},
  batismo:{label:'Batismo',color:'#22d3ee',ic:'<path d="M2 12c2 0 2 2 4 2s2-2 4-2 2 2 4 2 2-2 4-2 2 2 4 2M2 18c2 0 2 2 4 2s2-2 4-2 2 2 4 2 2-2 4-2 2 2 4 2"/><circle cx="12" cy="6" r="3"/>'},
  especial:{label:'Especial',color:'#f472b6',ic:'<path d="m12 2 3 7h7l-5.5 4.5L18.5 21 12 16.5 5.5 21l2-7.5L2 9h7z"/>'},
  intervalo:{label:'Intervalo',color:'#64748b',ic:'<path d="M17 8h1a4 4 0 0 1 0 8h-1M3 8h14v9a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4z"/>'},
  outro:{label:'Outro',color:'#cbd5e1',ic:'<circle cx="12" cy="12" r="9"/>'}
};
C.tipo=k=>C.TIPOS[k]||C.TIPOS.outro;
C.tipoIcon=k=>'<svg class="pf-ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'+C.tipo(k).ic+'</svg>';
/* horários automáticos: cada momento começa quando o anterior termina */
C.cascade=(items,startMin)=>{
  let t=startMin;
  items.forEach(i=>{if(!(+i.dur>0))i.dur='10';i.hora=C.fmt(t);if(i.estado!=='ignorado')t+=(+i.dur)});
  return t;
};
/* modelos prontos [título, tipo, minutos, texto] */
C.MODELOS={
  domingo:{nome:'Culto de domingo',desc:'Louvor, ofertas, pregação e encerramento',inicio:'10:00',itens:[
    ['Acolhida','avisos',10,'Boas-vindas e recepção dos visitantes.'],['Louvor e adoração','louvor',25,''],['Oração','oracao',5,''],
    ['Avisos','avisos',5,''],['Dízimos e ofertas','oferta',5,''],['Momento especial','especial',5,''],
    ['Pregação','palavra',40,''],['Apelo e oração final','oracao',10,''],['Bênção e encerramento','outro',5,'']]},
  oracao:{nome:'Culto de oração',desc:'Leitura, oração em grupos e testemunhos',inicio:'19:30',itens:[
    ['Abertura','outro',5,''],['Louvor','louvor',15,''],['Leitura bíblica','leitura',10,''],['Oração em grupos','oracao',30,''],
    ['Testemunhos','especial',15,''],['Encerramento','oracao',5,'']]},
  ceia:{nome:'Culto de Santa Ceia',desc:'Louvor, mensagem e ceia',inicio:'18:00',itens:[
    ['Louvor','louvor',20,''],['Leitura bíblica','leitura',5,''],['Pregação','palavra',25,''],['Santa Ceia','ceia',20,'Pão e cálice.'],
    ['Oração','oracao',5,''],['Encerramento','outro',5,'']]},
  casamento:{nome:'Cerimônia de casamento',desc:'Entradas, mensagem, votos e alianças',inicio:'16:00',itens:[
    ['Entrada do noivo','especial',3,''],['Entrada dos padrinhos','especial',7,''],['Entrada da noiva','especial',4,''],['Louvor','louvor',6,''],
    ['Mensagem aos noivos','palavra',15,''],['Votos','especial',10,''],['Alianças','especial',5,''],['Oração pelos noivos','oracao',5,''],['Saída dos noivos','outro',5,'']]},
  branco:{nome:'Em branco',desc:'Só um momento, você monta o resto',inicio:'19:00',itens:[['Primeiro momento','outro',15,'']]}
};
C.fromModelo=(k,inicio)=>{
  const m=C.MODELOS[k]||C.MODELOS.branco;
  const items=m.itens.map(x=>({id:C.uid(8),titulo:x[0],tipo:x[1],dur:String(x[2]),texto:x[3],estado:'auto',hora:''}));
  C.cascade(items,C.toMin(inicio||m.inicio));
  return items;
};

window.PFCore=C;
})();
