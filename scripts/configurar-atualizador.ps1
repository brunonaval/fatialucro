# Configuracao inicial de assinatura do FatiaLucro (uma unica vez).
# Execute apenas no seu PC Windows. Nunca cole uma chave privada em chats.
param([string]$Repository = 'brunonaval/fatialucro')

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

function Confirmar-Comando([string]$Nome, [string]$Instrucao) {
    if (-not (Get-Command $Nome -ErrorAction SilentlyContinue)) {
        throw "$Nome nao encontrado. $Instrucao"
    }
}
function Confirmar-Saida([string]$Descricao) {
    if ($LASTEXITCODE -ne 0) {
        throw "$Descricao falhou. Nenhuma release foi publicada."
    }
}

Confirmar-Comando 'gh' 'Instale https://cli.github.com/ e execute gh auth login.'
Confirmar-Comando 'npm' 'Instale Node.js 24 ou superior e reinicie o PowerShell.'

& gh auth status *> $null
if ($LASTEXITCODE -ne 0) {
    Write-Host 'Entre na sua conta oficial do GitHub (uma unica vez).'
    & gh auth login
    Confirmar-Saida 'Autenticacao no GitHub'
}

& gh repo view $Repository --json nameWithOwner --jq '.nameWithOwner' *> $null
Confirmar-Saida 'Acesso ao repositorio'
$Root = Split-Path -Parent $PSScriptRoot
$Tauri = Join-Path $Root 'node_modules\.bin\tauri.cmd'
if (-not (Test-Path -LiteralPath $Tauri)) {
    Push-Location $Root
    try {
        Write-Host 'Instalando somente as dependencias de configuracao do projeto...'
        & npm ci --ignore-scripts --no-audit --no-fund
        Confirmar-Saida 'Instalacao do CLI Tauri'
    }
    finally { Pop-Location }
}
if (-not (Test-Path -LiteralPath $Tauri)) {
    throw 'O Tauri CLI nao foi encontrado apos npm ci.'
}

$KeyDir = Join-Path $env:USERPROFILE '.tauri'
$PrivateKey = Join-Path $KeyDir 'fatialucro-updater.key'
$PublicKey = "$PrivateKey.pub"
New-Item -Path $KeyDir -ItemType Directory -Force | Out-Null

if ((Test-Path -LiteralPath $PrivateKey) -xor (Test-Path -LiteralPath $PublicKey)) {
    throw 'Somente uma das chaves foi encontrada. Pare e recupere o par original; nao gere outro no mesmo caminho.'
}
if (-not (Test-Path -LiteralPath $PrivateKey)) {
    Write-Host 'Gerando sua assinatura no PC. Guarde a senha escolhida.'
    & $Tauri signer generate -w $PrivateKey
    Confirmar-Saida 'Geracao do par de chaves'
}
else {
    Write-Host 'Par de chaves existente encontrado; nao sera sobrescrito.'
}

$Public = (Get-Content -LiteralPath $PublicKey -Raw -Encoding UTF8).Trim()
# O Tauri CLI grava a chave publica como Base64 de um documento minisign.
# Validamos o texto decodificado, enviando o Base64 original ao GitHub.
try {
    $PublicDecoded = [System.Text.Encoding]::UTF8.GetString([Convert]::FromBase64String($Public))
}
catch {
    throw 'Formato Base64 invalido para a chave publica. Nao apague suas chaves.'
}
$PublicLines = $PublicDecoded -split '\r?\n'
if ($PublicLines.Count -lt 2 -or
    -not $PublicLines[0].StartsWith('untrusted comment: minisign public key') -or
    $PublicLines[1] -notmatch '^RW[A-Za-z0-9+/=]{40,}$') {
    throw 'Chave publica minisign invalida. Nao apague suas chaves.'
}
Remove-Variable PublicDecoded, PublicLines -ErrorAction SilentlyContinue

Write-Host 'Enviando a chave privada diretamente ao GitHub Secret, pelo gh autenticado.'
$Private = (Get-Content -LiteralPath $PrivateKey -Raw -Encoding UTF8).Trim()
$Private | & gh secret set TAURI_SIGNING_PRIVATE_KEY --repo $Repository
Confirmar-Saida 'Cadastro de TAURI_SIGNING_PRIVATE_KEY'
Remove-Variable Private -ErrorAction SilentlyContinue

Write-Host 'Informe abaixo a MESMA senha escolhida ao gerar a chave (nao aparece na tela).'
$SecurePassword = Read-Host 'Senha da assinatura' -AsSecureString
$Bstr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($SecurePassword)
try {
    $PlainPassword = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($Bstr)
    # O segredo da senha e opcional se o par de chaves nao tiver senha.
    if ($PlainPassword.Length -gt 0) {
        $PlainPassword | & gh secret set TAURI_SIGNING_PRIVATE_KEY_PASSWORD --repo $Repository
        Confirmar-Saida 'Cadastro de TAURI_SIGNING_PRIVATE_KEY_PASSWORD'
    }
    else {
        Write-Host 'Senha vazia: o segredo opcional nao foi cadastrado.'
    }
}
finally {
    [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($Bstr)
    Remove-Variable PlainPassword -ErrorAction SilentlyContinue
}

$Public | & gh variable set TAURI_UPDATER_PUBLIC_KEY --repo $Repository
Confirmar-Saida 'Cadastro da chave publica'
Remove-Variable Public -ErrorAction SilentlyContinue

Write-Host ''
Write-Host 'Configuracao concluida. Nenhuma release foi criada ou publicada.'
Write-Host 'A chave privada permanece somente no PC e no cofre de Secrets do GitHub.'
Write-Host "Guarde um backup offline do arquivo $PrivateKey e da senha."
Write-Host 'Avise no chat apenas que os nomes das tres configuracoes foram cadastrados.'
