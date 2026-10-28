# Backend autenticado e Open Finance

As rotas `/api/*` exigem `Authorization: Bearer <Firebase ID token>`, exceto `/api/health`. O UID é derivado exclusivamente do token verificado e revogações são verificadas. O servidor precisa de credenciais Firebase Admin pelo mecanismo Application Default Credentials e de `FIREBASE_PROJECT_ID` (ou `GOOGLE_CLOUD_PROJECT`). Não coloque arquivos de chave de serviço no repositório ou no bundle do navegador.

## Configuração

- `PLUGGY_CLIENT_ID` e `PLUGGY_CLIENT_SECRET`: apenas no servidor/gerenciador de segredos.
- `GEMINI_API_KEY` e `GEMINI_MODEL`: apenas no servidor. Escolha um identificador disponível para a conta por `models.list`/`models.get`; nenhuma troca de modelo é adivinhada. Sem configuração, o chat retorna 503 e o onboarding identifica explicitamente sua heurística local.
- `apiQuotas` guarda contagens transacionais por usuário, rota e janela, além de limite global por rota. Bloqueie todo acesso de clientes a essa coleção. Configure TTL no campo `expiresAt` para remover janelas antigas; até isso ocorrer elas permanecem inativas e ocupam armazenamento.

Nenhum teste local deve apontar para um banco ou provedor de produção. Use emuladores Firebase e credenciais fictícias com fetch do provedor substituído nos testes.

## Fluxo bancário

1. O cliente autenticado solicita `/api/pluggy/connect-token`.
2. O servidor valida associação ao casal e emite token escopado com `options.clientUserId` definido pelo UID verificado.
3. O widget Pluggy recebe somente esse token temporário. O segredo e a API key geral nunca são devolvidos ao navegador.
4. Após consentimento, o cliente envia o `itemId` para `/api/pluggy/items` e consulta contas/sincronização. A cada operação, o servidor consulta o item no provedor e compara `clientUserId` com o UID. Um identificador informado pelo cliente sozinho nunca prova propriedade.
5. `/api/bank-sync/fetch` usa `/v2/transactions` com paginação por cursor, aceita apenas transações confirmadas em BRL e fornece identificadores estáveis por conta/transação. Os resultados exigem revisão de categoria. Falha parcial não devolve importação como sucesso. Dados pendentes e outras moedas não são convertidos silenciosamente.

O backend não gera dados de demonstração no lugar de movimentações reais. Falta de configuração retorna 503; falha do provedor retorna 502. A integração externa ainda depende das credenciais válidas, do consentimento no banco e da disponibilidade do conector. A suíte usa fixtures, não comprova conexão com um banco real.

## Associação e migração

Criação, entrada, renovação de convite e saída passam por `/api/couples`, `/api/couples/join`, `/api/couples/invite` e `/api/couples/leave`. Convites usam 144 bits aleatórios, duram 48 horas, são sensíveis a maiúsculas/minúsculas, têm chave SHA-256 e consumo transacional de uso único. Renovação revoga o anterior. Há limite compartilhado de tentativas. Saída preserva os UIDs históricos e marca `departedMembers`; não abre vaga para substituir uma pessoa.

Casais legados sem UIDs confiáveis precisam de migração administrativa após backup e revisão de identidade pelo responsável. Não atribua um UID usando somente o `coupleId` do perfil ou o navegador. Não implante regras novas sem planejar essa migração: o acesso a registros sem identidade verificável será negado.

Antes de ativar a versão, rotacione credenciais Pluggy previamente persistidas no cliente, faça backup e remova `pluggyCredentials` dos documentos legados com ferramenta administrativa revisável. A remoção do campo não invalida uma chave já exposta. Não há execução automática de migração ou implantação em produção neste trabalho.

Rollback de aplicativo não deve restaurar regras permissivas ou segredos no cliente. Preserve backup para recuperar dados, não para reintroduzir o modelo de autorização anterior.

## Referências verificadas

- [Pluggy: autenticação](https://docs.pluggy.ai/en/docs/authentication)
- [Pluggy: token do Connect e options.clientUserId](https://docs.pluggy.ai/en/reference/auth/connect-token-create)
- [Pluggy: transações v2 e cursor](https://docs.pluggy.ai/en/reference/transaction/transactions-list-by-cursor)
- [Pluggy: conceitos e depreciação de transações por página](https://v2.docs.pluggy.ai/en/reference/basic-concepts)
- [Gemini: descoberta de modelos disponíveis](https://ai.google.dev/api/models)
