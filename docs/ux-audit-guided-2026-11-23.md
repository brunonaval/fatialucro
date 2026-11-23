# FatiaLucro — auditoria UX para iniciantes (2ª homologação real)

**Data:** 23/11/2026  
**Branch:** `feat/pricing-engine-v01` / PR #1 em rascunho  
**Escopo:** navegação, correção de campos, hierarquia de Configurações, teste de atualização e prevenção de falhas de preenchimento.

## Achados comprovados na implementação

| Código | Prioridade | Achado real | Ação implementada |
|---|---|---|---|
| UX-NAV-01 | Crítica | O efeito de mudança de tela usava `focus()` mais `scrollIntoView({ block: 'center' })` no `workspace-content`. Ao mudar para Configurações/Calcular, a viewport saltava para o meio. | Separar navegação de página de salto para correção. `useLayoutEffect` reposiciona a página no topo; mesma página no menu também volta ao início. |
| UX-NAV-02 | Alta | O efeito de foco também executava após mudanças de etapa e misturava foco da página com foco nos campos. | Navegação de etapa foca o início da seção, sem centralizar em botões; saltos explícitos para erros focam o controle. |
| UX-VAL-01 | Crítica | A lista `guidedIssues` sabia qual campo faltava, mas `Fields.tsx` só mostrava erros locais por interação (`touched`). Um campo ausente podia não receber marcação após clicar em Corrigir. | `FormContext` passa pendências e estado de validação. `Input`, `NumericInput` e `Select` mostram erro junto ao campo e `aria-invalid` após tentativa de conclusão. |
| UX-VAL-02 | Alta | Campos dentro de `<details>` e seções da Shopee eram alcançados somente por salto a um bloco genérico. | Correção abre elementos `details` ancestrais, procura o primeiro controle pertinente, foca e destaca, incluindo os formulários de loja. |
| UX-VAL-03 | Média | Depois de voltar de Resultado, o usuário não via uma orientação curta sobre o que faltava na etapa atual. | Banner discreto, exibido **somente após tentativa de cálculo**, com total de pendências da etapa e botão para o primeiro campo. |
| UX-SET-01 | Alta | Configurações exibia muitos cards simultâneos: loja, oficina, perfis, ajuda, catálogo e backup. A pessoa precisava atravessar uma página longa para encontrar o que queria. | Preservar Aparência e Atualizações à vista; recolher os grupos opcionais (loja, oficina/perfis, ajuda/catálogo). Backup permanece disponível fora das opções avançadas. |
| UX-SET-02 | Média | Nome do campo numérico dizia “Necessário quando selecionado” mesmo para campos visíveis e exigidos. | Labels mostram **Obrigatório** ou **Opcional**; controles com erro recebem destaque acessível, texto e foco. |
| UX-UPD-01 | Alta | O botão Atualizações consulta apenas versões estáveis em GitHub Releases, mas não há Releases estáveis no repositório. O botão não é atualizador automático assinado. | Testes cobrem existência do botão, endpoint exato, comparação de versões e resposta 404/sem versões. Não instalar executáveis sem assinatura. |

## Fundamentos

- O GOV.UK Design System recomenda resumo de erros com links que conduzem ao campo, e a mensagem ao lado do próprio campo: https://design-system.service.gov.uk/components/error-summary/ e https://design-system.service.gov.uk/components/error-message/
- O plugin oficial Tauri Updater exige assinatura verificável do pacote: https://v2.tauri.app/plugin/updater/
- O aplicativo ainda não possui o par de chaves nem release com metadados `latest.json`. A ativação do update automático foi documentada em `docs/UPDATER_SETUP.md`, sem atalhos inseguros.

## Comportamento esperado após a correção

1. **Calcular → Configurações → Calcular:** qualquer menu principal retorna ao topo, nunca ao meio. A mesma aba clicada novamente também sobe.
2. **Impressão e custos:** antes de tentar calcular, o usuário vê campos limpos, sem erro preventivo. Após tentativa frustrada, vê mensagens nos campos realmente necessários.
3. **Resultado → Corrigir:** botão do resumo leva diretamente ao campo, expande seção recolhida, coloca o cursor e destaca o local. Ao corrigir, a mensagem desaparece automaticamente.
4. **Shoppe:** para frete, programas e CPF/CNPJ, a conferência rápida continua à vista; botões abrem a pergunta e focam o seletor, não apenas o contêiner.
5. **Configurações:** começar pelas ações simples; todo recurso técnico segue disponível, porém recolhido.
6. **Buscar atualizações:** sem GitHub Release estável, retorna “Ainda não há uma versão estável publicada”. Uma resposta 404 do GitHub é a ausência de publicação, não erro de instalação.
7. **Atualização automática:** segue **indisponível** até a configuração segura de assinatura do Tauri, publicação de releases e validação de upgrade real entre versões.

## Testes automatizados

- Testes unitários de navegação para o topo e de foco na etapa sem centralização.
- Teste de correção com duas seções recolhidas e campo interno: abre todas, foca e destaca.
- Teste de mensagens de erro contextualizadas por campo com `aria-invalid`; sem alerta prematuro antes da validação.
- Teste do botão Atualizações, consulta do endpoint e interpretação de resposta 404.
- Regressão prévia: motor de tarifas, solução de preço, custos e cenários continuam intactos.

**Limitação:** renderização estática e DOM simulado não substituem clique e inspeção visual em WebView2 do Windows. A configuração final do instalador e os alertas de atualização também exigem teste de uso real.

## Roteiro de homologação Windows

1. Fazer backup de produtos/perfis em Configurações e fechar a instância antiga.
2. Abrir a nova versão. Descer até o fim de Configurações, clicar em **Calcular** e verificar se aparece o cabeçalho do aplicativo; repetir na direção contrária.
3. Iniciar um novo cálculo, informar peso, omitir preço da bobina e tentar Resultado. Clicar **Corrigir preço da bobina**; verificar foco, contorno e mensagem exatamente no campo.
4. Ativar custo de máquina/energia, deixar custo/hora vazio e repetir; a seção opcional precisa abrir.
5. Em Shopee, escolher condições com frete indefinido e utilizar **Conferir**; confirmar que o seletor correto fica em foco.
6. Verificar Configurações com Aparência e Atualizações visíveis, grupos extras recolhidos e backup acessível.
7. Clicar **Buscar atualizações** conectado à Internet. Sem releases oficiais, a mensagem correta é ausência de versão estável, sem instalação automática.
8. Confirmar contraste, resolução 1280×720 e zoom 125%. Enviar captura se algum botão não estiver visível ou o foco não chegar ao campo.

## Pendências fora deste incremento

- Atualização **automática assinada e testada de ponta a ponta**: depende das chaves e da primeira publicação estável; não substituímos esse requisito por download de .exe sem verificação.
- Homologação visual e funcional Windows com cliques e 3MF reais.
- Verificação de cada regra tarifária Shopee em fonte oficial com vigência adequada (não afeta o motor nesta revisão).
