# O Púlpito

<img src="icon/pulpito-192.png" width="96" alt="ícone O Púlpito">


**O Púlpito** (antes PREACH FLOW) — música de fundo, slides e programação do culto, com espelho PC ↔ celular (o PC toca o áudio, o celular controla).

## Como usar

1. **PC:** abra `https://jholmine50-dotcom.github.io/o-pulpito/palco.html` (ou o arquivo `PREACH_FLOW_V10_ESPELHO.html`) e clique em **ESPELHAR** — anote o **código da sala**.
2. **Celular:** abra o site abaixo, digite o código (**6 caracteres**) e toque em **ENTRAR NA SALA**. Se o código estiver errado ou não houver palco aberto com ele, o celular avisa (**Sala não encontrada**) e pede o código de novo.
3. No celular aparece o CONTROLE (TOCAR, STOP, intensidade, fala, faixas); o PC executa e o áudio sai dele.
4. **Slides do Canva:** cole o link de qualquer apresentação em **APRESENTAÇÃO CANVA** (no PC ou no celular). Ela abre em **tela cheia no palco** e no **1/4 superior no controle**, com as setinhas **← →** para passar os slides dos dois lados.
5. **Laser:** no celular, um **trackpad** ocupa 1/5 inferior da tela — passe o dedo e um ponteiro vermelho aparece no slide e no palco (some sozinho após 5 s parado); no PC, basta mover o mouse sobre o slide. No controle do PC, o botão **MAX** deixa o slide em tela inteira.

## Versões do palco

- **v4 (atual) — `palco.html`**: v3 + aba **Programação**, login da igreja e configurações (ver abaixo).
- **v3 (anterior) — `v3/palco.html`** (também no branch `v3`): mesma estrutura da v2, com visual **Liquid Glass** (inspirado no design da Apple):
  - vidro só nos controles e na navegação (barra de abas, biblioteca, botões, barra do slide, setas); conteúdo em cartões escuros legíveis;
  - fundo ambiente que muda de cor com a **intensidade** (frio no SUAVE, quente no CLÍMAX), estático para não pesar no PC;
  - o celular (`espelho/`) e a entrada (`index.html`) ganharam o mesmo visual;
  - quem usa "reduzir transparência" no sistema recebe superfícies sólidas.
- **v2 (anterior) — `v2/palco.html`** (também no branch `v2`): o palco com **abas no estilo do Chrome**:
  - **Fundo** — a música de fundo (biblioteca, tocar/stop/fade, linha do tempo, intensidade, fala). A aba mostra um equalizer quando está tocando e a intensidade atual.
  - **Slide** — a apresentação do Canva: barra com link + ABRIR, ‹ slide N ›, **TELA CHEIA** (para projetar; `Esc` sai) e FECHAR. O slide fica em 16:9, alinhado com o controle do celular, então o laser cai no lugar certo.
  - Trocar de aba **não para a música**. Quando chega uma apresentação nova (do PC ou do celular), o palco vai sozinho para a aba Slide.
  - Teclas: `←` `→` / `PgUp` `PgDn` passam slides (funciona com passador), `Alt+1` / `Alt+2` trocam de aba; as teclas antigas continuam (`Espaço` fala, `↑` `↓` intensidade, `F` fade).
  - **ESPELHAR** + código da sala ficam no canto direito da barra de abas.
- **v1 (mais antiga) — `v1/palco.html`**: o palco como era até 25/09, guardado igual (também no branch `v1` do GitHub). Usa as mesmas faixas de `audio/` e o mesmo celular.

O controle do celular (`espelho/PREACH_ESPELHO.html`) funciona com as três versões.


## Programação (aba nova no palco)

- **Login da igreja** (por enquanto **simulado** no navegador): o palco pede nome da igreja + senha. A senha nunca é guardada crua — passa por **duas codificações de mão única** (PBKDF2-SHA256 com sal aleatório e 210.000 rodadas, depois SHA-256) e só esse resultado fica no "banco". No login a senha digitada passa pelo mesmo processo e os resultados são comparados. Ver `prog/auth.js`. O celular (link com código) não pede login.
- **Modelos prontos**: culto de domingo, de oração, Santa Ceia, casamento ou em branco — escolhe data e horário de início e ajusta.
- **Tipos de momento** (louvor, oração, pregação, leitura, avisos, ofertas, Santa Ceia, batismo, especial, intervalo) com cor e ícone.
- **Horários automáticos**: você informa só a duração de cada momento; mudou uma duração ou a ordem (**arraste o cartão**; no teclado Alt+↑/↓), os horários seguintes se ajustam. Pode desligar para usar horários livres.
- **Resumo do culto**: uma barra com o culto inteiro em cores, a linha do "agora", início, fim e duração total. Durante o culto: **+5 MIN** (atrasou) e **PRÓXIMO AGORA** (adianta o próximo momento) — o resto anda junto.
- **Relógio do momento** (abaixo do resumo): quanto tempo o momento atual já rodou e quanto falta; **TERMINOU** começa o próximo agora, **ATRASAR…** dá mais tempo.
- **"Acabou?"**: quando o tempo de um momento termina, a tela vai sozinha para a Programação (menos no Slide, onde aparece só um aviso) e mostra só o relógio, perguntando se acabou: **Sim** segue; **Atrasar este momento** (N min só para ele — o próximo encolhe e o culto termina na mesma hora); **Atrasar toda a programação** (tudo anda N min). Pode desligar nas Configurações.
- **A data conta**: programação de outro dia fica toda "agendada" até chegar o dia.
- **Como funciona (?)**: cada parte do app tem o seu passo a passo — **Fundo**, **Slide**, **Programação**, **Espelhar** e o **controle no celular**. Ele aparece sozinho na primeira vez e pode ser aberto de novo pelo botão **?** (na barra de cima no PC; no canto da tela no celular). Ver `prog/tour.js`.
- **Momentos** com horário, título e texto. A **bolinha** mostra o estado pelo relógio: **verde** no ar · **laranja** prestes a acontecer · **azul** agendado · **cinza** já aconteceu · **preta** ignorado. Uma linha vermelha marca "agora" e a lista anda sozinha.
- **Anexos com @**: digite `@` no texto para anexar slide (link do Canva), imagem, vídeo, música, PDF ou texto, dando um nome (ex.: `@SlidePr`). Também dá para **arrastar arquivos** em qualquer lugar da aba (em cima de um item ele já entra no texto daquele item). Os arquivos ficam guardados neste computador.
- **Configurações** (engrenagem): o que fazer quando um item entra no ar — nada, aviso com botão "usar" ou **automático** (abre slide/imagem/vídeo/texto na aba Slide e toca a música, abaixando o Fundo); minutos da bolinha laranja; backup; sair.
- **Exportar**: **PDF** ou **JPEG** · **Site** (`programacao.html#…`, só a programação, passando sozinha e atualizando ao vivo) · **Site editável** (mesmo site + comentários ao vivo de quem tem o link, com texto e arquivos de até 300 KB, também via `@`) · **Baixar .html** (cópia que abre sem internet).
- Sites e comentários passam pelo servidor de mensagens público (MQTT). **Quem tem o link vê** — não coloque nada sigiloso. Arquivos grandes (vídeo, música) não vão para o site; só o nome aparece.

## Site (GitHub Pages)

`https://jholmine50-dotcom.github.io/o-pulpito/`

- **`palco.html`** — o palco no navegador, com som (baixa as faixas de `audio/`).
- **`espelho/PREACH_ESPELHO.html`** — controle (36 KB), leve, roda em qualquer celular.
- **`index.html`** — porta de entrada: digite o código e vai direto pro controle.
- Ativado em **Settings → Pages → Deploy from a branch → `main` → `/ (root)`** (workflow `.github/workflows/pages.yml`).

## Arquivo grande

O `PREACH_FLOW_V10_ESPELHO.html` tem **227 MB** e **não cabe no GitHub** (limite de 100 MB por arquivo).
Hospede-o separadamente (EdgeOne, servidor próprio ou rode direto no PC com duplo clique).

## Regras do repositório

Só código — com **uma exceção**: `audio/` (as 28 faixas que o `palco.html` toca, 170 MB). Mídia de trabalho (wav, masters), HTMLs gigantes, logs e chaves de API ficam de fora — ver `.gitignore`.
