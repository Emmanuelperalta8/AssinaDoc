const express    = require('express');
const cors       = require('cors');
const crypto     = require('crypto');
const { PrismaClient } = require('@prisma/client');

const app    = express();
const prisma = new PrismaClient();

app.use(cors());
app.use(express.json());

// ── Helpers ─────────────────────────────────────────────────
function hashPassword(password) {
  return crypto.createHash('sha256').update(password + '_salt_fixo').digest('hex');
}

// FUNÇÃO QUE CRIA OS PARES DE CHAVES PARÇA
function generateKeyPair() {
  return crypto.generateKeyPairSync('rsa', {
    modulusLength: 2048,
    publicKeyEncoding:  { type: 'spki',  format: 'pem' }, 
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
  });
}

function signText(text, privateKeyPem) {
  const sign = crypto.createSign('RSA-SHA256');
  sign.update(text);
  sign.end();
  return sign.sign(privateKeyPem, 'base64');
}

function verifySignature(text, signatureB64, publicKeyPem) {
  try {
    const verify = crypto.createVerify('RSA-SHA256');
    verify.update(text);
    verify.end();
    return verify.verify(publicKeyPem, signatureB64, 'base64');
  } catch {
    return false;
  }
}

// ── Middleware de auth ───────────────────────────────────────
async function authMiddleware(req, res, next) {
  const auth = req.headers.authorization;
  if (!auth) return res.status(401).json({ error: 'Token não fornecido.' });
  try {
    const [userId] = Buffer.from(auth.replace('Bearer ', ''), 'base64')
      .toString().split(':');
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new Error();
    req.user = user;
    next();
  } catch {
    res.status(401).json({ error: 'Token inválido.' });
  }
}

// ── POST /register ───────────────────────────────────────────
app.post('/register', async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password)
    return res.status(400).json({ error: 'Username e password são obrigatórios.' });

  const exists = await prisma.user.findUnique({ where: { username } });
  if (exists)
    return res.status(409).json({ error: 'Username já existe.' });

  const { publicKey, privateKey } = generateKeyPair();

  const user = await prisma.user.create({
    data: {
      username,
      passwordHash: hashPassword(password),
      publicKey,
      privateKey,
    },
  });

  res.json({ message: 'Usuário criado!', userId: user.id, username: user.username });
});

// ── POST /login ──────────────────────────────────────────────
app.post('/login', async (req, res) => {
  const { username, password } = req.body;
  const user = await prisma.user.findUnique({ where: { username } });
  if (!user || user.passwordHash !== hashPassword(password))
    return res.status(401).json({ error: 'Credenciais inválidas.' });

  const token = Buffer.from(`${user.id}:${Date.now()}`).toString('base64');
  res.json({ token, userId: user.id, username: user.username });
});

// ── POST /sign  (autenticado) ────────────────────────────────
app.post('/sign', authMiddleware, async (req, res) => {
  const { text } = req.body;
  if (!text) return res.status(400).json({ error: 'Texto é obrigatório.' });

  const hash = crypto.createHash('sha256').update(text).digest('hex');
  const sig  = signText(text, req.user.privateKey);

  const saved = await prisma.signature.create({
    data: {
      userId:      req.user.id,
      textContent: text,
      textHash:    hash,
      signature:   sig,
      algorithm:   'RSA-SHA256',
    },
  });

  res.json({
    signatureId: saved.id,
    hash:        saved.textHash,
    algorithm:   saved.algorithm,
    createdAt:   saved.createdAt,
  });
});

// ── Helper: resolve ID (UUID ou DOC-XXXX-XXXX-XXXX) ─────────
async function resolveSignature(id) {
  const docMatch = id.match(/^DOC-([0-9A-Fa-f]{4})-([0-9A-Fa-f]{4})-([0-9A-Fa-f]{4})$/i);
  if (docMatch) {
    const prefix = (docMatch[1] + docMatch[2] + docMatch[3]).toLowerCase();
    return prisma.signature.findFirst({
      where:   { textHash: { startsWith: prefix } },
      include: { user: true },
    });
  }
  return prisma.signature.findUnique({
    where:   { id },
    include: { user: true },
  });
}

// ── GET /verify/:id  (público) — aceita somente UUID ─────────
app.get('/verify/:id', async (req, res) => {
  const ip  = req.ip;
  const sig = await prisma.signature.findUnique({
    where:   { id: req.params.id },
    include: { user: true },
  });

  if (!sig) {
    await prisma.verificationLog.create({
      data: { signatureId: null, result: 'NOT_FOUND', ipAddress: ip, notes: 'ID não encontrado' },
    });
    return res.status(404).json({ valid: false, error: 'Assinatura não encontrada.' });
  }

  const isValid = verifySignature(sig.textContent, sig.signature, sig.user.publicKey);

  await prisma.verificationLog.create({
    data: { signatureId: sig.id, result: isValid ? 'VALID' : 'INVALID', ipAddress: ip },
  });

  res.json({
    valid:       isValid,
    signatureId: sig.id,
    signer:      sig.user.username,
    algorithm:   sig.algorithm,
    textHash:    sig.textHash,
    createdAt:   sig.createdAt,
    verifiedAt:  new Date(),
  });
});

// ── POST /verify/manual  (público) ──────────────────────────
app.post('/verify/manual', async (req, res) => {
  const { text, signature, username } = req.body;
  const ip   = req.ip;
  const user = await prisma.user.findUnique({ where: { username } });

  if (!user) {
    await prisma.verificationLog.create({
      data: { result: 'USER_NOT_FOUND', ipAddress: ip, notes: `Username: ${username}` },
    });
    return res.status(404).json({ valid: false, error: 'Usuário não encontrado.' });
  }

  const isValid = verifySignature(text, signature, user.publicKey);

  await prisma.verificationLog.create({
    data: {
      result:    isValid ? 'VALID' : 'INVALID',
      ipAddress: ip,
      notes:     `Verificação manual: ${username}`,
    },
  });

  res.json({ valid: isValid, signer: user.username, algorithm: 'RSA-SHA256', verifiedAt: new Date() });
});

// ── POST /verify/by-key  (público) ───────────────────────────
app.post('/verify/by-key', async (req, res) => {
  const { signatureId, publicKey } = req.body;
  const ip = req.ip;

  if (!signatureId || !publicKey)
    return res.status(400).json({ error: 'signatureId e publicKey são obrigatórios.' });

  const sig = await resolveSignature(signatureId);

  if (!sig) {
    await prisma.verificationLog.create({
      data: { signatureId: null, result: 'NOT_FOUND', ipAddress: ip, notes: 'Verificação por chave: ID não encontrado' },
    });
    return res.status(404).json({ valid: false, error: 'Documento não encontrado.' });
  }

  const isValid = verifySignature(sig.textContent, sig.signature, publicKey);

  await prisma.verificationLog.create({
    data: { signatureId: sig.id, result: isValid ? 'VALID' : 'INVALID', ipAddress: ip, notes: 'Verificação por chave fornecida' },
  });

  res.json({
    valid:       isValid,
    signatureId: sig.id,
    signer:      sig.user.username,
    algorithm:   sig.algorithm,
    textHash:    sig.textHash,
    createdAt:   sig.createdAt,
    verifiedAt:  new Date(),
  });
});

// ── GET /my-signatures  (autenticado) ────────────────────────
app.get('/my-signatures', authMiddleware, async (req, res) => {
  const sigs = await prisma.signature.findMany({
    where:   { userId: req.user.id },
    orderBy: { createdAt: 'desc' },
    select:  { id: true, textContent: true, textHash: true, algorithm: true, createdAt: true },
  });
  res.json(sigs);
});

// ── Start ─────────────────────────────────────────────────────
const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`✅ Backend em http://localhost:${PORT}`));
module.exports = app;



// ── GET /profile  (autenticado) ──────────────────────────────
app.get('/profile', authMiddleware, async (req, res) => {
  res.json({
    userId:     req.user.id,
    username:   req.user.username,
    publicKey:  req.user.publicKey,
    privateKey: req.user.privateKey,
    createdAt:  req.user.createdAt,
  });
});

// ── GET /public-keys  (público) ──────────────────────────────
app.get('/public-keys', async (_req, res) => {
  const users = await prisma.user.findMany({
    orderBy: { createdAt: 'asc' },
    select:  { id: true, username: true, publicKey: true, createdAt: true },
  });
  res.json(users);
});