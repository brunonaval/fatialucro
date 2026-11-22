# Shopee Brasil — evidências e limites

Síntese própria, produzida para o FatiaLucro em 22/11/2026 a partir do pacote de auditoria **0.4-revisao-de-capturas** disponibilizado pelo usuário. A pesquisa original descreve 84 capturas MHTML e 28 regras/estados. Recebemos a auditoria, o inventário e as fixtures; **não recebemos os MHTML nem os comprovantes primários**. Os estados da auditoria são preservados como evidência documental secundária, não como nova homologação oficial.

O diretório de referência estava ausente na inspeção inicial e foi disponibilizado durante a execução. O ZIP fica fora do Git. Seu SHA-256 foi calculado localmente: `486a7f2c09349f08e87227b62c186aad11f66be0eb02b446dd644f8e711758ec`. O [registro de evidências](evidence-registry.json) conserva URLs, datas e hashes **declarados pelo inventário** para os documentos relevantes. Os hashes dos HTML não puderam ser recomputados sem os originais.

Os links oficiais de [comissão](https://seller.shopee.com.br/edu/article/26839/Comissao-para-vendedores-CNPJ-e-CPF-em-2026) e [Devolução Fácil](https://seller.shopee.com.br/edu/article/26700/Devolucao-Facil-Shopee) foram consultados nesta execução. O acesso automatizado retornou somente o contêiner da página, sem texto das tarifas; isso **não constitui reverificação independente**. O aplicativo não consulta essas páginas em tempo de uso.

## Fórmulas implementadas como prévia documental

| Componente | Fórmula / incidência | Tratamento |
| --- | --- | --- |
| Faixa regular abaixo de R$80 | 20% + R$4,50 por item | CPF ≥12 ou CNPJ ≥9; transação já incluída |
| Acima de R$80 e abaixo de R$100 | 14% + R$16 por item | R$80 exato fica pendente |
| Acima de R$100 e abaixo de R$200 | 14% + R$20 por item | R$100 exato fica pendente |
| Acima de R$200 | 14% + R$26 por item | R$200 e R$500 exatos ficam pendentes |
| CNPJ abaixo de R$9 | 20% + parcela equivalente a 50% do preço | Por item; interpretação da auditoria; arredondamento ainda não validado |
| CPF acima de 450 pedidos/90 dias | R$3 por item | Apenas preço ≥12 e volume informado; incidência condicional |
| Devolução Fácil | R$0,49 por pedido pago | Participação cobrável confirmada, fora da gratuidade |
| Campanha de Destaque | 5% durante adesão | Todas as vendas da loja; sem extrapolar para outra campanha |
| Transação | componente da comissão | Visível como excluída da soma, nunca acrescentada |

Todas as fórmulas automáticas acima têm `effectiveFrom = null`: o pacote informa datas de publicação e atualização, mas não demonstra a data inicial de todas as tarifas. O catálogo só permite uma **prévia no dia da captura, 22/11/2026**, com pendências de vigência e arredondamento. Isso não declara que as tarifas entraram em vigor nesse dia. Fora dessa janela, nenhuma fórmula é aplicada. Uma futura evidência de vigência deve gerar novo snapshot e testes, sem apagar o anterior.

Descontos do vendedor deixam a comissão percentual pendente porque a base depende da modalidade. Nenhuma base genérica é imposta como regra oficial. Valores fixos calculáveis podem continuar no subtotal parcial.

## Regras adiadas ou indeterminadas

- CPF abaixo de R$12: não interpolar exemplos de R$8/R$10; fórmula e relação com volume permanecem desconhecidas.
- Exatamente 450 pedidos: redações divergentes; sem adicional presumido.
- R$80, R$100, R$200 e R$500: não inventar os limites matemáticos.
- Ads Fácil, afiliados e antecipação: participação ativa/desconhecida gera pendência explícita; fórmulas dependem de parâmetros e bases ainda não implementados. Participação inativa confirmada exclui o programa.
- Ads por clique, moedas, devoluções e FSF/RSF, reembolso de amostras e outros ajustes: gastos/eventos efetivos, fora da tarifa padrão. O campo de outras despesas registra valores conhecidos sem classificá-los como tarifa oficial.
- Retorno de R$15 e Devolução Fácil: não pressupor isenção de um pelo outro.
- Frete: informar o custo líquido efetivo; subsídio máximo do cupom do comprador não é custo automático do vendedor.
- Tributos: exigem regime e dados próprios; CPF/CNPJ não determina alíquota.
- Fluxo de amostras com marco em 24/11/2026: não é aplicado retroativamente na captura de 22/11/2026.

## Históricos

Fixtures de junho existem apenas em `tests/fixtures` e no teste histórico. O valor R$23,90 representa **o total do pedido com duas unidades**; o preço por unidade é R$11,95. A composição matemática usa 20%, R$4 por unidade, adicional histórico de 3,5% **sem atribuir o serviço causador**, e R$0,49 por pedido. Esses escopos são convenções do cenário de regressão, sem inferir a política real de arredondamento.

Cinco totais coincidem com os valores transcritos na auditoria. No pedido de R$7,90, a fórmula produz R$6,35 e o observado transcrito é R$6,30: divergência não explicada de R$0,05. O teste verifica que ela continua explícita. Os comprovantes originais e as datas exatas das operações faltam para validar independentemente as fontes primárias; a suíte não transforma essas fixtures em tarifas oficialmente verificadas.

## Evidências necessárias para avançar

1. Vigência explícita e política de arredondamento por cobrança/ocorrência.
2. Fórmula regressiva CPF e definição de volume/exatamente 450.
3. Exemplos oficiais nas fronteiras e com descontos/cashback/múltiplas quantidades.
4. Termos e períodos efetivos dos programas da conta, sem dados de compradores.
5. Regras de coparticipação e ajustes logísticos: artigos [4478](https://seller.shopee.com.br/edu/article/4478) e [25794](https://seller.shopee.com.br/edu/article/25794/Operacoes-e-Politicas-da-Logistica-do-Vendedor).
6. Extratos expandidos anonimizados para conciliar as linhas, especialmente a divergência histórica.

Não publicar arquivos MHTML integrais, comprovantes, dados pessoais, cookies ou credenciais. Atualizações devem trazer URL oficial, captura, vigência comprovada, estado de verificação e regressão correspondente.
