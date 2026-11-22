# Alterações

## 0.1.0 — 22/11/2026

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

Sem persistência, importação de arquivos, conexão com marketplaces ou publicação de release.
