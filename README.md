# FatiaLucro

Precificação local de impressão 3D, com custos de produção, simulações de venda direta e Shopee Brasil. Tauri 2 + React + TypeScript, motor decimal independente e licença MIT. Versão **0.1.0 integrada**, ainda aguardando homologação gráfica e de distribuição. Sem servidor, conta online ou telemetria.

## Usar a calculadora

1. Informe um produto ou selecione um `.3mf` fatiado do Bambu Studio / G-code textual compatível. Escolha uma placa e clique em **Aplicar placa à produção**. A leitura é local; não há envio de arquivos.
2. Confira peso, tempo e peças produzidas. No modo lote, esses valores são totais da placa; no modo unidade, descrevem uma peça. A quantidade vendida é independente. Materiais importados precisam de preço por kg explícito ou perfil salvo.
3. Escolha custo completo por hora **ou** energia, manutenção e depreciação. Trabalho manual, reserva de falhas e consumíveis aceitam zero. Embalagem pode ser por unidade e/ou pedido.
4. Escolha venda direta ou Shopee. Para Shopee, configure CPF/CNPJ, adesões e frete; leia as premissas e pendências. Nenhum enquadramento é presumido.
5. Informe preço e unidades vendidas, ou escolha lucro desejado por pedido, margem, ponto de equilíbrio ou comparação. Clique em **Calcular cenário**. Margem `0,20` significa 20%; preços comparados são separados por ponto e vírgula, por exemplo `15; 19,90; 25`.
6. Salve produto, impressora, filamento, custos de produção, configuração do marketplace ou simulação. **Cadastros** aplica perfis reutilizáveis; **Histórico** reabre entradas e catálogo original da simulação. Recalcular utiliza as regras atuais; buscas e comparações são executadas novamente.

Os valores iniciais são exemplos editáveis. Entradas aceitam `19,90` ou `19.90`, sem separadores de milhar. Alterar qualquer entrada sinaliza resultado desatualizado. Não se deve somar frete ou publicidade já incluídos em outro componente.

## O que é calculado

- Filamento por material, energia, máquina, manutenção, depreciação, mão de obra, reservas e embalagens; custo por peça, produção completa e unidades vendidas.
- Taxas individualizadas com fórmula, incidência, base, versão, documentação e limitações; desconto do vendedor, frete líquido, publicidade informada e outras despesas.
- Repasse **simulado**, lucro operacional estimado, margem e markup; alertas de prejuízo e margem baixa configurável.
- Busca exaustiva em centavos para lucro/margem/equilíbrio, até 100 mil candidatos dentro do intervalo informado, respeitando mudanças de faixa e regiões desconhecidas. Comparação de até 20 preços.

A Shopee usa a auditoria e os MHTML arquivados conferidos em 22/11/2026. A classificação separa fórmulas documentadas, **simulações provisórias com premissas ou valores personalizados**, e cobranças indeterminadas que bloqueiam líquido e lucro. Aceitar premissas não resolve adesões ou fórmulas ausentes. A comissão básica obrigatória não pode ser desligada; programas opcionais têm controles independentes. Percentuais e fixos manuais exigem incidência, base, origem e período. Nenhum resultado é recebimento confirmado.

Na faixa regular, R$ 19,90 gera R$ 3,98 + R$ 4,50 = **R$ 8,48 de comissão básica**, com transação incluída. Regressão CPF, fronteiras exatas, vigência, arredondamento e bases após desconto conservam as limitações documentais. A divergência histórica de R$ 0,05 foi preservada. Consulte o [registro Shopee](docs/shopee/README.md).

## Arquivos e dados locais

O importador lê estimativas declaradas, sem fatiar geometria, executar G-code ou converter comprimento em massa por densidade presumida. Um 3MF geométrico pode não trazer peso/tempo/quantidade: use **Preparar preenchimento manual**. Algumas contagens vêm de instâncias do modelo e precisam corresponder a peças comerciais equivalentes. Placas e materiais são separados. Limites: 3MF 100 MB, G-code textual 20 MB, metadados XML/JSON 2 MB por entrada, 32 materiais. ZIP64, arquivos criptografados e G-code binário não são suportados. [Formato e limitações](docs/imports-and-storage.md).

Cadastros usam **IndexedDB local**, sem dependência nativa adicional. São próprios da origem e do perfil do aplicativo: desenvolvimento e desktop não compartilham automaticamente os dados. Exporte o **backup JSON** antes de limpar dados, trocar de instalação ou desinstalar. Importações de backup são validadas e transacionais; IDs iguais são substituídos, outros registros são mantidos. Não há sincronização, criptografia própria ou cópia de segurança automática. Um arquivo importado não fica armazenado integralmente no histórico.

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
- `src/importers`: leitura local limitada de metadados e worker.
- `src/app`: modelo de formulário, composição dos cálculos, worker e persistência.
- `src/ui`: calculadora, cadastros, histórico e demonstrativos.
- `src-tauri`: shell e empacotamento Windows.
- `tests`: regressões financeiras, importadores e IndexedDB em Node.

[Relatório integrado e prontidão](docs/integrated-v01.md) · [Arquitetura](docs/architecture.md) · [Referências e licenças](docs/references.md) · [Revisão financeira anterior](docs/review-v01.md).
