# Upgrade Visual e Estrutural dos Avatares & Edição Compartilhada no Modo Casal

Transformação completa do sistema de avatares do Juntô: novo ambiente estúdio/pedestal de alta elegância, novo design estrutural dos bonecos com opção masculino/feminino, cabelos e roupas refinadas (incluindo scrubs e jaleco médico), catálogo rico de acessórios (estetoscópio, fone de ouvido, mochila, bolsa, bola de futebol), além da correção definitiva da sessão de autenticação e permissão de edição compartilhada para o casal.

---

### User Review & Critical Decisions

> [!IMPORTANT]
> As decisões abaixo incorporam os alinhamentos anteriores e as novas solicitações de upgrade estético e estrutural:

- **Novo Ambiente / Cenário dos Bonecos**:
  - Em vez de caixas planas monocromáticas, os bonecos agora são apresentados em um **Palco Estúdio Contemporâneo** com pedestal arquitetônico circular, iluminação suave (halo/glow ambiente), sombra elíptica projetada no chão e acabamento premium (claro e escuro).
- **Opção Masculino e Feminino**:
  - Adição da propriedade `gender` (`'masculine'` | `'feminine'`) no modelo do avatar, ajustando proporcionalidade dos ombros, queixo, silhueta e cortes de cabelo/roupas correspondentes, mantendo compatibilidade total com os avatares já salvos via `normalizeAvatar`.
- **Roupas Temáticas & Médicas**:
  - Inclusão do **Scrub Médico** (decote em V com bolso frontal e caneta) e do **Jaleco Branco** médico (com gola e lapela elegante), essenciais para a identidade do casal de médicos, além de moletom, camisa social, camiseta e jaqueta contemporânea.
- **Catálogo de Acessórios Expressivos**:
  - Inclusão do **Estetoscópio** no pescoço, **Fone de Ouvido (Headphones)**, **Mochila** de plantão, **Bolsa tiracolo**, **Bola de futebol**, **Óculos modernos**, **Brincos**, **Barba/Cavanhaque** e **Sardas**.
- **Resolução de Autenticação & Edição Casal**:
  - Correção do erro *"Sessão inválida ou expirada"* com auto-refresh de token Firebase (`getIdToken(true)`) em erros 401 e ajuste da verificação no backend.
  - No **Modo Casal**, qualquer um dos dois parceiros pode visualizar e editar os dois avatares (Matheus e Ana). Na **Visão Individual**, exibe apenas o avatar individual da conta.

---

### 1. Overview & Core Concept

- **O que faz**: Proporciona aos usuários uma experiência de personalização lúdica, refinada e intimamente ligada à identidade deles (incluindo a vivência médica). Cada usuário tem seu avatar na sua conta individual, que se une no Modo Casal em um palco estúdio compartilhado onde ambos podem se ver e se personalizar.
- **Público-alvo**: O casal médico (Matheus e Ana) e usuários em contas individuais.
- **Valor Principal**: Transforma os avatares de meros ícones genéricos em personagens carismáticos com presença cênica, acessórios da rotina médica e esportiva, com salvamento confiável e sem falhas de sessão.

---

### 2. User Experience & Visual Design

#### Fluxos Principais & Cenários

1. **Palco dos Bonecos no Dashboard (`AvatarHero`)**:
   - Cenário com iluminação ambiente suave, gradiente de profundidade e pedestal duplo onde o casal fica lado a lado com sombras de contato no chão.
   - No modo individual, pedestal centralizado com destaque pessoal.
   - Botão sutil de ateliê: *"Personalizar meu avatar"* (ou do par, no modo casal).

2. **Ateliê de Personalização (`AvatarEditor`)**:
   - Vista frontal ampla do boneco em um estúdio com holofote superior suave e luz de borda.
   - Navegação por abas com ícones táteis:
     - **Corpo & Rosto**: Gênero (Masculino / Feminino), Tom de pele, Formato dos olhos, Cor dos olhos e Expressão.
     - **Cabelo**: Novos cortes estilizados (Topete, Degradê fade, Ondulado com mechas, Cacheado volumoso, Crespo, Coque alto, Longo sofisticado, Bob moderno, Tranças e Careca) e paleta rica de cores.
     - **Roupas**: Scrub Médico (em tons de azul hospitalar, verde cirúrgico, bordô e chumbo), Jaleco Branco sobreposto, Camisa social, Moletom com capuz e Camiseta básica.
     - **Acessórios**: Estetoscópio médico, Fone de ouvido (headphones), Mochila, Bolsa lateral, Bola de futebol, Óculos redondos/quadrados/solares, Brincos, Barba estilizada e Sardas.
   - Ações rápidas: *Desfazer*, *Refazer*, *Me surpreenda* (combinações harmônicas) e *Recomeçar*.

3. **Modo Casal vs. Visão Individual**:
   - Em **Modo Casal**: o ateliê permite selecionar qual avatar está sendo customizado (Matheus ou Ana) com abas diretas *"Editar Matheus"* e *"Editar Ana"*.
   - Em **Visão Individual**: exibe e edita somente o boneco da respectiva conta.
   - Se desconectado: edita no modo demo e, ao salvar, exibe convite para entrar na conta preservando o rascunho local.

---

### 3. Key Product Decisions & Trade-Offs

- **Decisão 1: Expansão do Modelo Vetorial Declarativo (SVG puro local)**:
  - *Abordagem*: Continuar gerando toda a arte em SVG determinístico renderizado no cliente (sem imagens externas ou iframes), estendendo as opções de `gender`, `outfit` e `accessory` em `avatarConfig.ts`.
  - *Por que*: Desempenho instantâneo, zero consumo de banda, escalabilidade perfeita em qualquer tela e retina, total segurança contra injeção de código e renderização suave.
- **Decisão 2: Compatibilidade Regressiva com `normalizeAvatar`**:
  - *Abordagem*: Se um avatar já existente no banco não possuir a chave `gender` ou os novos acessórios, `normalizeAvatar` preenche com valores elegantes padrão sem quebrar a leitura.
  - *Por que*: Garante que nenhum usuário perca seu avatar atual ou enfrente tela em branco.
- **Decisão 3: Autorização de Edição Cruzada no Casal**:
  - *Abordagem*: O servidor valida se o usuário autenticado é parceiro ativo do casal via `authorizedCouple(uid)` para autorizar a escrita no documento `avatars/{targetUid}`.
  - *Por que*: Atende diretamente ao requisito de que Matheus possa editar o boneco da Ana e vice-versa quando o casal estiver vinculado.

---

### 4. Technical Architecture & Component Structure

```
┌────────────────────────────────────────────────────────────────────────┐
│                        Sistema de Avatares 2.0                         │
│                                                                        │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │                    AvatarStage / Environment                     │  │
│  │  - Pedestal arquitetônico 3D-effect com sombra radial suave      │  │
│  │  - Iluminação atmosférica (gradientes de estúdio quente/ardósia) │  │
│  └──────────────────────────────────┬───────────────────────────────┘  │
│                                     │                                  │
│                                     ▼                                  │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │                     Renderizador SVG Avatar                      │  │
│  │  - Gênero: Masculino / Feminino (ombros, queixo e proporções)    │  │
│  │  - Roupas: Scrub Médico, Jaleco Branco, Moletom, Camisa, Tee     │  │
│  │  - Acessórios: Estetoscópio, Fone, Mochila, Bolsa, Bola, Óculos │  │
│  │  - Cabelos: 12 estilos detalhados com brilho e texturas          │  │
│  └──────────────────────────────────┬───────────────────────────────┘  │
│                                     │                                  │
│                                     ▼                                  │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │                 AvatarEditor & Couple Selector                   │  │
│  │  - Abas: Aparência, Cabelo, Rosto, Roupa & Estilo Médico, Extras │  │
│  │  - Seletor de parceiro quando em casal ("Editar Par 1 / Par 2")  │  │
│  └──────────────────────────────────┬───────────────────────────────┘  │
│                                     │                                  │
│                                     ▼                                  │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │           authenticatedApi & Server (/api/avatars/save)          │  │
│  │  - Auto-refresh de token no 401 (elimina "Sessão expirada")     │  │
│  │  - Suporte a gravação do par se autorizado no casal              │  │
│  └──────────────────────────────────────────────────────────────────┘  │
└────────────────────────────────────────────────────────────────────────┘
```

#### Plano de Modificação nos Arquivos:
1. `src/avatars/avatarConfig.ts`:
   - Adicionar `gender` (`masculine`, `feminine`).
   - Adicionar novos estilos de roupa em `outfit`: `scrub` (pijama cirúrgico), `labcoat` (jaleco médico), `hoodie`, `shirt`, `tee`, `jacket`.
   - Adicionar novos acessórios em `accessory`: `stethoscope` (estetoscópio), `headphones` (fone de ouvido), `backpack` (mochila), `bag` (bolsa), `soccer` (bola de futebol), `round_glasses`, `square_glasses`, `sunglasses`, `earrings`, `freckles`, `beard`.
   - Atualizar `normalizeAvatar`, `isAvatarConfig` e testes.
2. `src/avatars/Avatar.tsx` e `src/avatars/avatar.css`:
   - Implementar renderização detalhada dos novos cortes de cabelo, roupas (scrubs com decote V e bolso com caneta; jaleco impecável) e acessórios (estetoscópio curvo realista no pescoço, fone nos ouvidos/pescoço, bolsa, mochila e bola).
   - Ajustar proporções do corpo de acordo com `gender`.
   - Criar efeito de pedestal e sombra estúdio.
3. `src/avatars/AvatarUI.tsx`:
   - Redesenhar `AvatarHero`, `AvatarSettings` e o palco do boneco com o novo cenário estúdio elegante.
   - Adicionar seletor de quem está sendo editado no Modo Casal (permitindo alternar entre Matheus e Ana com 1 clique).
4. `src/avatars/AvatarEditor.tsx`:
   - Adicionar a aba de Gênero e organizar os novos itens (com destaques especiais para a categoria Médica e Acessórios).
5. `src/lib/authenticatedApi.ts` e `server/security.ts`:
   - Auto-refresh de ID token em 401 e verificação resiliente no servidor.
6. `server/avatars.ts` e `src/avatars/AvatarProvider.tsx`:
   - Permitir que membros do casal salvem alterações em `avatars/{targetUid}` de ambos os parceiros.
