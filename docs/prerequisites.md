# Ambiente e pré-requisitos

Inspeção realizada em 22/11/2026, antes da instalação de dependências.

| Componente | Situação local |
| --- | --- |
| Windows / PowerShell | disponíveis |
| Git / GitHub CLI | disponíveis; repositório público com licença MIT |
| Node.js | 24.12.0 |
| npm | 11.6.2 |
| Rust / Cargo | ausentes no PATH e em `%USERPROFILE%/.cargo/bin` |
| Visual Studio C++ Build Tools | componente VC.Tools.x86.x64 encontrado em VS 2022 |
| WebView2 Runtime | encontrado, versão 158.0.4370.33 |
| AuditoriaShopee | ausente na inspeção inicial; ZIP disponibilizado e lido durante esta execução |

O checkout de trabalho é `C:\Projetos\FatiaLucro`. O diretório inicialmente aberto no Codex é outro repositório Git vazio, sem remoto; ele não foi utilizado para desenvolver o aplicativo.

Para o motor e a interface: Node.js 24 LTS e `npm ci`. Para o desktop: também Rust stable com target MSVC, ferramentas C++ do Visual Studio e WebView2. A instalação dos pré-requisitos de sistema é manual; esta execução não altera o toolchain do Windows. Verifique com `node --version`, `npm --version`, `rustc --version` e `cargo --version`.

Fontes técnicas consultadas: [pré-requisitos oficiais do Tauri 2](https://v2.tauri.app/start/prerequisites/), [API do decimal.js](https://mikemcl.github.io/decimal.js/) e [Vitest](https://vitest.dev/guide/). Dependências npm e Rust são fixadas por `package-lock.json` e `src-tauri/Cargo.lock`. O lockfile npm foi gerado sem `node_modules` em diretório limpo com npm 11.19.1 e validado por instalações limpas em Windows e Linux. Não é necessário servidor para usar o aplicativo empacotado; a instalação inicial das ferramentas/dependências requer internet.

Ao alterar dependências, use npm 11.19.1 e confira o lockfile em diretório limpo. O npm 11.6.2 local omitiu dependências opcionais `@emnapi` ao atualizar um `node_modules` existente, causando rejeição por `npm ci` no CI da integração. O lockfile foi reparado com `npx --yes npm@11.19.1 install --package-lock-only --ignore-scripts` em diretório sem `node_modules`, seguido de instalação limpa. Para reproduzir a instalação com a versão usada na validação: `npx --yes npm@11.19.1 ci`. Não regenere o lockfile com versões antigas do npm sobre uma árvore instalada.
