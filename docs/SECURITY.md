# Segurança

## Regras do Firestore (aplicadas)

As regras em `firestore.rules` foram endurecidas:

- **`users/{uid}`**: cada usuário só lê/escreve o próprio perfil.
- **`couples/{coupleId}`**:
  - leitura/escrita apenas para membros do casal;
  - criação exige que `partner1Uid` seja o UID de quem está criando;
  - o vínculo é reconhecido por `users/{uid}.coupleId` **ou** pelos campos `partner1Uid` / `partner2Uid` no documento do casal;
  - subcoleções herdam a mesma verificação;
  - **não existe `list`**: um cliente não consegue enumerar casais.
- **`coupleInvites/{code}`**:
  - guarda apenas `coupleId`, `createdAt` e `createdBy`;
  - qualquer usuário autenticado com o código pode fazer `get` (é o mecanismo do convite);
  - criar/atualizar/apagar exige ser membro do casal;
  - **não existe `list`**: códigos não podem ser enumerados.

### Como funciona o vínculo

1. No cadastro, o documento do casal nasce com `partner1Uid` e o app cria `coupleInvites/{code}`.
2. Ao entrar com código de convite, o app:
   - faz `get` em `coupleInvites/{code}` para descobrir o `coupleId`;
   - atualiza `users/{uid}.coupleId`;
   - lê o documento do casal (agora permitido);
   - grava `partner2Uid` e `partner2Name`;
   - se o casal já tiver outro `partner2Uid`, desfaz o vínculo e mostra erro.
3. Ao gerar um novo código, o app cria o novo `coupleInvites/{code}`, atualiza o casal e apaga o convite antigo.
4. Casais antigos recebem backfill automático:
   - `partner1Uid`/`partner2Uid` no primeiro carregamento do membro correspondente;
   - `coupleInvites/{code}` quando o parceiro 1 abre o app.

### Migração de casais antigos

Se o parceiro 2 tentar entrar com um código de um casal criado antes desta versão e o convite ainda não existir, o app mostra “código inválido ou expirado”. Peça ao parceiro 1 para abrir o app (isso cria o convite) ou gerar um novo código em Ajustes.

### Limitação conhecida

A busca por convite é um `get` direto pelo código. Um atacante ainda pode tentar adivinhar códigos de 6 caracteres (espaço de ~1 bilhão) sujeito a quotas/rate limits do Firestore. Para produção em escala, recomenda-se:

- códigos de uso único com expiração;
- resolução por **Cloud Function**;
- rate limiting por IP/UID;
- notificação ao parceiro 1 quando um novo dispositivo entrar.

## Outras recomendações

- **Nunca comite** `.env`, tokens do Pluggy ou chaves privadas.
- A `apiKey` do Firebase no cliente é pública por design; proteja com regras de Firestore e domínios autorizados.
- Restrinja a `GEMINI_API_KEY` ao servidor (já é o caso).
- Adicione rate limiting nas rotas `/api/*` antes de expor publicamente (ex.: `express-rate-limit`).
- Configure cabeçalhos de segurança (CSP, HSTS) no proxy/CDN de produção.
- Faça rotação de credenciais do Pluggy e use o ambiente sandbox em desenvolvimento.
- Revise periodicamente as regras com o simulador do Firebase e mantenha um teste de integração para o fluxo de convite.
