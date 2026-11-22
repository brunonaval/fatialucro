# Importação e dados locais

## Leitura de impressão

`importPrintFile` recebe bytes e nome de arquivo; não acessa rede nem grava arquivos. A interface transfere o `ArrayBuffer` para um worker, liberado ao terminar, falhar ou desmontar o componente. Importar outra seleção invalida uma leitura anterior. O usuário escolhe a placa e aplica suas informações; a quantidade vendida e os custos de máquina continuam independentes.

3MF é lido como ZIP. Somente `Metadata/slice_info.config`, `model_settings.config`, `project_settings.config` e G-codes `plate_N` são expandidos. Geometrias, miniaturas e outros conteúdos são ignorados. São rejeitados caminhos perigosos, entradas repetidas, diretório incompleto, XML inválido, DTD/entidades, metadados conflitantes, arquivos criptografados e ZIP64. Há limites de 100 MB comprimidos, 5.000 entradas, 2 MB por configuração, 20 MB por G-code, 48 MB expandidos e profundidade/complexidade de objetos XML. Não há extração em disco.

O formato Bambu suportado identifica placas por `index`, tempo por `prediction` em segundos, filamentos por `used_g`/`type`, impressora/material do JSON do projeto e quantidade por `object_count`/`number_of_objects` ou instâncias da placa em `model_settings`. Instâncias são somente uma estimativa de peças: conjuntos, suportes, peças comerciais diferentes e objetos compostos exigem conferência. Não há distribuição automática entre SKUs diferentes. Metadados de fatiamento têm precedência sobre o G-code interno; este serve como alternativa quando não há placas compatíveis. Nenhuma massa/tempo é deduzida da geometria.

G-code textual aceita comentários de tempo Bambu/Prusa/Orca (`estimated printing time`, `model printing time`, unidades d/h/m/s), Cura `TIME` em segundos, massa declarada em `[g]`, nomes de material/impressora e contagem explícita de objetos. Cabeçalhos conflitantes deixam o campo ausente. Massa total e massas por ferramenta precisam concordar quando ambas existem. Não se integram movimentos/extrusão e não se presume diâmetro/densidade. Outros dialetos, formatos binários ou metadados ausentes permanecem manuais.

Aplicar uma placa limpa preços por kg; nenhum preço vem de um arquivo de fatiamento. Dados ausentes viram campos vazios, nunca zero nem valores anteriores. A produção não calcula enquanto faltarem dados usados. Um arquivo apenas geométrico oferece preparação manual, que limpa peso, tempo e quantidade. Não há impressão nem execução de comandos G-code.

Testes usam arquivos ZIP/XML/G-code sintéticos gerados em memória. **Arquivos reais de usuários e compatibilidade com diferentes versões do Bambu Studio ainda precisam de homologação**; não foram fornecidos arquivos reais nesta etapa. Os importadores não garantem autenticidade de metadados: são estimativas do fatiador, não medições ou comprovantes.

## IndexedDB e backup

Banco `fatialucro-local-v1`, versão **3**, conserva os stores `entries`/`settings` e não reescreve registros legados. A versão 3 protege o formato novo contra escrita por versões anteriores. Categorias incluem produto, impressora, filamento, produção, marketplace, simulação de venda e simulação somente de custo. Cadastros podem ficar incompletos; cálculos validam as entradas efetivamente usadas. `settings` guarda tema, modo, rascunho real, progresso de oficina e catálogos aplicados/arquivados.

O primeiro uso começa sem valores de fabricação; o exemplo é identificado e rejeitado na persistência como dado real. Perfis aplicam somente seus campos. A oficina pode ser salva parcialmente sem bloquear o primeiro cálculo. Rascunho real é salvo após 700 ms e pode ser recuperado por ação explícita na abertura; há uma janela de perda das últimas alterações se ocorrer interrupção abrupta.

Produtos organizam revisões de simulações. Cada histórico preserva entradas normalizadas e catálogo original, ou um snapshot somente de custo. A consulta reproduz esse snapshot e não seleciona tarifas atuais. Editar cria nova revisão e avisa que o recálculo utiliza o catálogo atual. Duplicar cria produto independente. Resultados de busca/comparações podem ser executados novamente em uma revisão; o snapshot preserva o preço final e as premissas usadas, sem recalcular o histórico silenciosamente.

Exclusão na interface exige confirmação e é lógica, com `deletedAt`/`deletedBatch`. Excluir produto inclui revisões ativas; restaurar o lote de exclusão não revive revisões já excluídas individualmente. A lixeira não tem remoção definitiva pela interface.

Backup JSON: `{ "version": 2, "entries": [...] }`, incluindo lixeira, até 12 MB/5.000 registros, IDs únicos e coerência de snapshots. A leitura de **v1** continua compatível. Chaves de protótipo e profundidade excessiva são rejeitadas. Todos os registros são validados antes de uma única transação, abortada integralmente em falha/quota. IDs idênticos com conteúdo diferente viram cópias; vínculos de produto, revisão e lote de exclusão são remapeados e `restoredFromId` registra a origem. O conteúdo existente não é sobrescrito pela restauração.

Backup inclui produtos, perfis, loja e snapshots financeiros. Tema, modo, rascunho, progresso do assistente e cache público não fazem parte do arquivo: podem ser configurados novamente; o catálogo original de cada simulação continua no seu snapshot. A migração de v2 para v3, perfis reabertos, históricos, lixeira e restauração conflitante são testados com IndexedDB emulado em Node. Nenhuma migração reclassifica resultados antigos.

O armazenamento depende do perfil do WebView/navegador e de sua origem. Não é um arquivo SQLite compartilhado, não tem criptografia própria, sincronização ou backup automático; sua persistência real no WebView2 e o download/restauro do JSON no desktop estão pendentes de homologação gráfica. A escolha evita plugins nativos e novas permissões de filesystem. O conteúdo integral do arquivo de impressão não é salvo; campos aplicados e sua origem (nome do arquivo, placa e metadados declarados). Nomes/custos pertencem ao usuário e ficam fora do Git. Nenhum arquivo privado ou documentação integral de terceiros foi incluído nos testes.

A experiência atual mostra explicitamente que apenas a placa selecionada entra no cálculo. O drop HTML5 foi habilitado no shell Tauri desativando o interceptador nativo (`dragDropEnabled: false`), conforme o esquema oficial distribuído com o CLI. A seleção nativa e o drop real no WebView2 não foram executados nesta etapa; veja a [matriz UX V2](ux-v2.md).
