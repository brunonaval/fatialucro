# Referências técnicas e atribuições

Os três projetos da tabela abaixo foram estudados por arquivos do GitHub, com os commits registrados para tornar a consulta reproduzível. Todos declaram licença MIT. O código desta integração foi escrito especificamente para o FatiaLucro, sem transcrição de implementações desses projetos. As consultas orientaram a separação de responsabilidades e a interpretação de formatos de metadados; não tornam os valores ou fórmulas de terceiros fontes financeiras da Shopee.

| Projeto / commit consultado | Licença e titular declarado | Ideias examinadas |
| --- | --- | --- |
| [Waarangel/3dcoster](https://github.com/Waarangel/3dcoster/tree/d2d12a833d8fc41983c2f4d079f7e2cad112be65) | MIT, Copyright 2026 Ashla Industries | `costCalc.ts`, `threeMfParser.ts`, `gcodeParser.ts`: custos separados da UI, placas e metadados Bambu, limites de importação |
| [ils15/open3dcalc](https://github.com/ils15/open3dcalc/tree/d261fcbbc35b236c44b9480a02e85fc1b61cb75a) | MIT, Copyright 2026 Open3DCalc | Núcleo compartilhado, perfis, persistência local e leitura de cabeçalhos G-code |
| [KINGdeusX/Print-Cost-Calculator](https://github.com/KINGdeusX/Print-Cost-Calculator/tree/3c664cb8ea35e8f9d1b6761ee05b58f085ab1d5f) | MIT, Copyright 2026 KINGdeusX | `threemf.py`, `pricing.py`, `models.py`: separação entre dados de placa, materiais e custos |

O FatiaLucro conserva seu próprio motor decimal e suas convenções documentadas. Não adotou conversões monetárias por ponto flutuante, preços padrão de materiais importados, densidades presumidas ou cópia de interfaces dos projetos consultados. As licenças originais podem ser consultadas em `LICENSE` nos links acima.

Dependências adicionadas: [fflate 0.8.3](https://github.com/101arrowz/fflate), descompactação em memória com limites, MIT; [fast-xml-parser 5.12.1](https://github.com/NaturalIntelligence/fast-xml-parser), leitura de XML sem DTD/entidades, MIT. [fake-indexeddb 6.2.8](https://github.com/dumbmatter/fakeIndexedDB), Apache-2.0, apenas para testar persistência em Node. Licenças e distribuições próprias dessas dependências permanecem nos pacotes fixados pelo lockfile; não são código copiado para o repositório.

## Referências adicionais da experiência UX V2

Consulta documental em 22/11/2026, por arquivos do GitHub e leitura textual das páginas públicas, sem abrir navegador ou executar os projetos. Nenhum código, imagem, marca, fonte ou outro ativo foi copiado. Não se adotaram fórmulas, taxas, margens sugeridas ou valores padrão dessas referências.

| Referência | Arquivo/identificação consultada | Licença observada / uso na análise |
| --- | --- | --- |
| [smallhours-tools/print-cost-calculator](https://github.com/smallhours-tools/print-cost-calculator/blob/main/README.md) | README blob `ca51375fbbbfbba3fa744dbb82e59743bc1dbbf1`; LICENSE blob `0a852a5e7dc1fe65a7ab25839a08c93bd322eea6` | MIT, Copyright 2026 Small Hours, confirmado em LICENSE; entrada por arquivo com alternativa manual e perfis |
| [Nate-DUDV2/PrintPricingCalculator](https://github.com/Nate-DUDV2/PrintPricingCalculator/blob/master/README.md) | README blob `4a9b267253c8cf0fb53d4031c8d86309d36e189c` | README declara MIT; consulta de LICENSE retornou 404, licença independente não confirmada; recálculo e temas, sem reutilização |
| [sinezzio/sinezzio-calculadora](https://github.com/sinezzio/sinezzio-calculadora/blob/main/README.md) | README blob `061fa6d20da66e94a946ae986c874b4eeceea39f` | LICENSE não localizado na consulta (404); perguntas preço/meta, preservação de custos e ausência como pendência; sem reutilização |
| [JohnPitter/precifique](https://github.com/JohnPitter/precifique/blob/main/README.md) | README blob `f0a48441988499280fdc17562cf53a0d4cf87a90` | README declara MIT; LICENSE consultado retornou 404, licença independente não confirmada; separação custo/tarifas/resultado, sem reutilização |
| [jlopes07/CalculadoraPrecificacao](https://github.com/jlopes07/CalculadoraPrecificacao/blob/main/README.md) | README blob `bd51ac6456033e12884b76207c0a46b1dfe56755` | README permite uso pessoal/comercial, sem licença específica confirmada; LICENSE consultado retornou 404; embalagem por quantidade e cartões de custos, sem reutilização |

Os hashes acima identificam o conteúdo dos arquivos, não commits nem verificação jurídica de licenciamento. Ausência de LICENSE nesse caminho não comprova inexistência de licença em outro local; por isso, nenhuma reutilização foi autorizada a partir dessas declarações.

| Página pública consultada | Observação aplicada ao desenho próprio |
| --- | --- |
| [APP3D](https://www.app3d.com.br/) | Organização por operações; manteve-se apenas o fluxo da calculadora, sem dashboard empresarial |
| [DBLAB3D](https://dblab3d.com.br/) | A leitura não foi concluída pela ferramenta; nenhuma conclusão específica atribuída ao produto |
| [UniCalc](https://unicalc.com.br/) | Importação e preenchimento manual, materiais e perfis; não se incorporou IA |
| [Polvo](https://polvo.app/) | Custos datados e distinção entre informação ausente e zero; sem importar integrações |
| [Precifica Certo](https://precificacertoecommerce.com.br/) | Perguntas preço/lucro/margem; nenhuma tarifa foi usada como fonte oficial |
| [3D Print Cost Calc](https://www.3dprintcostcalc.com/) | Entrada por arquivo, custo da bobina/peso líquido e detalhamento; sem estimar geometria ou adotar fórmulas externas |

A leitura textual não é avaliação visual ou teste funcional desses serviços. Fontes financeiras oficiais continuam exclusivamente no [registro documental Shopee](shopee/README.md). A implementação, os tokens e a identidade visual do FatiaLucro são próprios.
