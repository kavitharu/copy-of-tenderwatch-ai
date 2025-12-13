/**
 * Cloudflare Pages Function for Automated Scanning.
 * This can be triggered by a Cron Job or manually.
 */

// We define constants here because importing from ../constants might fail in some Pages build environments
// if the shared file isn't bundled correctly for the Functions runtime.
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

/**
 * Server-side version of the Gemini analysis logic.
 * Uses direct REST fetch to avoid dependency issues in lightweight Functions.
 */
async function analyzeWithGemini(content, baseUrl, siteName, apiKey) {
  const model = "gemini-2.0-flash";
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

  const todayStr = new Date().toISOString().split('T')[0];
  const pastDate = new Date();
  pastDate.setDate(pastDate.getDate() - 30);
  const pastDateStr = pastDate.toISOString().split('T')[0];

  const prompt = `
    Analyze provided HTML from "${siteName}" (Base: ${baseUrl}).
    1. DATE FILTER: Current Date ${todayStr}. Exclude tenders older than ${pastDateStr}. If no date, include it.
    2. KEYWORDS: Find tenders containing: ${TARGET_KEYWORDS.join(", ")}.
    3. Translate to English.
    4. Return valid JSON array: [{ "title": "", "url": "", "snippet": "", "keywordsFound": [] }]
    
    Content: ${content.substring(0, 50000)}
  `;

  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { responseMimeType: "application/json" }
    })
  });

  if (!response.ok) return [];
  const json = await response.json();
  const text = json.candidates?.[0]?.content?.parts?.[0]?.text;
  
  try {
    return text ? JSON.parse(text) : [];
  } catch (e) {
    return [];
  }
}

async function sendEmail(tenders, apiKey) {
  if (tenders.length === 0) return;
  
  const resendUrl = "https://api.resend.com/emails";
  let html = `<h2>TenderWatch Automated Report</h2><p>Found ${tenders.length} new tenders.</p><ul>`;
  
  tenders.forEach(t => {
    html += `<li><strong>${t.title}</strong><br><a href="${t.url}">${t.url}</a><br><small>${t.source}</small></li>`;
  });
  html += "</ul>";

  await fetch(resendUrl, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      from: "TenderWatch <onboarding@resend.dev>",
      to: EMAIL_RECIPIENTS,
      subject: `[Auto-Scan] ${tenders.length} New Tenders Found`,
      html: html
    })
  });
}

export async function onRequest(context) {
  const { env } = context;
  const apiKey = env.API_KEY;
  const resendKey = env.RESEND_API_KEY;

  if (!apiKey || !resendKey) {
    return new Response("Missing API Keys", { status: 500 });
  }

  let allTenders = [];

  // Parallel scanning
  const scanPromises = TARGET_SITES.map(async (site) => {
    try {
      // Use Jina.ai for clean server-side scraping
      const scrapeUrl = `https://r.jina.ai/${site.url}`;
      const res = await fetch(scrapeUrl, { headers: { 'x-no-cache': 'true' } });
      const content = await res.text();
      
      const tenders = await analyzeWithGemini(content, site.url, site.name, apiKey);
      return tenders.map(t => ({ ...t, source: site.name }));
    } catch (e) {
      console.error(`Error scanning ${site.name}:`, e);
      return [];
    }
  });

  const results = await Promise.all(scanPromises);
  results.forEach(arr => allTenders.push(...arr));

  if (allTenders.length > 0) {
    await sendEmail(allTenders, resendKey);
  }

  return new Response(JSON.stringify({ 
    status: "Success", 
    tendersFound: allTenders.length,
    timestamp: new Date().toISOString()
  }), {
    headers: { "Content-Type": "application/json" }
  });
}