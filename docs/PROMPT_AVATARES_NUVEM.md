# Upgrade: avatares da conta compartilhados com o casal

Cada avatar pertence ao UID autenticado, não ao casal. Salvar e recuperar antes do convite e após saída do casal; ao vincular, cada integrante vê atualizações em tempo real do outro. Preserve editor, arte, fontes, temas, Firebase/Gemini e finanças.

Use avatars/{uid} com configuração validada, proprietário e revisão; leitura própria e do parceiro ativo, sem listagem ou escrita direta pelo cliente. API autenticada deriva UID e rejeita demonstração anônima. Gravações com revisão antiga exigem resolução explícita; repetição idêntica é idempotente.

Migre configuração legada apenas do próprio UID, somente se ainda não existir avatar pessoal; nunca sobrescreva perfil pessoal existente. Conserve registros antigos. Ofereça prévia e confirmação para importar uma escolha local de demonstração como avatar próprio, sem atribuir o outro à conta do parceiro.

Cancele listeners e limpe dados remotos ao trocar sessão/vínculo. Após saída, mantenha assinatura própria e remova a do parceiro. Não confirme gravação offline: preserve rascunho com erro recuperável. Em conflito, carregar versão atual ou confirmar substituição sobre revisão atual.

Validar: contas independentes, vínculo/convite, atualização recíproca sem reload, perda de vínculo, leitura de terceiros negada, anonimato, listagem, edições concorrentes, retomada, migração idempotente, nenhuma alteração financeira. Rodar lint, tipos, suíte, build, smoke e regras no emulador. Publicar regras do banco nomeado antes da interface que depende delas; não alegar testes com duas contas reais se só houve fixtures/emulador.

## Ordem de aplicação

Este upgrade sucede o editor23 já concluído e precede qualquer função que dependa de perfil compartilhado. É independente da regra60/30/10. Antes do merge, executar CI e publicar regras no banco nomeado. Produção com duas contas só pode ser declarada validada após teste autorizado no ambiente real.
