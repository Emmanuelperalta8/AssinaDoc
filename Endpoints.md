# Endpoints — AssinaDoc API

Base URL: `http://localhost:3001`

---

## POST /register
**Acesso:** público  
**Descrição:** Cria usuário e gera par de chaves RSA-2048

### Request
```json
{
  "username": "peralta",
  "password": "123"
}
```

### Response 200 — sucesso
```json
{
  "message": "Usuário criado!",
  "userId": "40091d9e-199c-4161-b3ed-1d49831590e7",
  "username": "peralta"
}
```

### Response 400 — campos faltando
```json
{ "error": "Username e password são obrigatórios." }
```

### Response 409 — username já existe
```json
{ "error": "Username já existe." }
```

---

## POST /login
**Acesso:** público  
**Descrição:** Autentica o usuário e retorna token de acesso

### Request
```json
{
  "username": "peralta",
  "password": "123"
}
```

### Response 200 — sucesso
```json
{
  "token": "NDAwOTFkOWUtMTk1Yy00MTYx...",
  "userId": "40091d9e-199c-4161-b3ed-1d49831590e7",
  "username": "peralta"
}
```

### Response 401 — credenciais inválidas
```json
{ "error": "Credenciais inválidas." }
```

---

## POST /sign
**Acesso:** autenticado 🔒  
**Descrição:** Assina um texto com a chave privada do usuário logado  
**Header obrigatório:** `Authorization: Bearer <token>`

### Request
```json
{
  "text": "Eu, peralta, autorizo este documento em 2025."
}
```

### Response 200 — sucesso
```json
{
  "signatureId": "fb2c1853-1ed8-45e7-8d69-f362d075993f",
  "hash": "6f836aab9147844b206eb95a0264b237b8d1308def0a144ecc026f39ef667456",
  "algorithm": "RSA-SHA256",
  "createdAt": "2026-03-18T19:45:04.185Z"
}
```

### Response 400 — texto faltando
```json
{ "error": "Texto é obrigatório." }
```

### Response 401 — sem token
```json
{ "error": "Token não fornecido." }
```

---

## GET /verify/:id
**Acesso:** público 🌐  
**Descrição:** Verifica uma assinatura pelo ID — persiste log automaticamente

### Request
```
GET /verify/fb2c1853-1ed8-45e7-8d69-f362d075993f
```

### Response 200 — assinatura VÁLIDA
```json
{
  "valid": true,
  "signatureId": "fb2c1853-1ed8-45e7-8d69-f362d075993f",
  "signer": "peralta",
  "algorithm": "RSA-SHA256",
  "textHash": "6f836aab9147844b206eb95a0264b237...",
  "createdAt": "2026-03-18T19:45:04.185Z",
  "verifiedAt": "2026-03-18T19:47:51.878Z"
}
```

### Response 200 — assinatura INVÁLIDA
```json
{
  "valid": false,
  "signatureId": "fb2c1853-1ed8-45e7-8d69-f362d075993f",
  "signer": "peralta",
  "algorithm": "RSA-SHA256",
  "textHash": "6f836aab...",
  "createdAt": "2026-03-18T19:45:04.185Z",
  "verifiedAt": "2026-03-18T19:47:51.878Z"
}
```

### Response 404 — ID não encontrado
```json
{
  "valid": false,
  "error": "Assinatura não encontrada."
}
```

---

## POST /verify/manual
**Acesso:** público 🌐  
**Descrição:** Verifica colando texto + assinatura base64 + username — persiste log automaticamente

### Request
```json
{
  "username": "peralta",
  "text": "Eu, peralta, autorizo este documento em 2025.",
  "signature": "oAQjbpPZgT1QrPgMLNjyWPGEglgLh+Ov1bUXt0JFekQjFjpqu..."
}
```

### Response 200 — VÁLIDA
```json
{
  "valid": true,
  "signer": "peralta",
  "algorithm": "RSA-SHA256",
  "verifiedAt": "2026-03-18T19:49:26.229Z"
}
```

### Response 200 — INVÁLIDA (assinatura adulterada)
```json
{
  "valid": false,
  "signer": "peralta",
  "algorithm": "RSA-SHA256",
  "verifiedAt": "2026-03-18T19:49:26.229Z"
}
```

### Response 404 — usuário não encontrado
```json
{
  "valid": false,
  "error": "Usuário não encontrado."
}
```

---

## GET /my-signatures
**Acesso:** autenticado 🔒  
**Descrição:** Lista todas as assinaturas do usuário logado  
**Header obrigatório:** `Authorization: Bearer <token>`

### Request
```
GET /my-signatures
Authorization: Bearer <token>
```

### Response 200
```json
[
  {
    "id": "fb2c1853-1ed8-45e7-8d69-f362d075993f",
    "textContent": "Eu, peralta, autorizo este documento em 2025.",
    "textHash": "6f836aab9147844b206eb95a0264b237...",
    "algorithm": "RSA-SHA256",
    "createdAt": "2026-03-18T19:45:04.185Z"
  },
  {
    "id": "e9c312da-4859-4767-93bf-...",
    "textContent": "teste peralta",
    "textHash": "36bb67a12b7aa6c56eea1cf...",
    "algorithm": "RSA-SHA256",
    "createdAt": "2026-03-18T19:23:08.396Z"
  }
]
```

### Response 401 — sem token
```json
{ "error": "Token não fornecido." }
```

---

## Resumo

| Método | Rota | Acesso | Descrição |
|--------|------|--------|-----------|
| POST | `/register` | público | Cria usuário + gera chaves RSA |
| POST | `/login` | público | Autentica + retorna token |
| POST | `/sign` | 🔒 token | Assina texto com chave privada |
| GET | `/verify/:id` | público | Verifica assinatura por ID |
| POST | `/verify/manual` | público | Verifica colando texto + assinatura |
| GET | `/my-signatures` | 🔒 token | Lista assinaturas do usuário |