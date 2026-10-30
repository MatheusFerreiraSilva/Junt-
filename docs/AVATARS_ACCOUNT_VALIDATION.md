# Validação — avatares por conta

Base762acc46db8de1d16e09f149f95b5a57a5b23aec. Mudança aditiva para avatars/{uid}; legado do casal preservado.

- Vitest local:31arquivos e182testes aprovados, com --maxWorkers=1.
- Backend:15cenários de autoria, gravação semcasal, revisão, repetição, migração e autorização.
- Frontend/helper:24cenários focados de conta independente, parceiro, sessão, migração, importação local, conflito e metadados de erro aprovados.
- Emulador local bloqueado:Java8 instalado, firebase-tools exigeJava21. WorkflowCI incluiJava21 e execução da suíte de regras; não considerar a validação de regras concluída antes desse job passar.
- Nenhuma gravação de avatar com contas reais em produção foi feita nesta validação. A autorização do CLI e a publicação das regras do banco nomeado são gates anteriores à ativação da interface.

Typecheck e ESLint completos aprovados. Build cliente/PWA e servidor aprovados. Smoke de produção aprovado após repetição com cache de dependências aquecido; a primeira tentativa local excedeu a inicialização sem saída, e a investigação isolou importação lenta de firebase-admin/firestore no Windows. Nenhuma dependência ou timeout de produção foi alterado para passar. O CI fará confirmação independente.
