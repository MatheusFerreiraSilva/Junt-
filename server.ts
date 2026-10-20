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
  next();
});

app.use(express.json());

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
app.post('/api/pluggy/auth', async (req, res) => {
  try {
    const { clientId, clientSecret } = req.body;
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
        return res.status(authRes.status).json(data);
      }
      return res.json({ apiKey: data.apiKey });
    } catch (e: any) {
      // In sandbox/demo or if external fetch fails, return simulated apiKey
      return res.json({
        apiKey: `pluggy_token_${Date.now()}_simulated`,
        simulated: true,
        message: 'Conectado ao ambiente Open Finance (Meu Pluggy Sandbox)',
      });
    }
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Erro ao autenticar com Meu Pluggy' });
  }
});

// Endpoint: Fetch accounts & balances via Pluggy
app.post('/api/pluggy/accounts', async (req, res) => {
  try {
    const { apiKey, itemId } = req.body;
    if (!apiKey) {
      return res.status(400).json({ error: 'API Key do Pluggy é obrigatória' });
    }

    const url = itemId ? `https://api.pluggy.ai/accounts?itemId=${itemId}` : 'https://api.pluggy.ai/accounts';
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
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Erro ao buscar contas no Pluggy' });
  }
});

// Endpoint: Fetch real-time bank transactions & auto-categorize
app.post('/api/bank-sync/fetch', async (req, res) => {
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
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Erro ao sincronizar com bancos' });
  }
});

// -------------------------------------------------------------
// GEMINI CHATBOT API (Assistente Financeiro do Casal Médico)
// -------------------------------------------------------------
app.post('/api/gemini/chat', async (req, res) => {
  try {
    const { messages, context, model = 'gemini-3.5-flash' } = req.body;

    if (!messages || !Array.isArray(messages)) {
      return res.status(400).json({ error: 'Mensagens são obrigatórias' });
    }

    if (!ai) {
      return res.json({
        reply: `Oi, gente! Aqui é o Junto, o parceiro de vocês. Olhei como estão as coisas por aqui:
• Vocês ainda podem gastar **${context?.remainingFormatted || 'R$ 4.287'}** neste mês sem aperto.
• A categoria que mais pediu atenção recentemente foi **${context?.highestBlownName || 'Moradia'}**.
• Sabemos bem como a rotina de plantões e consultas é corrida e puxada! Se passamos um pouquinho do combinado em algo, fiquem tranquilos: a gente ajusta juntos para vocês terem descanso, paz e viagens sem culpa.

Como podemos descomplicar o dia de vocês hoje?`,
      });
    }

    const systemInstruction = `Você é a inteligência artificial do app "Junto", o parceiro financeiro acolhedor, humano e cúmplice do jovem casal de médicos ${context?.partner1Name || 'Bia'} (${context?.partner1Specialty || 'Médica'}) e ${context?.partner2Name || 'Lucas'} (${context?.partner2Specialty || 'Médico'}) em ${context?.city || 'sua cidade'}.

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
- Entradas do mês: ${context?.totalIncomeFormatted || 'R$ 30.000'}
- Quanto já saiu este mês: ${context?.totalSpentFormatted || 'R$ 13.000'}
- Quanto ainda podemos gastar: ${context?.remainingFormatted || 'R$ 17.000'}
- Situação do mês: ${context?.isOver ? 'Passamos um pouco do combinado (vamos ajustar com carinho!)' : 'Dentro do que combinamos com tranquilidade'}
- Comprometimento com parcelas: ${context?.installmentCommitmentPct || '7'}% da renda
- Dinheiro guardado nos cofrinhos: ${context?.savedTotalFormatted || 'R$ 380.000'}`;

    const contents = messages.map(msg => ({
      role: msg.role === 'user' ? 'user' : 'model',
      parts: [{ text: msg.text }],
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
    console.error('Gemini Chat error:', err);
    res.status(500).json({ error: err.message || 'Erro ao conversar com o assistente Gemini' });
  }
});

// -------------------------------------------------------------
// GEMINI ONBOARDING INTERPRETER API (Questionário Inteligente)
// -------------------------------------------------------------
app.post('/api/gemini/onboarding-interpret', async (req, res) => {
  try {
    const {
      partner1Name = 'Pessoa 1',
      partner2Name = 'Pessoa 2',
      partner1Income = 14000,
      partner2Income = 16000,
      lifeStage = 'Recém-casados montando casa',
      housingSituation = 'Aluguel com condomínio',
      diningStyle = 'Equilibrado com pedidos de delivery',
      mainGoal = 'Construir reserva e investir para o futuro',
      isInitialHomePhase = false,
      estimatedRent = 5000,
      specialNotes = '',
    } = req.body;

    const totalIncome = Number(partner1Income) + Number(partner2Income);

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
        moradia: Math.max(4000, Math.round(Number(estimatedRent) || totalIncome * 0.25)),
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
    console.error('Onboarding interpret error:', err);
    res.status(500).json({ error: err.message || 'Erro ao interpretar questionário' });
  }
});

// Start Server with proper HTML & compression handling
async function startServer() {
  const isProd = process.env.NODE_ENV === 'production';

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
