# Arquitetura 0.1

O núcleo TypeScript em `src/engine` é síncrono, determinístico e independente de React, Tauri, rede ou relógio do sistema. Ele recebe a data e o catálogo explicitamente. O adaptador Shopee em `src/marketplaces/shopee` não interfere na fabricação.

## Contrato financeiro

- Moeda, percentuais, medidas e tempo entram como **strings decimais**. `number` é reservado a contagens inteiras limitadas e índices. Entradas monetárias numéricas são rejeitadas em runtime.
- `decimal.js` usa uma configuração isolada de 60 algarismos; não há conversão monetária para `Number`. Valores externos são limitados a 18 algarismos inteiros e 12 fracionários; moeda é limitada a centavos.
- Fabricação: filamento = gramas / 1000 × R$/kg; máquina = horas × custo completo/h **ou**, exclusivamente, energia + manutenção + depreciação. Energia = watts / 1000 × horas × R$/kWh. Trabalho manual = minutos / 60 × R$/h, admitindo zero.
- Consumíveis e reserva de falhas são valores explícitos por peça. A reserva é estimativa do vendedor, não tarifa nem modelo estatístico de rendimento. Cálculo por taxa observada de falha fica para outra etapa.
- Sem `basis`, o contrato anterior continua por unidade: cada componente é arredondado e multiplicado pela quantidade vendida. Com `basis = batch`, peso, tempo e trabalho descrevem o lote: arredonda-se o custo de cada componente do lote, divide-se pelas peças produzidas e multiplica-se pelas unidades vendidas antes de arredondar o total do pedido. Frações do rateio não são perdidas multiplicando o unitário exibido. Consumíveis/reserva continuam por peça; embalagem individual e por pedido são despesas independentes. Até 32 materiais podem ter massas e preços por kg próprios.
- Receita após desconto = preço unitário × quantidade − desconto total bancado pelo vendedor. Frete recebe somente o **custo líquido confirmado** após subsídios e pagamentos de terceiros. Não há subsídio hipotético somado como custo.
- Taxas têm fórmula estruturada (sem `eval`), base explícita, incidência item/pedido, seleção, condições, versão, fonte, verificação e vigência. Fórmulas suportam fixo, percentual, teto e faixas de preço unitário com limite inferior inclusivo e superior exclusivo. Lacunas são permitidas e geram pendências.
- Arredondamento de taxas: `ROUND_HALF_UP` em cada ocorrência; depois a soma. Essa é uma **convenção de simulação**, sem alegar homologação Shopee. Taxa por item e taxa por pedido podem ter resultados diferentes.
- Para comissão após desconto por item, os centavos da base são distribuídos em dois grupos (bases que diferem por um centavo), preservando exatamente o total. É convenção do núcleo genérico; o adaptador Shopee não a aplica sem evidência da base do desconto.
- Recebimento do marketplace = receita após desconto − taxas − frete líquido do vendedor. Lucro operacional estimado = recebimento − fabricação − embalagem − outras despesas operacionais.
- Margem = lucro / receita após desconto. Markup = lucro / (fabricação + embalagem + outras despesas operacionais). Ambos retornam razões decimais com 12 casas, não percentuais nem multiplicadores de preço. Denominador zero retorna `null`. Perdas permanecem negativas.

## Ausência de evidência

Uma fórmula desconhecida, participação não confirmada, condição ausente, lacuna de faixa ou catálogo fora da janela gera `Pending` bloqueante. Vigência não demonstrada, precedência entre documentos conflitantes e a convenção de arredondamento são `Assumption`, separadas das fórmulas ausentes. Sem aceitação explícita em `SaleInput.acceptedAssumptions`, elas também aparecem como pendências. Aceitar uma premissa não preenche uma fórmula, não confirma uma adesão e não apaga frete desconhecido.

`status` indica completude (`complete`/`partial`); `confidence` indica base (`documented`, `provisional`, `indeterminate`). Com qualquer pendência, líquido, lucro, margem e markup continuam `null`. Um cenário completo que usa premissas ou valores personalizados é sempre `provisional`. `settlement = not-confirmed` em todos os casos: calcular uma simulação não confirma repasse. Fabricação e **subtotal calculável** continuam detalhados; subtotais documentais e personalizados são separados. Nunca usar `knownMarketplaceFees` como se fosse taxa completa quando `status = partial`.

`complete` significa uma simulação completa segundo as entradas e o catálogo escolhido, não comprovação de pagamento real ou lucro fiscal. Tributos não informados não são presumidos nem determinados pelo cadastro CPF/CNPJ. Há advertência explícita no retorno e na interface.

`applyManualFees` exige valor/fórmula, incidência, base, origem/motivo e período explicitamente informados. Preserva obrigação, condições e `includes`, registra a fórmula e a evidência substituídas em `override`, e marca a nova origem como `custom`. Só resolve pendências que nomeiam exatamente as cobranças substituíveis em `manualRuleIds`. Não resolve cadastro ausente, adesão desconhecida ou frete não confirmado. Um zero personalizado é uma entrada explícita; o adaptador Shopee impede zerar simultaneamente os dois componentes da comissão básica obrigatória. Nenhum valor vem preenchido automaticamente nos campos de tarifas personalizadas.

Na Shopee, cenários mistos permanecem restritos ao dia da captura. Somente um cenário **inteiramente personalizado**, sem cobranças documentais ativas nem indeterminações restantes, pode usar a interseção dos períodos definidos pelo usuário fora dessa janela. Seu catálogo se identifica como cenário personalizado; não extrapola a vigência das regras arquivadas.

`effectiveFrom`/`effectiveUntil` são vigência da regra; a janela `simulationFrom`/`simulationUntil` limita a autorização documental do catálogo. Não são a mesma coisa. Publicação, atualização, captura e vigência são datas distintas. Histórico documental e simulação são propósitos incompatíveis, validados pelo núcleo. O histórico local de simulações conserva o propósito `simulation` e salva o catálogo junto às entradas; não o transforma em evidência de recebimento.

Cobranças obrigatórias e condicionais não aceitam desligamento manual. Opcionais exigem seleção explícita; condicionais são avaliadas por fatos. `includes` identifica subcomponentes não aditivos; duplicatas, vigências sobrepostas e hierarquias ambíguas são rejeitadas. Essa proteção depende de IDs declarados no catálogo; o motor não adivinha equivalência de cobranças com nomes diferentes.

## Cálculo inverso

`solvePrice` percorre centavos em ordem, dentro do intervalo explícito, até 100.000 candidatos. Retorna o primeiro preço que satisfaz o lucro-alvo por pedido ou a margem-alvo, usando os mesmos cálculos diretos. Não presume monotonicidade: várias taxas arredondadas e mudanças de faixa podem criar quedas e saltos. Preços inferiores ao desconto fixo do pedido são inadmissíveis. Uma região desconhecida interrompe a busca com `partial`; não se afirma um mínimo depois de saltá-la. `not-found` vale somente no intervalo pesquisado.

A classificação e as premissas de **todos os candidatos examinados** são preservadas no solver. Mesmo que o preço encontrado use somente uma regra documental, a busca continua provisória se eliminou candidatos anteriores com valores personalizados. O usuário informa o intervalo; CPF abaixo de R$12 pode interromper a busca. O núcleo nunca pula a regressão indeterminada automaticamente. Equilíbrio usa alvo de lucro zero e retorna o menor preço que cobre os custos dentro do intervalo, que pode começar acima do ponto global. Comparação avalia até 20 preços independentemente, mantendo pendências e classificação de cada um.

O núcleo permanece síncrono e testável. Na interface, cálculo e buscas são executados em um worker de módulo, encerrado após conclusão/falha ou alteração de entradas. Importação usa outro worker temporário. Resultados de tarefas antigas não substituem entradas editadas. Não há execução de G-code, rede, runtime nativo novo ou servidor.

## Adaptadores e desktop

React exibe os dados e envia strings normalizadas. O enquadramento começa vazio, exige CPF/CNPJ explícito e nunca usa CNPJ como fallback. As opções da conta Shopee começam como **não confirmadas**. A comissão básica aparece marcada e bloqueada para desativação; programas têm controles independentes. Premissas e personalizações ficam expansíveis. A venda direta sem marketplace é uma escolha explícita de canal, nunca fallback para regras desconhecidas. Alterações no formulário marcam o resultado anterior como desatualizado.

O frete de `sellerShipping` representa valor líquido **debitado no repasse**. Frete pago externamente entra em `otherOperatingCosts`, uma única vez; não deve reduzir duas vezes o repasse e o lucro. Cupons e subsídios integralmente financiados pela plataforma não entram no desconto pago pelo vendedor.

Tauri 2 empacota a interface e não expõe comandos Rust, permissões de filesystem, shell ou HTTP. CSP restringe scripts e conexões, permitindo workers da própria origem. Não há servidor de aplicação, login, IA, atualização online de tarifas ou telemetria. Links de fontes são referências consultáveis por iniciativa do usuário. Arquivos são selecionados pelo próprio usuário na interface; a leitura ocorre em memória.

`src/app` compõe o cenário a partir de um formulário controlado e serializável, sem transferir regras Shopee para componentes visuais. O IndexedDB guarda cadastros e snapshots localmente, com importação/exportação JSON validada e transacional. A escolha atende à persistência sem adicionar dependências Rust/permissões nativas. Dados dependem da origem/perfil do WebView; backup é explícito. `src/importers` lê apenas metadados limitados, mantém ausência como `null` e exige preço manual por material. Veja [importação e armazenamento](imports-and-storage.md).

A CSP de desenvolvimento permite os scripts/estilos de atualização do Vite e seu WebSocket somente no loopback. A CSP do aplicativo empacotado mantém essas permissões desativadas. O watcher do Vite ignora `src-tauri` para não recarregar a interface a cada artefato Rust. Configuração baseada na [referência oficial](https://v2.tauri.app/reference/config/#securityconfig) e na [integração Vite](https://v2.tauri.app/start/frontend/vite/).

O instalador NSIS requer WebView2 já instalado (`webviewInstallMode = skip`), para não baixar runtime durante a instalação. Rust/MSVC são requisitos de **desenvolvimento**, não do usuário final. O build de revisão é sem assinatura digital; não é uma publicação de release.

## Extensão

Novos marketplaces fornecem `TariffCatalog`, fatos e seleções, reutilizando fabricação, demonstrativo e solver. Eventos de devolução, gastos publicitários por período, resgates, múltiplos SKUs e impostos precisarão de adaptadores com suas próprias bases e incidências. Não devem ser disfarçados de tarifa por item. O contrato serializável permite ampliar incidências e registrar lançamentos com hierarquia sem alterar o cálculo de fabricação.
