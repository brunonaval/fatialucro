# FatiaLucro

Calculadora gratuita, pública e offline de precificação para impressão 3D. Primeira implementação do motor financeiro, com demonstrativo de cada cobrança e esqueleto Windows em Tauri 2, React e TypeScript. Licença MIT.

**Estado 0.1:** custos de fabricação, embalagem, descontos, frete líquido, taxas fixas/percentuais, faixas, condições, exclusão de duplicatas, lucro operacional estimado, margem, markup e busca inversa em centavos. Sem servidor, conta, IA, telemetria ou persistência nesta etapa.

A Shopee tem uma **base documental de 22/11/2026**, não uma tabela homologada. A V0.1 revisada distingue cálculo documental, **simulação provisória com premissas aceitas ou parâmetros personalizados**, e cobranças indeterminadas que bloqueiam a conclusão. Vigência, arredondamento e precedência CPF são premissas explícitas; fórmulas desconhecidas nunca recebem zero automaticamente. O lucro e a busca inversa respeitam essa classificação. Uma venda direta sem marketplace é uma escolha explícita.

O cadastro começa vazio: cada vendedor escolhe CPF ou CNPJ. Parâmetros avançados são expansíveis. Comissão básica obrigatória não pode ser desativada; programas opcionais têm controles independentes. A interface identifica resultados provisórios e nunca os apresenta como repasses confirmados.

## Executar

Leia os [pré-requisitos](docs/prerequisites.md) antes de instalar. Node.js 24 LTS:

```powershell
npm ci
npm run dev
```

A interface de desenvolvimento abre em `http://127.0.0.1:1420`. Aceita valores como `19,90` ou `19.90`, sem separador de milhar.

```powershell
npm run check        # lint,  testes, TypeScript e build web
npm run typecheck
npm test
npm audit --audit-level=high
```

Para desktop, também instale Rust stable MSVC e os pré-requisitos do Windows:

```powershell
npm run tauri -- dev
npm run tauri -- build -- --locked
```

O instalador gerado requer WebView2 já instalado. Rust não é necessário no computador de quem utiliza o instalador. GitHub Actions valida o projeto e gera um instalador Windows x64 como artefato de revisão, sem publicar releases.

## Estrutura e documentação

- `src/engine`: núcleo independente, cálculos decimais, demonstrativo e solver.
- `src/marketplaces`: catálogos e adaptação às condições de cada marketplace.
- `src/ui`: formulário mínimo, resultados e fontes.
- `src-tauri`: shell Windows e configuração de empacotamento.
- `tests`: testes unitários, invariantes e regressões históricas isoladas.
- [Arquitetura e convenções financeiras](docs/architecture.md).
- [Shopee: proveniência, implementações e pendências](docs/shopee/README.md).
- [Relatório da entrega](docs/implementation-report-v01.md).
- [Revisão da V0.1 antes do merge](docs/review-v01.md).

Valores monetários entram como strings decimais. Nunca use uma taxa desconhecida como zero nem trate resultado parcial como lucro confirmado. O cálculo é operacional; tributos não informados e eventos não modelados devem ser avaliados separadamente.
