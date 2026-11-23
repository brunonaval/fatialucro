# FatiaLucro — atualizações seguras no próprio aplicativo

**Estado em 23/11/2026:** a versão 0.1.1 passa a oferecer **Configurações → Buscar atualizações**, consultando manualmente `https://api.github.com/repos/brunonaval/fatialucro/releases/latest`. **Ainda não instala versões automaticamente.** A versão 0.1.0, já instalada, nunca recebeu um atualizador, então pelo menos uma instalação de transição é inevitável.

## Por que não instalar automaticamente agora?

A aplicação não possui o `tauri-plugin-updater` nem uma chave pública de assinatura incorporada, e o repositório ainda não possui nenhuma GitHub Release estável publicada. Releases do GitHub Actions são artefatos temporários e **não são um canal de atualização**. Baixar um executável externo e iniciá-lo sem verificar a assinatura não é aceitável.

O plugin oficial Tauri 2 exige verificação criptográfica de cada pacote de atualização. Esse requisito não pode ser desativado. A chave privada de assinatura não deve ser publicada no repositório, anexada a uma issue, enviada no chat ou incluída em backups do programa.

Fontes:
- https://v2.tauri.app/plugin/updater/
- https://v2.tauri.app/reference/javascript/updater/

## O que já está implementado na versão 0.1.1

- Botão **Buscar atualizações** disponível nas Configurações, acionado manualmente.
- Leitura somente do endpoint oficial do repositório GitHub, sem telemetria e sem enviar preços, arquivos 3MF ou dados da loja.
- Comparação numérica de versões SemVer e rejeição de prereleases ou páginas de release fora do repositório.
- Quando não existe release, mensagem clara; quando existe uma versão estável maior, acesso à página oficial, sem executar o instalador automaticamente.
- Versão do aplicativo explícita e incremento para 0.1.1; nenhum dado local precisa ser apagado.

## Passos obrigatórios para habilitar atualização automática assinada

1. **Gerar o par de chaves de atualização uma única vez**, no Windows do proprietário, dentro do diretório do projeto após instalar as dependências. Em PowerShell:

   `npm run tauri signer generate -- -w "$env:USERPROFILE\\fatialucro-updater.key"`

   Use senha forte e mantenha o arquivo `fatialucro-updater.key` somente em armazenamento privado. A chave pública correspondente pode ser compartilhada; a privada nunca.

2. **Configurar o repositório no GitHub** (Settings → Secrets and variables → Actions), cadastrando os secrets `TAURI_SIGNING_PRIVATE_KEY` (conteúdo da chave privada) e `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` (senha, se criada). Somente o proprietário do repositório deve executar este procedimento. Fazer backup seguro da chave.

3. **Integrar a chave pública e o plugin oficial** na próxima versão de transição, mantendo dependências fixas e pinando as capacidades:
   - npm: `@tauri-apps/plugin-updater`
   - Cargo: `tauri-plugin-updater`
   - `src-tauri/src/lib.rs`: inicializar o plugin
   - `src-tauri/tauri.conf.json`: configurar `plugins.updater.pubkey`, endpoint HTTPS `https://github.com/brunonaval/fatialucro/releases/latest/download/latest.json`, `bundle.createUpdaterArtifacts: true`
   - Capabilities Tauri: permitir somente as operações de consulta, download e instalação de atualizações; não adicionar shell irrestrito
   - Interface: verificar via `check()`, exibir versão/alterações, solicitar confirmação explícita, fazer backup do rascunho, baixar `downloadAndInstall()` com progresso, informar que o app irá reiniciar no Windows.

4. **CI/CD de release**: somente para tag de versão aprovada a partir de `main`, construir NSIS Windows com os secrets de assinatura, publicar `.exe`, `.sig` e `latest.json` contendo a assinatura real e URL do instalador em GitHub Releases, validar assinatura e versão antes de publicação.

5. **Homologação:** instalar uma vez a primeira versão com updater embutido (por exemplo 0.2.0). A partir daí, publicar uma versão posterior (por exemplo 0.2.1) e confirmar que **Buscar atualizações → Instalar e reiniciar** funciona sem instalar manualmente ZIP/EXE. Em caso de falha de rede, assinatura inválida ou falta de permissão, preservar dados e permitir nova tentativa.

### Restrições importantes

- **Não ativar atualização silenciosa automática sem consentimento.** A verificação pode ser iniciada manualmente; o download e a instalação precisam de confirmação.
- A assinatura do updater é separada da assinatura Authenticode do Windows/SmartScreen. Uma atualização criptograficamente verificada pelo Tauri pode continuar gerando advertências do Windows se o executável não tiver assinatura de código.
- Não considerar `latest.json` como prova de uma versão até a assinatura do artefato ter sido validada.
- Não publicar versão estável ou promover o PR apenas porque o build automatizado passou.
- Se os segredos não estiverem presentes, a publicação de atualizações assinadas precisa falhar; jamais voltar a executar instaladores sem assinatura.
