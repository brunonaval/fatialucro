# FatiaLucro — atualização automática assinada (Tauri 2)

**Estado:** implementação do aplicativo e do pipeline preparada na branch `feat/pricing-engine-v01`. A ativação exige uma única configuração do proprietário: assinatura criptográfica. **Até a primeira release assinada, o instalador atual 0.1.2 continua sem atualização automática.**

## Objetivo

Depois da instalação inicial de transição para a **primeira release assinada (0.2.0)**:

1. Em **Configurações → Atualizações → Buscar atualizações**, o FatiaLucro consulta o manifesto `latest.json` publicado no repositório.
2. Se houver versão **maior**, mostra número e notas e habilita **Atualizar e reiniciar**.
3. Ao confirmar, salva explicitamente o rascunho ativo no IndexedDB antes da saída.
4. O Tauri baixa o pacote com progresso, valida a assinatura minisign e verifica que a versão assinada corresponde à versão anunciada.
5. No Windows, inicia a instalação NSIS em modo `passive`, substituindo o mesmo produto e preservando os dados locais, e reabre o programa. O usuário pode precisar aceitar a elevação solicitada pelo Windows dependendo do tipo de instalação.

O usuário não precisa baixar ZIPs nem abrir o GitHub para versões futuras. **Nenhum download ou instalação acontece automaticamente sem o clique do usuário.**

## Atalho para Windows (recomendado)

Foi criado o assistente local `scripts/configurar-atualizador.ps1`. Ele gera ou reutiliza suas chaves na pasta privada `%USERPROFILE%\.tauri`, verifica autenticação do GitHub CLI, cadastra a chave privada **diretamente como GitHub Actions Secret** e a chave pública como variável; não imprime o segredo no chat, não publica releases e não troca de branch.

Pré-requisito: [GitHub CLI](https://cli.github.com/) instalado e autenticado (`gh auth login`). No PowerShell da cópia **atualizada** do projeto:

```powershell
cd C:\Projetos\FatiaLucro
.\scripts\configurar-atualizador.ps1
```

O programa pedirá a senha da chave no próprio terminal. Não compartilhe a senha nem a chave privada. Se o PowerShell impedir a execução por política corporativa, **não desative as políticas do sistema**: use a configuração manual descrita abaixo. Guarde cópia offline da chave privada e da senha. Após este passo, não será necessário configurar novas chaves a cada versão.

## Uma única configuração que deve ser feita pelo proprietário

No computador Windows com o código do projeto e `npm ci` já executado, abra PowerShell na pasta do projeto. Gere o par de chaves, com senha forte:

```powershell
New-Item -ItemType Directory -Force -Path "$env:USERPROFILE\.tauri" | Out-Null
npm run tauri signer generate -- -w "$env:USERPROFILE\.tauri\fatialucro-updater.key"
```

O comando gera a chave privada `fatialucro-updater.key` e a chave pública `fatialucro-updater.key.pub`. **Nunca adicione a chave privada ao repositório, ao chat ou a qualquer arquivo do app. Faça um backup offline seguro da chave e de sua senha. Perder a chave impedirá que as instalações existentes aceitem novas atualizações.**

Em `https://github.com/brunonaval/fatialucro/settings/secrets/actions`:

- **New repository secret** → `TAURI_SIGNING_PRIVATE_KEY` → cole o **conteúdo integral da chave privada** (não o nome do arquivo).
- **New repository secret** → `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` → informe a senha da chave, se configurada.

Em `https://github.com/brunonaval/fatialucro/settings/variables/actions`:

- **New repository variable** → `TAURI_UPDATER_PUBLIC_KEY` → cole o conteúdo integral de `fatialucro-updater.key.pub` **sem decodificar nem transformar**. O Tauri CLI gera o arquivo como texto Base64 (normalmente uma única linha); o cabeçalho `untrusted comment:` só aparece depois de decodificá-lo. O assistente verifica esse formato automaticamente.

> A chave pública não é segredo e pode ser usada no build. A chave privada só é lida pelo GitHub Actions durante a publicação de releases; o aplicativo instalado contém somente a pública.

**Não é necessário enviar nenhuma chave pelo ChatGPT.** Depois da configuração, basta informar que os três nomes foram cadastrados (sem seus valores).

## Processo de publicação das próximas versões

- As mudanças de código ficam na branch experimental e são verificadas pelo CI. A `main` não é modificada automaticamente.
- Depois da homologação e de incrementar a versão em `package.json`, `package-lock.json`, `src-tauri/tauri.conf.json`, `src-tauri/Cargo.toml` e `src-tauri/Cargo.lock`, uma versão aprovada é promovida à branch `release`.
- O GitHub Actions executa automaticamente `.github/workflows/publish-signed.yml` em cada push à `release`.
- Sem chave privada ou pública, **o workflow falha ANTES de publicar** qualquer release.
- Com as chaves, executa CI, build Windows `--features signed-updater`, cria artefatos NSIS assinados e publica uma release estável `vX.Y.Z`, com `latest.json` e assinatura `.sig`.
- O botão instalado sempre consulta `https://github.com/brunonaval/fatialucro/releases/latest/download/latest.json` e não os ZIPs temporários do Actions.
- O workflow não republica versões com o mesmo tag; cada atualização requer aumento de versão.

## Compilações de teste versus versão assinada

O build QA comum, inclusive o do PR, é intencionalmente compilado **sem** `signed-updater` e sem permissões de instalação. Nele, **Buscar atualizações** apenas verifica se há versão oficial disponível, sem iniciar instaladores.

A release assinada é compilada com configuração e capacidade separadas. Essa separação impede que um build de testes use um canal de update inseguro.

## Testes de aceitação obrigatórios

1. Configure as chaves e execute um primeiro build **0.2.0** da branch `release`. Confira no GitHub Release a presença de `latest.json`, instalador `.exe` e assinatura correspondente `.sig`.
2. Instale o 0.2.0 uma única vez pelo instalador oficial, substituindo a antiga 0.1.2. Antes, faça backup dos registros.
3. Clique em **Buscar atualizações** com 0.2.0 instalado. Sem release mais nova, deve informar **Seu FatiaLucro está na versão mais recente disponível**.
4. Publique uma versão **0.2.1** com uma alteração visível, usando a mesma chave. Clique novamente em **Buscar atualizações** no 0.2.0. Deve exibir 0.2.1 e notas, depois **Atualizar e reiniciar**.
5. Confirme. O aplicativo deve preservar o rascunho, verificar a assinatura, instalar e voltar na versão 0.2.1. Os dados da oficina, histórico e perfis devem continuar íntegros.
6. Verifique tratamento de rede desconectada, erro 404, manifesto manipulado, arquivo com assinatura incorreta, cancelamento de UAC e tentativa de downgrade. Nenhuma instalação inválida pode ser aceita.

**Não declarar o atualizador como homologado até esses testes reais do Windows passarem.**

## Segurança e observações

- A assinatura Tauri valida a origem do pacote; não substitui assinatura Windows Authenticode (SmartScreen pode alertar).
- `latest.json` não autoriza downgrade e `requireSignedVersion` exige vinculação da assinatura à versão do pacote, compatível com Tauri moderno.
- Os dados de impressão e da loja não são enviados para o serviço de atualização.
- A instalação usa o mesmo identificador `com.fatialucro.desktop`, preservando armazenamento local.
- Links técnicos: https://v2.tauri.app/plugin/updater/ e https://v2.tauri.app/distribute/pipelines/github/
