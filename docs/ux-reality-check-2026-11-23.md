# FatiaLucro — relatório de homologação real: preço não calculado e excesso de perguntas

**Data:** 23/11/2026.  
**Origem:** capturas do instalador de homologação UX V4 enviadas pelo usuário.

## Problema reproduzido na leitura do código

O aplicativo calculava corretamente o custo da peça em **R$ 8,84**: filamento R$ 7,81, máquina/energia R$ 0,68, embalagem R$ 0,35. Meta: margem de 20%, venda na Shopee Brasil como CPF, menos de 450 pedidos em 90 dias, programa Devolução Fácil cobrável, outros programas inativos e frete líquido confirmado como zero.

A busca de preço mínimo começa por padrão em **R$ 0,01** (campo `minPrice`). `solvePrice` avalia preços em ordem crescente e encerra a busca na primeira condição de taxa incompleta, para não declarar um mínimo que não conseguiu verificar. No catálogo documental de 22/11/2026, a tarifa CPF **abaixo de R$ 12,00** é regressiva, e a fórmula completa não está estabelecida. Consequentemente, o aplicativo encerrava a busca logo no começo, mesmo com a meta viável na faixa documentada.

A falha é **integração de UX/intervalo**, não erro de usuário nem dos custos informados.

## Correção

- `appliedSearchRange`: quando o intervalo permanece exatamente no padrão de primeiro uso `0,01`, a venda é Shopee/CPF e existe faixa de tarifa identificada, o motor busca a partir da primeira faixa regular documentada (atualmente R$ 12,00). A interface informa a restrição: **não é mínimo global abaixo do piso**.
- Intervalo explicitamente personalizado pelo usuário não sofre substituição automática e permanece sujeito às regras desconhecidas.
- Nenhuma taxa fictícia, média presumida, interpolação regressiva ou lucro não verificável é criado.
- O motor decimal e as regras originais não foram modificados.
- Teste de regressão reproduz custo R$ 8,84, margem 20%, CPF, Devolução Fácil e faixa documental. A expectativa financeira é **R$ 23,05** de preço e R$ 4,61 de lucro operacional estimado, quando as premissas documentais pertinentes tiverem sido aceitas.

## Simplificações de interface

- Tela de venda com título e decisões principais curtas; data e kits dentro de seção opcional.
- Configurações Shopee já confirmadas ficam atrás de `Conferir ou alterar CPF, programas, frete e tarifas`, mantendo acessível a lista de pendências e ações corretivas.
- Embalagem já confirmada fica recolhida, com resumo de situação.
- Cadastro de bobina e metadados adicionais ficam recolhidos; custo material continua editável.
- Energia/impressora e mão de obra/outros custos ficam recolhidos no modo simples, inclusive se preenchidos; resumo financeiro permanece visível.
- Ações de correção abrem qualquer bloco recolhido antes de tentar focalizar a seção.
- O modo avançado conserva a consulta completa das premissas.

## Limitações e decisões

- Documento arquivado de 22/11/2026 **não comprova as tarifas da conta no instante da venda**. O usuário deve conferir a Central do Vendedor quando necessário; o aplicativo sinaliza premissas provisórias.
- Se a faixa buscada for inferior a R$ 12,00 ou houver programa cuja fórmula não foi documentada, o resultado permanece parcial; não se atribui taxa zero.
- Testes automatizados não substituem teste visual no Windows.

## Próxima homologação

1. Restaurar ou abrir o cenário da captura.
2. Selecionar Shopee Brasil, CPF, meta de **20%**, custo **R$ 8,84** e confirmar as condições existentes. Não mexer em `minPrice`.
3. Conferir preço mínimo **R$ 23,05**, com aviso de que a busca começa em **R$ 12,00**, se as hipóteses documentais forem aceitas e não houver encargos adicionais.
4. Confirmar que cadastro, programas, embalagem e opções técnicas estão recolhidos no fluxo simples.
5. Abrir uma pendência pelo botão **Corrigir** e verificar o foco, inclusive dentro de seção recolhida.
6. Alternar para modo avançado e confirmar que a auditoria completa permanece disponível.
