# Relatório de implementação 0.1 — 22/11/2026

Registro da primeira execução. Para as correções, novas evidências, testes do instalador e decisão de prontidão, consulte a [revisão da V0.1](review-v01.md). Na revisão posterior foram localizados os MHTML fora do diretório de referências inicialmente inspecionado.

Checkout: `C:\Projetos\FatiaLucro`, repositório `brunonaval/fatialucro`, branch `feat/pricing-engine-v01`. A base encontrada continha apenas README, licença MIT e gitignore, com um commit inicial. Não foram encontrados arquivos AGENTS.md aplicáveis. Nenhuma alteração foi feita diretamente em main.

## Entregue

- Projeto TypeScript estrito, React, Vite, ESLint, Vitest e decimal.js, com lockfile npm.
- Fabricação por unidade: filamento, tempo, máquina completa ou componentes exclusivos, energia, manutenção, depreciação, mão de obra inclusive zero, consumíveis e reserva explícita de falhas.
- Embalagem por unidade/pedido, desconto bancado pelo vendedor, frete líquido informado, outras despesas, recebimento, lucro operacional estimado, margem e markup com denominadores explícitos.
- Catálogo versionado com fórmulas estruturadas, faixas, teto, fonte, estado documental, vigência, condições e seleção; bloqueio de obrigatórias e de duplicatas; detalhamento de bases, quantidades, valor anterior ao arredondamento e centavos somados.
- Solver por lucro ou margem, com busca em centavos limitada a intervalo explícito, resistente a descontinuidades e sem atravessar região desconhecida.
- Adaptador Shopee: partes documentadas de comissão/fixa, baixo valor CNPJ, alto volume CPF, Devolução Fácil e Destaque. Indeterminações retornam pendências, sem valores inventados.
- Histórico isolado de junho: cinco coincidências matemáticas com a auditoria e divergência preservada de R$0,05 no caso R$7,90. R$23,90 é total de pedido com duas unidades, não preço unitário.
- Interface mínima para entradas, demonstrativo, fontes, pendências e busca inversa. Venda direta sem taxas disponível por escolha explícita. Alterações indicam necessidade de recalcular.
- Shell Tauri 2, instalador NSIS Windows x64 e GitHub Actions de lint/testes/build/auditoria npm e compilação Windows.
- Documentação própria de arquitetura, pré-requisitos e evidências, sem copiar artigos, documentos privados ou credenciais.

## Verificação

| Verificação | Resultado |
| --- | --- |
| Instalação limpa `npm ci` no Windows | passou |
| ESLint sem avisos | passou |
| Vitest | 75 testes passaram em 4 arquivos, incluindo 6 casos históricos |
| TypeScript estrito e build de produção Vite | passaram |
| `npm audit --audit-level=high` | zero vulnerabilidades informadas |
| CI Linux: instalação limpa, lint, testes, tipos, build e auditoria | passou |
| CI Windows: `cargo fmt` e `cargo clippy --all-targets -- -D warnings` | passaram |
| Conferência da interface no Edge headless | 5 cenários funcionais passaram; sem erros JavaScript nem requisições externas |
| Políticas CSP de desenvolvimento e produção aplicadas no navegador | passaram, sem violações observadas |
| Build/instalador Windows x64 NSIS | passou; instalador de revisão gerado no GitHub Actions |

Os cenários da interface foram: Shopee R$19,90 com subtotal conhecido R$8,48 e resultado pendente; venda direta com os custos de exemplo e lucro R$14,53; alteração da entrada sinalizando resultado desatualizado; busca de lucro R$5 com preço mínimo R$10,37; preço Shopee R$80 exatamente com fronteira pendente. A visualização em largura 390px também foi inspecionada. Playwright foi utilizado em diretório temporário, sem adicionar dependência ao aplicativo ou ao projeto.

A compilação nativa não pode ser executada localmente porque Rust/Cargo não estão instalados; o ambiente tem MSVC e WebView2. As dependências npm foram instaladas somente após registrar a inspeção dos pré-requisitos. Os totais históricos são regressões da auditoria fornecida, não verificação independente de comprovantes primários.

O primeiro [build Windows bem-sucedido](https://github.com/brunonaval/fatialucro/actions/runs/45055983847) gerou o instalador e o `Cargo.lock`, incorporado ao projeto. O workflow exige `--locked` nas compilações seguintes. O [PR de revisão e suas validações](https://github.com/brunonaval/fatialucro/pull/1/checks) registra o estado atualizado. O instalador não foi instalado nem submetido a teste interativo nativo nesta máquina; a conferência funcional da interface foi no Edge, separadamente do build nativo.

## Limites conhecidos

Não há homologação oficial da Shopee. O pacote contém síntese documental e inventário, sem MHTML nem extratos primários. Consulta aos links oficiais não expôs o texto ao acesso automatizado. As datas de atualização/captura não são convertidas em vigência. Toda prévia Shopee mantém pendências de vigência e arredondamento, portanto não libera lucro, margem, markup ou líquido como determinados. Fórmulas ficam restritas ao cenário documental de 22/11/2026, sem extrapolar para junho ou para datas posteriores.

Regressão CPF <12, limite de 450, preços exatos de 80/100/200/500, bases após descontos, programas avançados, condições de devolução e frete têm pendências documentadas em `docs/shopee/README.md`. Ads Fácil, afiliados e antecipação ativos/desconhecidos geram pendência explícita. Outras despesas reais podem ser informadas manualmente, sem se tornarem tarifas oficiais.

SQLite, salvar/reabrir simulações, importação de fatiadores/extratos, múltiplos SKUs, impostos específicos, assinatura digital e publicação de release ficam para próximas etapas. O aplicativo não usa rede de integração, contas, IA ou telemetria. O instalador requer WebView2 existente. A busca inversa é síncrona e limitada a 100.000 preços; intervalos grandes podem pausar brevemente a interface.

O Pull Request deve permanecer para revisão. Não houve integração na main nem publicação de documentos privados.
