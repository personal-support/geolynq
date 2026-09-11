import { workflow, node, trigger, sticky, placeholder, newCredential, ifElse, merge, expr } from '@n8n/workflow-sdk';

const startTrigger = trigger({
  type: 'n8n-nodes-base.manualTrigger',
  version: 1,
  config: { name: 'Iniciar Importação' }
});

const paramsNode = node({
  type: 'n8n-nodes-base.set',
  version: 3.5,
  config: {
    name: 'Parâmetros da Importação',
    parameters: {
      mode: 'manual',
      assignments: {
        assignments: [
          { id: 'tenant_id', name: 'tenant_id', value: placeholder('UUID do tenant no Supabase — editar antes de cada execução'), type: 'string' },
          { id: 'import_source', name: 'import_source', value: 'google_sheets_import', type: 'string' }
        ]
      }
    },
    output: [{ json: { tenant_id: 'a0000000-0000-0000-0000-000000000000', import_source: 'google_sheets_import' } }]
  }
});

const readProdutos = node({
  type: 'n8n-nodes-base.googleSheets',
  version: 4.7,
  config: {
    name: 'Ler Aba Produtos',
    parameters: {
      resource: 'sheet',
      operation: 'read',
      documentId: { __rl: true, mode: 'list', value: '', cachedResultName: 'GeoLynq — Planilha Modelo Catálogo' },
      sheetName: { __rl: true, mode: 'name', value: 'Produtos' }
    },
    credentials: { googleApi: newCredential('Google Drive account') },
    output: [{ json: { sku: 'WPI-900', nome: 'Whey Protein Isolado 900g', categoria: 'proteina', claims: 'sem lactose, sem gluten', alergenos: 'leite' } }]
  }
});

const readRevendedores = node({
  type: 'n8n-nodes-base.googleSheets',
  version: 4.7,
  config: {
    name: 'Ler Aba Revendedores',
    executeOnce: true,
    parameters: {
      resource: 'sheet',
      operation: 'read',
      documentId: { __rl: true, mode: 'list', value: '', cachedResultName: 'GeoLynq — Planilha Modelo Catálogo' },
      sheetName: { __rl: true, mode: 'name', value: 'Revendedores' }
    },
    credentials: { googleApi: newCredential('Google Drive account') },
    output: [{ json: { nome: 'Farmácia Saúde Total', tipo: 'farmacia', telefone: '13999990000', whatsapp: '13999990000', site: '', cep: '11015-000', rua: 'Av. Ana Costa', numero: '100', bairro: 'Gonzaga', cidade: 'Santos', estado: 'SP' } }]
  }
});

const readCobertura = node({
  type: 'n8n-nodes-base.googleSheets',
  version: 4.7,
  config: {
    name: 'Ler Aba Cobertura',
    executeOnce: true,
    parameters: {
      resource: 'sheet',
      operation: 'read',
      documentId: { __rl: true, mode: 'list', value: '', cachedResultName: 'GeoLynq — Planilha Modelo Catálogo' },
      sheetName: { __rl: true, mode: 'name', value: 'Cobertura' }
    },
    credentials: { googleApi: newCredential('Google Drive account') },
    output: [{ json: { sku_produto: 'WPI-900', nome_revendedor: 'Farmácia Saúde Total', prioridade: '0' } }]
  }
});

const codeValidarProdutos = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'Validar Produtos',
    executeOnce: true,
    parameters: {
      mode: 'runOnceForAllItems',
      language: 'javaScript',
      jsCode:
        "const tenantId = $('Parâmetros da Importação').first().json.tenant_id;\n" +
        "const rows = $('Ler Aba Produtos').all();\n" +
        "const seenSku = new Set();\n" +
        "const out = [];\n" +
        "rows.forEach((item, idx) => {\n" +
        "  const row = idx + 2;\n" +
        "  const d = item.json;\n" +
        "  const sku = (d.sku || '').toString().trim();\n" +
        "  const nome = (d.nome || '').toString().trim();\n" +
        "  if (!sku || !nome) {\n" +
        "    out.push({ json: { _valid: false, _sheet: 'Produtos', _row: row, _error: 'sku e nome são obrigatórios' } });\n" +
        "    return;\n" +
        "  }\n" +
        "  if (seenSku.has(sku)) {\n" +
        "    out.push({ json: { _valid: false, _sheet: 'Produtos', _row: row, _error: 'SKU duplicado no lote: ' + sku } });\n" +
        "    return;\n" +
        "  }\n" +
        "  seenSku.add(sku);\n" +
        "  const claims = (d.claims || '').toString().split(',').map(s => s.trim()).filter(Boolean);\n" +
        "  const alergenos = (d.alergenos || '').toString().split(',').map(s => s.trim()).filter(Boolean);\n" +
        "  out.push({ json: {\n" +
        "    _valid: true, _sheet: 'Produtos', _row: row,\n" +
        "    tenant_id: tenantId, sku: sku, name: nome,\n" +
        "    category: (d.categoria || '').toString().trim() || null,\n" +
        "    claims: claims, allergens: alergenos, active: true\n" +
        "  } });\n" +
        "});\n" +
        "return out;"
    },
    output: [{ json: { _valid: true, _sheet: 'Produtos', _row: 2, tenant_id: 'a0000000-0000-0000-0000-000000000000', sku: 'WPI-900', name: 'Whey Protein Isolado 900g', category: 'proteina', claims: ['sem lactose'], allergens: ['leite'], active: true } }]
  }
});

const ifProdutoValido = ifElse({
  version: 2.3,
  config: {
    name: 'Produto Válido?',
    parameters: {
      conditions: {
        options: { caseSensitive: true, leftValue: '', typeValidation: 'strict' },
        conditions: [{ leftValue: expr('{{ $json._valid }}'), operator: { type: 'boolean', operation: 'equals' }, rightValue: true }],
        combinator: 'and'
      }
    },
    output: [{ json: { _valid: true, _sheet: 'Produtos', _row: 2, tenant_id: 'a0000000-0000-0000-0000-000000000000', sku: 'WPI-900', name: 'Whey Protein Isolado 900g', category: 'proteina', claims: ['sem lactose'], allergens: ['leite'], active: true } }]
  }
});

const supabaseCreateProdutos = node({
  type: 'n8n-nodes-base.supabase',
  version: 1,
  config: {
    name: 'Criar Produtos no Supabase',
    onError: 'continueErrorOutput',
    parameters: {
      resource: 'row',
      operation: 'create',
      tableId: 'products',
      dataToSend: 'defineBelow',
      fieldsUi: {
        fieldValues: [
          { fieldId: 'tenant_id', fieldValue: expr('{{ $json.tenant_id }}') },
          { fieldId: 'sku', fieldValue: expr('{{ $json.sku }}') },
          { fieldId: 'name', fieldValue: expr('{{ $json.name }}') },
          { fieldId: 'category', fieldValue: expr('{{ $json.category }}') },
          { fieldId: 'claims', fieldValue: expr('{{ $json.claims }}') },
          { fieldId: 'allergens', fieldValue: expr('{{ $json.allergens }}') },
          { fieldId: 'active', fieldValue: expr('{{ $json.active }}') }
        ]
      }
    },
    credentials: { supabaseApi: newCredential('Supabase - GeoLynq (service_role)') },
    output: [{ json: { id: 'b0000000-0000-0000-0000-000000000000', sku: 'WPI-900', name: 'Whey Protein Isolado 900g' } }]
  }
});

const codeValidarRevendedores = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'Validar Revendedores',
    executeOnce: true,
    parameters: {
      mode: 'runOnceForAllItems',
      language: 'javaScript',
      jsCode:
        "const tenantId = $('Parâmetros da Importação').first().json.tenant_id;\n" +
        "const rows = $('Ler Aba Revendedores').all();\n" +
        "const tiposValidos = ['loja_fisica','farmacia','online','distribuidor','outro'];\n" +
        "const out = [];\n" +
        "rows.forEach((item, idx) => {\n" +
        "  const row = idx + 2;\n" +
        "  const d = item.json;\n" +
        "  const nome = (d.nome || '').toString().trim();\n" +
        "  const tipo = (d.tipo || '').toString().trim();\n" +
        "  const cidade = (d.cidade || '').toString().trim();\n" +
        "  const estado = (d.estado || '').toString().trim();\n" +
        "  if (!nome || !tipo || !cidade || !estado) {\n" +
        "    out.push({ json: { _valid: false, _sheet: 'Revendedores', _row: row, _error: 'nome, tipo, cidade e estado são obrigatórios' } });\n" +
        "    return;\n" +
        "  }\n" +
        "  if (!tiposValidos.includes(tipo)) {\n" +
        "    out.push({ json: { _valid: false, _sheet: 'Revendedores', _row: row, _error: 'tipo inválido: ' + tipo + ' (use ' + tiposValidos.join('/') + ')' } });\n" +
        "    return;\n" +
        "  }\n" +
        "  const cepDigits = (d.cep || '').toString().replace(/\\D/g, '');\n" +
        "  if (d.cep && cepDigits.length !== 8) {\n" +
        "    out.push({ json: { _valid: false, _sheet: 'Revendedores', _row: row, _error: 'CEP inválido: ' + d.cep } });\n" +
        "    return;\n" +
        "  }\n" +
        "  const rua = (d.rua || '').toString().trim();\n" +
        "  const numero = (d.numero || '').toString().trim();\n" +
        "  const bairro = (d.bairro || '').toString().trim();\n" +
        "  const enderecoCompleto = [rua, numero, bairro, cidade, estado, 'Brasil'].filter(Boolean).join(', ');\n" +
        "  out.push({ json: {\n" +
        "    _valid: true, _sheet: 'Revendedores', _row: row,\n" +
        "    tenant_id: tenantId, name: nome, type: tipo, status: 'active',\n" +
        "    phone: (d.telefone || '').toString().trim() || null,\n" +
        "    whatsapp: (d.whatsapp || '').toString().trim() || null,\n" +
        "    website: (d.site || '').toString().trim() || null,\n" +
        "    cep: d.cep || null, cep_digits: cepDigits,\n" +
        "    street: rua || null, number: numero || null, neighborhood: bairro || null,\n" +
        "    city: cidade, state: estado, endereco_completo: enderecoCompleto\n" +
        "  } });\n" +
        "});\n" +
        "return out;"
    },
    output: [{ json: { _valid: true, _sheet: 'Revendedores', _row: 2, tenant_id: 'a0000000-0000-0000-0000-000000000000', name: 'Farmácia Saúde Total', type: 'farmacia', status: 'active', city: 'Santos', state: 'SP', cep_digits: '11015000', endereco_completo: 'Av. Ana Costa, 100, Gonzaga, Santos, SP, Brasil' } }]
  }
});

const ifRevendedorValido = ifElse({
  version: 2.3,
  config: {
    name: 'Revendedor Válido?',
    parameters: {
      conditions: {
        options: { caseSensitive: true, leftValue: '', typeValidation: 'strict' },
        conditions: [{ leftValue: expr('{{ $json._valid }}'), operator: { type: 'boolean', operation: 'equals' }, rightValue: true }],
        combinator: 'and'
      }
    },
    output: [{ json: { _valid: true, _sheet: 'Revendedores', _row: 2, tenant_id: 'a0000000-0000-0000-0000-000000000000', name: 'Farmácia Saúde Total', type: 'farmacia', status: 'active', phone: '13999990000', whatsapp: '13999990000', website: null, cep: '11015-000', cep_digits: '11015000', street: 'Av. Ana Costa', number: '100', neighborhood: 'Gonzaga', city: 'Santos', state: 'SP', endereco_completo: 'Av. Ana Costa, 100, Gonzaga, Santos, SP, Brasil' } }]
  }
});

const supabaseCreateRevendedores = node({
  type: 'n8n-nodes-base.supabase',
  version: 1,
  config: {
    name: 'Criar Revendedores no Supabase',
    onError: 'continueErrorOutput',
    parameters: {
      resource: 'row',
      operation: 'create',
      tableId: 'resellers',
      dataToSend: 'defineBelow',
      fieldsUi: {
        fieldValues: [
          { fieldId: 'tenant_id', fieldValue: expr('{{ $json.tenant_id }}') },
          { fieldId: 'name', fieldValue: expr('{{ $json.name }}') },
          { fieldId: 'type', fieldValue: expr('{{ $json.type }}') },
          { fieldId: 'status', fieldValue: expr('{{ $json.status }}') },
          { fieldId: 'phone', fieldValue: expr('{{ $json.phone }}') },
          { fieldId: 'whatsapp', fieldValue: expr('{{ $json.whatsapp }}') },
          { fieldId: 'website', fieldValue: expr('{{ $json.website }}') }
        ]
      }
    },
    credentials: { supabaseApi: newCredential('Supabase - GeoLynq (service_role)') },
    output: [{ json: { id: 'c0000000-0000-0000-0000-000000000000', name: 'Farmácia Saúde Total', type: 'farmacia' } }]
  }
});

const httpViaCep = node({
  type: 'n8n-nodes-base.httpRequest',
  version: 4.5,
  config: {
    name: 'Consultar CEP (ViaCEP)',
    parameters: {
      method: 'GET',
      url: expr('https://viacep.com.br/ws/{{ $("Validar Revendedores").item.json.cep_digits }}/json/'),
      options: { response: { response: { neverError: true } } }
    },
    output: [{ json: { cep: '11015-000', logradouro: 'Av. Ana Costa', bairro: 'Gonzaga', localidade: 'Santos', uf: 'SP' } }]
  }
});

const httpNominatim = node({
  type: 'n8n-nodes-base.httpRequest',
  version: 4.5,
  config: {
    name: 'Geocodificar Endereço (Nominatim)',
    alwaysOutputData: true,
    parameters: {
      method: 'GET',
      url: expr('https://nominatim.openstreetmap.org/search?format=json&limit=1&countrycodes=br&q={{ encodeURIComponent($("Validar Revendedores").item.json.endereco_completo) }}'),
      sendHeaders: true,
      headerParameters: { parameters: [{ name: 'User-Agent', value: 'GeoLynq-ImportPipeline (geolynq.personalsupport.tech)' }] },
      options: { response: { response: { neverError: true } } }
    },
    output: [{ json: { lat: '-23.9608', lon: '-46.3336', display_name: 'Av. Ana Costa, Gonzaga, Santos - SP, Brasil' } }]
  }
});

const codeMontarEndereco = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'Montar Payload de Endereço',
    parameters: {
      mode: 'runOnceForEachItem',
      language: 'javaScript',
      jsCode:
        "const resellerId = $('Criar Revendedores no Supabase').item.json.id;\n" +
        "const val = $('Validar Revendedores').item.json;\n" +
        "const nominatim = $json;\n" +
        "const lat = nominatim && nominatim.lat ? parseFloat(nominatim.lat) : null;\n" +
        "const lon = nominatim && nominatim.lon ? parseFloat(nominatim.lon) : null;\n" +
        "return { json: {\n" +
        "  tenant_id: val.tenant_id,\n" +
        "  reseller_id: resellerId,\n" +
        "  cep: val.cep,\n" +
        "  street: val.street,\n" +
        "  number: val.number,\n" +
        "  neighborhood: val.neighborhood,\n" +
        "  city: val.city,\n" +
        "  state: val.state,\n" +
        "  latitude: lat,\n" +
        "  longitude: lon,\n" +
        "  geocoded_at: (lat !== null && lon !== null) ? new Date().toISOString() : null\n" +
        "} };"
    },
    output: [{ json: { tenant_id: 'a0000000-0000-0000-0000-000000000000', reseller_id: 'c0000000-0000-0000-0000-000000000000', cep: '11015-000', street: 'Av. Ana Costa', number: '100', neighborhood: 'Gonzaga', city: 'Santos', state: 'SP', latitude: -23.9608, longitude: -46.3336, geocoded_at: '2026-09-11T00:00:00.000Z' } }]
  }
});

const supabaseCreateEnderecos = node({
  type: 'n8n-nodes-base.supabase',
  version: 1,
  config: {
    name: 'Criar Endereços no Supabase',
    onError: 'continueErrorOutput',
    parameters: {
      resource: 'row',
      operation: 'create',
      tableId: 'addresses',
      dataToSend: 'defineBelow',
      fieldsUi: {
        fieldValues: [
          { fieldId: 'tenant_id', fieldValue: expr('{{ $json.tenant_id }}') },
          { fieldId: 'reseller_id', fieldValue: expr('{{ $json.reseller_id }}') },
          { fieldId: 'cep', fieldValue: expr('{{ $json.cep }}') },
          { fieldId: 'street', fieldValue: expr('{{ $json.street }}') },
          { fieldId: 'number', fieldValue: expr('{{ $json.number }}') },
          { fieldId: 'neighborhood', fieldValue: expr('{{ $json.neighborhood }}') },
          { fieldId: 'city', fieldValue: expr('{{ $json.city }}') },
          { fieldId: 'state', fieldValue: expr('{{ $json.state }}') },
          { fieldId: 'latitude', fieldValue: expr('{{ $json.latitude }}') },
          { fieldId: 'longitude', fieldValue: expr('{{ $json.longitude }}') },
          { fieldId: 'geocoded_at', fieldValue: expr('{{ $json.geocoded_at }}') }
        ]
      }
    },
    credentials: { supabaseApi: newCredential('Supabase - GeoLynq (service_role)') },
    output: [{ json: { id: 'd0000000-0000-0000-0000-000000000000', city: 'Santos', state: 'SP' } }]
  }
});

const codeValidarCobertura = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'Validar Cobertura',
    executeOnce: true,
    parameters: {
      mode: 'runOnceForAllItems',
      language: 'javaScript',
      jsCode:
        "const tenantId = $('Parâmetros da Importação').first().json.tenant_id;\n" +
        "const rows = $('Ler Aba Cobertura').all();\n" +
        "let produtos = [];\n" +
        "try { produtos = $('Criar Produtos no Supabase').all(); } catch (e) { produtos = []; }\n" +
        "let revendedores = [];\n" +
        "try { revendedores = $('Criar Revendedores no Supabase').all(); } catch (e) { revendedores = []; }\n" +
        "const produtoPorSku = {};\n" +
        "produtos.forEach(p => { if (p.json && p.json.sku) produtoPorSku[p.json.sku] = p.json.id; });\n" +
        "const revendedorPorNome = {};\n" +
        "revendedores.forEach(r => { if (r.json && r.json.name) revendedorPorNome[r.json.name] = r.json.id; });\n" +
        "const out = [];\n" +
        "rows.forEach((item, idx) => {\n" +
        "  const row = idx + 2;\n" +
        "  const d = item.json;\n" +
        "  const sku = (d.sku_produto || '').toString().trim();\n" +
        "  const nomeRevendedor = (d.nome_revendedor || '').toString().trim();\n" +
        "  if (!sku || !nomeRevendedor) {\n" +
        "    out.push({ json: { _valid: false, _sheet: 'Cobertura', _row: row, _error: 'sku_produto e nome_revendedor são obrigatórios' } });\n" +
        "    return;\n" +
        "  }\n" +
        "  const productId = produtoPorSku[sku];\n" +
        "  if (!productId) {\n" +
        "    out.push({ json: { _valid: false, _sheet: 'Cobertura', _row: row, _error: \"produto com SKU '\" + sku + \"' não encontrado ou não importado\" } });\n" +
        "    return;\n" +
        "  }\n" +
        "  const resellerId = revendedorPorNome[nomeRevendedor];\n" +
        "  if (!resellerId) {\n" +
        "    out.push({ json: { _valid: false, _sheet: 'Cobertura', _row: row, _error: \"revendedor '\" + nomeRevendedor + \"' não encontrado ou não importado\" } });\n" +
        "    return;\n" +
        "  }\n" +
        "  const prioridade = parseInt(d.prioridade, 10);\n" +
        "  out.push({ json: {\n" +
        "    _valid: true, _sheet: 'Cobertura', _row: row,\n" +
        "    tenant_id: tenantId, product_id: productId, reseller_id: resellerId,\n" +
        "    priority: Number.isFinite(prioridade) ? prioridade : 0\n" +
        "  } });\n" +
        "});\n" +
        "return out;"
    },
    output: [{ json: { _valid: true, _sheet: 'Cobertura', _row: 2, tenant_id: 'a0000000-0000-0000-0000-000000000000', product_id: 'b0000000-0000-0000-0000-000000000000', reseller_id: 'c0000000-0000-0000-0000-000000000000', priority: 0 } }]
  }
});

const ifCoberturaValida = ifElse({
  version: 2.3,
  config: {
    name: 'Cobertura Válida?',
    parameters: {
      conditions: {
        options: { caseSensitive: true, leftValue: '', typeValidation: 'strict' },
        conditions: [{ leftValue: expr('{{ $json._valid }}'), operator: { type: 'boolean', operation: 'equals' }, rightValue: true }],
        combinator: 'and'
      }
    },
    output: [{ json: { _valid: true, _sheet: 'Cobertura', _row: 2, tenant_id: 'a0000000-0000-0000-0000-000000000000', product_id: 'b0000000-0000-0000-0000-000000000000', reseller_id: 'c0000000-0000-0000-0000-000000000000', priority: 0 } }]
  }
});

const supabaseCreateCobertura = node({
  type: 'n8n-nodes-base.supabase',
  version: 1,
  config: {
    name: 'Criar Cobertura no Supabase',
    onError: 'continueErrorOutput',
    parameters: {
      resource: 'row',
      operation: 'create',
      tableId: 'product_reseller_coverage',
      dataToSend: 'defineBelow',
      fieldsUi: {
        fieldValues: [
          { fieldId: 'tenant_id', fieldValue: expr('{{ $json.tenant_id }}') },
          { fieldId: 'product_id', fieldValue: expr('{{ $json.product_id }}') },
          { fieldId: 'reseller_id', fieldValue: expr('{{ $json.reseller_id }}') },
          { fieldId: 'priority', fieldValue: expr('{{ $json.priority }}') }
        ]
      }
    },
    credentials: { supabaseApi: newCredential('Supabase - GeoLynq (service_role)') },
    output: [{ json: { id: 'e0000000-0000-0000-0000-000000000000' } }]
  }
});

const mergeErros = merge({
  version: 3.2,
  config: {
    name: 'Consolidar Erros de Validação e Gravação',
    parameters: { mode: 'append', numberInputs: 7 },
    output: [{ json: { _sheet: 'Produtos', _row: 5, _error: 'exemplo de erro' } }]
  }
});

const codeMontarResumo = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'Montar Resumo da Importação',
    parameters: {
      mode: 'runOnceForAllItems',
      language: 'javaScript',
      jsCode:
        "const tenantId = $('Parâmetros da Importação').first().json.tenant_id;\n" +
        "const importSource = $('Parâmetros da Importação').first().json.import_source;\n" +
        "const erros = $input.all().map(i => i.json).filter(e => e && e._sheet);\n" +
        "function contarLinhas(nodeName) {\n" +
        "  try { return $(nodeName).all().length; } catch (e) { return 0; }\n" +
        "}\n" +
        "const totalProdutos = contarLinhas('Ler Aba Produtos');\n" +
        "const totalRevendedores = contarLinhas('Ler Aba Revendedores');\n" +
        "const totalCobertura = contarLinhas('Ler Aba Cobertura');\n" +
        "const rowsProcessed = totalProdutos + totalRevendedores + totalCobertura;\n" +
        "const rowsFailed = erros.length;\n" +
        "let status = 'success';\n" +
        "if (rowsFailed > 0 && rowsFailed < rowsProcessed) status = 'partial';\n" +
        "if (rowsFailed > 0 && rowsFailed >= rowsProcessed) status = 'failed';\n" +
        "return [{ json: {\n" +
        "  tenant_id: tenantId,\n" +
        "  source: importSource,\n" +
        "  status: status,\n" +
        "  rows_processed: rowsProcessed,\n" +
        "  rows_failed: rowsFailed,\n" +
        "  error_log: erros,\n" +
        "  completed_at: new Date().toISOString()\n" +
        "} }];"
    },
    output: [{ json: { tenant_id: 'a0000000-0000-0000-0000-000000000000', source: 'google_sheets_import', status: 'success', rows_processed: 3, rows_failed: 0, error_log: [], completed_at: '2026-09-11T00:00:00.000Z' } }]
  }
});

const supabaseCreateImportBatch = node({
  type: 'n8n-nodes-base.supabase',
  version: 1,
  config: {
    name: 'Registrar Lote de Importação',
    parameters: {
      resource: 'row',
      operation: 'create',
      tableId: 'import_batches',
      dataToSend: 'defineBelow',
      fieldsUi: {
        fieldValues: [
          { fieldId: 'tenant_id', fieldValue: expr('{{ $json.tenant_id }}') },
          { fieldId: 'source', fieldValue: expr('{{ $json.source }}') },
          { fieldId: 'status', fieldValue: expr('{{ $json.status }}') },
          { fieldId: 'rows_processed', fieldValue: expr('{{ $json.rows_processed }}') },
          { fieldId: 'rows_failed', fieldValue: expr('{{ $json.rows_failed }}') },
          { fieldId: 'error_log', fieldValue: expr('{{ $json.error_log }}') },
          { fieldId: 'completed_at', fieldValue: expr('{{ $json.completed_at }}') }
        ]
      }
    },
    credentials: { supabaseApi: newCredential('Supabase - GeoLynq (service_role)') },
    output: [{ json: { id: 'f0000000-0000-0000-0000-000000000000', status: 'success' } }]
  }
});

const setupNote = sticky(
  '## Antes de ativar\n' +
  '1. Criar a planilha real no Google Drive a partir do modelo (docs/planilha-modelo-catalogo.xlsx) e selecioná-la nos 3 nós "Ler Aba ..." (picker de spreadsheet).\n' +
  '2. Criar a credencial Supabase (Project URL + service_role key) e vincular nos nós "Criar ... no Supabase".\n' +
  '3. Editar o campo tenant_id no nó "Parâmetros da Importação" antes de cada execução (um tenant por rodada).',
  [startTrigger, paramsNode],
  { color: 4 }
);

const coberturaChain = codeValidarCobertura.to(
  ifCoberturaValida.onTrue(supabaseCreateCobertura).onFalse(mergeErros.input(5))
);

const enderecoChain = httpViaCep.to(
  httpNominatim.to(codeMontarEndereco.to(supabaseCreateEnderecos.to(coberturaChain)))
);

const revendedorChain = codeValidarRevendedores.to(
  ifRevendedorValido.onTrue(supabaseCreateRevendedores.to(enderecoChain)).onFalse(mergeErros.input(3))
);

const produtoChain = codeValidarProdutos.to(
  ifProdutoValido.onTrue(supabaseCreateProdutos.to(revendedorChain)).onFalse(mergeErros.input(1))
);

supabaseCreateProdutos.onError(mergeErros.input(0));
supabaseCreateRevendedores.onError(mergeErros.input(2));
supabaseCreateEnderecos.onError(mergeErros.input(4));
supabaseCreateCobertura.onError(mergeErros.input(6));

export default workflow('geolynq-import-catalogo', 'GeoLynq — Import Catálogo')
  .add(startTrigger)
  .to(paramsNode.to(readProdutos.to(readRevendedores.to(readCobertura.to(produtoChain)))))
  .add(mergeErros)
  .to(codeMontarResumo.to(supabaseCreateImportBatch))
  .add(setupNote);
