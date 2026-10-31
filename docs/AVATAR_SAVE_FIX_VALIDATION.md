# Correção do salvamento e preferências por conta

Base:86e946f80671a5f3c24bbef33060f6e39303d1de.

## Falhas reproduzidas antes da correção

- Uma resposta HTTP bem-sucedida sem avatar válido resolvia a promessa e fechava o editor sem atualizar a receita.
- Editar um integrante sem vínculo efetivo podia escolher o UID de quem estava logado; o parceiro sem avatar não tinha identidade independente da receita.
- A adição de gender sem compatibilidade de leitura invalidava avatares existentes.
- Uma resposta atrasada de gravação do parceiro substituía uma revisão mais recente.
- As regras aceitavam config vazia e saltos/retrocesso de revisão. O teste citado pelo usuário falhou novamente localmente antes da correção.
- A autorização compartilhada do servidor ocorria fora da transação.

## Validação

Os testes de regressão foram executados antes das correções e demonstraram as falhas. A suíte de regras agora inclui escrita/leitura de sessões distintas pelo SDK real em emulador, edição recíproca, conflito, repetição idempotente, migração do legado preservado e isolamento de preferências. O emulador usa demo-junto-rules; nenhum teste grava dados financeiros de produção.

Validação local integrada: 230 testes unitários em 35 arquivos, 21 testes de regras/SDK no emulador, typecheck e lint aprovados. Build cliente/PWA e servidor e smoke local também aprovados. CI/publicação registrados no PR. A build mantém o aviso já existente de chunk grande; não foram alterados limites para ocultá-lo. Não houve acesso a duas contas reais no aplicativo publicado nesta execução. A confirmação pelo usuário no AI Studio continua necessária após atualizar o projeto a partir da main.

## Atualização de CI

Ações migradas para runtimes atuais e runner fixado em ubuntu-24.04 para evitar mudança automática de sistema durante este rollout. Node22 do aplicativo e Java21 do emulador foram mantidos; nenhuma dependência do app foi adicionada.

Referências oficiais: [checkout](https://github.com/actions/checkout/blob/main/CHANGELOG.md), [setup-node](https://github.com/actions/setup-node), [setup-java](https://github.com/actions/setup-java).
