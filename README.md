# FatiaLucro

Precificação local de impressão 3D, com custos de produção, simulações de venda direta e Shopee Brasil. Tauri 2 + React + TypeScript, motor decimal independente e licença MIT. Versão **0.1.0 integrada**, ainda aguardando homologação gráfica e de distribuição. Sem servidor, conta online ou telemetria.

## Usar a calculadora

A navegação é **Calcular / Meus produtos / Configurações**. O modo simples começa em **Impressão → Custos → Resultado**, com Venda adicionada somente quando escolhida; o modo avançado usa os mesmos dados e cálculos.

1. **Importar impressão 3D** permite selecionar ou arrastar uma placa fatiada Bambu Studio/OrcaSlicer (`.3mf`, inclusive `.gcode.3mf`) ou G-code textual compatível. Confira a origem, placa, impressora, materiais e ausências antes de **Usar esta placa**. **Preencher manualmente — peso e tempo** está disponível sem cadastro.
2. Confira as peças físicas produzidas, peso e tempo do lote ou de uma peça. A quantidade vendida é independente; kits indicam quantas peças equivalentes compõem uma unidade comercial. Múltiplas placas são calculadas separadamente, sem consolidação automática.
3. Informe o valor pago pela bobina e seu peso líquido real, ou o preço por kg. A prévia mostra o custo de material já calculável. Nenhuma bobina recebe 1 kg presumido. Escolha custo completo por hora ou energia/desgaste separados; também é possível calcular só material. Mão de obra é opcional, inclusive zero consciente. Embalagens aceitam custo unitário ou pacote dividido pela quantidade.
4. Para conhecer somente os custos, não é necessário informar preço, quantidade vendida ou loja. Use **Ver custo da impressão** para pular Venda; depois, **Simular uma venda com este custo** reaproveita os dados. Para simular uma venda, informe preço ou meta de lucro/margem; venda direta dispensa Shopee. CPF/CNPJ e adesões não são presumidos. O cadastro da loja pode ser salvo; somente adesões explicitamente contínuas atravessam datas. Campanhas/testes, frete, volume e hipóteses exigem confirmação adequada ao cenário.
5. O recálculo é automático após uma pausa na digitação. Durante edição/erro, números antigos ficam ocultos. A busca retorna um mínimo matemático no intervalo, sem recomendação competitiva de mercado. **Para onde vai o dinheiro** e **Ver cálculo completo** explicam os valores e pendências.
6. Dê um nome e salve produto/simulação em **Meus produtos**. Consulte o histórico com suas regras originais ou edite explicitamente uma nova revisão com regras atuais. É possível duplicar, confirmar exclusão para lixeira e recuperar. O rascunho real é salvo localmente e oferecido na próxima abertura.

O primeiro cálculo começa **sem custos fictícios**. **Experimentar com um exemplo fictício** é uma demonstração isolada que não pode ser gravada como dado real. **Configurar minha oficina**, em Configurações, é opcional e retomável; impressora e filamento podem ser salvos sem terminar o assistente.

Novos cenários usam a **data local do computador**; históricos conservam a sua data. Moeda aceita `19,90` ou `19.90` e colagem como `R$ 1.234,56`; duração aceita `hh:mm:ss` ou horas decimais. Margem visual `20` significa 20%, com razão `0.20` no motor. Valores são strings decimais validadas; campos inválidos não são arredondados para parecer válidos.

Em janelas largas, **Meu resumo** acompanha as etapas; em janelas menores, aparece após os campos. Custos conhecidos continuam visíveis quando ainda falta um dado da venda. Embalagem tem decisão própria, inclusive **Ainda não sei**, que bloqueia o lucro conclusivo da venda. Programas Shopee podem ser declarados em conjunto, sempre enumerados e vinculados à data. **Ver hipóteses** explica a referência documental antes do aceite específico.

Em **Configurações**, **Aparência** oferece claro, escuro ou sistema, com preferência local. Rótulos, foco visível e layout responsivo foram preparados; revisão visual, navegação real por teclado/zoom e conformidade integral de acessibilidade continuam pendentes. Veja a [matriz de requisitos e homologação da UX V3](docs/ux-v3.md).

## Catálogos versionados

Tabelas em `public/catalogs` registram início/fim de vigência (inclusive `null` quando não comprovados), fontes oficiais e hashes de evidência, última verificação, versão, revisão e estado documental. A seleção considera a data do cenário, substituições explícitas e períodos inclusivos. A revisão anterior permanece arquivada. **A data atual e a seleção automática nunca atualizam a data de verificação.**

Quando não há vigência comprovada, uma referência documental anterior pode ser selecionada para simulação **provisória**, com aceitação explícita da premissa. Não é apresentada como tabela vigente ou recém-verificada. Antes da evidência, após um fim conhecido ou retirada documental, não se recupera silenciosamente uma tabela antiga.

Em **Configurações → Consultar atualizações no GitHub**, o usuário consulta o canal público de revisão deste PR. A consulta valida esquema, limites e SHA-256, mostra as novas versões e exige **Aplicar publicação revisada**. Não há scraping ou atualização de valores em segundo plano. Falhas/offline preservam a cópia local; downgrades, reescrita/remoção de versões e revisões regressivas são rejeitados. Histórico conserva o catálogo usado. A CSP permite somente o host GitHub necessário a essa consulta, além do IPC local.

O canal está na branch de desenvolvimento; não é uma release pública. A confiança depende do repositório/HTTPS e da revisão documental do mantenedor: hashes detectam corrupção, não constituem assinatura digital independente. [Política, limites e relatório da revisão](docs/tariffs-and-ux.md).

## O que é calculado

- Filamento por material, energia, máquina, manutenção, depreciação, mão de obra, reservas e embalagens; custo por peça, produção completa e unidades vendidas.
- Taxas individualizadas com fórmula, incidência, base, versão, documentação e limitações; desconto do vendedor, frete líquido, publicidade informada e outras despesas.
- Repasse **simulado**, lucro operacional estimado, margem e markup; alertas de prejuízo e margem baixa configurável.
- Busca exaustiva em centavos para lucro/margem/equilíbrio, até 100 mil candidatos dentro do intervalo informado, respeitando mudanças de faixa e regiões desconhecidas. Comparação de até 20 preços.

A Shopee usa a auditoria e os MHTML arquivados conferidos em 22/11/2026. A classificação separa fórmulas documentadas, **simulações provisórias com premissas ou valores personalizados**, e cobranças indeterminadas que bloqueiam líquido e lucro. Aceitar premissas não resolve adesões ou fórmulas ausentes. A comissão básica obrigatória não pode ser desligada; programas opcionais têm controles independentes. Percentuais e fixos manuais exigem incidência, base, origem e período. Nenhum resultado é recebimento confirmado.

Na faixa regular, R$ 19,90 gera R$ 3,98 + R$ 4,50 = **R$ 8,48 de comissão básica**, com transação incluída. A fronteira de **R$ 500 foi comprovada pelo exemplo oficial: comissão básica R$ 96**. R$ 80, R$ 100 e R$ 200 ainda têm lacunas específicas; regressão CPF, vigência, arredondamento e bases após desconto mantêm suas limitações. A divergência histórica de R$ 0,05 foi preservada. Consulte o [registro Shopee](docs/shopee/README.md).

## Arquivos e dados locais

O importador lê estimativas declaradas, sem fatiar geometria, executar G-code ou converter comprimento em massa por densidade presumida. Um 3MF geométrico pode não trazer peso/tempo/quantidade: use **Informar os dados manualmente**. Algumas contagens vêm de instâncias do modelo e precisam corresponder a peças comerciais equivalentes. Placas e materiais são separados. Limites: 3MF 100 MB, G-code textual 20 MB, metadados XML/JSON 2 MB por entrada, 32 materiais. ZIP64, arquivos criptografados e G-code binário não são suportados. [Formato e limitações](docs/imports-and-storage.md).

Cadastros usam **IndexedDB local**, sem dependência nativa adicional. São próprios da origem e do perfil do aplicativo: desenvolvimento e desktop não compartilham automaticamente os dados. Exporte o **backup JSON** antes de limpar dados, trocar de instalação ou desinstalar. Backup v2 inclui a lixeira e continua lendo v1. Importações são validadas e transacionais; conflitos de ID com conteúdo diferente geram cópias e preservam os vínculos, sem sobrescrever os dados existentes. Rascunho, progresso da oficina, tema e cache público não entram no backup; perfis e snapshots financeiros entram. Não há sincronização, criptografia própria ou cópia de segurança automática. Um arquivo importado não fica armazenado integralmente no histórico.

## Desenvolvimento e validação

Node.js 24 LTS; veja os [pré-requisitos](docs/prerequisites.md).

```powershell
npm ci
npm run check        # lint, testes, TypeScript e build web, sem abrir janelas
npm audit --audit-level=high
```

Para desenvolvimento interativo em uma etapa autorizada: `npm run dev` serve em `http://127.0.0.1:1420`; não abre o navegador automaticamente. Desktop exige Rust stable MSVC, ferramentas C++ e WebView2; `npm run tauri -- dev` abre a aplicação. Esses comandos interativos **não foram executados nesta etapa**.

GitHub Actions executa validação leve em PR. Instalador Windows é opcional: execução manual do workflow, na branch de desenvolvimento, com `build_windows = true` somente quando solicitado. Artefatos experimentais duram três dias. Não há publicação automática de release. O instalador requer WebView2 existente e ainda não tem assinatura digital.

## Organização

- `src/engine`: cálculos decimais, tarifas, fabricação e análises.
- `src/marketplaces`: adaptadores e fontes versionadas.
- `public/catalogs`: manifesto, esquema e tabelas documentais imutáveis por versão.
- `src/importers`: leitura local limitada de metadados e worker.
- `src/app`: modelo de formulário, composição dos cálculos, worker e persistência.
- `src/ui`: calculadora, cadastros, histórico e demonstrativos.
- `src-tauri`: shell e empacotamento Windows.
- `tests`: regressões financeiras, importadores e IndexedDB em Node.

[Revisão atual: experiência UX V3 e matriz](docs/ux-v3.md) · [Experiência UX V2 anterior](docs/ux-v2.md) · [Tarifas e UX anterior](docs/tariffs-and-ux.md) · [Integração anterior](docs/integrated-v01.md) · [Arquitetura](docs/architecture.md) · [Referências e licenças](docs/references.md).
