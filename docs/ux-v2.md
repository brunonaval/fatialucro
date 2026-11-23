# Experiência UX V2 — revisão integrada da V0.1

Relatório histórico. A experiência atual e sua matriz estão em [UX V3](ux-v3.md).

Esta revisão permanece na versão 0.1.0 e no PR #1, sem merge, release ou publicação da aplicação na `main`. “V2” identifica a experiência solicitada. Não houve execução gráfica, navegador real, instalador ou compilação Windows nesta etapa.

## O que mudou e por quê

O formulário inicial misturava custos de demonstração, configuração de loja e cálculo de venda. A abertura agora oferece **Importar impressão 3D**, **Informar peso e tempo manualmente** e **Explorar um exemplo fictício**. O cálculo real começa sem preços, bobinas, pesos, tempos ou custos de máquina preenchidos. O exemplo tem aviso permanente e não pode ser gravado como produto, perfil ou rascunho real.

A navegação tem somente **Calcular / Meus produtos / Configurações**. No modo simples, o fluxo **Impressão → Custos → Venda → Resultado** mostra uma etapa por vez. O modo avançado expõe os mesmos componentes e o mesmo estado; não possui fórmulas próprias. Venda é opcional: custo de fabricação não requer preço, quantidade vendida ou cadastro Shopee.

**Configurar minha oficina** é um assistente opcional, retomável, com canal/cadastro, impressora, filamento e custos opcionais. Etapas incompletas ficam guardadas para edição; somente perfis válidos são aplicados como padrões. Peso, tempo, peças, preço, quantidade vendida e frete não se tornam padrões de oficina. Perfis de impressora/filamento podem ser salvos antes de concluir o assistente.

## Componentes, estado e operações

| Camada | Responsabilidade |
| --- | --- |
| `app/experience-types`, `experience-validation` | Estado serializável de entrada, intenção custo/venda, modo, etapa, origem, exclusões conscientes e condições do cenário |
| `app/experience` | Formulário vazio, demonstração isolada, adaptação de registros anteriores, custo sem venda, preparação do solver e captura das entradas |
| `app/model`, `engine`, adaptador Shopee | Normalização, cálculos decimais e regras documentais; sem dependência da apresentação |
| `app/automatic`, `ui/useAutomaticCalculation` | Debounce de 450 ms, identificação da versão das entradas, cancelamento de worker e descarte de respostas antigas |
| `app/workshop`, `app/records`, `app/storage` | Aplicação restrita de perfis, produtos/revisões, snapshots, rascunho, lixeira e backup transacional |
| `PrintImport`, `PrintStep`, `CostFields`, `SaleStep`, `ShopQuestions`, `ExperienceResult` | Etapas compartilhadas entre os modos; campos, perguntas, origem e resultado |
| `WorkshopWizard`, `ProductLibrary`, `BackupPanel` | Configuração progressiva, histórico somente leitura, revisão explícita e recuperação de dados |

O formulário tem uma única fonte de dados. O estado do resultado é `waiting`, `processing`, `ready` ou `invalid`, associado à assinatura financeira e às versões de tabelas. Uma mudança oculta o resultado antes mesmo de agendar o novo worker. Alterar só a etapa, o nome ou o modo não reinicia o cálculo. Erro e edição não reutilizam números anteriores como atuais. Enter/“Atualizar e ver resultado agora” permite calcular imediatamente.

## Contrato financeiro preservado e extensões explícitas

As fórmulas anteriores, a precisão decimal, as regras Shopee, os documentos, os catálogos JSON e os testes financeiros existentes foram preservados. As extensões são entradas opcionais; sem elas, os cálculos mantêm o contrato anterior:

- **Bobina:** consumo em gramas × valor pago ÷ peso líquido real. O preço equivalente por grama/kg é apenas uma apresentação aproximada; não alimenta o motor. Multiplica-se antes de dividir, evitando perder um meio centavo por aproximação intermediária. O preço direto por kg continua disponível. Nenhuma bobina recebe 1 kg presumido.
- **Materiais:** cada linha aceita preço/kg ou o valor/peso de um perfil de bobina. Suportes/purga devem estar no consumo conhecido; não são acrescidos automaticamente aos metadados.
- **Máquina:** custo completo/h e energia/manutenção/depreciação são exclusivos. É possível excluir máquina/energia explicitamente e calcular somente os custos selecionados. Desgaste separado tem adesão própria. Exclusão não comprova custo real zero.
- **Mão de obra:** excluída, considerada zero por decisão consciente, ou tempo/valor informados. Nenhum serviço do marketplace desconhecido usa esse mecanismo.
- **Embalagem:** custo por unidade comercial ou preço de pacote × unidades vendidas ÷ quantidade de embalagens compradas, arredondando o total do pedido; embalagem compartilhada por pedido é independente.
- **Lote/pedido/kit:** peso e tempo do lote são rateados pelas peças físicas fabricadas. Cinco fabricadas e duas vendidas alocam 2/5 do lote; não obrigam vender cinco. Um kit multiplica o custo físico pelas peças equivalentes que o compõem, mas as tarifas por item incidem na unidade comercial vendida. Kits com SKUs de custos diferentes não são consolidados.
- **Arredondamento:** HALF_UP e rateio anterior foram mantidos. Embalagem de pacote não arredonda antecipadamente um custo unitário fracionário. A soma do pedido pode diferir do unitário exibido multiplicado pela quantidade.
- **Busca:** lucro-alvo é por pedido; margem é lucro/receita após desconto, não markup. Sem preço inicial, o solver usa o intervalo explícito e retorna o mínimo matemático. Uma busca bloqueada não mostra como sugestão o preço máximo usado internamente na preparação. A captura final conserva todas as premissas do percurso, inclusive as personalizadas.

Na Shopee, o volume pode ser informado como acima/abaixo/exatamente no limite da tabela selecionada, sem inventar uma contagem. Essa resposta é vinculada ao limite e à data do cenário; se mudarem, volta a desconhecida. O número exato opcional tem prioridade. Exatamente 450 e as demais lacunas documentais continuam pendentes. Frete e volume pertencem ao cenário; cadastro e adesões podem ser reutilizados.

R$19,90 continua identificando **R$8,48 de comissão básica por unidade**, com transação incluída. As fronteiras de R$80/100/200, regressão CPF, conflito documental, vigência, arredondamento e desconto mantêm suas limitações existentes; R$500 conserva a resolução documental anterior de comissão básica R$96. A divergência histórica de R$0,05 permanece sem ajuste artificial.

## Resultados e transparência

A hierarquia distingue preço, fabricação, tarifas, repasse estimado, lucro e margem, com pedido e unidade comercial quando aplicável. **Completo** vale dentro das entradas conhecidas do cenário; **Provisório** identifica premissas ou personalizações aceitas; **Parcial** conserva líquido/lucro/margem pendentes e mostra apenas tarifas calculáveis. Nenhuma simulação comprova recebimento.

O resultado mostra quais custos foram excluídos, “Para onde vai o dinheiro” e “Ver cálculo completo”. “Entenda as taxas → Auditoria completa e parâmetros personalizados” mantém a comissão obrigatória bloqueada, programas independentes, incidência, período e origem personalizada. Fórmulas e fontes detalhadas aparecem no demonstrativo. Perguntas “Não sei” não se tornam zero. A consulta GitHub continua manual, revisável, com integridade, esquema, regressões e cache offline.

Avisos de proximidade de faixa são derivados das bandas documentadas que mudam percentual/parcela fixa; não inventam um degrau em R$500. Alertas de prejuízo usam lucro calculado; resultados parciais não recebem sinal fictício de lucro/prejuízo.

## Dados locais, segurança e compatibilidade

O banco mantém o nome `fatialucro-local-v1` e passa à versão **3**. A migração conserva os stores e não reescreve registros antigos. A versão impede que uma instância anterior, que desconhece cálculos somente de custo, escreva silenciosamente no novo formato. Históricos legados sem vínculo de produto aparecem em grupo próprio.

Salvar um resultado cria uma revisão e preserva as anteriores. Consultar histórico usa exclusivamente o snapshot de entradas e catálogo original. “Editar como nova revisão” usa as regras atuais e avisa isso antes do novo salvamento. Duplicar cria um produto independente. Cópias calculadas não compartilham referências mutáveis com o formulário.

O rascunho real é salvo após 700 ms e oferecido para recuperação, sem substituir automaticamente o trabalho atual. Abrir exemplo, nova impressão ou edição tenta preservar o rascunho antes da troca. Uma interrupção abrupta pode perder os últimos 700 ms. Se o armazenamento não estiver disponível, a interface informa a limitação; calcular continua possível. Recuperação de rascunho não restaura o vínculo de edição de um histórico: salvar cria produto independente, preservando o anterior.

Exclusão exige confirmação e move para lixeira recuperável. Ao excluir um produto, suas revisões ativas acompanham a operação. Restaurar essa operação não revive revisões excluídas individualmente antes dela. Não há remoção definitiva na interface.

Backup **v2** inclui registros e lixeira; leitura de **v1** permanece aceita. Todos os registros são validados antes de uma única transação. Conflitos de ID com conteúdo diferente geram cópias e remapeiam vínculos/ancestrais/lixeira, sem sobrescrever os existentes. `restoredFromId` registra a origem. Preferências, progresso da oficina, rascunho e cache público não fazem parte do arquivo de backup; perfis e catálogo original de cada simulação fazem. Proteção não substitui backup externo. Persistência, quota e download/restauro no WebView2 exigem homologação real.

## Matriz de requisitos

“Implementado” indica código e cobertura não interativa; não representa homologação visual ou de usabilidade no Windows.

| Requisito | Estado | Evidência / limite |
| --- | --- | --- |
| Estudo de arquitetura e referências antes da edição | Implementado | Plano interno de componentes/estados e [referências](references.md); DBLAB3D indisponível na consulta |
| Abertura importação/manual/exemplo sem custos fictícios | Implementado | Nova fábrica vazia, demonstração rejeitada na persistência e testes de primeiro uso |
| Oficina opcional, retomável, perfis parciais sem bloqueio | Implementado | Wizard separado do cenário, armazenamento de etapa e aplicação somente de perfis válidos |
| Três áreas e fluxo Impressão/Custos/Venda/Resultado | Implementado | Componentes por etapa, navegação sem novas áreas principais |
| Modo simples/avançado com mesmos dados e motor | Implementado | Assinatura financeira ignora apresentação; teste de equivalência |
| Importação fatiada, origem, placa, materiais, ausências | Implementado | Metadados em worker, revisão antes de aplicar, ZIPs sintéticos com múltiplas placas/materiais |
| Múltiplas placas | Parcial | Seleção de uma placa e aviso explícito; consolidação não implementada |
| Compatibilidade real Bambu/Orca e `.gcode.3mf` | Parcial | Formatos de metadados cobertos; arquivos reais e versões do fatiador aguardam homologação |
| Seleção de arquivo e arrastar/soltar | Parcial | HTML5 e configuração Tauri para permitir drop web; integração nativa não executada |
| Bobina, peso líquido, kg, materiais e perfis restritos | Implementado | Cálculo exato por compra e testes de meio centavo e aplicação de perfil |
| Máquina exclusiva, custos opcionais e embalagem de pacote | Implementado | Energia/full-hour não se somam; zero consciente e rateio do pacote testados |
| Separação de peças fabricadas, pedido e kit | Implementado | Testes cinco/duas e kit equivalente; SKUs heterogêneos permanecem fora do escopo |
| Preço conhecido ou meta de lucro/margem/equilíbrio | Implementado | Mesmo solver exato; snapshot do preço final e premissas; comparação mantida |
| Recálculo, debounce, cancelamento e invalidar anterior | Implementado | Temporizadores simulados, falhas, cancelamento e HTML sem valores antigos |
| Shopee acessível, Não sei, loja persistente e cenário | Implementado | Perguntas, volume vinculado à data/limite, frete independente e pendências testadas |
| Taxas obrigatórias, opcionais, premissas e auditoria | Implementado | Obrigatória desabilitada, programas próprios, aceitação explícita e catálogo preservado |
| Hierarquia completo/provisório/parcial e detalhamento | Implementado | HTML estático e testes financeiros; resultado parcial sem lucro calculado |
| Temas, tokens, formatação brasileira e semântica | Implementado | Sem novas fontes/dependências, contraste de tokens, labels/IDs, foco CSS e botões nativos |
| WCAG 2.2 AA, teclado real, zoom/DPI e responsividade | Parcial | Estrutura e estilos preparados; conformidade integral não declarada sem homologação |
| Produtos, duplicação, revisões e histórico original | Implementado | Snapshots congelados e testes de histórico após mudança de catálogo |
| Rascunho, migração, exclusão recuperável e backup | Implementado | IndexedDB emulado, v2→v3, backup v1/v2, quota atômica anterior e conflitos remapeados |
| Servidor/contas/assinaturas/telemetria | Implementado | Não introduzidos; cálculo, importação e dados locais funcionam sem rede |
| Teste gráfico/instalador/distribuição Windows | Pendente | Expressamente não executado nesta etapa |

## Validação e decisão de entrega

Os testes novos cobrem custos sem Shopee/preço, primeiro cenário CPF, perfis reabertos, bobina de peso real, zero consciente, programas desconhecidos, kits, lote/pedido, arredondamento, solver bloqueado, cancelamento, origem importada, metadados ausentes, lixeira, conflitos e migração. HTML estático verifica comunicação de estados, rótulos e controles nativos. Os testes financeiros anteriores continuam obrigatórios; testes de navegação real não são substituídos por renderização estática.

Validação consolidada local em 22/11/2026: `npm run check` aprovado — ESLint sem avisos, **221 testes em 15 arquivos**, TypeScript sem erros e build web concluído. Os 181 testes anteriores permanecem; foram acrescentados 40 casos. A primeira rodada detectou uma referência mutável entre formulário e cópia calculada, corrigida com captura isolada e teste de regressão. O lint detectou um parâmetro não utilizado, removido antes da rodada aprovada. Não foi alterada fórmula aprovada para satisfazer teste. A execução leve do PR no GitHub será verificada no mesmo commit; não será acionado build Windows.

**Merge técnico:** candidato à revisão, com validação automatizada local aprovada; exige checks do commit integrado e aceitação das pendências documentadas. Se a política de merge exigir homologação gráfica, o merge permanece pendente. **Lançamento público:** não pronto. Antes de lançar, homologar primeiro uso com leigos, persistência/backup no WebView2, arquivos reais Bambu/Orca, arrastar/soltar, temas, teclado/leitor de tela, foco após mudanças de etapa, alto contraste, zoom/DPI (125/150/200%), janela estreita, desempenho do solver, instalador, offline, ausência do WebView2 e desinstalação. As lacunas documentais Shopee continuam expostas, sem valores presumidos.

Nenhum teste gráfico, instalação, desinstalação ou compatibilidade sem WebView2 foi aprovado nesta revisão. O modo NSIS continua exigindo WebView2 já instalado; não houve verificação nativa da nova configuração de drag/drop. Nenhuma dependência nova, build Windows, release ou mudança da `main` faz parte desta entrega.
