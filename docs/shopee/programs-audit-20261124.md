# Revisão documental — programas adicionais
Fonte: Páginas Shopee.zip, capturas MHTML de 22/11/2026, reabertas em 24/11/2026. SHA-256 do HTML MIME decodificado (não do arquivo MHTML inteiro). Não implica vigência confirmada ao vivo ou adesão da conta.

| Artigo | SHA-256 HTML | Regra |
|---|---|---|
| 23254 | fb88f2cf901adb88e5262bcb1a339ead61c02d959f37ad888b70bb815d1019a0 | Ads Fácil até 5% por venda concluída, conversão em créditos. |
| 24596 | c96eb99dda6fe5601de8d7dfc63876514ef5a53bea7111bac1dce3aebfceda1d | Campanha: mínimos 1%, 2% ou 4% por categoria, atribuição indireta 30%. |
| 24595 | 9b3acc0c151a4aa56f8a225a89ce79ff5b09abfab6a4b51e3a38423a2bca36d3 | Geral menciona mínimo 4%, direto/indireto; exemplo visual com 14% sobre comissão não universal. |
| 27736 | 206a17f7610e3d3b689d11d234a34cfdca0208412732c00987cba59576156fb2 | Dinâmica até ±50%; não aplicar em campanhas exclusivas. |
| 27737 | 8931748de66a86ce06baa68cefbbd87f377d1ee2ffa8c735b9926c743859aeea | Fluxo de repasse e responsabilidade fiscal. |
| 27688 | 7f4c7a140d7f6aa75b5ca8b2b0658479cc2cc26733dac00d2f0d51d996c9a4c5 | Tributos e eventual taxa de intermediação; sem alíquota universal. |
| 25973 | 237bc4feefa21de8612eb049737c4eacba5265ec98b5d433938e6f2602aa93f5 | Acelera: 1/2,5/3,5%, percentual de resgate diário variável. |
| 25990 | 0255ab949699cbc3fb4046269248b05fc611cd050073d74bf679e5cb26b05b79 | Base do Acelera após comissões e taxas adicionais. |
| 25992 | 01ad309e70e18ca7c8e281095c4e1e866600b42b2294bd5fc9120d0d4d064fbf | Consulta detalhada e exportação CSV. |

## Implementação e limitações
- Ads Fácil: taxa informada 0–5%; base bruta sem cupom; no cenário com cupom, base bruta é hipótese declarada. Não somar novamente créditos usados em publicidade. Não monetizar créditos/cashback.
- Afiliados: comissão configurada × atribuição × fator dinâmico × (1 + encargo informado sobre comissão). O valor de 4% e a variação até 50% são referência ilustrativa quando faltam dados, não limites universais. Encargo ausente permanece desconhecido; referência não o inclui. A atribuição deve ser elegível e validada. Não inferir categoria nem percentual da loja.
- Acelera: taxa da categoria × fração efetivamente antecipada × recebível após desconto e demais taxas modeladas, sem subtrair custos de fabricação. O artigo 25990 descreve dedução apenas da comissão e possíveis taxas adicionais; frete líquido separado não é abatido da base nesta simulação. A inclusão exata de cada cobrança no recebível e a sequência de arredondamento exigem conciliação de extrato. Cálculo por pedido, não confundir percentual diário com garantia de antecipação individual. Cashback excluído.
- Duas ilustrações (baixo/alto) são cenários, não intervalo garantido; as condições originais e campos em branco são preservados. Taxas manuais explicitamente configuradas têm prioridade. Não se aplica automaticamente a datas anteriores à referência documental.
- Módulo de regras versionado junto ao aplicativo, separado do catálogo remoto de comissão básica; não alterar o esquema remoto v1 sem migração.
