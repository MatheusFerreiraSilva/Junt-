# JUNTÔ

Finanças e planos a dois para um casal de futuros médicos. React, TypeScript, Express, Firebase Auth/Firestore, Gemini e PWA.

Orçamento, despesas, receitas, metas, faculdade e plantões. Cada parceiro pode registrar sua própria etapa de formação e suas datas. Projeções não representam dinheiro recebido.

## Executar localmente

Use Node 22.12+ e npm. Copie .env.example para .env e configure um projeto Firebase de testes.

```sh
npm ci
npm run dev
```

O servidor abre em http://localhost:3000. A configuração web Firebase é pública; as credenciais administrativas ficam somente no servidor.

## Integrações

- APIs exigem ID token Firebase verificado. Criação, convite e saída do casal passam por transações administrativas.
- Extratos CSV são importados manualmente com prévia, identificação da conta, titular e revisão de lançamentos. Reutilize o mesmo nome de conta para identificar importações repetidas.
- IA exige GEMINI_API_KEY e GEMINI_MODEL disponível na conta. O onboarding identifica a heurística de fallback. O assistente não altera registros.
- O shell PWA pode ser armazenado em cache; bancos, IA e sincronização exigem rede. Notificações locais são verificadas com o app aberto; não há agendamento remoto garantido.

Veja [configuração e segurança](docs/BACKEND_SECURITY.md) e [migração e limitações](docs/IMPLEMENTATION.md) antes de implantar.

## Validação

```sh
npm ci
npm run lint
npm run typecheck
npm test
npm run build:all
node scripts/smoke-production.mjs
npm run test:rules
```

Testes de regras usam projeto demo isolado e exigem Java compatível com Firebase Emulator. O smoke não consome serviços externos. Build local não comprova implantação das regras remotas.

## Dados

Entidades compartilhadas usam documentos independentes e checagem de conflitos por transação. Migração incremental preserva arrays legados como backup e tombstones impedem recriação de registros excluídos. Cache separado por UID.

Totais agregados e configurações compartilhadas ainda exigem cuidado em edições simultâneas. Não implante regras ou migrações sem backup e validação em homologação. O script scripts/migrate-security.mjs opera em export local, com dry-run por padrão e sem inferir membros de perfis editáveis. Rotacione credenciais Pluggy anteriormente persistidas no cliente.

## Licença

Nenhuma licença de distribuição foi definida pelo autor neste repositório.
