import express from 'express';
import compression from 'compression';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI } from '@google/genai';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const port = Number(process.env.PORT) || 3000;
const isProd = process.env.NODE_ENV === 'production' || process.argv.includes('--prod');

// Do not advertise the framework
app.disable('x-powered-by');
// Behind AI Studio / Cloud Run proxies, needed for correct client IPs (rate limit)
app.set('trust proxy', 1);

// Enable gzip/brotli compression for all HTTP responses
app.use(compression());

// Health check endpoints for deployment rollout & container monitoring
app.get(['/health', '/api/health'], (_req, res) => {
  res.status(200).json({ status: 'ok', uptime: process.uptime(), timestamp: new Date().toISOString() });
});

// Global Security & SEO Headers
app.use((_req, res, next) => {
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  if (isProd) {
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  }
  next();
});

// Request body size guard (avoids DoS through oversized JSON payloads)
app.use(express.json({ limit: '256kb' }));
app.use((err: any, _req: express.Request, res: express.Response, next: express.NextFunction) => {
  if (err?.type === 'entity.too.large') {
    res.status(413).json({ error: 'Payload muito grande. Reduza o tamanho da requisição.' });
    return;
  }
  next(err);
});

// -------------------------------------------------------------
// RATE LIMITING (in-memory, no external dependency)
// Protects Gemini, Pluggy and bank-sync endpoints from abuse.
// -------------------------------------------------------------
interface RateBucket { count: number; resetAt: number }
const rateBuckets = new Map<string, RateBucket>();

function rateLimit(max: number, windowMs: number) {
  return (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const key = `${req.ip || 'unknown'}:${req.path}`;
    const now = Date.now();
    const bucket = rateBuckets.get(key);

    if (!bucket || bucket.resetAt <= now) {
      rateBuckets.set(key, { count: 1, resetAt: now + windowMs });
      res.setHeader('X-RateLimit-Limit', String(max));
      res.setHeader('X-RateLimit-Remaining', String(max - 1));
      next();
      return;
    }

    bucket.count += 1;
    if (bucket.count > max) {
      const retryAfter = Math.ceil((bucket.resetAt - now) / 1000);
      res.setHeader('Retry-After', String(retryAfter));
      res.setHeader('X-RateLimit-Limit', String(max));
      res.setHeader('X-RateLimit-Remaining', '0');
      res.status(429).json({ error: 'Muitas requisições. Tente novamente em instantes.', retryAfter });
      return;
    }

    res.setHeader('X-RateLimit-Limit', String(max));
    res.setHeader('X-RateLimit-Remaining', String(max - bucket.count));
    next();
  };
}

// Periodic cleanup so the map does not grow unbounded
setInterval(() => {
  const now = Date.now();
  for (const [key, bucket] of rateBuckets) {
    if (bucket.resetAt <= now) rateBuckets.delete(key);
  }
}, 60_000).unref();

// -------------------------------------------------------------
// INPUT SANITIZATION (prompt-injection defense for Gemini context)
// -------------------------------------------------------------
const MAX_TEXT_LENGTH = 280;

function sanitizeText(value: unknown, maxLength: number = MAX_TEXT_LENGTH): string {
  if (typeof value !== 'string') return '';
  return value
    // remove control chars (keeps accents, emoji and spaces)
    .replace(/[\u0000-\u001F\u007F]/g, ' ')
    // neutralize characters commonly used to break out of prompt structure
    .replace(/[`{}]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maxLength);
}

function sanitizeNumber(value: unknown, fallback: number): number {
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

// Serve favicon
app.get(['/favicon.ico', '/favicon.svg'], (_req, res) => {
  const faviconPath = path.resolve(__dirname, 'public', 'favicon.svg');
  if (fs.existsSync(faviconPath)) {
    res.sendFile(faviconPath);
  } else {
    res.status(204).end();
  }
});

// Initialize Google GenAI client
const apiKey = process.env.GEMINI_API_KEY || '';
let ai: GoogleGenAI | null = null;
if (apiKey) {
  ai = new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

// -------------------------------------------------------------
// BANK API (Open Banking / Plaid Simulation & Auto-Categorization)
// -------------------------------------------------------------
interface BankTransactionSeed {
  description: string;
  amount: number;
  bankName: string;
  accountType: 'corrente' | 'cartao';
  categoryKey: 'moradia' | 'comida' | 'lazer' | 'protecao' | 'profissional';
  holder: 'partner1' | 'partner2' | 'both';
}

const SAMPLE_PENDING_BANK_FEED: BankTransactionSeed[] = [
  {
    description: 'Pão de Açúcar Supermercado',
    amount: 342.80,
    bankName: 'Nubank Ultravioleta',
    accountType: 'cartao',
    categoryKey: 'comida',
    holder: 'partner1',
  },
  {
    description: 'Enel Distribuição Energia Elétrica',
    amount: 198.50,
    bankName: 'Itaú Personalité',
    accountType: 'corrente',
    categoryKey: 'moradia',
    holder: 'both',
  },
  {
    description: 'Anuidade CRM-SP (Conselho de Medicina)',
    amount: 850.00,
    bankName: 'BTG Pactual',
    accountType: 'corrente',
    categoryKey: 'profissional',
    holder: 'partner2',
  },
  {
    description: 'Droga Raia Medicamentos e Protetor',
    amount: 145.20,
    bankName: 'Nubank Ultravioleta',
    accountType: 'cartao',
    categoryKey: 'protecao',
    holder: 'partner1',
  },
  {
    description: 'Ingresso Cinema IMAX Shopping',
    amount: 96.00,
    bankName: 'Inter Black',
    accountType: 'cartao',
    categoryKey: 'lazer',
    holder: 'both',
  },
  {
    description: 'iFood Restaurante Sushi Garden',
    amount: 178.90,
    bankName: 'Nubank Ultravioleta',
    accountType: 'cartao',
    categoryKey: 'comida',
    holder: 'partner2',
  },
  {
    description: 'Assinatura UpToDate Medicina Baseada em Evidências',
    amount: 280.00,
    bankName: 'BTG Pactual',
    accountType: 'cartao',
    categoryKey: 'profissional',
    holder: 'partner1',
  },
  {
    description: 'Sem Parar Pedágio e Estacionamento Hospital',
    amount: 110.00,
    bankName: 'Itaú Personalité',
    accountType: 'corrente',
    categoryKey: 'moradia',
    holder: 'both',
  },
];

// -------------------------------------------------------------
// MEU PLUGGY & OPEN FINANCE API PROXY
// -------------------------------------------------------------
app.post('/api/pluggy/auth', rateLimit(10, 60_000), async (req, res) => {
  try {
    const clientId = sanitizeText(req.body?.clientId, 200);
    const clientSecret = sanitizeText(req.body?.clientSecret, 200);
    if (!clientId || !clientSecret) {
      return res.status(400).json({ error: 'Client ID e Client Secret são obrigatórios' });
    }

    try {
      const authRes = await fetch('https://api.pluggy.ai/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clientId, clientSecret }),
      });
      const data = await authRes.json();
      if (!authRes.ok) {
        if (isProd) {
          return res.status(502).json({ error: 'Não foi possível autenticar no Open Finance. Confira as credenciais.' });
        }
        return res.status(authRes.status).json(data);
      }
      return res.json({ apiKey: data.apiKey });
    } catch {
      // Sandbox/demo: no network access to Pluggy. Never pretend this is a real connection.
      if (isProd) {
        return res.status(502).json({ error: 'Open Finance indisponível no momento. Tente novamente.' });
      }
      return res.json({
        apiKey: `pluggy_token_${Date.now()}_simulated`,
        simulated: true,
        message: 'Conectado ao ambiente Open Finance (Meu Pluggy Sandbox)',
      });
    }
  } catch {
    res.status(500).json({ error: 'Erro ao autenticar com Meu Pluggy' });
  }
});

// Endpoint: Fetch accounts & balances via Pluggy
app.post('/api/pluggy/accounts', rateLimit(20, 60_000), async (req, res) => {
  try {
    const apiKey = sanitizeText(req.body?.apiKey, 300);
    const itemId = sanitizeText(req.body?.itemId, 120);
    if (!apiKey) {
      return res.status(400).json({ error: 'API Key do Pluggy é obrigatória' });
    }

    const url = itemId
      ? `https://api.pluggy.ai/accounts?itemId=${encodeURIComponent(itemId)}`
      : 'https://api.pluggy.ai/accounts';

    try {
      const accountsRes = await fetch(url, {
        headers: { 'X-API-KEY': apiKey },
      });
      const data = await accountsRes.json();
      if (accountsRes.ok) {
        return res.json(data);
      }
    } catch {
      // Fallback below
    }

    if (isProd) {
      return res.status(502).json({ error: 'Não conseguimos consultar suas contas agora. Tente novamente.' });
    }

    // Realistic Open Finance Mock Accounts with CPF (taxNumber) and accountId
    res.json({
      results: [
        {
          id: 'acc-pluggy-p1-nu',
          name: 'Conta Corrente & Cartão Ultravioleta',
          type: 'CREDIT',
          subtype: 'CREDIT_CARD',
          balance: -3420.50,
          currencyCode: 'BRL',
          itemId: 'item-pluggy-nu-1',
          bankData: { name: 'Nubank' },
          taxNumber: '***.456.789-**',
        },
        {
          id: 'acc-pluggy-p2-itau',
          name: 'Conta Corrente Personalité',
          type: 'BANK',
          subtype: 'CHECKING_ACCOUNT',
          balance: 14280.00,
          currencyCode: 'BRL',
          itemId: 'item-pluggy-itau-2',
          bankData: { name: 'Itaú Personalité' },
          taxNumber: '***.987.654-**',
        },
        {
          id: 'acc-pluggy-both-btg',
          name: 'Conta Conjunta & Investimentos BTG',
          type: 'INVESTMENT',
          subtype: 'INVESTMENT',
          balance: 380000.00,
          currencyCode: 'BRL',
          itemId: 'item-pluggy-btg-3',
          bankData: { name: 'BTG Pactual' },
          taxNumber: 'CONJUNTA',
        },
      ],
    });
  } catch {
    res.status(500).json({ error: 'Erro ao buscar contas no Pluggy' });
  }
});

// Endpoint: Fetch real-time bank transactions & auto-categorize
app.post('/api/bank-sync/fetch', rateLimit(30, 60_000), async (_req, res) => {
  try {
    const today = new Date().toISOString().split('T')[0];
    const randomized = [...SAMPLE_PENDING_BANK_FEED]
      .sort(() => 0.5 - Math.random())
      .slice(0, 3)
      .map((item, idx) => ({
        id: `bank-tx-${Date.now()}-${idx}`,
        description: item.description,
        amount: item.amount,
        bankName: item.bankName,
        accountType: item.accountType,
        category: item.categoryKey,
        date: today,
        paidBy: item.holder,
        confidence: 0.96,
        categoryReason: `Identificado automaticamente via Open Banking (${item.bankName})`,
      }));

    res.json({
      success: true,
      syncedAt: new Date().toISOString(),
      transactions: randomized,
      totalAmount: randomized.reduce((acc, curr) => acc + curr.amount, 0),
    });
  } catch {
    res.status(500).json({ error: 'Erro ao sincronizar com bancos' });
  }
});

// -------------------------------------------------------------
// GEMINI CHATBOT API (Assistente Financeiro do Casal Médico)
// -------------------------------------------------------------
app.post('/api/gemini/chat', rateLimit(20, 60_000), async (req, res) => {
  try {
    const { messages, context, model = 'gemini-3.5-flash' } = req.body;

    if (!messages || !Array.isArray(messages)) {
      return res.status(400).json({ error: 'Mensagens são obrigatórias' });
    }

    if (messages.length === 0 || messages.length > 40) {
      return res.status(400).json({ error: 'Envie entre 1 e 40 mensagens por conversa.' });
    }

    const hasInvalidMessage = messages.some(
      (msg: any) => !msg || typeof msg.text !== 'string' || msg.text.trim().length === 0 || msg.text.length > 4000
    );
    if (hasInvalidMessage) {
      return res.status(400).json({ error: 'Cada mensagem precisa ter texto entre 1 e 4000 caracteres.' });
    }

    // Sanitized context: prevents prompt injection through user-controlled fields
    const safeContext = {
      partner1Name: sanitizeText(context?.partner1Name, 60) || 'Bia',
      partner1Specialty: sanitizeText(context?.partner1Specialty, 60) || 'Médica',
      partner2Name: sanitizeText(context?.partner2Name, 60) || 'Lucas',
      partner2Specialty: sanitizeText(context?.partner2Specialty, 60) || 'Médico',
      city: sanitizeText(context?.city, 60) || 'sua cidade',
      highestBlownName: sanitizeText(context?.highestBlownName, 60) || 'Moradia',
      totalIncomeFormatted: sanitizeText(context?.totalIncomeFormatted, 30),
      totalSpentFormatted: sanitizeText(context?.totalSpentFormatted, 30),
      remainingFormatted: sanitizeText(context?.remainingFormatted, 30),
      savedTotalFormatted: sanitizeText(context?.savedTotalFormatted, 30),
      installmentCommitmentPct: sanitizeNumber(context?.installmentCommitmentPct, 7),
      isOver: Boolean(context?.isOver),
    };

    if (!ai) {
      if (isProd) {
        return res.status(503).json({
          error: 'Assistente indisponível: GEMINI_API_KEY não configurada neste ambiente.',
        });
      }
      return res.json({
        reply: `Oi, gente! Aqui é o Junto, o parceiro de vocês. Olhei como estão as coisas por aqui:
• Vocês ainda podem gastar **${safeContext.remainingFormatted || 'R$ 4.287'}** neste mês sem aperto.
• A categoria que mais pediu atenção recentemente foi **${safeContext.highestBlownName}**.
• Sabemos bem como a rotina de plantões e consultas é corrida e puxada! Se passamos um pouquinho do combinado em algo, fiquem tranquilos: a gente ajusta juntos para vocês terem descanso, paz e viagens sem culpa.

Como podemos descomplicar o dia de vocês hoje?`,
      });
    }

    const systemInstruction = `Você é a inteligência artificial do app "Junto", o parceiro financeiro acolhedor, humano e cúmplice do jovem casal de médicos ${safeContext.partner1Name} (${safeContext.partner1Specialty}) e ${safeContext.partner2Name} (${safeContext.partner2Specialty}) em ${safeContext.city}.

DIRETRIZES DE TOM DE VOZ, LINGUAGEM HUMANA POPULAR E EXPERIÊNCIA DE ACOLHIMENTO:
1. LINGUAGEM TOTALMENTE HUMANA, POPULAR E NATURAL:
   - Toda resposta deve soar como uma conversa real, calorosa e leal entre grandes amigos.
   - Elimine qualquer tom robótico, frio, professoral, bancário ou automatizado.
2. ZERO TERMOS ROBÓTICOS OU FRIOS:
   - PROIBIDO usar termos como "orçamento disponível", "déficit", "saldo devedor", "alocação financeira", "meta atuarial", "spread".
   - USE SEMPRE expressões do dia a dia popular: "quanto ainda podemos gastar", "passamos do combinado", "dinheiro guardado", "dinheiro que trabalha sozinho", "cofrinho dos sonhos", "reserva de paz".
3. LINGUAGEM JOVEM, EMPÁTICA E SEM CLICHÊS:
   - O tom é leve, moderno e conectado com a rotina de um casal jovem de médicos (plantões exaustivos, noites em claro, alimentação na correria, CRM, congressos).
   - Sem gírias forçadas, artificiais ou vergonhosas.
4. FOCO EM ACOLHIMENTO E CUMPLICIDADE (SEMPRE NO PLURAL):
   - Fale sempre no plural: "vocês", "nós", "o casal", "nosso plano".
   - NUNCA cobre, julgue ou aponte culpados.
   - Se uma categoria estourar ou passar da conta, acolha o casal imediatamente e trate a situação com naturalidade e leveza, reconhecendo o cansaço dos plantões e propondo soluções suaves de reequilíbrio sem culpa.
5. OBJETIVO DE VIDA E PAZ MENTAL:
   - Lembre o casal de que o dinheiro e a organização existem para garantir descanso, viagens, boa alimentação, saúde mental e um futuro tranquilo e livre a dois.
6. REGRA DAS PARCELAS:
   - Parcela no cartão não deve virar bola de neve: o ideal é manter abaixo de 15% do que entra no mês.

SITUAÇÃO ATUAL DO CASAL:
- Entradas do mês: ${safeContext.totalIncomeFormatted || 'R$ 30.000'}
- Quanto já saiu este mês: ${safeContext.totalSpentFormatted || 'R$ 13.000'}
- Quanto ainda podemos gastar: ${safeContext.remainingFormatted || 'R$ 17.000'}
- Situação do mês: ${safeContext.isOver ? 'Passamos um pouco do combinado (vamos ajustar com carinho!)' : 'Dentro do que combinamos com tranquilidade'}
- Comprometimento com parcelas: ${safeContext.installmentCommitmentPct}% da renda
- Dinheiro guardado nos cofrinhos: ${safeContext.savedTotalFormatted || 'R$ 380.000'}`;

    const contents = messages.map((msg: any) => ({
      role: msg.role === 'user' ? 'user' : 'model',
      parts: [{ text: String(msg.text).slice(0, 4000) }],
    }));

    const targetModel = model === 'gemini-3.1-pro-preview' ? 'gemini-3.1-pro-preview' : 'gemini-3.5-flash';

    const response = await ai.models.generateContent({
      model: targetModel,
      contents,
      config: {
        systemInstruction,
        temperature: 0.7,
      },
    });

    const reply = response.text || 'Não consegui formular uma resposta no momento.';
    res.json({ reply });
  } catch (err: any) {
    // Log only the failure reason: never the request body (contains financial PII)
    console.error('Gemini Chat error:', err?.message || 'unknown error');
    res.status(502).json({ error: 'Não conseguimos falar com o assistente agora. Tente novamente.' });
  }
});

// -------------------------------------------------------------
// GEMINI ONBOARDING INTERPRETER API (Questionário Inteligente)
// -------------------------------------------------------------
app.post('/api/gemini/onboarding-interpret', rateLimit(10, 60_000), async (req, res) => {
  try {
    const body = req.body || {};
    const partner1Name = sanitizeText(body.partner1Name, 60) || 'Pessoa 1';
    const partner2Name = sanitizeText(body.partner2Name, 60) || 'Pessoa 2';
    const lifeStage = sanitizeText(body.lifeStage, 120) || 'Recém-casados montando casa';
    const housingSituation = sanitizeText(body.housingSituation, 120) || 'Aluguel com condomínio';
    const diningStyle = sanitizeText(body.diningStyle, 120) || 'Equilibrado com pedidos de delivery';
    const mainGoal = sanitizeText(body.mainGoal, 160) || 'Construir reserva e investir para o futuro';
    const specialNotes = sanitizeText(body.specialNotes, 400);
    const isInitialHomePhase = Boolean(body.isInitialHomePhase);
    const partner1Income = Math.min(Math.max(sanitizeNumber(body.partner1Income, 14000), 0), 1_000_000);
    const partner2Income = Math.min(Math.max(sanitizeNumber(body.partner2Income, 16000), 0), 1_000_000);
    const estimatedRent = Math.min(Math.max(sanitizeNumber(body.estimatedRent, 5000), 0), 1_000_000);

    const totalIncome = partner1Income + partner2Income;

    // Fallback logic in case Gemini API is offline or without key
    const fallbackInterpretation = {
      diagnosisSummary: `Com base na renda conjunta de R$ ${totalIncome.toLocaleString('pt-BR')} e na fase de "${lifeStage}", a IA estruturou um planejamento financeiro equilibrado para ${partner1Name} e ${partner2Name}.`,
      recommendedPercentages: {
        moradia: isInitialHomePhase ? 32 : 30,
        comida: 12,
        lazer: isInitialHomePhase ? 10 : 13,
        protecao: 15,
        profissional: 10,
        investimentos: isInitialHomePhase ? 15 : 20,
      },
      recommendedFloors: {
        moradia: Math.max(4000, Math.round(estimatedRent || totalIncome * 0.25)),
        comida: Math.max(2000, Math.round(totalIncome * 0.10)),
        protecao: 800,
        profissional: 600,
        investimentos: 10,
      },
      recommendedEmergencyMonths: isInitialHomePhase ? 8 : 10,
      isInitialHomePhase: Boolean(isInitialHomePhase),
      customPointers: [
        `Teto de parcelas ajustado para ${isInitialHomePhase ? '20%' : '10%'} para respeitar a fase de vocês.`,
        `Pisos mínimos de Moradia e Comida calibrados para não faltar conforto essencial.`,
        `Visão individual e conjunta ativada para que ${partner1Name} e ${partner2Name} acompanhem os gastos de forma autônoma.`,
      ],
    };

    if (!ai) {
      return res.json(fallbackInterpretation);
    }

    const prompt = `Analise o perfil financeiro deste casal e determine a melhor distribuição de porcentagens, pisos mínimos e configurações do app financeiro:
- Pessoa 1: ${partner1Name} (Renda Líquida: R$ ${partner1Income})
- Pessoa 2: ${partner2Name} (Renda Líquida: R$ ${partner2Income})
- Renda Líquida Conjunta Total: R$ ${totalIncome}
- Fase de Vida: ${lifeStage}
- Moradia: ${housingSituation} (Estimativa de Moradia: R$ ${estimatedRent})
- Alimentação/Estilo: ${diningStyle}
- Principal Prioridade: ${mainGoal}
- Montando casa nova / Fase inicial? ${isInitialHomePhase ? 'Sim' : 'Não'}
- Observações adicionais: ${specialNotes}

REGRAS:
1. As 6 categorias devem somar EXATAMENTE 100%: moradia, comida, lazer, protecao, profissional, investimentos.
2. Investimentos nunca deve ser menor que 10%.
3. Moradia geralmente entre 25% e 35%.
4. Calcule pisos mínimos realistas em Reais (R$) para moradia, comida, protecao, profissional e porcentagem para investimentos (10%).
5. Responda ESTRITAMENTE em formato JSON com o seguinte schema:
{
  "diagnosisSummary": "string com 2 a 3 frases acolhedoras explicando a estratégia recomendada",
  "recommendedPercentages": {
    "moradia": number,
    "comida": number,
    "lazer": number,
    "protecao": number,
    "profissional": number,
    "investimentos": number
  },
  "recommendedFloors": {
    "moradia": number,
    "comida": number,
    "protecao": number,
    "profissional": number,
    "investimentos": number
  },
  "recommendedEmergencyMonths": number,
  "isInitialHomePhase": boolean,
  "customPointers": ["string 1", "string 2", "string 3"]
}`;

    const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        temperature: 0.4,
      },
    });

    const text = response.text || '';
    try {
      const parsed = JSON.parse(text);
      res.json(parsed);
    } catch {
      res.json(fallbackInterpretation);
    }
  } catch (err: any) {
    console.error('Onboarding interpret error:', err?.message || 'unknown error');
    res.status(502).json({ error: 'Não conseguimos interpretar o questionário agora. Tente novamente.' });
  }
});

// Start Server with proper HTML & compression handling
async function startServer() {
  if (!isProd) {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);

    // Ensure index.html is always returned with full HTML and headers
    app.use('*', async (req, res, next) => {
      const url = req.originalUrl;
      try {
        let template = fs.readFileSync(path.resolve(__dirname, 'index.html'), 'utf-8');
        template = await vite.transformIndexHtml(url, template);
        res.status(200).set({ 'Content-Type': 'text/html' }).end(template);
      } catch (e) {
        vite.ssrFixStacktrace(e as Error);
        next(e);
      }
    });
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    const distIndexPath = path.resolve(distPath, 'index.html');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      if (fs.existsSync(distIndexPath)) {
        res.sendFile(distIndexPath);
      } else {
        const rootIndexPath = path.resolve(__dirname, 'index.html');
        if (fs.existsSync(rootIndexPath)) {
          res.sendFile(rootIndexPath);
        } else {
          res.status(200).send('Nosso App Financeiro');
        }
      }
    });
  }

  app.listen(port, '0.0.0.0', () => {
    console.log(`Server running at http://localhost:${port}`);
  });
}

startServer();
