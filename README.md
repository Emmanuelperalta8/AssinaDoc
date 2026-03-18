# 🔐 AssinaDoc — Assinador Digital Web

Aplicação web para assinatura e verificação digital de documentos usando criptografia RSA-2048 + SHA-256.

Materia: Segurança de Sistemas
---

## 👥 Dupla

- Emmanuel Peralta

---

## ⚙️ Pré-requisitos

Antes de rodar, instale:

- [Node.js 18+](https://nodejs.org) — para rodar o backend
- [Git](https://git-scm.com) — para clonar o repositório

Verifique se estão instalados:
```bash
node --version   # deve mostrar v18 ou superior
npm --version    # deve mostrar 8 ou superior
```

---

## 🚀 Como rodar

### 1. Clonar o repositório

```bash
git clone https://github.com/seu-usuario/digital-signer.git
cd digital-signer
```

---

### 2. Instalar dependências do backend

```bash
cd backend
npm install
```

---

### 3. Configurar o banco de dados

O banco já está hospedado na nuvem (**Neon / PostgreSQL**).
O arquivo `.env` já contém a conexão configurada — **não precisa instalar nada localmente**.

Rode apenas para criar as tabelas:

```bash
npx prisma generate
npx prisma db push
```

---

### 4. Iniciar o backend

```bash
node server.js
```

Deve aparecer:
```
✅ Backend em http://localhost:3001
```

> Deixe este terminal aberto.

---

### 5. Abrir o frontend

Abra um **novo terminal** e rode:

```bash
cd frontend
python3 -m http.server 8080
```

Acesse no navegador: **http://localhost:8080**

> Se não tiver Python, use:
> ```bash
> cd frontend
> npx serve .
> ```

---

### 6. Rodar os testes (opcional)

Abra um **novo terminal** com o backend já rodando:

```bash
cd backend
node tests/run_tests.js
```

Resultado esperado:
```
🔐 TESTES DE INTEGRAÇÃO — AssinaDoc
====================================
📋 Suite 1: Cadastro
  ✅ Cadastro retorna 200
  ✅ Retorna userId
  ✅ Username duplicado → 409

🔑 Suite 2: Login
  ✅ Login retorna 200
  ✅ Retorna token
  ✅ Senha errada → 401

✍️  Suite 3: Assinatura
  ✅ Assinar retorna 200
  ✅ Retorna signatureId
  ✅ Retorna hash SHA-256
  ✅ Sem token → 401

✅ Suite 4: Verificação POSITIVA
  ✅ ⭐ valid === true → VÁLIDA
  ✅ Signatário correto
  ✅ Algoritmo presente
  ✅ Data de verificação presente

❌ Suite 5: Verificação NEGATIVA
  ✅ ⭐ ID falso → valid === false → INVÁLIDA
  ✅ ⭐ Assinatura adulterada → valid === false → INVÁLIDA
  ✅ ⭐ Texto adulterado → valid === false → INVÁLIDA
  ✅ ⭐ Usuário errado → valid === false → INVÁLIDA

📝 Suite 6: Logs de verificação
  ✅ verifiedAt presente → log persistido no banco

════════════════════════════════════
RESULTADO: 16 passaram | 0 falharam
🎉 TODOS OS TESTES PASSARAM!
```

---

## 📁 Estrutura do projeto

```
digital-signer/
├── README.md           → este arquivo
├── FLUXO.md            → fluxo completo da aplicação
├── ENDPOINTS.md        → documentação de todos os endpoints
├── backend/
│   ├── server.js       → servidor Express principal
│   ├── package.json    → dependências do projeto
│   ├── .env            → configuração do banco (Neon)
│   ├── migration.sql   → schema SQL de referência
│   ├── prisma/
│   │   └── schema.prisma → models do banco de dados
│   └── tests/
│       └── run_tests.js  → testes de integração
└── frontend/
    └── index.html      → SPA em React (sem build)
```

---

## 🗄️ Banco de dados

**PostgreSQL** hospedado no [Neon](https://neon.tech) via Prisma ORM.
Não é necessário instalar banco localmente — a `DATABASE_URL` já está no `.env`.

| Tabela | O que armazena |
|--------|---------------|
| `users` | Usuários + par de chaves RSA (pública e privada) |
| `signatures` | Texto, hash SHA-256, assinatura RSA, algoritmo |
| `verification_logs` | Log de toda verificação realizada |

Para visualizar os dados:
```bash
cd backend
npx prisma studio
# Abre em http://localhost:5555
```

---

## 🔌 Endpoints resumo

| Método | Rota | Acesso | Descrição |
|--------|------|--------|-----------|
| POST | `/register` | público | Cria usuário + gera chaves RSA |
| POST | `/login` | público | Autentica + retorna token |
| POST | `/sign` | 🔒 token | Assina texto com chave privada |
| GET | `/verify/:id` | público | Verifica assinatura por ID |
| POST | `/verify/manual` | público | Verifica colando texto + assinatura |
| GET | `/my-signatures` | 🔒 token | Lista assinaturas do usuário |

Documentação completa em `ENDPOINTS.md`.

---

## 🧪 Casos de teste

| Tipo | Teste | Resultado esperado |
|------|-------|--------------------|
| ✅ Positivo | Verificar assinatura válida por ID | `valid: true` |
| ❌ Negativo | Verificar ID inexistente | `valid: false` |
| ❌ Negativo | Verificar assinatura adulterada | `valid: false` |
| ❌ Negativo | Verificar texto adulterado | `valid: false` |

---

## 🔐 Tecnologias

| Item | Tecnologia |
|------|-----------|
| Backend | Node.js + Express |
| Criptografia | crypto (nativo Node.js) |
| Banco de dados | PostgreSQL (Neon) |
| ORM | Prisma |
| Frontend | React 18 (via CDN) |
| Algoritmo | RSA-2048 + SHA-256 |