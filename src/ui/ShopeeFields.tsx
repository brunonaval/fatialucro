import { useState } from 'react';
import { SHOPEE_SNAPSHOT } from '../marketplaces/shopee/catalog';
import { BaseField, Field, ManualFeeFields, ParticipationField, ScopeField } from './Fields';

export function ShopeeFields({ seller, onSellerChange }: { seller: string; onSellerChange: (value: string) => void }) {
  const [manualBasic, setManualBasic] = useState(false);
  const [returns, setReturns] = useState('unknown');
  return <fieldset><legend>Shopee: enquadramento e tarifas</legend>
    <div className="fields">
      <label>Cadastro do vendedor<select name="seller" value={seller} onChange={event => onSellerChange(event.target.value)} required><option value="">Selecione CPF ou CNPJ</option><option value="CPF">CPF</option><option value="CNPJ">CNPJ</option></select></label>
      {seller === 'CPF' && <label>Pedidos em 90 dias (vazio = desconhecido)<input name="orders" type="number" min="0" step="1" /></label>}
    </div>
    <label className="check"><input type="checkbox" checked disabled /> Comissão básica obrigatória: percentual e parcela por unidade; transação já incluída.</label>
    <p>A tabela arquivada permite calcular R$ 8,48 de comissão básica para R$ 19,90 na faixa regular. Isso não confirma adesões, vigência ou recebimento real.</p>
    <details><summary>Premissas e parâmetros avançados</summary>
      <p>Você pode calcular uma simulação provisória com premissas identificadas. Fórmulas, participação ou frete desconhecidos continuam bloqueando o resultado.</p>
      <label className="check"><input type="checkbox" name="acceptValidity" /> Aceito usar a tabela arquivada no cenário de 22/11/2026, sem comprovação do início da vigência.</label>
      <label className="check"><input type="checkbox" name="acceptRounding" /> Aceito HALF_UP por ocorrência como convenção da simulação; não como política confirmada da Shopee.</label>
      {seller === 'CPF' && <label className="check"><input type="checkbox" name="acceptPrecedence" /> Na faixa comum CPF, aceito priorizar R$4,50 da tabela do artigo 26839, apesar do trecho de R$4 no artigo 18484. A divergência permanece aberta.</label>}
      <details><summary>Comissão básica personalizada</summary>
        <label className="check"><input type="checkbox" name="manualBasic" checked={manualBasic} onChange={event => setManualBasic(event.target.checked)} /> Substituir o percentual e a parcela fixa por parâmetros informados por mim</label>
        {manualBasic && <div className="fields">
          <Field name="manualRate" label="Comissão percentual personalizada (%)" initial="" decimal />
          <ScopeField name="manualRateScope" label="Incidência do percentual" />
          <BaseField name="manualBase" />
          <Field name="manualFixed" label="Parcela fixa personalizada (R$)" initial="" />
          <ScopeField name="manualFixedScope" label="Incidência da parcela fixa" />
          <label>Origem ou motivo dos parâmetros<input name="manualReference" required maxLength={500} placeholder="Valores pessoais para simulação; sem dados privados" /></label>
        </div>}
      </details>
      {seller === 'CPF' && <ManualFeeFields id="shopee:cpf-extra" label="Adicional CPF" />}
      <div className="fields">
        <label>Início do período dos parâmetros personalizados<input type="date" name="manualFrom" defaultValue={SHOPEE_SNAPSHOT} required /></label>
        <label>Fim do período dos parâmetros personalizados<input type="date" name="manualUntil" defaultValue={SHOPEE_SNAPSHOT} required /></label>
      </div>
      <p>Essas datas são premissas do usuário, não vigência oficial. Parâmetros personalizados substituem somente as cobranças nomeadas e preservam as obrigações. CPF abaixo de R$ 12 exige também o adicional CPF explícito, pois sua decomposição não está determinada.</p>
    </details>
    <details open><summary>Programas opcionais — controles independentes</summary><div className="fields">
      <div><label>Devolução Fácil neste pedido pago<select name="returns" value={returns} onChange={event => setReturns(event.target.value)}><option value="unknown">Não confirmado</option><option value="inactive">Sem participação</option><option value="trial">Durante teste gratuito</option><option value="billable">Participação cobrável, fora da gratuidade</option></select></label>
        {returns === 'billable' && <ManualFeeFields id="shopee:returns-protection" label="Devolução Fácil (documental: R$ 0,49/pedido)" />}
      </div>
      <ParticipationField name="highlight" label="Campanha de Destaque" ruleId="shopee:highlight" />
      <ParticipationField name="ads" label="Ads Fácil" ruleId="shopee:adsEasy" />
      <ParticipationField name="affiliates" label="Afiliados" ruleId="shopee:affiliates" />
      <ParticipationField name="advance" label="Antecipação Shopee Acelera" ruleId="shopee:cashAdvance" />
    </div><p>Destaque ativo considera todas as vendas da loja durante a adesão. Alterar uma opção aqui não cancela uma adesão real. Créditos Ads já custeados não devem ser lançados novamente em outras despesas.</p></details>
  </fieldset>;
}
