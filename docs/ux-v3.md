# FatiaLucro — experiência UX V3

## Objetivo e desenho implementado

Revisão substancial da experiência da V0.1, preservando o PR #1 em rascunho. A especificação principal foi lida integralmente antes da edição: `FatiaLucro_Prompt_Codex_UX_V3_Detalhado.md`. O inventário inicial confirmou a branch `feat/pricing-engine-v01`, HEAD `405c99a`, checkout limpo, PR aberto/draft e referência de 221 testes em 15 arquivos. Foram examinados os componentes, domínio, importadores, armazenamento, testes, documentação de UX V2/pré-requisitos/dados/referências, registro de evidências e tabelas r1/r2. A arquitetura de fluxo, resumo, estados e preservação dos dados foi definida antes da implementação.

O relatório adicional `FatiaLucro_Auditoria_UX_V3_2026-11-22.md` não estava no diretório do documento fornecido. A especificação declara conter integralmente os requisitos centrais; os IDs da matriz abaixo foram mapeados a partir dela, sem inventar títulos de uma auditoria não fornecida.

A abertura oferece **Importar impressão fatiada**, **Preencher manualmente — peso e tempo** e **Experimentar com um exemplo fictício**. Oficina é opcional; rascunho real anterior oferece **Continuar de onde parei**. Não há custos reais preenchidos com exemplos. O exemplo continua isolado e rejeitado no salvamento de produtos/perfis/rascunho.

O fluxo padrão é **Impressão → Custos → Resultado**. A fabricação pode começar com dados de uma peça, bobina/preço por kg e somente material; máquina/energia começam excluídas e explicitamente identificadas. Em Custos, **Ver custo da impressão** pula Venda. No resultado, **Simular uma venda com este custo** preserva o trabalho e acrescenta a etapa Venda. Não é necessário configurar Shopee, perfis, salário ou preço para descobrir o custo.

A navegação continua **Calcular / Meus produtos / Configurações**. Tema e modo ficam em Configurações; opções de salvar antes de terminar e modo avançado continuam em um menu secundário do cálculo. Há um único estado de formulário e um único motor. Em desktop largo, o passo e **Meu resumo** ocupam duas colunas. Em janela estreita, o resumo segue os campos em uma coluna, sem barra cobrindo ações. Sticky só é aplicado em viewport largo e alto, com altura limitada, rolagem própria acessível e foco; em viewport menor fica estático. A ergonomia real de zoom/rolagem ainda exige homologação.

## Resumo, edição e domínio financeiro

`FinancialSummary` foi refatorado e reintegrado ao App, em vez de criar um segundo resumo independente. `FinancialMetrics` é compartilhado com `ExperienceResult`; nenhuma tarifa ou fórmula de custo foi escrita em React. O custo parcial é preparado em `app/cost-preview` usando os cálculos existentes da engine, com os demais componentes explicitamente excluídos em cada avaliação independente. Ausência permanece ausência: o painel distingue subtotal conhecido, total selecionado, campo faltante e custo excluído. Valores de componentes selecionados sem entrada válida não aparecem como zero.

O worker envia primeiro a prévia de custos atuais e depois o resultado completo ou erro. A prévia pode aparecer mesmo quando falta preço ou uma entrada da venda. O debounce de 450 ms, cancelamento e identificação de geração foram preservados. Mudanças invalidam de imediato tanto números financeiros como prévias anteriores. Uma resposta antiga ou envelope ainda em espera não é promovido a resultado atual. Rascunhos incompletos continuam editáveis/salváveis como rascunho, mas não como cálculo final.

Antes de vender: material, máquina/energia, embalagem, custos selecionados, custo por peça e exclusões. Na venda: preço/quantidade, total, tarifas, desconto do vendedor/frete líquido separados, repasse estimado, fabricação/embalagem, outras despesas, lucro por pedido/unidade e margem. Markup aparece no modo avançado. **Completo**, **Simulação provisória** e **Parcial** continuam classificações distintas. Com pendência, líquido/lucro/margem não recebem números conclusivos; há ações para conferir frete, programas, cadastro, hipóteses e embalagem. O demonstrativo completo conserva todas as pendências, fontes e fórmulas.

A engine, precisão decimal, rateio, solver em centavos, incidências e tabelas auditadas **não foram alterados**. Bobina, máquina exclusiva, pacote de embalagem, lote/pedido e kits reaproveitam os contratos anteriores. A embalagem adicional por pedido exige zero explícito se não existir; não é preenchida a partir do exemplo de envelopes. Acabamento manual usa o tempo/custo da base da impressão; consumíveis/reserva são por peça, embalagem por unidade comercial/pedido e outras despesas de venda por pedido.

**Já tenho um preço** e **Quero descobrir um preço** são escolhas visíveis. Lucro é alvo por pedido; margem é lucro/receita após desconto, não acréscimo sobre custo. Equilíbrio, comparação e intervalo continuam disponíveis. Após busca, um preço final opcional é informado explicitamente; aplicar muda para cálculo direto e recalcula todas as tarifas. Se cair em fronteira desconhecida, o resultado volta a parcial; a meta anterior não é prometida.

## Shopee, declarações e hipóteses

A pergunta agrupada enumera **Devolução Fácil, Campanha de Destaque, Ads Fácil, Afiliados e Shopee Acelera**. “Não participo de nenhum” registra ausência explícita desses programas na data do cenário; não elimina taxas obrigatórias, volume, frete ou evidência faltante. “Sim/conferir individualmente” preserva cada seleção independente; “Não sei” conserva desconhecidos. Devolução mantém inativo/teste gratuito/cobrança ativa/desconhecido. A declaração não cria uma regra nova no catálogo.

Cadastro CPF/CNPJ pode ser reutilizado. Frete, volume, aceites e dados específicos do pedido atual não são sobrescritos ao aplicar a loja. Campanha, afiliados por venda e teste gratuito não se tornam adesões permanentes. Outras adesões só atravessam datas mediante confirmação explícita de continuidade em **Minha loja Shopee**; o usuário precisa conferir mudanças reais da loja. Mudar a data solicita nova confirmação de frete, volume, condições temporárias e hipóteses. Essas alterações afetam o cenário editado, sem reclassificar snapshots históricos.

O painel **Sobre esta simulação → Ver hipóteses** apresenta a referência arquivada, continuidade não comprovada, convenção de centavos e, quando pertinente, conflito CPF de R$4/R$4,50. O botão de aceitar aparece após expor essas hipóteses; grava os aceites **individuais** existentes e uma revisão vinculada à data/ID da tabela. Não há booleano global liberando cálculos. É possível retirar o aceite. Outra data/versão exige revisão. Aceitar não resolve fórmula, faixa, adesão, frete ou embalagem desconhecida.

Embalagem ganhou **Sim / Não incluir / Ainda não sei**, em bloco próprio. “Ainda não sei” permite conhecer os custos selecionados da impressão, mas acrescenta uma pendência ao catálogo composto da **venda**, bloqueando repasse/lucro conclusivos. Isso usa o mecanismo existente de pendências, também no solver, sem inventar uma tarifa Shopee.

**Entenda as taxas cobradas**, personalizações explícitas e **Ver cálculo completo** são camadas acessíveis sem cadeia de três accordions no cálculo atual. O detalhamento completo usa blocos abertos com a mesma informação anterior: cobrança, natureza, valor, fórmula, base, unidade/pedido, arredondamento, condições, período, versão, fonte e parâmetros personalizados. A comissão obrigatória permanece bloqueada. Referência documental não vira tarifa vigente porque o relógio avançou.

R$19,90 continua gerando R$8,48 básicos por unidade, com transação incluída. R$500 conserva a resolução documental anterior; R$80/100/200, regressão CPF, exatamente450 e demais lacunas permanecem expostos. As fixtures históricas de R$25/15/20 e a divergência de R$0,05 permanecem inalteradas. São evidência histórica limitada, nunca taxa atual inferida. Não houve nova verificação ao vivo de tarifas nesta revisão.

## Importação e perfis

A conferência antes de aplicar mantém arquivo, impressora identificada, placa, material, peso, tempo e peças quando encontrados. Ausências pedem confirmação manual. O texto distingue estimativa do fatiador, peça física e unidade vendida. Geometria sem estimativas explica como fatiar/exportar no Bambu/Orca e oferece preenchimento manual; falha de leitura também tem esse atalho. O parser, limites, leitura local, workers e cancelamento foram mantidos.

Múltiplas placas continuam com seleção **individual**, sem soma indevida. O aviso distingue horas-máquina de prazo de calendário/entrega. Consolidação não foi implementada, conforme alternativa segura permitida pela especificação. Os testes usam arquivos sintéticos; não se alega compatibilidade com versões de slicer não homologadas.

Importar preserva preço de venda, quantidade comercial, loja e custos de máquina; consumo/tempo/contagem são da placa escolhida. Preço de filamento nunca é obtido do arquivo; após importar, deve ser conferido por material ou perfil salvo. Perfis cadastrados continuam disponíveis. Perfis de máquina/filamento incompletos são recusados antes de substituir valores válidos; padrões antigos incompletos não apagam dados na abertura. Origem do perfil e alteração posterior são identificadas no formulário; origem do arquivo continua preservada.

## Matriz UX3-01…UX3-20

“Implementado” significa comportamento no código e validação não interativa, não homologação humana. O mapeamento é derivado da especificação disponibilizada.

| ID | Entrega P0/P1 | Estado | Evidência / limite |
| --- | --- | --- | --- |
| UX3-01 | Abertura e navegação simples | Implementado | Três áreas, importação/manual/exemplo, oficina opcional e rascunho explícito |
| UX3-02 | Resumo contextual vivo | Implementado | FinancialSummary refatorado, prévia do worker e métricas compartilhadas |
| UX3-03 | Caminho somente de custos | Implementado | Impressão/Custos/Resultado, ação direta e venda posterior preservando dados |
| UX3-04 | Entrada manual e ajuda de importação | Implementado | Títulos claros, formato humano, ajuda Bambu/Orca e alternativa em falha |
| UX3-05 | Conferência de metadados/origem | Implementado | Placa, ausências e distinção físico/comercial; parser anterior mantido |
| UX3-06 | Arquivo com múltiplas placas | Parcial permitido | Seleção individual explícita; nenhuma consolidação ou prazo fictício |
| UX3-07 | Bobina/kg, prévia e perfis de material | Implementado | Preço/peso reais, materiais independentes, atalho com custo e proteção de perfil vazio |
| UX3-08 | Escolhas compreensíveis de máquina | Implementado | Excluída, hora completa ou componentes exclusivos, sem taxa fictícia |
| UX3-09 | Embalagem visível e desconhecida | Implementado | Pacote/unidade/pedido, exclusão consciente e bloqueio de lucro se desconhecida |
| UX3-10 | Outros custos e base explícita | Implementado | Trabalho/acabamento por lote/peça, zero consciente, consumíveis/reserva por peça, sem custos fictícios |
| UX3-11 | Intenções da venda e peças/kit/pedido | Implementado | Dois cartões, metas e unidades distintas com o mesmo motor |
| UX3-12 | Busca e preço final recalculado | Implementado | Intervalo, lacunas respeitadas e ajuste explícito com novo cálculo completo |
| UX3-13 | Programas Shopee agrupados | Implementado | Declaração datada enumerada e seleções independentes, incluindo trial |
| UX3-14 | Loja reutilizável e condições temporárias | Implementado | Editor próprio e confirmação explícita de continuidade; pedido preservado |
| UX3-15 | Hipóteses amigáveis e aceites específicos | Implementado | Painel, data/tabela, retirada e pendências não resolvidas pelo aceite |
| UX3-16 | Auditoria sem três níveis de expansão | Implementado | Blocos no detalhamento completo e personalizações separadas |
| UX3-17 | Resultado compreensível e ações de pendência | Implementado | Hierarquia única, custos conhecidos, líquido/lucro suspensos e atalhos com foco |
| UX3-18 | Perfis, histórico, rascunho, lixeira e backup | Implementado | Recursos anteriores preservados, metadados opcionais e migração sem reescrita |
| UX3-19 | Legibilidade, teclado e responsividade | Parcial | Fonte base 16 px, ajuda mínima 0,9 rem, rótulos/foco/contraste; teste real Windows e WCAG integral pendentes |
| UX3-20 | Offline, regressões, documentação e PR draft | Implementado | Sem dependências/servidor/telemetria novos; validação automatizada e entrega de revisão |

## Armazenamento, riscos e compatibilidade

O banco conserva nome/stores e passa de versão **3 para 4**. Os novos campos de UX são opcionais e não reescrevem produtos, rascunhos ou snapshots existentes. A mudança de versão protege contra uma versão antiga do aplicativo que desconheça material excluído, declaração datada ou embalagem desconhecida. Instâncias antigas precisam ser fechadas; erro de bloqueio é informado. Não há promessa de downgrade. Rascunho V2 na antiga etapa Venda sem intenção de vender é adaptado apenas na apresentação para continuar navegável.

Backup continua v2 com leitura de v1, conflitos como cópias, vínculos remapeados e lixeira. Snapshots anteriores conservam entradas e catálogo originais; edição cria nova revisão. Progresso, rascunho e preferências continuam fora do backup de cadastros, conforme já documentado. Não houve leitura/escrita do banco nativo do proprietário durante os testes; somente IndexedDB emulado em Node. Quota, perda de perfil WebView e interrupção nos últimos 700 ms de rascunho continuam riscos já informados.

## Validação executada

`npm run check` aprovado na versão final: **ESLint sem avisos, 254 testes em 16 arquivos, TypeScript sem erros e build web Vite concluído**. São 33 casos novos além dos 221 anteriores. Os testes financeiros e fixtures históricas não foram alterados; expectativas de navegação/loja foram atualizadas onde o comportamento V3 exige nova confirmação.

A primeira rodada passou com 253 casos. A revisão de acessibilidade acrescentou IDs próprios para editores simultâneos, personalizações sem terceiro nível e uma regressão adicional. Essa rodada revelou uma dependência acidental da ordem de UUIDs no teste novo de migração, com datas empatadas; a asserção foi corrigida para comparar os mesmos registros por ID, sem alterar persistência ou cálculo. A rodada consolidada final passou com 254 casos. Não houve execuções repetidas de Actions para testar essas correções. `git diff --check` também foi verificado.

O CI automático do único push será registrado na descrição do PR, sem build Windows ou dispatch manual. Nenhum teste com navegador, aplicativo instalado ou Windows gráfico foi executado. A matriz A…T é coberta por testes de lógica/composição e HTML estático quando aplicável; O reutiliza temporizadores/cancelamento anteriores e acrescenta o contrato do envelope atual. Q cobre estrutura/formatos/estilos/tokens automatizáveis, não navegação real de teclado ou zoom renderizado.

## Homologação final pendente

- Primeiro uso por pessoas leigas e entendimento de custos, unidades, hipóteses e pendências.
- Layout renderizado em janela larga/estreita, claro/escuro/sistema, zoom e DPI 125/150/200%, alto contraste, rolagem/foco do resumo.
- Teclado real, leitores de tela, mensagens e foco após navegação e ações de pendência; sem declaração de conformidade integral WCAG.
- Seleção/drop nativo, arquivos Bambu/Orca reais autorizados e diferentes versões, cancelamento e desempenho do solver no WebView2.
- Persistência, rascunho, backup/download/restauração no aplicativo instalado, offline nativo, bloqueio de banco entre versões.
- Instalação, abertura, ausência de WebView2 e desinstalação. Não foram executados instalador nem build Windows nesta etapa.

**Revisão técnica:** depende dos checks do commit integrado e revisão das mudanças de estado/composição; não equivale a homologação visual. **Lançamento público:** ainda não aprovado. Não houve merge, tag, release, alteração da main ou workflow manual.

## Próxima etapa (UX V4 / P2)

Consolidação correta de trabalhos com placas/máquinas independentes, custo real pós-impressão, orçamento PDF e histórico avançado podem ser avaliados depois. Novas plataformas exigem adaptadores e fontes próprias. Esses recursos não foram adicionados nesta entrega; homologar o fluxo simples vem primeiro.

## Arquivos alterados



- `CHANGELOG.md`
- `README.md`
- `docs/architecture.md`
- `docs/imports-and-storage.md`
- `docs/ux-v2.md`
- `docs/ux-v3.md`
- `src/app/calculation-worker.ts`
- `src/app/cost-preview.ts`
- `src/app/experience-types.ts`
- `src/app/experience-validation.ts`
- `src/app/experience.ts`
- `src/app/model.ts`
- `src/app/preferences.ts`
- `src/app/storage.ts`
- `src/app/ux-v3.ts`
- `src/app/workshop.ts`
- `src/ui/App.tsx`
- `src/ui/CalculationNavigation.tsx`
- `src/ui/CostFields.tsx`
- `src/ui/ExperienceContext.tsx`
- `src/ui/ExperienceResult.tsx`
- `src/ui/Fields.tsx`
- `src/ui/FinancialSummary.tsx`
- `src/ui/PrintImport.tsx`
- `src/ui/PrintStep.tsx`
- `src/ui/ResultView.tsx`
- `src/ui/SaleStep.tsx`
- `src/ui/ShopQuestions.tsx`
- `src/ui/SimulationReview.tsx`
- `src/ui/StoreSettings.tsx`
- `src/ui/WorkshopWizard.tsx`
- `src/ui/style.css`
- `src/ui/useAutomaticCalculation.ts`
- `tests/format-and-markup.test.ts`
- `tests/preferences-and-cache.test.ts`
- `tests/ux-helpers.ts`
- `tests/ux-markup.test.tsx`
- `tests/ux-v3.test.tsx`


As mudanças estão concentradas em composição/estado, apresentação, validação de metadados, testes e documentação. `src/engine`, `src/marketplaces`, `public/catalogs`, workflows, dependências e lockfiles não foram modificados nesta UX V3.
