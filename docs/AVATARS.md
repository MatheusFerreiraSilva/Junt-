# Avatares do casal

O editor fica em Ajustes → Nossos avatares e no atalho do dashboard. Usa arte SVG local de rosto/corpo, sem IA, fotos ou dependências novas. Catálogo e configuração são versionados e validados por whitelist, sem aceitar SVG/HTML externo. Todas as opções estão disponíveis a qualquer integrante.

## Comportamento

- Prévia, grupos de aparência, desfazer/refazer, combinação aleatória e reinício alteram somente o rascunho. Cancelar não publica; fechar com alterações pede confirmação.
- Tema claro/escuro preserva cores escolhidas. Hover suave respeita redução de movimento.
- Seletores mostram rosto ou iniciais; dashboard mostra uma pessoa ou o casal conforme o filtro, sem alterar a identidade autenticada.
- Demonstração: escolhas de ambas as pessoas ficam em junto-demo-avatars-v1 no aparelho. Não são copiadas automaticamente ao entrar em conta.
- Conta vinculada: cada UID salva apenas seu avatar. O parceiro pode visualizá-lo. Não é possível editar um convidado ainda não vinculado.
- Sem rede, o rascunho permanece aberto com erro de confirmação; não há promessa de publicação offline nem fila automática de salvamento.

## Persistência e integridade

POST /api/couples/avatar usa a autenticação existente e recebe coupleId, config e expectedRevision. O servidor deriva o integrante dos UIDs reais e revalida perfil/vínculo/saída em transação. Salva apenas avatarProfiles no documento do casal, em registros ownerUid/revision/config. Revisão antiga conflita; repetir a última gravação idêntica após perda de resposta é idempotente. Alterações de ambos os integrantes preservam as duas receitas de avatar. Não altera saldos, categorias, contratos financeiros ou inicialização Firebase/Gemini.

A rota e sua cota usam o firestoreDatabaseId já configurado no frontend. A extensão opcional de fábrica em userQuota não muda as demais rotas. Regras existentes permitem leitura do documento aos membros e impedem que clientes escrevam avatarProfiles diretamente; nenhum deploy de regras ou nova variável é necessário. Servidor e frontend devem ser publicados juntos usando a build existente. O ambiente precisa ter a autenticação e as credenciais Admin atuais funcionais.

Escolhas estão no documento do casal, vinculadas ao UID original. Trocar nome não troca avatar; sair do casal remove o acesso ao documento e não copia escolhas a outro vínculo. Exportar extrato CSV/OFX continua exportando transações, não perfil/avatar.

## Validação

Testes automatizados cobrem whitelist, SVG seguro/IDs, edição e cancelamento, erros/retry, isolamento de sessão e modo local, autorização da API, banco configurado, concorrência e conflito. A suíte completa, lint, tipos, build cliente/PWA/servidor e smoke de produção devem passar antes da publicação. A validação de duas sessões reais no Firebase de produção exige acesso ao ambiente e não é simulada por esses testes.

Uma alteração exclusivamente de avatar no documento do casal não reidrata metadados financeiros. A validação de vínculo continua ocorrendo antes desse filtro. Isso preserva alterações financeiras locais que ainda aguardam o debounce de salvamento. Respostas HTTP de avatar também não substituem uma revisão remota mais recente.
