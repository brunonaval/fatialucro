# Shopee Brasil — evidências e limites

Síntese própria, produzida para o FatiaLucro em 22/11/2026 a partir do pacote de auditoria **0.4-revisao-de-capturas** disponibilizado pelo usuário. Na revisão da V0.1 foram encontrados os MHTML originais em um diretório local externo ao repositório. Foram conferidos os textos dos artigos 26839, 18483, 18484, 26700, 27298, 18712 e 19426 e as tabelas incorporadas de comissão CPF/CNPJ. Os sete hashes do HTML MIME decodificado coincidem com o inventário. Isso confirma a correspondência das capturas examinadas; não comprova uma tabela vigente ao vivo, a adesão da conta ou o recebimento de um pedido. **Os comprovantes históricos primários continuam ausentes.**

O diretório de referência estava ausente na inspeção inicial e foi disponibilizado durante a execução. O ZIP fica fora do Git. Seu SHA-256 foi calculado localmente: `486a7f2c09349f08e87227b62c186aad11f66be0eb02b446dd644f8e711758ec`. O [registro de evidências](evidence-registry.json) conserva URLs, datas, hashes do inventário e o resultado da recomputação na revisão. Nenhum MHTML, captura integral, imagem de artigo ou dado de conta foi adicionado ao repositório público.

O acesso web automatizado inicial aos links oficiais retornou somente o contêiner da página. A revisão se apoia nas capturas locais arquivadas, cujo conteúdo foi efetivamente lido. O aplicativo não consulta essas páginas em tempo de uso.

## Fórmulas implementadas como prévia documental

| Componente | Fórmula / incidência | Tratamento |
| --- | --- | --- |
| Faixa regular abaixo de R$80 | 20% + R$4,50 por item | CPF ≥12 ou CNPJ ≥9; transação já incluída |
| Acima de R$80 e abaixo de R$100 | 14% + R$16 por item | R$80 exato fica pendente |
| Acima de R$100 e abaixo de R$200 | 14% + R$20 por item | R$100 exato fica pendente |
| Acima de R$200 | 14% + R$26 por item | R$200 exato fica pendente; R$500 comprovado pelo exemplo de R$96 |
| CNPJ abaixo de R$9 | 20% + parcela equivalente a 50% do preço | Por item; interpretação da auditoria; arredondamento ainda não validado |
| CPF acima de 450 pedidos/90 dias | R$3 por item | Apenas preço ≥12 e volume informado; incidência condicional |
| Devolução Fácil | R$0,49 por pedido pago | Participação cobrável confirmada, fora da gratuidade |
| Campanha de Destaque | 5% durante adesão | Todas as vendas da loja; sem extrapolar para outra campanha |
| Transação | componente da comissão | Visível como excluída da soma, nunca acrescentada |

Todas as fórmulas automáticas acima mantêm `effectiveFrom = null`: publicação/atualização não demonstram o início da vigência. O catálogo versionado seleciona períodos comprovados ou uma referência documental observada até a data, sempre sob premissa explícita quando falta vigência. A data atual não atualiza a verificação de **22/11/2026**. A revisão r1 foi arquivada e substituída pela r2; a seleção não ressuscita versões retiradas ou períodos encerrados. No modo estrito, premissas não aceitas impedem concluir o resultado. Com aceitação explícita da vigência não comprovada e do HALF_UP por ocorrência, os trechos conhecidos podem gerar **simulação provisória**, lucro estimado e preço provisório. A aceitação não inventa faixas, fórmulas ou adesões. Uma futura evidência de vigência deve gerar novo snapshot e testes, sem apagar o anterior.

Na faixa comum CPF, o artigo 26839 e as tabelas trazem R$4,50, mas um trecho do artigo 18484 ainda menciona R$4. O usuário deve aceitar separadamente a premissa de priorizar a tabela de R$4,50; a divergência não foi resolvida oficialmente. O exemplo R$19,90 tem R$3,98 percentuais + R$4,50 por item = R$8,48 básicos, sem acrescentar transação.

Descontos do vendedor deixam **ambos os componentes da comissão básica** pendentes: a base e a determinação de faixa dependem da modalidade. A revisão corrigiu o cálculo anterior que ainda mostrava a parcela fixa dependente de faixa nesse cenário. Nenhuma base genérica é imposta como regra oficial. Devolução Fácil por pedido, se confirmado como cobrável, pode continuar como parcela conhecida.

## Parâmetros personalizados e resultados provisórios

O usuário pode substituir uma cobrança nomeada por percentual ou valor fixo, selecionando base, incidência por unidade/pedido, origem e período. O demonstrativo identifica a origem `custom`, conserva a evidência e a fórmula substituídas, e separa o subtotal personalizado do documental. Nenhuma taxa desconhecida recebe zero automaticamente; zero personalizado exige entrada explícita. A comissão básica obrigatória não pode ser desativada nem ter seus dois componentes zerados simultaneamente.

Parâmetros para a comissão básica não eliminam silenciosamente o adicional CPF desconhecido. Na regressão CPF <12, a simulação exige também o adicional explícito. Adesões não confirmadas, cadastro ausente e frete não confirmado continuam bloqueantes. Programas ativos sem módulo automático só podem ser resolvidos com a cobrança correspondente informada explicitamente; para bases como antecipação efetiva, informar o valor apurado por pedido evita inventar uma base percentual.

Um cenário com **todas as cobranças ativas personalizadas** usa a interseção dos períodos pessoais, sem transformar parâmetros em tarifa oficial. Cenários mistos podem usar a referência arquivada sob premissa explícita de vigência/continuidade não comprovada, mantendo origem de cada parcela. A última verificação nunca é renovada por seleção ou consulta GitHub. O solver preserva premissas de todos os preços examinados e interrompe regiões indeterminadas.

## Regras adiadas ou indeterminadas

- CPF abaixo de R$12: não interpolar exemplos de R$8/R$10; fórmula e relação com volume permanecem desconhecidas.
- Exatamente 450 pedidos: redações divergentes; sem adicional presumido.
- R$80, R$100 e R$200: tabelas encerram faixas em 79,99/99,99/199,99 e usam acima de nos limites seguintes. Trechos inclusivos sobre subsidio/frete não demonstram a comissão exata. Continuam pendentes, sem inventar limites.
- R$500: resolvido na r2. O exemplo oficial do artigo 18483 mostra comissão R$96 e líquido R$404 para cartão/boleto. A fórmula básica 14% + R$26 é calculável exatamente em 500; a retirada desse bloqueio não comprova adesões, vigência ou arredondamento.
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

## Revisão de tarifas e UX

Veja a [política de versões e atualização](../tariffs-and-ux.md). Os originais de comissão foram relidos por processamento MIME e OCR local dos arquivos incorporados, sem interface gráfica, scraping ou captura de tela. Os hashes HTML continuam iguais. O hash do exemplo incorporado e a conclusão por fronteira ficam no registro sanitizado de evidências. Nenhum original/imagem foi publicado.
