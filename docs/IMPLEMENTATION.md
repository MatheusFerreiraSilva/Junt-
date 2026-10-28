# Implementação e implantação controlada

Esta branch corrige contratos, autenticação das APIs, associação do casal,
persistência e fluxos financeiros. Não houve acesso a banco de produção, deploy
de regras ou validação de uma conexão bancária real.

## Migração

1. Exporte o Firestore e preserve uma cópia imutável. Exporte também o cache
   local legado antes de limpar qualquer dado no dispositivo.
2. Execute `node scripts/migrate-security.mjs backup.json revisado.json`.
   É um dry-run local. Não imprime credenciais nem altera banco.
3. Valide identidades de membros com registros administrativos independentes.
   Nunca deduza associação somente de `users/{uid}.coupleId`, antes editável.
   Casais sem `partner1Uid` confiável exigem revisão manual.
4. Use `--write` para criar um NOVO export sanitizado. Revise as diferenças e
   rotacione as credenciais anteriormente expostas no navegador/Firestore.
5. Em homologação, configure Firebase Admin, Pluggy e as regras propostas. Teste
   os dois membros, convites, saída, importação e troca de contas.
6. A primeira hidratação copia entidades legadas para documentos independentes,
   somente quando ausentes. Arrays originais são preservados e exclusões usam
   tombstones, impedindo ressurreição na próxima execução.
7. Cache v5 tem namespace por UID. O cache global v4 é preservado para backup,
   mas não é carregado automaticamente em contas autenticadas.

## Rollback

Mantenha o export original, a versão anterior e o novo schema em homologação.
Reverter somente o frontend antigo após gravar entidades novas perde visibilidade
das alterações feitas no novo esquema. Antes de rollback, interrompa gravações e
reconstrua um export consistente dos documentos novos; não restaure arrays antigos
por cima de dados novos. Reverter regras antigas reabre a falha de associação.
Prefira corrigir adiante ou suspender escrita até revisão administrativa.

## Limitações de arquitetura e próximos incrementos

- Entidades financeiras são independentes e conflitos do mesmo registro são
  rejeitados. Configurações e totais agregados de reserva/liberdade ainda residem
  no documento principal; depósitos/transferências entre agregados e metas
  precisam de um ledger transacional único para invariantes entre dispositivos.
- Regras não validam todo o schema financeiro de cada entidade. Validadores e
  limites adicionais de payload devem evoluir junto com o domínio.
- Os perfis médicos separados não implementam todo o calendário de formação,
  custos profissionais anuais, cenários de duas residências ou contabilidade PJ.
- Planejamento de agenda com sobreposição, descanso e disponibilidade pessoal
  exige incremento próprio. Não há garantia clínica de segurança de escalas.
- A integração real exige configuração/contrato Pluggy, Firebase Admin e
  consentimento. Testes com mocks e emuladores não comprovam o conector bancário.
- Backup/importação financeira com prévia e restauração completa ainda exige
  testes de produto específicos. O script de export acima trata segurança e
  revisão administrativa; não substitui esse fluxo na interface.
- Não há envio remoto completo de push nem garantia de operações financeiras
  offline. Teste instalação e atualização PWA em dispositivos reais.

## Aceite

Registre resultados efetivamente executados em `VALIDATION.md`. A CI inclui
lint, TypeScript, testes, build cliente+servidor e smoke de produção sem chaves.
Testes de regras devem executar em Firebase Emulator com projeto `demo-`.
Somente após homologação e configuração deve-se considerar implantação.
