/**
 * ============================================================
 *  TESTES DE INTEGRAÇÃO — AssinaDoc
 * ============================================================
 *  Como rodar:
 *    1. cd backend
 *    2. node server.js          (terminal 1)
 *    3. node tests/run_tests.js (terminal 2)
 * ============================================================
 */

const BASE_URL = 'http://localhost:3001';

const USER = { username: `user_${Date.now()}`, password: 'teste123' };

let token       = '';
let signatureId = '';
let passed      = 0;
let failed      = 0;

function assert(cond, msg) {
  if (cond) {
    console.log(`  ✅ ${msg}`);
    passed++;
  } else {
    console.error(`  ❌ FALHOU: ${msg}`);
    failed++;
  }
}

async function req(method, path, body, tok) {
  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(tok ? { Authorization: `Bearer ${tok}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  return { status: res.status, data: await res.json() };
}

async function testCadastro() {
  console.log('\n📋 Suite 1: Cadastro');
  const r1 = await req('POST', '/register', USER);
  assert(r1.status === 200,  'Cadastro retorna 200');
  assert(!!r1.data.userId,   'Retorna userId');

  const r2 = await req('POST', '/register', USER);
  assert(r2.status === 409,  'Username duplicado → 409');
}

async function testLogin() {
  console.log('\n🔑 Suite 2: Login');
  const r1 = await req('POST', '/login', USER);
  assert(r1.status === 200, 'Login retorna 200');
  assert(!!r1.data.token,   'Retorna token');
  token = r1.data.token;

  const r2 = await req('POST', '/login', { username: USER.username, password: 'errada' });
  assert(r2.status === 401, 'Senha errada → 401');
}

async function testAssinatura() {
  console.log('\n✍️  Suite 3: Assinatura');
  const r1 = await req('POST', '/sign', { text: 'Documento de teste para assinatura.' }, token);
  assert(r1.status === 200,     'Assinar retorna 200');
  assert(!!r1.data.signatureId, 'Retorna signatureId');
  assert(!!r1.data.hash,        'Retorna hash SHA-256');
  signatureId = r1.data.signatureId;

  const r2 = await req('POST', '/sign', { text: 'sem auth' });
  assert(r2.status === 401, 'Sem token → 401');
}

async function testVerificacaoPositiva() {
  console.log('\n✅ Suite 4: Verificação POSITIVA (assinatura válida)');
  const r = await req('GET', `/verify/${signatureId}`);
  assert(r.status === 200,                  'Verificação retorna 200');
  assert(r.data.valid === true,             '⭐ valid === true → VÁLIDA');
  assert(r.data.signer === USER.username,   'Signatário correto');
  assert(r.data.algorithm === 'RSA-SHA256', 'Algoritmo presente');
  assert(!!r.data.createdAt,                'Data de criação presente');
  assert(!!r.data.verifiedAt,               'Data de verificação presente');
  console.log(`\n     → Signatário : ${r.data.signer}`);
  console.log(`     → Algoritmo  : ${r.data.algorithm}`);
  console.log(`     → Verificado : ${new Date(r.data.verifiedAt).toLocaleString('pt-BR')}`);
}

async function testVerificacaoNegativa() {
  console.log('\n❌ Suite 5: Verificação NEGATIVA (assinatura inválida)');

  // Negativo 1: ID inexistente
  const r1 = await req('GET', '/verify/id-falso-que-nao-existe-00000');
  assert(r1.status === 404,       'ID inexistente → 404');
  assert(r1.data.valid === false, '⭐ ID falso → valid === false → INVÁLIDA');

  // Negativo 2: assinatura adulterada
  const r2 = await req('POST', '/verify/manual', {
    text:      'Documento de teste para assinatura.',
    signature: 'ASSINATURA_ADULTERADA_INVALIDA_AAAAAAAAAA==',
    username:  USER.username,
  });
  assert(r2.status === 200,       'Verificação manual retorna 200');
  assert(r2.data.valid === false, '⭐ Assinatura adulterada → valid === false → INVÁLIDA');

  // Negativo 3: texto adulterado
  const r3 = await req('POST', '/verify/manual', {
    text:      'Texto ALTERADO diferente do original.',
    signature: 'QUALQUER_ASSINATURA_INVALIDA==',
    username:  USER.username,
  });
  assert(r3.data.valid === false, '⭐ Texto adulterado → valid === false → INVÁLIDA');

  // Negativo 4: usuário inexistente
  const r4 = await req('POST', '/verify/manual', {
    text:      'Documento de teste para assinatura.',
    signature: 'ASSINATURA_QUALQUER==',
    username:  'usuario_que_nao_existe',
  });
  assert(r4.status === 404,       'Usuário inexistente → 404');
  assert(r4.data.valid === false, '⭐ Usuário errado → valid === false → INVÁLIDA');
}

async function testLogs() {
  console.log('\n📝 Suite 6: Logs de verificação');
  const r = await req('GET', `/verify/${signatureId}`);
  assert(!!r.data.verifiedAt,    'verifiedAt presente → log persistido no banco');
  assert(r.data.valid === true,  'Rota de verificação funcionando corretamente');
}

async function main() {
  console.log('🔐 TESTES DE INTEGRAÇÃO — AssinaDoc');
  console.log('====================================');
  console.log(`   Usuário de teste: ${USER.username}`);
  console.log(`   Backend: ${BASE_URL}`);

  try {
    await testCadastro();
    await testLogin();
    await testAssinatura();
    await testVerificacaoPositiva();
    await testVerificacaoNegativa();
    await testLogs();
  } catch (err) {
    console.error('\n💥 Erro inesperado:', err.message);
    console.error('Certifique-se de que o servidor está rodando: node server.js');
    process.exit(1);
  }

  console.log('\n════════════════════════════════════');
  console.log(`RESULTADO: ${passed} passaram | ${failed} falharam`);
  if (failed === 0) console.log('🎉 TODOS OS TESTES PASSARAM!');
  else console.log('⚠️  Alguns testes falharam.');
  process.exit(failed > 0 ? 1 : 0);
}

main();