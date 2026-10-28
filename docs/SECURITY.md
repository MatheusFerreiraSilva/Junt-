# Segurança

Consulte [BACKEND_SECURITY.md](BACKEND_SECURITY.md) para configuração e contratos atuais, e [IMPLEMENTATION.md](IMPLEMENTATION.md) para migração/rollback.

A branch inclui verificação Firebase ID token nas APIs, associação por transação no servidor, convite de uso único/expiração, cotas compartilhadas, timeout de provedores e isolamento de cache por usuário/casal. Segredos Pluggy ficam somente no servidor. Regras propostas não alteram automaticamente o Firebase implantado.

Não há certificação de segurança ou validação de produção. Execute testes locais e emuladores, revise as regras, faça backup e valide homologação antes de implantar. Nunca teste acesso indevido usando dados reais. Não envie tokens ou dados financeiros em issues públicas.

Limitações conhecidas: totais financeiros agregados/configurações ainda têm operações no documento principal; a migração completa para ledger transacional permanece necessária para invariantes entre documentos. O widget bancário e o Gemini são serviços externos e exigem configuração, consentimento e conectividade. IA não possui ações financeiras autorizadas.
