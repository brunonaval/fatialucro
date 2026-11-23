import { BaseField, Check, Field, Input, ManualFeeFields, ParticipationField, ScopeField, Select, useForm } from './Fields';

export function ShopeeFields() {
  const { draft } = useForm(); const seller = draft.fields.seller;
  return <fieldset><legend>Shopee: enquadramento e tarifas</legend>
    <div className="fields">
      <Select name="seller" label="Cadastro do vendedor"><option value="">Selecione CPF ou CNPJ</option><option value="CPF">CPF</option><option value="CNPJ">CNPJ</option></Select>
    </div>
    <label className="check"><input type="checkbox" checked disabled /> Comissão básica obrigatória: percentual e parcela fixa; transação já incluída.</label>
    <p>A tabela arquivada calcula R$ 8,48 de comissão básica sobre R$ 19,90 na faixa regular. Vigência, enquadramento e adesões precisam ser conferidos.</p>
    <details><summary>Premissas e parâmetros avançados</summary>
      <p>Uma cobrança desconhecida bloqueia o lucro completo. Premissas aceitas e tarifas personalizadas produzem simulações provisórias.</p>
      <Check name="acceptValidity">Aceito simular com a referência selecionada, sem confirmação ao vivo de vigência. A data da última verificação fica registrada no resultado.</Check>
      <Check name="acceptRounding">Aceito HALF_UP por ocorrência como convenção desta simulação, sem confirmação da política da Shopee.</Check>
      {seller === 'CPF' && <Check name="acceptPrecedence">Na faixa comum CPF, aceito R$ 4,50 da tabela do artigo 26839, apesar de R$ 4 no texto do artigo 18484. A divergência permanece aberta.</Check>}
      <details><summary>Comissão básica personalizada</summary>
        <Check name="manualBasic">Substituir o percentual e a parcela fixa por parâmetros informados por mim</Check>
        {draft.fields.manualBasic === true && <div className="fields">
          <Field name="manualRate" label="Comissão personalizada (%)" decimal /><ScopeField name="manualRateScope" label="Incidência do percentual" /><BaseField name="manualBase" />
          <Field name="manualFixed" label="Parcela fixa personalizada (R$)" /><ScopeField name="manualFixedScope" label="Incidência da parcela fixa" /><Input name="manualReference" label="Origem ou motivo dos parâmetros" />
        </div>}
      </details>
      {seller === 'CPF' && <ManualFeeFields id="shopee:cpf-extra" label="Adicional CPF condicional (sem controle de desativação)" />}
      <div className="fields"><Input name="manualFrom" type="date" label="Início do período personalizado" /><Input name="manualUntil" type="date" label="Fim do período personalizado" /></div>
      <p>O período informado não comprova vigência oficial. CPF abaixo de R$ 12 exige também o adicional CPF explícito. Valores personalizados preservam a obrigatoriedade das cobranças.</p>
    </details>
    <details><summary>Programas opcionais — confirmar cada adesão</summary><div className="fields">
      <div><Select name="returns" label="Devolução Fácil no pedido pago"><option value="unknown">Não confirmado</option><option value="inactive">Sem participação</option><option value="trial">Durante teste gratuito</option><option value="billable">Cobrável, fora da gratuidade</option></Select>
        {draft.fields.returns === 'billable' && <ManualFeeFields id="shopee:returns-protection" label="Devolução Fácil (documental: R$ 0,49/pedido)" />}</div>
      <ParticipationField name="highlight" label="Campanha de Destaque" ruleId="shopee:highlight" />
      <ParticipationField name="ads" label="Ads Fácil" ruleId="shopee:adsEasy" />
      <ParticipationField name="affiliates" label="Afiliados" ruleId="shopee:affiliates" />
      <ParticipationField name="advance" label="Antecipação Shopee Acelera" ruleId="shopee:cashAdvance" />
    </div><p>Destaque ativo considera todas as vendas da loja durante a adesão. A seleção representa o cenário e não altera sua conta Shopee. Créditos Ads já custeados não devem entrar novamente em despesas.</p></details>
  </fieldset>;
}
