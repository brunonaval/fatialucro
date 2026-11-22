# Entrega integrada 0.1 — 22/11/2026

Registro da integração anterior. A revisão posterior de catálogos e interface está em [tarifas e UX](tariffs-and-ux.md), incluindo a resolução documental de R$500 e a seleção por versões.

Branch `feat/pricing-engine-v01`, [PR #1](https://github.com/brunonaval/fatialucro/pull/1). O motor, as regressões anteriores e o histórico Git foram preservados. Não houve alteração em main, merge, release, build nativo ou execução de instalador nesta etapa.

## Construído e corrigido

- Calculadora integrada com produto/importação, produção, marketplace, preço e lucro; cadastros/histórico locais, detalhes expansíveis e mensagens de resultado desatualizado.
- Fabricação por peça ou lote, quantidade produzida independente da vendida, vários materiais com preços próprios, energia, manutenção, depreciação, custo horário completo exclusivo, mão de obra inclusive zero, embalagens e reserva explícita. Produção completa e custo alocado à venda são mostrados separadamente.
- Rateio mantém centavos do lote; não multiplica um unitário visualmente arredondado. Convenção declarada e coberta por regressão. Taxas horárias admitem frações para depreciação calculada por vida útil.
- Importação de placas Bambu 3MF e cabeçalhos G-code em worker, com limites e rejeição de entradas perigosas/incompletas. Falta de massa, tempo ou contagem permanece ausente; preços por kg exigem entrada/perfil explícito. Geometria não vira consumo presumido.
- Produtos, impressoras, filamentos, custos de fabricação, configurações Shopee e simulações em IndexedDB. Backup JSON validado antes de transação única, abortada também em falta de espaço. Histórico conserva catálogo/entradas, confere coerência e reproduz o cálculo sem substituir regras antigas.
- Cálculo direto, alvo de lucro, margem, equilíbrio e comparação; alertas de perda/margem baixa. Cálculos e buscas em worker, sem bloquear a thread da UI; edição cancela resultado assíncrono anterior.
- Personalizações desativadas de programas não contaminam programas ativos. Quantidade de lote ausente não interfere no modo por unidade. Perfil de impressora não sobrescreve produto/preço/CPF.
- Shopee preserva comissão percentual/fixa, adicional CPF condicional, Devolução Fácil, Destaque, Ads Fácil, afiliados e antecipação com fontes/pendências. Publicidade convencional pode ser informada como despesa apurada, independente de adesão Ads Fácil. Obrigatórias bloqueadas e opcionais independentes. Nenhuma cobrança desconhecida é zerada.
- GitHub Actions: validação leve no PR; Windows apenas por `workflow_dispatch` com `build_windows = true`, retenção de três dias. Não foi solicitado nem disparado build Windows.
- O primeiro CI da integração detectou dependências opcionais `@emnapi` omitidas do lockfile pelo npm 11.6.2 local. O lockfile foi reparado em diretório limpo com npm 11.19.1 (versão do runner), sem alterar versões diretas, e validado por instalações limpas antes da correção enviada. O job Windows permaneceu ignorado.

As três referências MIT foram estudadas, com commits e conclusões em [referências](references.md). A implementação é própria, reaproveitando o motor decimal existente, sem copiar documentação integral ou arquivos privados.

## Validação não interativa

Rodada consolidada local: `npm run check` **aprovado** — ESLint sem avisos, **146 testes em oito arquivos**, TypeScript estrito e build Vite de produção. Os **102 testes anteriores foram preservados**; 44 novos testes cobrem a integração. `npm audit --audit-level=high`: **zero vulnerabilidades**. `git diff --check`: sem erros. O build inclui os dois workers locais, sem iniciar servidor ou aplicativo. CI leve do PR é registrado no próprio GitHub; nenhum build Windows é disparado por atualização do PR.

A primeira rodada da integração passou no lint e em 144/145 testes; a falha era expectativa incorreta de texto de erro em um teste novo, corrigida sem alterar o comportamento de rejeição. Foram acrescentadas verificações de ZIP truncado e coerência do histórico antes da rodada consolidada aprovada.

Cobertura nova: custos de lote/múltiplos materiais, centavos rateados, depreciação fracionária, produção versus venda, publicidade/frete, equilíbrio/comparação com prejuízo e indeterminação, CPF/CNPJ, personalização e incidência, aplicação de placas incompletas e perfis; importadores sintéticos válidos, geométricos, conflitantes, malformados e limitados; IndexedDB reaberto, snapshots, backup, atualização, exclusão e aborto por quota. Não há testes gráficos/headless nesta etapa.

R$19,90 continua identificando **R$8,48 de comissão básica documental**, sem duplicar transação. As regressões históricas mantêm **R$0,05 sem explicação**, sem correção artificial. Regras documentais não foram extrapoladas para períodos desconhecidos.

## Limitações e homologação

- Gráfica/Windows desta integração: **pendentes** instalação, abertura, formulários, recálculo, busca, CPF/CNPJ, persistência real no WebView2, workers sob CSP do shell, seleção/importação e exportação/restauro JSON, inicialização offline, ausência de WebView2 e desinstalação. Não foram abertos navegadores, aplicativos, instaladores ou ferramentas de automação gráfica. Nenhum teste manual foi solicitado ao proprietário. Resultados nativos antigos constam da [revisão histórica](review-v01.md) e não homologam esta versão.
- Importação real: **pendente** homologação com arquivos reais e diferentes versões Bambu/dialetos G-code. Os testes usam fixtures sintéticas em memória. Contagem de instâncias exige equivalência com peças comerciais; múltiplos SKUs distintos não são rateados automaticamente. Sem fatiador, G-code binário, ZIP64 ou geometrias convertidas em peso.
- Dados locais: IndexedDB depende de origem/perfil; backup explícito sem sincronização, criptografia própria ou recuperação automática. Armazenamento/download no desktop ainda exige homologação. Formulários podem ser salvos incompletos, mas o cálculo exige os campos usados.
- Financeiro: sem comprovação de vigência/arredondamento Shopee, regressão CPF, fronteiras exatas, bases após desconto ou fórmulas de todos os programas. Premissas e valores personalizados são provisórios; adesão desconhecida bloqueia resultado. Tributos e outros custos devem ser informados; não há determinação fiscal, conciliação de extratos ou recebimento confirmado.
- Distribuição: requer WebView2 instalado, sem assinatura digital. Rust/Cargo continuam ausentes no ambiente local. O build web não comprova empacotamento nativo.

**Merge técnico:** candidato à revisão técnica após os checks de código, sem afirmar homologação do desktop. PR permanece draft; integração na main depende de nova autorização. Se o critério de merge incluir homologação Windows, permanece pendente.

**Lançamento público:** não pronto. Exige a rodada posterior de homologação gráfica/distribuição e avaliação das limitações financeiras/documentais. Não há release pública.
