import express from 'express';
import cron from 'node-cron';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenAI } from "@google/genai";
import fetch from 'node-fetch';
import cors from 'cors';

// Configuration
const app = express();
const PORT = process.env.PORT || 8080;
const API_KEY = process.env.API_KEY;
const RESEND_API_KEY = process.env.RESEND_API_KEY;

// Constants matching frontend
const TARGET_SITES = [
  { name: 'Maldives Gazette', url: 'https://www.gazette.gov.mv/iulaan' },
  { name: 'Sri Lanka Promise', url: 'https://promise.lk/' },
  { name: 'Sri Lanka Gov Gazette', url: 'http://documents.gov.lk/en/gazette.php' }
];

const TARGET_KEYWORDS = [
  "Autodesk", "Revit", "AutoCAD", "AEC Collection", "Civil 3D",
  "Adobe", "Creative Cloud", "Photoshop", "Illustrator",
  "Microsoft", "Office 365", "Azure",
  "Trimble", "SketchUp", "D5 Render"
];

const EMAIL_RECIPIENTS = [
  "krishan.p@amicisholdings.com",
  "prabath@amicisholdings.com",
  "deric@amicisholdings.com",
  "ktharika503@gmail.com"
];

// Middleware
app.use(cors()); // Enable CORS
app.use(express.json());

// --- API ROUTES (Defined BEFORE static files) ---

// 1. PROXY ENDPOINT
app.get('/proxy', async (req, res) => {
  const { url } = req.query;
  if (!url) {
    return res.status(400).send("Missing 'url' query parameter");
  }

  try {
    let targetUrl;
    try {
      targetUrl = new URL(url);
    } catch (e) {
      return res.status(400).send("Invalid URL");
    }

    console.log(`Proxying: ${targetUrl.toString()}`);

    const response = await fetch(targetUrl.toString(), {
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
        'Cache-Control': 'no-cache',
        'Upgrade-Insecure-Requests': '1'
      }
    });

    if (!response.ok) {
      console.error(`Proxy Target Error ${response.status}: ${url}`);
      // Return 500 so frontend tries next proxy, but send text for debugging
      return res.status(response.status).send(`Target Error: ${response.status}`);
    }

    // Forward content type
    const contentType = response.headers.get('content-type');
    if (contentType) res.setHeader('Content-Type', contentType);

    const text = await response.text();
    res.send(text);

  } catch (error) {
    console.error(`Proxy Exception:`, error.message);
    res.status(502).send(`Proxy Failed: ${error.message}`);
  }
});

// 2. Email Endpoint
app.post('/api/email', async (req, res) => {
  const { to, subject, html } = req.body;
  
  if (!RESEND_API_KEY) {
    console.error("Email request failed: RESEND_API_KEY is not set.");
    return res.status(500).json({ error: "Server missing RESEND_API_KEY" });
  }

  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        from: "TenderWatch <onboarding@resend.dev>", 
        to: to,
        subject: subject,
        html: html
      })
    });
    
    const data = await response.json();
    
    if (!response.ok) {
      console.error("Resend API Error:", data);
      return res.status(response.status).json(data);
    }
    
    res.json({ success: true, id: data.id });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// 3. Trigger Scan
app.get('/api/trigger-scan', async (req, res) => {
  runScan(); 
  res.json({ status: 'Scan started in background.' });
});

// --- SERVE STATIC FILES (AFTER API) ---
const __dirname = path.dirname(fileURLToPath(import.meta.url));
app.use(express.static(path.join(__dirname, 'dist')));

// Fallback for SPA
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

// --- BACKGROUND JOBS ---

async function analyzeWithGemini(content, baseUrl, siteName) {
  if (!API_KEY) {
    console.error("Missing Gemini API_KEY");
    return [];
  }
  const ai = new GoogleGenAI({ apiKey: API_KEY });
  const model = "gemini-2.0-flash";
  const todayStr = new Date().toISOString().split('T')[0];
  const pastDate = new Date();
  pastDate.setDate(pastDate.getDate() - 30);
  const pastDateStr = pastDate.toISOString().split('T')[0];

  const prompt = `
    Analyze provided HTML from "${siteName}" (Base: ${baseUrl}).
    RULES:
    - Current Date: ${todayStr}. Cutoff: ${pastDateStr}.
    - EXCLUDE tenders older than 30 days.
    - KEYWORDS: ${TARGET_KEYWORDS.join(", ")}.
    - Translate to English.
    - Return JSON array: [{ "title": "", "url": "", "snippet": "", "keywordsFound": [], "dateString": "" }]
    Content: ${content.substring(0, 60000)}
  `;

  try {
    const response = await ai.models.generateContent({
      model: model,
      contents: { parts: [{ text: prompt }] },
      config: { responseMimeType: "application/json" }
    });
    const text = response.text;
    return text ? JSON.parse(text) : [];
  } catch (error) {
    console.error(`Gemini Error for ${siteName}:`, error);
    return [];
  }
}

async function sendEmail(tenders) {
  if (!RESEND_API_KEY || tenders.length === 0) return;
  
  const html = `<h2>TenderWatch Report</h2><p>Found ${tenders.length} tenders.</p><ul>${tenders.map(t => `<li><a href="${t.url}">${t.title}</a><br><small>${t.source}</small></li>`).join('')}</ul>`;

  try {
    await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { "Authorization": `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: "TenderWatch <onboarding@resend.dev>", to: EMAIL_RECIPIENTS, subject: "[Auto-Scan] Tenders Found", html })
    });
    console.log("Report email sent.");
  } catch (e) {
    console.error("Email failed:", e);
  }
}

async function runScan() {
  console.log("Running Scan...");
  let allTenders = [];
  for (const site of TARGET_SITES) {
    try {
      // Use internal proxy logic or Jina
      const scrapeUrl = `https://r.jina.ai/${site.url}`;
      const res = await fetch(scrapeUrl);
      const content = await res.text();
      const tenders = await analyzeWithGemini(content, site.url, site.name);
      allTenders.push(...tenders.map(t => ({...t, source: site.name})));
    } catch (e) {
      console.error(`Scan error ${site.name}:`, e);
    }
  }
  await sendEmail(allTenders);
}

cron.schedule('0 10 * * *', runScan);

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});