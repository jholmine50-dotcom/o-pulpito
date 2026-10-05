# O Púlpito — regras do projeto

## Regra do tutorial (pedido do dono do projeto — sempre seguir)
**Se algo muito importante for mudado ou acrescentado no app, adicione/atualize o passo a passo ("Como funciona") da parte correspondente.**

- Os tutoriais ficam em `prog/tour.js` (constantes `FUNDO`, `SLIDE` (aba **Projeção** — o id interno continua `slide`), `ESPELHAR`, `CONTROLE`) e em `prog/prog.js` (constante `TOUR`, aba Programação).
- Cada passo é `{el:'seletor CSS', up:'ancestral opcional', t:'Título', d:'Texto (pode ter <b> e <kbd>)'}`. Se o elemento não estiver visível, o passo é pulado.
- Mudou ou entrou um passo → o tutorial reaparece sozinho para quem já tinha visto, com o título "Novidades" (a assinatura é calculada pelos títulos dos passos).
- Funcionalidade nova numa parte que ainda não tem tutorial → crie o tutorial dela e ligue no botão **?**.
- Teste: cada passo precisa achar o seu elemento (rodar o passo a passo no navegador antes de publicar).

## Outras convenções
- A aba "Slide" agora se chama **Projeção** na interface; ids internos (`tab-slide`, `panel-slide`, chave de tour `slide`) ficaram iguais. A janela limpa do telão é `projecao.html` (canal `pulpito-projecao`).
- Textos da interface em português do Brasil, linguagem simples (público de igreja).
- Repositório: `jholmine50-dotcom/o-pulpito` (GitHub Pages, workflow `.github/workflows/pages.yml`). Versões antigas nos branches `v1`…`v4`.
- Arquivos `.png` são ignorados pelo `.gitignore`, exceto em `icon/` e `audio/`.
