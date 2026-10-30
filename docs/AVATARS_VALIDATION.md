# Validação do upgrade de avatares

Base: main 20d51602507e1b4daf358f16969a4a283c4d3d2d. ZIP fornecido pelo usuário equivalente após normalizar finais de linha. Execução local em 30/10/2026.

- TypeScript: tsc --noEmit aprovado.
- ESLint: eslint . --ext .ts,.tsx aprovado.
- Vitest: 30 arquivos, 164 testes aprovados com --maxWorkers=1. A primeira execução concorrente encontrou timeouts de inicialização de HTTP no Windows; não foram reduzidas assertions nem alterados timeouts das suítes existentes.
- Vite/PWA: build cliente e precache aprovados. Aviso de chunk principal grande continua presente; editor é carregado separadamente (~3,2 kB gzip nesta build).
- esbuild: servidor compilado.
- Smoke de produção: health200; operações bancárias e gravação de avatar sem autenticação401.
- Navegador local: abertura de editor por dashboard/Ajustes; rascunho; salvar no modo de demonstração; recarregar e recuperar escolha; segundo integrante independente; claro/escuro; inspeção de editor em390 e320 pixels.
- git diff --check aprovado.

## Limites

Não houve gravação ou teste de duas contas em Firebase de produção. Autorização, concorrência, revisão e banco nomeado foram verificados por testes com armazenamento simulado. O editor cabe no diálogo de320px; observou-se largura excedente preexistente em controles do cabeçalho móvel externo ao editor, fora deste upgrade. Não se certifica ausência universal de bugs. Servidor e frontend precisam ser atualizados juntos.
