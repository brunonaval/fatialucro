# Alterações

## 0.1.0 — 22/11/2026

Experiência UX V2 (mesma V0.1, sem release):

- Abertura sem custos fictícios, importação/manual/exemplo isolado, oficina opcional e fluxo Impressão → Custos → Venda → Resultado.
- Navegação Calcular / Meus produtos / Configurações, modo simples/avançado compartilhado, custo sem venda e recálculo com debounce/cancelamento.
- Bobina por preço/peso líquido real, embalagem de pacote, mão de obra zero consciente e kits de peças equivalentes sem duplicar tarifas.
- Shopee por perguntas, condições desconhecidas preservadas, premissas explícitas e hierarquia de resultado completo/provisório/parcial.
- Produtos com revisões, rascunho recuperável, lixeira, backup v2 com conflitos como cópias e migração IndexedDB v3 preservando registros anteriores.
- Novos testes não interativos e [matriz de requisitos/homologação](docs/ux-v2.md). Nenhuma execução gráfica ou compilação Windows nesta etapa.

Profissionalização de tarifas e UX:

- Catálogos JSON versionados, períodos/estado documental/fonte/verificação, revisão anterior arquivada e seleção por data local do cenário.
- Consulta GitHub opt-in com esquema, hashes, limites, revisão prévia, aplicação explícita, cache offline e proteção contra regressões/concorrência.
- Fronteira básica de R$500 resolvida pelo exemplo oficial de comissão R$96; R$80/100/200 mantêm pendências justificadas.
- Loja reutilizada na abertura, dados variáveis por cenário, resumo financeiro, detalhes expansíveis, temas persistentes, componentes/tokens e campos formatados.
- Migração IndexedDB preserva cadastros/snapshots. Nenhum instalador ou interface gráfica executado nesta etapa.

Integração funcional, preservando o motor e o histórico:

- Produção por lote ou unidade, materiais independentes, perfis de impressora/filamento, depreciação e rateio explícito.
- Importação local de metadados Bambu 3MF e G-code textual; campos ausentes manuais, limites de expansão e leitura em worker.
- Produtos, configurações de fabricação/marketplace e histórico de simulações em IndexedDB, com backup JSON transacional e catálogo congelado por simulação.
- Ponto de equilíbrio, comparação de preços, alertas e buscas em worker; calculadora, cadastros e histórico em português.
- Instalador CI somente por execução manual opt-in, retenção de três dias; homologação gráfica desta integração pendente.

Revisão antes do merge, sem iniciar V0.2:

- Premissas de simulação separadas de cobranças indeterminadas; classificação de completude e evidência também no solver.
- Parâmetros personalizados de fórmula, base, incidência, origem e período, preservando obrigação e rastreabilidade.
- CPF/CNPJ explícito, controles opcionais independentes e resultado provisório identificado.
- Correção da parcela fixa dependente de faixa quando há desconto e conferência de sete MHTML originais com hashes coincidentes.
- Casos financeiros adicionais, preservando todos os testes anteriores e a divergência histórica de R$0,05.

- Núcleo financeiro decimal, custos de fabricação e demonstrativo auditável.
- Regras versionadas por data, condição, seleção, fonte e inclusão de componentes.
- Solver exato em centavos dentro de intervalo limitado, sem saltar lacunas desconhecidas.
- Prévia documental Shopee baseada na auditoria 0.4; histórico de junho isolado.
- Interface mínima React e shell Tauri 2; CI de validação e build Windows.

Sem conexão com marketplaces ou publicação de release. Tributos específicos, múltiplos SKUs e homologação gráfica/distribuição permanecem pendentes.
