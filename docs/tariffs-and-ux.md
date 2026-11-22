# Tarifas versionadas e revisão de UX — V0.1

Entrega no PR #1, branch `feat/pricing-engine-v01`, sem merge, release ou build Windows. Esta etapa usa somente arquivos e terminal não interativo; não abriu navegador, aplicativo, instalador ou automação gráfica.

## Revisão documental

Foram relidos os três MHTML originais de comissão e CPF, com MIME decodificado e os mesmos hashes HTML do inventário. Tabelas e exemplo incorporados foram processados por OCR local do Windows, sem instalar software, abrir imagens ou capturar a tela. O registro público contém apenas metadados e síntese própria.

| Fronteira | Conclusão e efeito |
| --- | --- |
| R$80 | Pendente. Primeira faixa até 79,99, seguinte acima de 80. Prosa inclusiva trata de subsídio/frete, sem demonstrar a comissão exata. |
| R$100 | Pendente. Faixa anterior até 99,99 e seguinte acima de 100, sem exemplo exato localizado. |
| R$200 | Pendente. Faixa anterior até 199,99 e seguinte acima de 200; subsídios não determinam a comissão. |
| R$500 | **Resolvido.** Exemplo oficial do artigo 18483, item de 500 com cartão/boleto: comissão 96 e líquido 404. A base 14% + 26 é calculável exatamente em 500. A busca inversa pode encontrar esse preço sem bloqueio artificial. |

O exemplo Pix não é desconto pago pelo vendedor: não autoriza somar subsídio como custo nem replicar duas vezes a comissão/transação. R$19,90 continua com **R$8,48 básicos**. Mantidos regressão CPF abaixo de 12, exatamente 450, divergência textual CPF 4/4,50, vigência/arredondamento e bases após desconto onde não esclarecidos. A divergência histórica de **R$0,05 permanece** sem ajuste da fórmula.

## Versões, seleção e rastreabilidade

`public/catalogs/manifest.json` relaciona arquivos com ID, versão, revisão, bytes e SHA-256. Tabelas declaram fontes oficiais com hashes HTML, observação, última verificação documental, início/fim de vigência, confirmação e revisão. O descritor `schema.json` documenta a estrutura; o validador TypeScript do aplicativo também confere datas, valores, condições, fontes, sobreposições, limites e vínculos entre arquivos. Um esquema remoto nunca é executado ou usado para relaxar a validação.

As revisões r1 (síntese anterior com 500 pendente) e r2 (releitura e resolução de 500) ficam arquivadas. r2 substitui explicitamente r1. A versão inicial publicada continua **documental**, com início/fim `null`: não foram inventadas datas de vigência para preencher o JSON. O sistema aceita múltiplos períodos comprovados; os testes de transições usam dados sintéticos, claramente identificados, sem publicá-los como tarifas.

Um novo cenário usa a data local do computador. Seleção prioriza período comprovado, com limites de data inclusivos; sem período, pode selecionar referência documental observada até a data e ainda não retirada/substituída/encerrada. Isso exige aceitação explícita de vigência/continuidade não confirmada e produz resultado provisório. Antes da evidência ou após um período encerrado não se recupera silenciosamente uma versão antiga. Sobreposições exigem substituição explícita, revisão maior e revisão documental compatível.

`provenance` acompanha o catálogo financeiro e o snapshot: versão, seleção, confirmação, revisão, vigência e última verificação. Selecionar hoje não altera `lastVerified`; nem uma consulta bem-sucedida ao GitHub o renova. Fontes, fórmulas substituídas, parâmetros personalizados e premissas continuam no demonstrativo. Históricos antigos reabrem com suas regras, inclusive os anteriores à existência de `provenance`.

## Atualização pública e offline

Canal de revisão: `https://raw.githubusercontent.com/brunonaval/fatialucro/feat/pricing-engine-v01/public/`. É a branch deste PR, sem publicação de release ou modificação da main. A promoção para canal estável depende de autorização posterior.

1. Usuário escolhe **Consultar atualizações no GitHub**. Não há consulta ao iniciar, timer, scraping ou serviço pago.
2. Requisições sem credenciais/referrer, origem fixa, caminhos restritos, redirecionamentos rejeitados e timeout total de 15 segundos. Limites: manifesto 64 KiB, 32 tabelas, 512 KiB por tabela.
3. Bytes/UTF-8, SHA-256, esquema conhecido, identidade, revisão e coerência documental são validados. A consulta apenas prepara uma proposta; não altera tarifas ativas.
4. Uma nova publicação mostra versão, estado, períodos, revisão e links oficiais. Somente **Aplicar publicação revisada** grava e ativa a cópia local.
5. Transação única salva pacote e arquivo histórico da publicação, conferindo novamente a sequência contra outra instância. Downgrade, reescrita/remoção de versões, números reaproveitados ou revisão/verificação regressiva são rejeitados. Sem espaço, falha de rede ou integridade, a cópia anterior permanece.

Confiança: repositório em HTTPS e revisão documental do mantenedor. SHA-256 detecta corrupção/divergência de conteúdo; não é assinatura independente contra comprometimento simultâneo do manifesto e do repositório. A flag de revisão é metadado da publicação, não homologação oficial da Shopee. Mudanças devem trazer nova revisão/arquivo, fonte, evidência e regressões; arquivos publicados não são editados. JSON usa UTF-8/LF, preservado por `.gitattributes`, para hashes iguais em Windows e Linux.

Cache aplicado é validado novamente na abertura, sem rede. Dados inválidos/regressivos levam ao catálogo incluído no aplicativo com aviso; snapshots não são apagados. IndexedDB v2 preserva `entries`, acrescenta `settings` e guarda temas/catálogos. Backup v1 continua contendo cadastros, loja e snapshots; tema/cache público ficam fora do backup. A nova conexão GitHub é permitida na CSP, sem liberar outros hosts de rede.

## Experiência de uso

- Fluxo produto/importação → fabricação → marketplace → preço/lucro; resumo destaca preço, custos, tarifas calculáveis e lucro por pedido, com identificação de indeterminações e resultado desatualizado.
- Configuração da loja salva uma vez: CPF/CNPJ, adesões e convenções. Frete não vira confirmação permanente; volume antigo de 90 dias volta a ficar ausente. Alterações reais de adesão continuam responsabilidade da configuração do cenário, sem modificar a conta Shopee.
- Detalhes financeiros, personalizações, embalagens, trabalho e reservas expansíveis. Campos essenciais e programas obrigatórios/opcionais preservam suas distinções.
- Componentes de produção, preço, resumo, cadastro, atualização e campos; tokens CSS para tema claro/escuro/sistema, contraste, bordas, foco, estados, espaçamento e responsividade. Preferência de tema local.
- Moeda formatada sem `Number` monetário, porcentagem visual em % com razão interna preservada, peso decimal e duração hh:mm:ss ou horas decimais. Formatar não arredonda silenciosamente moeda inválida. Rótulos associados, dicas/erros, `aria-invalid`, regiões de status, link de salto, controles nativos de teclado e preferência por movimento reduzido.
- Nenhuma biblioteca nova ou dependência nativa adicionada. Motor, importadores, backup e histórico existentes preservados. Os testes anteriores permanecem; expectativas de data e da fronteira de 500 foram ajustadas para as novas regras documentadas.

## Validação e prontidão

Rodada consolidada local: **ESLint sem avisos**, **181 testes aprovados em 11 arquivos** e **build web Vite aprovado**, incluindo os dois workers. Os 146 casos anteriores foram preservados, com expectativas atualizadas nos casos afetados pelas novas regras; 35 novos testes cobrem a revisão. O TypeScript apontou uma asserção imprecisa no agrupamento de fontes; ela foi substituída por construção tipada explícita e a **verificação TypeScript isolada passou**. A suíte inteira não foi reiniciada localmente. O CI leve do commit final é registrado no PR; instalador permanece somente manual.

Testes novos cobrem seleção/transições/retiradas, 500 e busca inversa, condições em JSON, integridade e esquema, update sem aplicação automática, falhas de rede, regressão concorrente, cache offline, migração v1/v2, tema/loja, formatação, HTML estático e contraste WCAG AA dos tokens. HTML estático é gerado em Node, sem navegador/DOM interativo. Não houve instalação de dependências ou mudança do lockfile nesta revisão.

**Homologação pendente:** avaliação visual claro/escuro e tamanhos reais, teclado/leitor de tela, worker e consulta GitHub sob CSP/WebView2, persistência/backup no shell, arquivos reais de impressão, inicialização offline nativa, instalação/desinstalação e ausência de WebView2. Não foram executados testes gráficos nem build de instalador. Contraste/estrutura estática não substituem esses testes.

**Merge técnico:** candidato à revisão de código e checks; homologação desktop ainda pendente, se for requisito de merge. **Lançamento público:** não pronto. Permanecem limites documentais Shopee, falta de assinatura/distribuição homologada e ausência de determinação fiscal/conciliação automática. Nenhum merge ou release autorizado/executado.
