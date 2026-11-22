# Arquitetura 0.1

O núcleo TypeScript em `src/engine` é síncrono, determinístico e independente de React, Tauri, rede ou relógio do sistema. Ele recebe a data e o catálogo explicitamente. O adaptador Shopee em `src/marketplaces/shopee` não interfere na fabricação.

## Contrato financeiro

- Moeda, percentuais, medidas e tempo entram como **strings decimais**. `number` é reservado a contagens inteiras limitadas e índices. Entradas monetárias numéricas são rejeitadas em runtime.
- `decimal.js` usa uma configuração isolada de 60 algarismos; não há conversão monetária para `Number`. Valores externos são limitados a 18 algarismos inteiros e 12 fracionários; moeda é limitada a centavos.
- Fabricação: filamento = gramas / 1000 × R$/kg; máquina = horas × custo completo/h **ou**, exclusivamente, energia + manutenção + depreciação. Energia = watts / 1000 × horas × R$/kWh. Trabalho manual = minutos / 60 × R$/h, admitindo zero.
- Consumíveis e reserva de falhas são valores explícitos por peça. A reserva é estimativa do vendedor, não tarifa nem modelo estatístico de rendimento. Cálculo por taxa observada de falha fica para outra etapa.
- Cada componente de fabricação é arredondado por unidade, depois multiplicado pela quantidade. Embalagem individual × quantidade + embalagem por pedido são despesas independentes.
- Receita após desconto = preço unitário × quantidade − desconto total bancado pelo vendedor. Frete recebe somente o **custo líquido confirmado** após subsídios e pagamentos de terceiros. Não há subsídio hipotético somado como custo.
- Taxas têm fórmula estruturada (sem `eval`), base explícita, incidência item/pedido, seleção, condições, versão, fonte, verificação e vigência. Fórmulas suportam fixo, percentual, teto e faixas de preço unitário com limite inferior inclusivo e superior exclusivo. Lacunas são permitidas e geram pendências.
- Arredondamento de taxas: `ROUND_HALF_UP` em cada ocorrência; depois a soma. Essa é uma **convenção de simulação**, sem alegar homologação Shopee. Taxa por item e taxa por pedido podem ter resultados diferentes.
- Para comissão após desconto por item, os centavos da base são distribuídos em dois grupos (bases que diferem por um centavo), preservando exatamente o total. É convenção do núcleo genérico; o adaptador Shopee não a aplica sem evidência da base do desconto.
- Recebimento do marketplace = receita após desconto − taxas − frete líquido do vendedor. Lucro operacional estimado = recebimento − fabricação − embalagem − outras despesas operacionais.
- Margem = lucro / receita após desconto. Markup = lucro / (fabricação + embalagem + outras despesas operacionais). Ambos retornam razões decimais com 12 casas, não percentuais nem multiplicadores de preço. Denominador zero retorna `null`. Perdas permanecem negativas.

## Ausência de evidência

Uma fórmula desconhecida, participação não confirmada, condição ausente, lacuna de faixa, vigência ausente ou catálogo fora da janela gera `Pending`. Havendo qualquer pendência, líquido, lucro, margem e markup retornam `null`; fabricação e **subtotal conhecido** continuam detalhados. Nunca usar `knownMarketplaceFees` como se fosse a taxa completa quando `status = partial`.

`complete` significa uma simulação completa segundo as entradas e o catálogo escolhido, não comprovação de pagamento real ou lucro fiscal. Tributos não informados não são presumidos nem determinados pelo cadastro CPF/CNPJ. Há advertência explícita no retorno e na interface.

`effectiveFrom`/`effectiveUntil` são vigência da regra; a janela `simulationFrom`/`simulationUntil` limita a autorização documental do catálogo. Não são a mesma coisa. Publicação, atualização, captura e vigência são datas distintas. Histórico e simulação são propósitos incompatíveis, validados pelo núcleo. Catálogos são dados serializáveis, para futuro armazenamento do snapshot junto à simulação.

Cobranças obrigatórias e condicionais não aceitam desligamento manual. Opcionais exigem seleção explícita; condicionais são avaliadas por fatos. `includes` identifica subcomponentes não aditivos; duplicatas, vigências sobrepostas e hierarquias ambíguas são rejeitadas. Essa proteção depende de IDs declarados no catálogo; o motor não adivinha equivalência de cobranças com nomes diferentes.

## Cálculo inverso

`solvePrice` percorre centavos em ordem, dentro do intervalo explícito, até 100.000 candidatos. Retorna o primeiro preço que satisfaz o lucro-alvo por pedido ou a margem-alvo, usando os mesmos cálculos diretos. Não presume monotonicidade: várias taxas arredondadas e mudanças de faixa podem criar quedas e saltos. Preços inferiores ao desconto fixo do pedido são inadmissíveis. Uma região desconhecida interrompe a busca com `partial`; não se afirma um mínimo depois de saltá-la. `not-found` vale somente no intervalo pesquisado.

A busca é síncrona nesta etapa. O limite evita buscas ilimitadas, mas intervalos grandes podem pausar brevemente a interface. Um worker poderá ser adicionado se houver necessidade medida.

## Adaptadores e desktop

React exibe os dados e envia strings normalizadas. As opções da conta Shopee começam como **não confirmadas**. A venda direta sem marketplace é uma escolha explícita de canal, nunca fallback para regras desconhecidas. Alterações no formulário marcam o resultado anterior como desatualizado.

Tauri 2 empacota a interface e não expõe comandos Rust, permissões de arquivos, shell ou HTTP. CSP restringe scripts e conexões. Não há servidor de aplicação, login, IA, atualização online de tarifas, telemetria ou persistência. Links de fontes são referências consultáveis por iniciativa do usuário. SQLite foi adiado até haver um fluxo de salvar/reabrir, evitando dependência sem uso.

A CSP de desenvolvimento permite os scripts/estilos de atualização do Vite e seu WebSocket somente no loopback. A CSP do aplicativo empacotado mantém essas permissões desativadas. O watcher do Vite ignora `src-tauri` para não recarregar a interface a cada artefato Rust. Configuração baseada na [referência oficial](https://v2.tauri.app/reference/config/#securityconfig) e na [integração Vite](https://v2.tauri.app/start/frontend/vite/).

O instalador NSIS requer WebView2 já instalado (`webviewInstallMode = skip`), para não baixar runtime durante a instalação. Rust/MSVC são requisitos de **desenvolvimento**, não do usuário final. O build de revisão é sem assinatura digital; não é uma publicação de release.

## Extensão

Novos marketplaces fornecem `TariffCatalog`, fatos e seleções, reutilizando fabricação, demonstrativo e solver. Eventos de devolução, gastos publicitários por período, resgates, múltiplos SKUs e impostos precisarão de adaptadores com suas próprias bases e incidências. Não devem ser disfarçados de tarifa por item. O contrato serializável permite ampliar incidências e registrar lançamentos com hierarquia sem alterar o cálculo de fabricação.
