# Avatares pessoais e compartilhamento

O avatar pertence à conta autenticada (UID). O casal apenas determina quem pode visualizar o outro perfil. Editor, arte, animações, temas e cálculos financeiros foram preservados.

## Armazenamento e API

Documento avatars/{uid}: ownerUid, revision, config (com versão própria). POST /api/avatars/save recebe config e expectedRevision sem depender de coupleId. Autorização vem da sessão verificada, nunca do payload. Revisão otimista e repetição idempotente evitam duplicidade. Conflito409 fornece currentAvatar para resolver explicitamente sem perder o rascunho. A rota antiga valida seu contexto e adapta a gravação para o documento pessoal.

POST /api/avatars/migrate copia legado próprio de avatarProfiles do casal somente se não existe perfil pessoal e o vínculo/proprietário são válidos. Dados pessoais existentes vencem; legado não é apagado. Demonstração fica local e importação exige escolha/prévia/confirmar como avatar próprio.

## Leitura e sessão

Firestore permite get próprio a contas não anônimas e get do parceiro apenas quando ambos os perfis apontam ao mesmo casal e os UIDs do casal estão ativos. Não permite listar coleção ou gravar diretamente. Não compartilha documentos users nem dados financeiros. Listeners separados acompanham o próprio avatar e o parceiro autorizado; saída do casal encerra acesso ao parceiro e mantém o próprio. Sessão/vínculo mudado limpa assinaturas antigas.

## Publicação coordenada

1. Aprovar testes unitários, tipos, lint, builds, smoke e regras em emulador/CI.
2. Publicar firestore.rules no banco nomeado indicado por firestoreDatabaseId em firebase-applet-config.json, no projectId desse arquivo. Não aplicar por engano só ao banco(default). Comparar primeiro as regras publicadas com este arquivo: a publicação também pode ativar restrições de vínculo que já existiam no repositório. Confirmar compatibilidade das gravações atuais, inclusive divisões personalizadas. Fazer backup do ruleset anterior.
3. Integrar/públicar servidor e frontend juntos somente após regras confirmadas. Nenhuma migração destrutiva ou nova dependência é necessária.
4. Em contas reais autorizadas, testar dois dispositivos, convite, alterações recíprocas e saída. Registrar evidência separadamente dos testes simulados.

Sem rede, o rascunho é mantido e a falha de confirmação aparece; não há fila automática nem promessa de salvamento offline. Não remova regras durante rollback de frontend sem considerar clientes já atualizados.

## Compatibilidade verificada antes da publicação

O banco nomeado é compartilhado por frontend, avatares e agora também pelas rotas de criação/convite/entrada/saída do casal e pelas quotas do servidor. A auditoria em 30/10/2026 consultou apenas metadados de vínculo: um usuário vinculado, um casal e nenhuma inconsistência detectada. O banco(default) retornou inexistente. Nenhum documento foi copiado, alterado ou removido nessa auditoria.

As regras publicadas anteriormente eram mais permissivas que as do repositório. É necessário proteger a autoria dos vínculos para impedir que terceiros se declarem parceiros e leiam avatares. A lista de pagadores/destinatários mantém o valor custom já previsto pelo tipo PaidBy do aplicativo.
