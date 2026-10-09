/* O Púlpito · passo a passo ("como funciona") de cada parte do app */
(function(){
'use strict';
const CSS=`
.pf-tour-hl{position:fixed;z-index:880;border-radius:16px;box-shadow:0 0 0 9999px rgba(2,4,7,.62),0 0 0 2px #8ff0c2;pointer-events:none;transition:all .25s}
.pf-tour{position:fixed;z-index:890;padding:16px 16px 12px;border-radius:20px;border:1px solid rgba(255,255,255,.2);color:#eef4f8;
  font-family:Inter,ui-sans-serif,system-ui,-apple-system,"Segoe UI",Roboto,Arial,sans-serif;box-sizing:border-box;
  background:linear-gradient(180deg,rgba(255,255,255,.14),rgba(255,255,255,.04)),rgba(16,20,28,.95);box-shadow:inset 0 1px 0 rgba(255,255,255,.25),0 24px 60px rgba(0,0,0,.6)}
.pf-tour small{font:800 10px/1 inherit;letter-spacing:2px;color:#8ff0c2}
.pf-tour>b{display:block;font-size:17px;margin:6px 0 4px}
.pf-tour p b{display:inline;font-size:inherit;margin:0;color:#fff}
.pf-tour p{margin:0;font-size:14px;line-height:1.55;color:#cfd8e2}
.pf-tour kbd{font:700 11px/1 ui-monospace,Consolas,monospace;padding:2px 6px;border:1px solid rgba(255,255,255,.25);border-radius:5px;color:#fff}
.pf-tour-b{display:flex;gap:6px;margin-top:14px;align-items:center}
.pf-tour-b span{flex:1}
.pf-tour-b button{min-height:36px;padding:0 13px;border-radius:11px;border:1px solid rgba(255,255,255,.18);background:rgba(255,255,255,.08);color:#fff;font:800 11px/1 inherit;letter-spacing:1.2px;cursor:pointer}
.pf-tour-b button.p{background:linear-gradient(180deg,rgba(255,255,255,.55),rgba(255,255,255,0) 60%),rgba(170,255,210,.92);color:#05140c;border-color:rgba(255,255,255,.55)}
.pf-tour-b button:focus-visible{outline:2px solid #8ff0c2;outline-offset:2px}
.pf-tour-dots{display:flex;gap:4px;margin-top:10px}.pf-tour-dots i{width:6px;height:6px;border-radius:50%;background:rgba(255,255,255,.2)}.pf-tour-dots i.on{background:#8ff0c2}
.pf-help{width:34px;height:32px;border-radius:11px;border:1px solid rgba(255,255,255,.16);background:linear-gradient(180deg,rgba(255,255,255,.12),rgba(255,255,255,.03)),rgba(255,255,255,.06);
  color:#eef4f8;font:800 15px/1 system-ui,sans-serif;cursor:pointer;flex:0 0 auto}
.pf-help:hover{border-color:rgba(170,255,215,.6)}.pf-help:focus-visible{outline:2px solid #8ff0c2;outline-offset:2px}
.pf-help-float{position:fixed;right:14px;bottom:14px;z-index:170;width:46px;height:46px;border-radius:50%;font-size:19px;box-shadow:0 10px 30px rgba(0,0,0,.5);
  -webkit-backdrop-filter:blur(16px);backdrop-filter:blur(16px)}
@media (prefers-reduced-motion:reduce){.pf-tour-hl{transition:none}}`;
let cssDone=false;
function css(){if(cssDone)return;cssDone=true;const s=document.createElement('style');s.textContent=CSS;document.head.appendChild(s)}
const key=n=>'pf.tour.'+n;
/* "assinatura" dos passos: se um passo novo entra no tutorial, ele volta a aparecer sozinho para quem já tinha visto */
const sig=steps=>{let h=0;const t=(steps||[]).map(x=>x.t).join('|');for(let i=0;i<t.length;i++)h=(h*31+t.charCodeAt(i))|0;return 'v'+(h>>>0).toString(36)};
function stored(n){try{return localStorage.getItem(key(n))}catch(e){return 'x'}}
function seen(n,steps){const v=stored(n);return !!v&&(!steps||v==='1'||v===sig(steps))}
function mark(n,steps){try{localStorage.setItem(key(n),steps?sig(steps):'1')}catch(e){}}
function visible(e){if(!e)return false;const r=e.getBoundingClientRect();return r.width>0&&r.height>0&&getComputedStyle(e).visibility!=='hidden'}
function find(st){
  for(const s of String(st.el).split('||')){const e=document.querySelector(s.trim());if(visible(e))return st.up&&e.closest(st.up)?e.closest(st.up):e}
  return null;
}
function end(){document.querySelectorAll('.pf-tour,.pf-tour-hl').forEach(x=>x.remove());document.removeEventListener('keydown',onKey,true)}
let cur=null;
function onKey(e){
  if(!cur)return;
  if(e.key==='Escape'){e.preventDefault();e.stopPropagation();finish()}
  else if(e.key==='ArrowRight'){e.preventDefault();e.stopPropagation();go(cur.i+1)}
  else if(e.key==='ArrowLeft'){e.preventDefault();e.stopPropagation();go(cur.i-1)}
  else if(e.key===' '){e.stopPropagation()}
}
function finish(){if(cur)mark(cur.name,cur.steps);end();const back=cur&&cur.back;cur=null;if(back&&back.focus)try{back.focus()}catch(e){}}
function go(i){
  if(!cur)return;
  end();
  const steps=cur.steps;
  if(i<0)i=0;
  if(i>=steps.length)return finish();
  const st=steps[i],el=find(st);
  if(!el){cur.i=i;return go(i+(cur.dir||1))}
  cur.dir=i>=cur.i?1:-1;cur.i=i;
  try{el.scrollIntoView({block:'center'})}catch(e){}
  document.addEventListener('keydown',onKey,true);
  setTimeout(()=>{
    if(!cur||cur.i!==i)return;
    const r=el.getBoundingClientRect(),h=Math.min(r.height,Math.max(120,innerHeight*.45));
    const hl=document.createElement('div');hl.className='pf-tour-hl';
    Object.assign(hl.style,{left:(r.left-6)+'px',top:(r.top-6)+'px',width:(r.width+12)+'px',height:(h+12)+'px'});
    const pop=document.createElement('div');pop.className='pf-tour';pop.setAttribute('role','dialog');pop.setAttribute('aria-modal','false');pop.setAttribute('aria-label',cur.title||'Como funciona');
    const last=i===steps.length-1;
    pop.innerHTML=`<small>${(cur.title||'COMO FUNCIONA').toUpperCase()} · ${i+1} DE ${steps.length}</small><b>${st.t}</b><p>${st.d}</p>
      <div class="pf-tour-dots" aria-hidden="true">${steps.map((_,k)=>`<i class="${k===i?'on':''}"></i>`).join('')}</div>
      <div class="pf-tour-b"><button type="button" data-t="skip">${last?'FECHAR':'PULAR'}</button><span></span>${i?'<button type="button" data-t="prev">VOLTAR</button>':''}<button type="button" class="p" data-t="next">${last?'ENTENDI':'PRÓXIMO'}</button></div>`;
    const host=document.body.classList.contains('pe-cell')&&document.getElementById('espelhoRoot')||document.body;
    host.append(hl,pop);
    const pw=Math.min(360,innerWidth-24);pop.style.width=pw+'px';
    let top=r.top+h+16;
    if(top+pop.offsetHeight>innerHeight-12)top=r.top-16-pop.offsetHeight;
    if(top<12)top=Math.max(12,innerHeight-pop.offsetHeight-12);
    pop.style.top=top+'px';pop.style.left=Math.min(Math.max(12,r.left),innerWidth-pw-12)+'px';
    pop.querySelector('[data-t=next]').focus();
    pop.onclick=e=>{const b=e.target.closest('[data-t]');if(!b)return;const a=b.dataset.t;if(a==='next')go(i+1);else if(a==='prev')go(i-1);else finish()};
  },300);
}
function start(name,steps,title){
  css();end();
  const novo=!!stored(name)&&!seen(name,steps);
  cur={name,steps,title:(novo?'Novidades · ':'')+(title||''),i:0,dir:1,back:document.activeElement};
  mark(name,steps);go(0);
}
/* roda sozinho só na 1ª vez de cada parte */
function auto(name,steps,title,delay){
  if(seen(name,steps)||document.querySelector('.pf-tour')||document.querySelector('#pfAuth'))return;
  setTimeout(()=>{if(!seen(name,steps)&&!document.querySelector('.pf-tour')&&!document.querySelector('#pfAuth'))start(name,steps,title)},delay||600);
}

/* ---------------- textos ---------------- */
const K=s=>'<kbd>'+s+'</kbd>';
const FUNDO=[
  {el:'#musicDock',t:'Biblioteca de músicas',d:'Escolha a música de fundo. Cada uma tem até 10 instrumentos separados (bateria, baixo, cordas…) que o app mistura sozinho.'},
  {el:'.transport-panel',t:'Tocar, parar e fade',d:'<b>TOCAR</b> começa a música. <b>STOP</b> para com um eco suave, sem cortar seco. <b>FADE OUT</b> abaixa devagar até sumir.'},
  {el:'.expression-card',t:'Intensidade: o coração do app',d:'Arraste para mudar o clima: <b>SUAVE</b> na reflexão, <b>CLÍMAX</b> no apelo. Não é só volume — os instrumentos entram e saem conforme sobe. Atalho: '+K('↑')+' '+K('↓')+'.'},
  {el:'#duckBtn',up:'.panel',t:'Fala',d:'Alguém vai falar? Aperte <b>FALA</b>: a música abaixa sem perder a intensidade. Aperte de novo para voltar. Atalho: '+K('Espaço')+'.'},
  {el:'.timeline-card',t:'Linha do tempo e loop',d:'Mostra quanto tocou e quanto falta — arraste para pular. Ligue o <b>LOOP</b> para a música não acabar no meio da pregação.'},
  {el:'.mode-switch',t:'BASE ou FULL',d:'<b>BASE</b> mostra só o essencial. <b>FULL</b> mostra também o volume geral e cada instrumento, para mutar um por um.'},
  {el:'#tsMirror',t:'Controle pelo celular',d:'<b>ESPELHAR</b> mostra o código da sala. Com ele, o celular vira controle remoto de tudo isso.'},
  {el:'#tab-prog',t:'Quando um momento acaba',d:'Se você usa a <b>Programação</b>, ao fim de cada momento a tela vem sozinha para lá e pergunta <b>“Acabou?”</b> — dá para seguir, atrasar só aquele momento ou atrasar tudo. A música não para. (Na Projeção aparece só um aviso pequeno.)'},
  {el:'#pfMini',t:'O relógio sempre à vista',d:'Este relógio pequeno mostra o momento que está no ar e quanto falta — em qualquer aba. Clique nele para ir à Programação.'},
  {el:'#tab-slide',t:'Três abas',d:'<b>Fundo</b> (música), <b>Projeção</b> (o que vai no telão) e <b>Programação</b> (o roteiro do culto). A música continua tocando quando você troca de aba. Atalhos: '+K('Alt')+' + '+K('1')+' '+K('2')+' '+K('3')+'.'},
  {el:'#tsHelp',t:'Ficou com dúvida?',d:'O botão <b>?</b> mostra o passo a passo da aba em que você estiver, quando quiser.'}
];
const SLIDE=[
  {el:'#pjOpen',up:'.pj-st',t:'Janela de projeção',d:'Clique em <b>JANELA DE PROJEÇÃO ↗</b>: abre uma janela limpa, só com o que vai no telão. Arraste-a para o projetor/TV e clique nela uma vez (fica em tela cheia e libera o som). Pronto: você não precisa mais arrastar o palco de um lado para o outro. O <b>⧉</b> copia o link.'},
  {el:'#pjFila',up:'.pj-bar',t:'A fila do momento',d:'Quando um momento da Programação entra no ar, os anexos dele aparecem aqui, em ordem, e vão sozinhos para a projeção. Clique num anexo para mostrar; ◀ ▶ passam.'},
  {el:'#pjFila',up:'.pj-bar',t:'Passar para o próximo?',d:'Quando um <b>vídeo</b>, <b>YouTube</b> ou <b>música</b> termina, aparece aqui: <b>SIM</b> passa para o próximo anexo (ou '+K('Enter')+'), <b>REPETIR</b> toca de novo, <b>NÃO</b> fica onde está ('+K('Esc')+'). Se preferir que passe sozinho, ligue nas Configurações.'},
  {el:'#pjBar [data-pj=black]',t:'Tela preta',d:'Precisa apagar o telão na hora (oração, imprevisto)? <b>TELA PRETA</b> ou a tecla '+K('B')+' — aperte de novo para voltar. Funciona também na janela de projeção.'},
  {el:'#slUrl',up:'.sl-bar',t:'Abrir um link',d:'Cole o link do Canva (até o encurtado) ou do YouTube e clique <b>ABRIR</b>. Pelo celular também dá abrir o Canva.'},
  {el:'.sl-nav',t:'Passar os slides',d:'‹ › passam os slides. Funciona também com as setas '+K('←')+' '+K('→')+' e com passador de slides ('+K('PgUp')+' '+K('PgDn')+').'},
  {el:'#slFull',t:'Tela cheia para projetar',d:'Use <b>TELA CHEIA</b> na hora de projetar — '+K('Esc')+' sai. Se o telão espelha este PC, ele mostra a aba que estiver aberta.'},
  {el:'#panel-slide .sl-area',t:'Onde o slide aparece',d:'Aqui aparece o slide. O trackpad do celular vira um <b>laser vermelho</b> por cima dele. Imagens, vídeos, YouTube e letras anexados na Programação também. Com a janela de projeção aberta, aqui vira o monitor (o vídeo passa só lá).'},
  {el:'#slClose',t:'Tirar da tela',d:'<b>FECHAR</b> tira o slide ou a mídia da tela. A música do Fundo não para.'}
];
const ESPELHAR=[
  {el:'#pe-codeCard',t:'O código da sala',d:'No celular, abra o site, digite este código de 6 letras (ou leia o QR) e ele vira o controle remoto. O link copiado já entra direto.'},
  {el:'#pe-netPill',up:'.pills',t:'Conexão',d:'<b>Verde</b> = online. Mostra quantos celulares estão conectados e o atraso em milissegundos.'},
  {el:'#pe-peerList',up:'.card',t:'Quem está conectado',d:'Cada aparelho conectado aparece aqui. Pode ter mais de um celular na mesma sala.'},
  {el:'#peCardExpr',t:'Os mesmos controles',d:'Estes controles são iguais aos do celular: o que você mexer aqui ou lá aparece nos dois na hora.'},
  {el:'#pe-switchBtn',t:'Voltar ao palco',d:'<b>FECHAR</b> volta para o palco. A sala continua aberta e o celular continua controlando.'}
];
function CONTROLE(P){return [
  {el:'#'+P+'netPill',up:'.pills',t:'Você está conectado',d:'<b>Verde</b> = ligado ao palco. Tudo o que você mexer aqui acontece no PC na hora — o som sai de lá.'},
  {el:'#'+P+'canvaUrl',up:'.card',t:'Slides do Canva',d:'Cole o link do Canva e toque <b>ABRIR</b>: ele aparece no telão e aqui em cima, com setas para passar. A faixa de baixo vira um <b>trackpad</b>: arraste o dedo e um laser aparece no slide.'},
  {el:'#'+P+'fader',up:'.card',t:'Intensidade',d:'Arraste para mudar o clima da música: <b>SUAVE</b> na reflexão, <b>CLÍMAX</b> no apelo. Dois toques voltam ao meio.'},
  {el:'#'+P+'duckBtn',t:'Fala',d:'Toque em <b>FALA</b> quando alguém for falar: a música abaixa. Toque de novo para voltar.'},
  {el:'#'+P+'playBtn',up:'.card',t:'Tocar e parar',d:'<b>TOCAR</b>, <b>STOP</b>, <b>FADE OUT</b> e <b>LOOP</b> mandam o comando para o palco na hora.'},
  {el:'#'+P+'setList',up:'.card',t:'Trocar a música',d:'Escolha outra música de fundo. A intensidade continua a mesma.'},
  {el:'#'+P+'chipList',up:'.card',t:'Instrumentos',d:'Toque num instrumento para mutar ou voltar. Bom para deixar só o piano numa oração, por exemplo.'},
  {el:'.pf-help-float',t:'Quando precisar',d:'O botão <b>?</b> mostra este passo a passo de novo.'}
]}

/* ---------------- palco (PC) ---------------- */
function palcoCtx(){
  const app=document.getElementById('pe-app');
  if(app&&app.classList.contains('pe-open'))return ['espelhar',ESPELHAR,'Espelhar'];
  const b=document.body.classList;
  if(b.contains('tab-slide'))return ['slide',SLIDE,'Projeção'];
  if(b.contains('tab-prog'))return ['prog',null,'Programação'];
  return ['fundo',FUNDO,'Fundo'];
}
function palcoHelp(){
  const [n,steps,t]=palcoCtx();
  if(n==='prog'){if(window.PFProg&&PFProg.tour)PFProg.tour(true);return}
  start(n,steps,t);
}
function palcoAuto(){
  if(!document.body.classList.contains('pe-host'))return;
  const [n,steps,t]=palcoCtx();
  if(n==='prog'){if(window.PFProg&&PFProg.tour)PFProg.tour(false);return}
  auto(n,steps,t,700);
}
function palcoInit(){
  css();
  const strip=document.getElementById('tabstrip'),mir=document.getElementById('tsMirror');
  if(strip&&mir&&!document.getElementById('tsHelp')){
    const b=document.createElement('button');b.type='button';b.id='tsHelp';b.className='pf-help';b.textContent='?';
    b.title='Como funciona esta tela';b.setAttribute('aria-label','Como funciona esta tela');b.style.alignSelf='center';b.style.marginRight='8px';
    b.onclick=palcoHelp;strip.insertBefore(b,document.getElementById('tsConfig')||mir);
  }
  new MutationObserver(palcoAuto).observe(document.body,{attributes:true,attributeFilter:['class']});
  const app=document.getElementById('pe-app');if(app)new MutationObserver(palcoAuto).observe(app,{attributes:true,attributeFilter:['class']});
  palcoAuto();
}
/* ---------------- celular (controle) ---------------- */
function controle(P){
  css();
  P=P||'';
  if(!document.querySelector('.pf-help-float')){
    const b=document.createElement('button');b.type='button';b.className='pf-help pf-help-float';b.textContent='?';
    b.title='Como usar o controle';b.setAttribute('aria-label','Como usar o controle');
    b.onclick=()=>start('controle',CONTROLE(P),'Controle');
    (document.getElementById('espelhoRoot')||document.body).appendChild(b);
  }
  auto('controle',CONTROLE(P),'Controle',900);
}

window.PFTour={start,auto,seen,mark,end,palcoInit,controle,css};
if(window.PFAuth){PFAuth.ready.then(s=>{if(s)setTimeout(palcoInit,300)})}
})();
