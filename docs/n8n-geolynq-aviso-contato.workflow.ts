// GeoLynq — Aviso de novo contato (landing). Workflow n8n id nDNHVHxurPRqu2h5 (criado INATIVO em 2026-10-13).
// A cada 5 min lê public.leads com notified_at nulo, manda 1 e-mail (Resend) com todos os novos contatos
// e só então marca notified_at. Se o e-mail falhar, nada é marcado e o próximo ciclo tenta de novo.
// Antes de ativar: (1) migration 20261013000000_leads_landing.sql — já aplicada em 2026-10-13 (criou notified_at);
// (2) no n8n, criar a credencial "Bearer Auth" 'Resend GeoLynq' com a chave do Resend e ligá-la ao nó de e-mail;
// (3) conferir que o remetente avisos@personalsupport.tech está verificado no Resend.
import { workflow, node, trigger, newCredential, expr } from '@n8n/workflow-sdk';

const cadaCincoMinutos = trigger({ type: 'n8n-nodes-base.scheduleTrigger', version: 1.4, config: { name: 'A cada 5 minutos', parameters: { rule: { interval: [{ field: 'minutes', minutesInterval: 5 }] } } }, output: [{}] });

const buscarNovos = node({ type: 'n8n-nodes-base.supabase', version: 1, config: { name: 'Buscar contatos não avisados', parameters: { resource: 'row', operation: 'getAll', tableId: 'leads', returnAll: false, limit: 20, orderBy: 'created_at.asc', filterType: 'string', filterString: 'notified_at=is.null' }, credentials: { supabaseApi: { id: 'urKpm6ymaIpZn3c3', name: 'Supabase account' } } }, output: [{ id: 'uuid', name: 'Maria', company: 'Marca X', email: 'm@x.com', phone: '13 99999-0000', message: '...', created_at: '2026-10-13T10:00:00Z' }] });

// O texto vem do formulário público: tudo é escapado no HTML; quebras de linha são removidas do assunto.
const montarAviso = node({ type: 'n8n-nodes-base.code', version: 2, config: { name: 'Montar aviso', parameters: { mode: 'runOnceForAllItems', language: 'javaScript', jsCode: '/* ver o nó no n8n: monta assunto, html, texto e a lista de ids */' } }, output: [{ subject: '', html: '', text: '', ids: [] }] });

const enviarEmail = node({ type: 'n8n-nodes-base.httpRequest', version: 4.5, config: { name: 'Enviar e-mail (Resend)', parameters: { method: 'POST', url: 'https://api.resend.com/emails', authentication: 'genericCredentialType', genericAuthType: 'httpBearerAuth', sendBody: true, contentType: 'json', specifyBody: 'json', jsonBody: expr('{{ { from: "GeoLynq <avisos@personalsupport.tech>", to: ["personalsupport@hotmail.com", "danilo.coletivaweb@gmail.com"], subject: $json.subject, html: $json.html, text: $json.text } }}') }, credentials: { httpBearerAuth: newCredential('Resend GeoLynq') } }, output: [{ id: 're_abc123' }] });

const listarIds = node({ type: 'n8n-nodes-base.code', version: 2, config: { name: 'Listar contatos avisados', parameters: { mode: 'runOnceForAllItems', language: 'javaScript', jsCode: "const ids = $('Montar aviso').first().json.ids || [];\nreturn ids.map(function (id) { return { json: { id: id } }; });" } }, output: [{ id: 'uuid' }] });

const marcarAvisado = node({ type: 'n8n-nodes-base.supabase', version: 1, config: { name: 'Marcar como avisado', parameters: { resource: 'row', operation: 'update', tableId: 'leads', filterType: 'manual', matchType: 'allFilters', filters: { conditions: [{ keyName: 'id', condition: 'eq', keyValue: expr('{{ $json.id }}') }] }, dataToSend: 'defineBelow', fieldsUi: { fieldValues: [{ fieldId: 'notified_at', fieldValue: expr('{{ $now.toISO() }}') }] } }, credentials: { supabaseApi: { id: 'urKpm6ymaIpZn3c3', name: 'Supabase account' } } }, output: [{ id: 'uuid', notified_at: '2026-10-13T10:05:00Z' }] });

export default workflow('geolynq-aviso-contato', 'GeoLynq — Aviso de novo contato (landing)')
  .add(cadaCincoMinutos).to(buscarNovos).to(montarAviso).to(enviarEmail).to(listarIds).to(marcarAvisado);
