# Avatares e aparência por conta

A identidade é o UID autenticado do Firebase, correspondente à conta usada no login por e-mail/Google. Não usar o endereço de e-mail como chave: o usuário pode alterá-lo sem perder o avatar. Não unificar UIDs diferentes automaticamente.

## Contratos

- avatars/{uid}: ownerUid, revision, config. A receita compacta usa o catálogo local; não aceita HTML, SVG externo ou campos extras. O UID de destino é o proprietário, mesmo quando seu parceiro edita.
- Ambos os integrantes ativos podem editar ambos os avatares, conforme confirmação do usuário. A autorização exige perfis apontando ao mesmo casal, UIDs reais no documento do casal e ausência de desligamento. Ter apenas um coupleId no cliente não concede acesso.
- accountPreferences/{uid}: ownerUid, version:1, revision, preferences com themeMode, accentTheme, coupleTheme, partner1Theme e partner2Theme. Somente a própria conta acessa essas preferências. Valores financeiros e vínculos não fazem parte desse documento.

## Gravação e confirmação

POST /api/avatars/save mantém a API existente com autenticação e transação, validando o vínculo compartilhado dentro da mesma transação da gravação. O cliente exige uma resposta com proprietário, revisão e receita correspondentes ao pedido. Resposta vazia, HTML da prévia ou receita incompatível não contam como salvamento.

Se a API estiver indisponível/incompatível, o SDK Firebase existente pode salvar em transação sujeita às mesmas regras. Não há setDoc incondicional para contornar conflito. Revisões antigas preservam o rascunho e oferecem revisão explícita; repetir a última gravação idêntica é seguro. Não usar a recuperação para contornar403,400,409ou429. Sem conexão, uma transação não confirma sucesso nem fecha o editor.

O destino do parceiro vem do vínculo verificado e existe independentemente de ele já ter um boneco. Um integrante ainda não vinculado nunca é convertido no próprio usuário durante o salvamento. Respostas atrasadas não substituem revisões mais novas, inclusive do parceiro. Trocar conta/casal encerra assinaturas antigas.

## Compatibilidade

Receitas exatas da versão1 anterior ao campo gender continuam legíveis, preservando as outras escolhas; somente esse campo recebe o padrão. Novas gravações exigem a receita completa atual. Dados inválidos não viram receitas válidas por normalização genérica.

A migração do legado avatarProfiles lê novamente o proprietário e o vínculo, copia apenas o próprio avatar e não sobrescreve o documento pessoal existente. O caminho SDK inicia o documento pessoal na revisão1; a API mantém a revisão legada. A revisão é controle do documento de destino, não identidade. O legado não é apagado. Demonstração permanece local e a importação exige prévia/confirmação.

## Aparência

Somente ações explícitas nas cores/tema provocam gravações. O cache financeiro não é enviado como preferências. Após hidratar o cache próprio do UID, a aparência atual permanece visível enquanto a nuvem carrega. Documento remoto existente tem prioridade; documento ausente oferece Salvar aparência atual nesta conta, sem copiar automaticamente preferências da demonstração ou de outra conta. O primeiro ajuste explícito preserva as outras cores visíveis. Transações mesclam campos na última revisão para preservar alterações em outros dispositivos. Falhas mantêm as escolhas e oferecem nova tentativa.

## Publicação e validação

Publicar as regras no projectId e no firestoreDatabaseId de firebase-applet-config.json antes de disponibilizar o frontend. Preservar backup das regras anteriores e confirmar que a release ativa corresponde ao arquivo aprovado. Atualizar frontend e servidor juntos no AI Studio.

Testes unitários, regras no emulador e transações reais do SDK no emulador cobrem as correções. Isso não substitui o teste final com duas contas reais no ambiente publicado. Arte, editor, animações, fontes, temas disponíveis, configuração Firebase/Gemini e cálculos financeiros foram preservados.
