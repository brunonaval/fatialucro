# Relatório de implementação 0.1 — 22/11/2026

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

Resultados locais e do CI serão consolidados após a execução final. A compilação nativa não pode ser executada localmente porque Rust/Cargo não estão instalados; o ambiente tem MSVC e WebView2. As dependências npm foram instaladas somente após registrar a inspeção dos pré-requisitos.

## Limites conhecidos

Não há homologação oficial da Shopee. O pacote contém síntese documental e inventário, sem MHTML nem extratos primários. Consulta aos links oficiais não expôs o texto ao acesso automatizado. As datas de atualização/captura não são convertidas em vigência. Toda prévia Shopee mantém pendências de vigência e arredondamento, portanto não libera lucro, margem, markup ou líquido como determinados. Fórmulas ficam restritas ao cenário documental de 22/11/2026, sem extrapolar para junho ou para datas posteriores.

Regressão CPF <12, limite de 450, preços exatos de 80/100/200/500, bases após descontos, programas avançados, condições de devolução e frete têm pendências documentadas em `docs/shopee/README.md`. Ads Fácil, afiliados e antecipação ativos/desconhecidos geram pendência explícita. Outras despesas reais podem ser informadas manualmente, sem se tornarem tarifas oficiais.

SQLite, salvar/reabrir simulações, importação de fatiadores/extratos, múltiplos SKUs, impostos específicos, assinatura digital e publicação de release ficam para próximas etapas. O aplicativo não usa rede de integração, contas, IA ou telemetria. O instalador requer WebView2 existente. A busca inversa é síncrona e limitada a 100.000 preços; intervalos grandes podem pausar brevemente a interface.

O Pull Request deve permanecer para revisão. Não houve integração na main nem publicação de documentos privados.
