# UX V4 — primeiro incremento implementado

A UX V4 está em andamento na branch experimental do PR #1. A versão instalada no Windows não é atualizada automaticamente.

## Alterações deste incremento

- Início com três perguntas de objetivo: preço recomendado (meta de lucro), custo da impressão e lucro de um preço informado.
- Fatiamento de placa com somente **um filamento consumido** usa o fluxo simples de preço por bobina ou por kg, em vez de obrigar o usuário a cadastrar uma linha de material.
- Sem custo por hora selecionado, o tempo de impressão pode ficar ausente, e os controles de máquina ficam recolhidos.
- Embalagem adicional por pedido é uma escolha explícita. Rascunhos históricos com custo adicional preenchido mantêm esse custo.
- Painel com informações faltantes: campo, motivo e botão Corrigir, preservando o subtotal dos custos conhecidos.
- Normalização segura de valores brasileiros e durações inequívocas como 1h15min ou 75 min.
- Redução de mensagens prematuras ao editar valores numéricos.
- O preço e as tarifas da Shopee continuam sujeitos às mesmas regras de comprovação. O painel não presume taxas, frete nem consumos desconhecidos.

## Incremento: despesas opcionais da venda sem bloqueios ocultos

- Desconto do vendedor, despesas adicionais e frete líquido da venda direta agora são escolhas explícitas e desativadas por padrão nos cálculos novos. Se não selecionados, os campos não são exigidos e as exclusões permanecem visíveis no resumo.
- Ao desativar a opção, o valor digitado é preservado no formulário, mas não entra no cenário. Ao reativar, o valor volta a ser conferido.
- Rascunhos anteriores que não tinham esses indicadores preservam os custos previamente registrados.
- A validação guiada usa a mesma condição de ativação usada para montar o cenário financeiro. O botão Corrigir também encontra campos do modo avançado, e a contagem de peças de um kit agora tem nome identificável.
- Testes adicionais verificam opção desmarcada, campos obrigatórios ao ativar e retrocompatibilidade.

## Pendências (não confundir com funcionalidade entregue)

- Homologação visual no Windows/WebView2 por usuário real, incluindo rolagem e foco de campos em painéis.
- Testes de jornada DOM completos, sem depender apenas de HTML estático e testes de lógica.
- Diagnóstico de erro técnico em Worker separado da validação do formulário com identificação estruturada.
- Preferências e aplicação automática de perfis em todos os cenários, inclusive múltiplos materiais do mesmo tipo com preços diferentes.
- Normalização de entradas financeiras ambíguas com confirmação específica (não adivinhar separadores).
- Revisão completa de acessibilidade, teclados, leitor de tela e telas pequenas.
- Real 3MF da impressora do usuário para validar compatibilidade além das fixtures sintéticas.

## Regra de integridade

Campos de custo excluídos por escolha não provam custo real igual a zero. Comissões e regras Shopee não comprovadas seguem como pendências; o aplicativo não pode exibir lucro definitivo nesses casos. A engine financeira e os catálogos auditáveis não foram substituídos neste incremento.
