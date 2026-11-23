# FATIALUCRO — ÚLTIMA AUDITORIA UX (SIMPLICIDADE)

**Data:** 23/11/2026  
**Branch:** `feat/pricing-engine-v01` — PR #1 (draft)  
**Escopo:** jornada da primeira impressão, custos, venda direta, Shopee, vários filamentos, recuperação de erros e clareza do resultado.  
**Método:** leitura de código da branch atual, comparação de padrões externos e testes automatizados sem abrir GUI. **Não é homologação visual do Windows.**

## Objetivo: três tarefas sem ajuda

1. **Quanto custa imprimir:** importar arquivo fatiado ou informar peso e preço do filamento. Não exigir tempo quando máquina/energia não são incluídos; não exigir Shopee.
2. **Quanto devo cobrar:** partir do custo conhecido, escolher canal e meta; somente dados realmente necessários; em Shopee, não converter taxas desconhecidas em zero.
3. **Errei um campo:** mostrar o campo, motivo, etapa, ação de correção e subtotal conhecido; diferenciar falha técnica de entrada inválida.

## Projetos e padrões consultados (inspiração, não código copiado)

- Small Hours Print Cost Calculator: extração de dados de G-code/3MF fatiado e utilização imediata — https://github.com/smallhours-tools/print-cost-calculator
- PrintMetric: resumo de custo e atualização reativa, campos numéricos validados — https://github.com/theo79/printmetric
- KINGdeusX Print Cost Calculator: importação e persistência de perfis — https://github.com/KINGdeusX/Print-Cost-Calculator
- GOV.UK Error Summary: mensagens por campo, resumo e navegação/foco — https://design-system.service.gov.uk/components/error-summary/
- GOV.UK Error Message: erro próximo do campo e descrição concreta — https://design-system.service.gov.uk/components/error-message/

São comparações de objetivos de interface, não evidência de que as tarifas ou modelos de custos de terceiros estejam corretos para a Shopee Brasil.

## Achados e correções desta auditoria

| ID | Gravidade | Achado verificado no código | Tratamento |
|---|---|---|---|
| UX-F01 | Alta | No cálculo de vários filamentos, uma linha com preço de bobina vindo de perfil tinha custo somente de leitura. Se o perfil estivesse incorreto, só era possível tentar selecionar outro perfil; a edição por kg desaparecia. | Botão por linha **Corrigir custo desta bobina — informar outro preço por kg**, sem modificar o perfil salvo. Compra inválida exibe instrução em vez de quebrar a interface. |
| UX-F02 | Alta | O guia de erros mostrava somente seis pendências, sem ação para acessar todas. | Exibição compacta de três, botão **Ver todas as pendências**, e ação **Corrigir primeiro campo pendente**. |
| UX-F03 | Alta | Erro de Web Worker ou falha de inicialização era exibido como mensagem de validação, sem opção evidente para recuperar. | Distinção `errorKind: technical/input`; mensagem técnica e botão **Tentar calcular novamente**, sem apagar o formulário. |
| UX-F04 | Média | Os materiais de mesma denominação, como PLA + PLA, eram visualmente parecidos na tabela de custos. | Título por linha **Filamento 1, 2...**, nome e peso consumido; custos independentes e orientação para escolher cada bobina. |
| UX-F05 | Alta | No detalhamento opcional de resultado parcialmente determinado, o lucro `null` podia ser passado ao formatador monetário como se fosse um valor. | Exibir literalmente **Ainda não determinado — existem cobranças desconhecidas**, inclusive na comparação de preços. |
| UX-F06 | Baixa | Botões desativados exibiam cursor de “aguarde” mesmo quando não havia carregamento. | Cursor de ação indisponível, sem falsa aparência de processamento. |

**Não modificar nesta auditoria:** fórmulas financeiras aprovadas, taxas ou vigência das tabelas Shopee, motor decimal, salvamento histórico, permissões de arquivos, API/servidor e modo escuro.

## Avaliação da experiência (sem alegar testes visuais)

| Jornada | Verificação estática e/ou de lógica | Resultado esperado | Limite |
|---|---|---|---|
| Primeiro custo manual | `newCalculationDraft`, `guidedIssues`, `calculateExperience` | 22,31 g + R$ 120/1000 g calcula R$ 2,68 sem preencher tempo | Ainda falta teste real de digitação e foco no Windows |
| Venda direta | `calculateExperience` com quantidade 1 e embalagem excluída conscientemente | Não solicita cadastro Shopee; lucro determinável se os dados necessários estiverem presentes | Custos conscientemente excluídos permanecem no relatório |
| Bambu 3MF com quatro slots PLA | Testes já existentes de importação, um consumo real | PLA único na interface simples, sem duplicar a contabilidade | Arquivo real da Bambu A1 do usuário ainda necessário |
| Vários filamentos PLA consumidos | Linhas de material e motor independente | Dois pesos, dois preços, sem inferir que custo de bobina é igual | Identificação de cor/slot pode depender de metadados ausentes |
| Shopee com tarifas/condições não confirmadas | `buildScenario` e resultado parcial existente | Não exibir lucro definitivo | Sem validação de taxas reais vigentes nesta auditoria |
| Erros de preenchimento | `GuidedIssues`, `fixIssue` e botões por campo | Chegar ao campo específico; mostrar todos se expandido | Verificar foco de `<details>` em WebView2 |
| Erro técnico Worker | `currentFinancialState` + telas de resultado | Não culpar usuário, preservar dados, permitir tentar novamente | Simulação do estado, não bloqueio real do Worker no Windows |
| Tema claro/escuro | Testes de contraste da UX V4 anterior | Identidade visual e legibilidade dos tokens | Ainda exige inspeção visual em diferentes monitores |

## Testes obrigatórios para liberar o instalador de homologação

- CI da branch aprovada: ESLint, TypeScript, Vitest, build web e auditoria `npm`.
- Nenhuma taxa desconhecida convertida em valor zero e nenhum lucro `null` mostrado como R$ 0,00.
- Nenhuma alteração silenciosa dos snapshots, backups ou da branch principal.
- Teste manual de um arquivo `.gcode.3mf` real da Bambu Studio e navegação do erro até o campo.
- **O Windows precisa ser compilado em execução única, sob aprovação**, em branch de QA ou `workflow_dispatch` de forma controlada. Sem release ou merge.

## Roteiro de homologação do usuário

### Cenário 1 — Custo mínimo
Abrir “Quanto custa imprimir?” → “Preencher manualmente”. Digitar peso **22,31 g**; custos → informar **R$ 120,00** e bobina **1.000 g**. Sem selecionar máquina, energia, mão de obra ou Shopee, conferir **R$ 2,68**. Não precisa informar tempo.

### Cenário 2 — 3MF real
No Bambu Studio, fatiar uma placa e exportar o arquivo fatiado. Importar no FatiaLucro. Conferir peso, peças, tempo e material; quando o fatiador apresentar `PLA;PLA;PLA;PLA` configurado com apenas um filamento consumido, o resumo deve mostrar somente PLA e o consumo real. Quando o tipo só tiver sido configurado, mas sem consumo, não inventar peso.

### Cenário 3 — Dois PLA consumidos
Importar uma impressão com dois consumos de PLA, verificar **Filamento 1** e **Filamento 2**. Informar preços por kg distintos ou aplicar perfis diferentes; clicar em **Corrigir custo desta bobina** em um deles e verificar que apenas o custo do orçamento atual muda.

### Cenário 4 — Venda direta
Com custo conhecido, ir a Venda → Venda direta. Informar **preço R$ 19,90** e quantidade **1**; decidir conscientemente a embalagem. Conferir lucro e despesas excluídas. Não aparecer nenhuma pergunta Shopee.

### Cenário 5 — Shopee sem condições confirmadas
Selecionar Shopee sem confirmar todos os programas e frete. O custo conhecido deve permanecer legível; o lucro final deve ficar **Pendente**, não **R$ 0,00**. Seguir ação de cada pendência.

### Cenário 6 — Corrigir erro
Apagar o preço da bobina ou digitar `abc`. Ir a Resultado e clicar **Corrigir primeiro campo pendente**; verificar se abriu a etapa e focalizou o campo. Repetir com uma bobina inválida em impressão com vários filamentos. A correção deve atualizar o resumo automaticamente.

### Cenário 7 — Interface
Em modo claro inspirado na Bambu Lab, testar 1366×768 e 1280×720; zoom Windows 100% e 125%; teclado Tab/Enter; alertas e campos recolhidos. Se houver sobreposição, botão sem resposta ou campo impossível de localizar, capturar print.

## Critério de conclusão

**Pronto para homologação técnica** significa que o CI e o build Windows passaram, e que as jornadas manuais acima estão disponíveis para o usuário testar; **não significa pronto para venda nem UX visual aprovada**. Não publicar release nem fazer merge até o retorno da homologação.
