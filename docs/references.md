# Referências técnicas e atribuições

Os projetos abaixo foram estudados por arquivos do GitHub, com os commits registrados para tornar a consulta reproduzível. Todos declaram licença MIT. O código desta integração foi escrito especificamente para o FatiaLucro, sem transcrição de implementações desses projetos. As consultas orientaram a separação de responsabilidades e a interpretação de formatos de metadados; não tornam os valores ou fórmulas de terceiros fontes financeiras da Shopee.

| Projeto / commit consultado | Licença e titular declarado | Ideias examinadas |
| --- | --- | --- |
| [Waarangel/3dcoster](https://github.com/Waarangel/3dcoster/tree/d2d12a833d8fc41983c2f4d079f7e2cad112be65) | MIT, Copyright 2026 Ashla Industries | `costCalc.ts`, `threeMfParser.ts`, `gcodeParser.ts`: custos separados da UI, placas e metadados Bambu, limites de importação |
| [ils15/open3dcalc](https://github.com/ils15/open3dcalc/tree/d261fcbbc35b236c44b9480a02e85fc1b61cb75a) | MIT, Copyright 2026 Open3DCalc | Núcleo compartilhado, perfis, persistência local e leitura de cabeçalhos G-code |
| [KINGdeusX/Print-Cost-Calculator](https://github.com/KINGdeusX/Print-Cost-Calculator/tree/3c664cb8ea35e8f9d1b6761ee05b58f085ab1d5f) | MIT, Copyright 2026 KINGdeusX | `threemf.py`, `pricing.py`, `models.py`: separação entre dados de placa, materiais e custos |

O FatiaLucro conserva seu próprio motor decimal e suas convenções documentadas. Não adotou conversões monetárias por ponto flutuante, preços padrão de materiais importados, densidades presumidas ou cópia de interfaces dos projetos consultados. As licenças originais podem ser consultadas em `LICENSE` nos links acima.

Dependências adicionadas: [fflate 0.8.3](https://github.com/101arrowz/fflate), descompactação em memória com limites, MIT; [fast-xml-parser 5.12.1](https://github.com/NaturalIntelligence/fast-xml-parser), leitura de XML sem DTD/entidades, MIT. [fake-indexeddb 6.2.8](https://github.com/dumbmatter/fakeIndexedDB), Apache-2.0, apenas para testar persistência em Node. Licenças e distribuições próprias dessas dependências permanecem nos pacotes fixados pelo lockfile; não são código copiado para o repositório.
