# Segurança

## Regras do Firestore

As regras atuais em `firestore.rules` são permissivas:

```rules
match /couples/{coupleId} {
  allow read, write: if isAuthenticated();
  match /{allChildren=**} {
    allow read, write: if isAuthenticated();
  }
}
```

Isso significa que **qualquer usuário autenticado** consegue ler e escrever qualquer documento de casal se souber o `coupleId`. Para produção, recomenda-se:

1. Armazenar os UIDs dos membros no documento do casal:

```json
{
  "partner1Uid": "uid-do-parceiro-1",
  "partner2Uid": "uid-do-parceiro-2",
  "inviteCode": "ABC123"
}
```

2. Atualizar `partner2Uid` no fluxo `joinCoupleWithInviteCode`.
3. Aplicar regras como:

```rules
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    function isAuthenticated() {
      return request.auth != null;
    }

    function isCoupleMember(coupleId) {
      let couple = get(/databases/$(database)/documents/couples/$(coupleId)).data;
      return isAuthenticated() &&
        (request.auth.uid == couple.partner1Uid ||
         request.auth.uid == couple.partner2Uid);
    }

    match /users/{userId} {
      allow read, write: if isAuthenticated() && request.auth.uid == userId;
    }

    match /couples/{coupleId} {
      allow read: if isCoupleMember(coupleId);
      allow create: if isAuthenticated() &&
        request.resource.data.partner1Uid == request.auth.uid;
      allow update: if isCoupleMember(coupleId);
      allow delete: if false;

      match /{allChildren=**} {
        allow read, write: if isCoupleMember(coupleId);
      }
    }
  }
}
```

> Atenção: documentos antigos sem `partner1Uid`/`partner2Uid` precisam de migração antes de ativar regras estritas. Faça um backfill ou uma janela de transição.

## Outras recomendações

- **Nunca comite** `.env`, tokens do Pluggy ou chaves privadas.
- A `apiKey` do Firebase no cliente é pública por design; proteja com regras de Firestore e domínios autorizados.
- Restrinja a `GEMINI_API_KEY` ao servidor (já é o caso).
- Adicione rate limiting nas rotas `/api/*` antes de expor publicamente (ex.: `express-rate-limit`).
- Configure cabeçalhos de segurança (CSP, HSTS) no proxy/CDN de produção.
- Faça rotação de credenciais do Pluggy e use o ambiente sandbox em desenvolvimento.
