# Revisão da V0.1 antes do merge — 22/11/2026

Escopo: corrigir e validar a V0.1 no PR #1, branch `feat/pricing-engine-v01`. A versão continua 0.1.0. O histórico Git foi preservado; não houve merge, mudança em main ou publicação de release.

## Problemas encontrados e corrigidos

1. O estado único de pendência tornava toda simulação Shopee incompleta. Foram separados indeterminações bloqueantes e premissas passíveis de aceitação explícita. `status` indica completude; `confidence` indica cálculo documental, provisório ou indeterminado; repasses nunca são declarados confirmados.
2. Não havia fluxo para valores pessoais. Agora é possível informar fórmula percentual/fixa, base, incidência, origem e período por cobrança. O retorno preserva a regra substituída e marca a origem personalizada. A aceitação de premissas não preenche valores ausentes nem confirma programas/frete.
3. A interface presumiu CNPJ. O cadastro agora começa vazio, com CPF/CNPJ obrigatório na Shopee. A conta pessoal do mantenedor foi testada como cenário CPF, sem transformar esse enquadramento em padrão público.
4. O cálculo após desconto ainda exibia uma parcela fixa dependente de faixa sem base suficientemente demonstrada. Ambos os componentes básicos ficam pendentes nesse caso, até haver parâmetros explícitos. Cupons/subsídios da plataforma não são tratados como despesa automática do vendedor.
5. A prioridade de R$4,50 da tabela sobre um trecho CPF de R$4 não era uma premissa explícita. Agora tem aceitação independente e permanece registrada como divergência documental.
6. O solver não distinguia a qualidade das premissas. Agora acumula a classificação e as premissas de todos os candidatos, mantém mínimos condicionados como provisórios e continua interrompendo qualquer região indeterminada.
7. O campo de frete não esclarecia a origem do débito. O contrato e a interface agora especificam frete líquido debitado no repasse; despesas de frete externas entram uma única vez em outras despesas.

## Conferência financeira e evidências

Foram localizados os MHTML fora do repositório e conferidos os artigos 26839, 18483, 18484, 26700, 27298, 18712 e 19426. Os sete hashes do HTML MIME decodificado coincidem com o inventário da auditoria. As tabelas CPF/CNPJ incorporadas foram inspecionadas visualmente. O registro público conserva somente metadados, hashes e conclusões próprias; originais e imagens não foram publicados.

As capturas sustentam os percentuais e valores documentais, transação incluída, adicional CPF condicionado ao volume, R$0,49 por pedido pago fora do teste e Campanha de Destaque sobre todas as vendas da loja durante adesão. Não resolvem início de vigência, arredondamento, regressão CPF, exatamente 450, fronteiras exatas ou bases após desconto. Essas lacunas continuam explícitas.

R$19,90 na faixa regular: R$3,98 percentuais + R$4,50 fixos = **R$8,48** básicos; transação não é somada novamente. Nos históricos de junho, cinco totais transcritos coincidem e o caso R$7,90 mantém R$6,35 calculados versus R$6,30 observados transcritos: **diferença não explicada de R$0,05**. Os comprovantes primários históricos continuam ausentes.

## Testes de código e interface

- Todos os 75 testes anteriores preservados e passando; 25 novos casos, total **100 testes** em cinco arquivos.
- Casos adicionais: múltiplas unidades, perdas, desconto, frete, programas, fronteiras, parâmetros explícitos, precedência CPF, arredondamento por unidade/pedido, períodos e classificação do preço inverso.
- ESLint sem avisos, TypeScript estrito e build Vite passaram localmente.
- Nove cenários funcionais no Edge headless passaram com o bundle de produção e CSP aplicada, sem erros JavaScript ou requisições externas observadas; largura de 390px também conferida.
- CI e teste interativo do instalador: em execução; resultados serão consolidados antes da entrega.

## Testes Windows

Em execução nesta revisão. Nenhum teste ainda não realizado deve ser interpretado como aprovado. O instalador de revisão será identificado pelo commit e SHA-256; os resultados de instalação, abertura, cálculos, offline, WebView2 e desinstalação serão registrados aqui.

## Limites e prontidão

Sem persistência, importação de extratos/fatiadores, múltiplos SKUs, determinação de tributos ou módulos automáticos de todos os programas. Um parâmetro personalizado é premissa, não prova de tarifa oficial. O solver continua limitado a 100.000 preços e é síncrono.

**Merge técnico:** avaliação final pendente da execução Windows e CI desta revisão.

**Lançamento público:** não aprovado nesta revisão enquanto os testes de distribuição e as limitações documentais não forem avaliados separadamente. Uma simulação provisória utilizável não é homologação financeira nem confirmação de recebimentos.
