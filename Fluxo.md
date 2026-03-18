# Fluxo da Aplicação — AssinaDoc

## Onde cada requisito foi implementado

---

## Requisito 1 — Cadastro com geração de chaves

### Arquivos envolvidos
- `frontend/index.html` → formulário de cadastro
- `backend/server.js` → rota `POST /register`
- `backend/prisma/schema.prisma` → tabela `users`

### Fluxo
```
Usuário preenche username + senha no frontend
        ↓
frontend/index.html
  async function submit() {
    await api('POST', '/register', { username, password })
  }
        ↓
backend/server.js  →  POST /register
  1. Verifica se username já existe
  2. generateKeyPair() → gera RSA-2048 (publicKey + privateKey)
  3. hashPassword()    → hash SHA-256 da senha
  4. prisma.user.create() → salva no banco
        ↓
banco → tabela users
  id, username, passwordHash, publicKey, privateKey, createdAt
```

---

## Requisito 2 — Área autenticada de assinatura

### Arquivos envolvidos
- `frontend/index.html` → textarea + botão Assinar
- `backend/server.js` → rota `POST /sign`
- `backend/prisma/schema.prisma` → tabela `signatures`

### Fluxo
```
Usuário digita texto no <textarea> e clica Assinar
        ↓
frontend/index.html
  async function sign() {
    await api('POST', '/sign', { text }, token)
    //                                   ↑
    //                    token no header Authorization
  }
        ↓
backend/server.js  →  POST /sign  (authMiddleware)
  1. authMiddleware → valida token → carrega req.user (com chaves)
  2. crypto.createHash('sha256').update(text) → calcula hash SHA-256
  3. signText(text, req.user.privateKey)       → assina com chave privada RSA
  4. prisma.signature.create()                 → salva no banco
  5. retorna { signatureId, hash, algorithm, createdAt }
        ↓
banco → tabela signatures
  id, userId, textContent, textHash, signature, algorithm, createdAt
        ↓
frontend exibe o ID da assinatura gerada
```

---

## Requisito 3 — Página pública de verificação

### Arquivos envolvidos
- `frontend/index.html` → página Verificar (aba Por ID + aba Manual)
- `backend/server.js` → rotas `GET /verify/:id` e `POST /verify/manual`
- `backend/prisma/schema.prisma` → tabela `verification_logs`

### Fluxo — verificação por ID
```
Qualquer pessoa (sem login) cola o ID no frontend
        ↓
frontend/index.html
  async function verifyById() {
    await api('GET', '/verify/' + id)
    // sem token — rota pública
  }
        ↓
backend/server.js  →  GET /verify/:id  (sem authMiddleware)
  1. prisma.signature.findUnique({ include: { user: true } })
     → busca assinatura + chave pública do signatário
  2. verifySignature(textContent, signature, user.publicKey)
     → verifica matematicamente → true ou false
  3. prisma.verificationLog.create() → loga o resultado
  4. retorna { valid, signer, algorithm, createdAt, verifiedAt }
        ↓
frontend exibe:
  ✓ VÁLIDA   → badge verde  + signatário + algoritmo + data/hora
  ✗ INVÁLIDA → badge vermelho
```

### Fluxo — verificação manual (texto + assinatura)
```
Qualquer pessoa cola username + texto + assinatura base64
        ↓
frontend/index.html
  async function verifyManual() {
    await api('POST', '/verify/manual', { username, text, signature })
  }
        ↓
backend/server.js  →  POST /verify/manual  (sem authMiddleware)
  1. prisma.user.findUnique({ where: { username } })
     → busca chave pública do usuário informado
  2. verifySignature(text, signature, user.publicKey)
     → verifica matematicamente → true ou false
  3. prisma.verificationLog.create() → loga o resultado
  4. retorna { valid, signer, algorithm, verifiedAt }
        ↓
frontend exibe VÁLIDA ou INVÁLIDA
```

---

## Requisito 4 — Persistência no banco de dados

### Arquivos envolvidos
- `backend/prisma/schema.prisma` → define as 3 tabelas
- `backend/server.js` → preenche as tabelas
- `backend/migration.sql` → SQL de referência

### Tabelas e quando são preenchidas

```
┌──────────────────────────────────────────────────────────┐
│  TABELA: users                                           │
│  Preenchida em: POST /register                          │
│                                                          │
│  id           → uuid único                              │
│  username     → "peralta"                               │
│  passwordHash → SHA-256 da senha                        │
│  publicKey    → chave pública RSA em PEM                │
│  privateKey   → chave privada RSA em PEM                │
│  createdAt    → timestamp do cadastro                   │
├──────────────────────────────────────────────────────────┤
│  TABELA: signatures                                      │
│  Preenchida em: POST /sign                              │
│                                                          │
│  id           → uuid único                              │
│  userId       → referência ao usuário que assinou       │
│  textContent  → texto original                          │
│  textHash     → hash SHA-256 do texto                   │
│  signature    → assinatura RSA em base64                │
│  algorithm    → "RSA-SHA256"                            │
│  createdAt    → timestamp da assinatura                 │
├──────────────────────────────────────────────────────────┤
│  TABELA: verification_logs                               │
│  Preenchida em: GET /verify/:id                         │
│                 POST /verify/manual                     │
│                                                          │
│  id           → uuid único                              │
│  signatureId  → referência à assinatura (pode ser null) │
│  verifiedAt   → timestamp da verificação                │
│  result       → VALID | INVALID | NOT_FOUND             │
│  ipAddress    → IP de quem verificou                    │
│  notes        → observações adicionais                  │
└──────────────────────────────────────────────────────────┘
```

---

## Visão geral — fluxo completo

```
CADASTRO
  frontend → POST /register → generateKeyPair() → banco (users)

LOGIN
  frontend → POST /login → valida senha → retorna token

ASSINATURA
  frontend (textarea) → POST /sign → SHA-256 + RSA → banco (signatures)
                                                          ↓
                                                    retorna ID

VERIFICAÇÃO
  qualquer pessoa → GET /verify/:id → verifySignature() → banco (logs)
                                                               ↓
                                                   VÁLIDA ou INVÁLIDA
                                                   + signatário
                                                   + algoritmo
                                                   + data/hora
```

---

## Funções de criptografia — `backend/server.js`

```
generateKeyPair()     → chamada no POST /register
                        gera publicKey + privateKey (RSA-2048)

hashPassword()        → chamada no POST /register e POST /login
                        gera SHA-256 da senha com salt

signText()            → chamada no POST /sign
                        assina texto com chave privada → base64

verifySignature()     → chamada no GET /verify/:id e POST /verify/manual
                        verifica assinatura com chave pública → true/false
```

---

## Por que a assinatura garante autoria?

```
Chave privada → só existe no servidor, associada ao usuário
             → só ela consegue gerar uma assinatura válida

Chave pública → verifica matematicamente que a assinatura
             → foi gerada pela chave privada correspondente

Se o texto for alterado     → hash muda → verificação falha → INVÁLIDA
Se a assinatura for trocada → não bate com a chave pública  → INVÁLIDA
Se o usuário for errado     → chave pública não corresponde → INVÁLIDA
```