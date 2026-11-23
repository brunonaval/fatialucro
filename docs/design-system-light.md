# Design visual do FatiaLucro — tema claro inspirado na Bambu Lab

**Estado:** implementado na UX V4 para revisão, sem homologação visual em Windows/WebView2.

## Objetivo e limites

Criar uma aparência clara, organizada e acessível, em linha com a sensação de limpeza visual observada no Bambu Studio (fundo claro, separação de painéis, cinzas neutros e sinal verde), mas com identidade própria do FatiaLucro. Não reproduzir marca, logotipo, ilustrações ou layout exato da Bambu Lab, nem afirmar afiliação.

O tom `#00AE42` é identificado como **Bambu Green** em documentos oficiais de **cor de filamento PLA**, não como uma especificação oficial universal de UI ou licença de marca. É uma referência de cor: aqui reservado para faixas decorativas que não dependem de contraste textual.

Referências de pesquisa:
- Cor PLA Bambu Green: https://store.bblcdn.eu/s8/default/903b60b06ac142e9b1b49ad53cfa4c82/Bambu_PLA_Basic_Hex_Code.pdf
- Interface Bambu Studio: https://wiki.bambulab.com/en/bambu-studio/skills
- Contraste e uso de cores: https://www.w3.org/TR/WCAG22/

## Paleta final (CSS `src/ui/style.css`)

| Papel | Token | Hex | Aplicação |
|---|---|---|---|
| Fundo geral | `--bg` | `#F5F8F6` | Janela e áreas neutras |
| Cards, painéis, inputs | `--surface` | `#FFFFFF` | Informação central |
| Superfícies secundárias | `--surface-soft` | `#F0F5F2` | Ajuda, agrupamentos, detalhes |
| Texto principal | `--text` | `#1D2B24` | Títulos, valores e labels |
| Texto secundário | `--muted` | `#51665A` | Instruções e metadados |
| Bordas | `--border` | `#D8E5DD` | Divisórias decorativas |
| Contorno de inputs | `--input-border` | `#778C80` | Campos identificáveis |
| Verde de ação/link | `--accent` | `#087A3D` | CTA, links, títulos de etapa |
| Hover | `--accent-hover` | `#066635` | CTA pressionável |
| Fundo verde suave | `--accent-soft` | `#E7F6EB` | Seleção, valor, importação |
| Texto sobre CTA | `--on-accent` | `#FFFFFF` | Contraste em botão |
| Verde de referência | `--brand-signal` | `#00AE42` | Faixa superior do resultado (decorativa) |
| Foco visível | `--ring` | `#0C6B49` | Acessibilidade por teclado |
| Atenção: fundo/texto | `--warning-bg`/`--warning-text` | `#FFF5E3` / `#694508` | Hipóteses e dados pendentes |
| Erro: texto/fundo | `--error`/`--error-bg` | `#A42535` / `#FFF1F2` | Campo inválido |
| Sucesso: fundo/texto | `--success-bg`/`--success-text` | `#E7F6EB` / `#176436` | Estados confirmados |

**Razão técnica:** o verde vibrante `#00AE42` tem somente cerca de **2,94:1** contra branco e não é adequado, por si só, para texto branco normal em botões. O botão usa `#087A3D` com branco, com cerca de **5,44:1**. O texto secundário `#51665A` sobre branco tem cerca de **6,18:1**. O contorno dos inputs `#778C80` sobre branco tem aproximadamente **3,59:1**. Esses valores são verificáveis pelos testes automatizados de tokens.

A cor identifica um estado **junto de texto e ícones/labels**, nunca sozinha. Um lucro positivo não se confunde com um cadastro confirmado nem com uma taxa provisória.

## Especificação dos componentes

1. **Cabeçalho e navegação:** fundo limpo, botões principais verdes escuros, seletor ativo com texto branco; configurações secundárias em posição discreta.
2. **Tela inicial:** uma ação principal para importar 3MF, alternativa manual clara, exemplo rotulado fictício. Não criar novos campos só para fins decorativos.
3. **Dropzone da impressão:** superfície verde muito suave, borda pontilhada visível, foco acessível, origem da informação e limitações do parser comunicadas por texto.
4. **Etapas Impressão → Custos → Venda → Resultado:** aba atual com contorno verde, texto e número; etapas desativadas claramente diferentes, sem depender de diferença de matiz.
5. **Inputs:** labels persistentes, unidade de medida, contorno com contraste suficiente, foco com anel visível. Erros aparecem no próprio campo e no guia de pendências, nunca apenas por cor.
6. **Seleção de intenção:** cards com título, resumo e estado `aria-pressed` para custo, preço-alvo ou lucro.
7. **Custos de bobina:** preço, quantidade líquida, perfil salvo e fonte do valor. Mostrar exclusões conscientemente escolhidas em texto neutro.
8. **Shopee:** perguntas essenciais em sequência, respostas salvas recolhidas, pendências e hipóteses em destaque âmbar; dados desconhecidos não podem parecer confirmados.
9. **Resumo financeiro:** faixa decorativa verde, total legível, números tabulares; não exibir lucro final se a cobrança relevante estiver desconhecida.
10. **Banners e status:** neutro para informação, âmbar para pendência, vermelho para erro e verde suave para confirmação. Sempre com texto acionável.
11. **Modo escuro:** manter os tokens existentes. `--brand-signal: var(--accent)` nesse modo conserva a faixa superior anterior.
12. **Responsividade:** evitar scroll horizontal a 1024 px e recortes em zoom 125–200%. Componentes de decisão devem empilhar ao diminuir a janela.

## Testes e homologação

Automatizados: verificar contrastes de pares de tokens com exigências orientativas WCAG 2.2, presença de foco visível e continuidade do sistema de temas. **Teste de tokens não equivale a homologação integral WCAG.**

Manuais pendentes: verificar screenshots reais do app claro no Windows/WebView2 em 1280×720, 1366×768 e 1920×1080 com zoom 100%, 125%, 150% e 200%; validar também monitor com contraste reduzido, teclado, leitores de tela, modais, popovers e banners largos. Comparar visualmente com Bambu Studio somente para avaliar clareza e consistência, não identidade da marca.
