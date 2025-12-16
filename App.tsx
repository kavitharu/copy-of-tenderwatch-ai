import React, { useState, useCallback } from 'react';
import { TARGET_SITES, EMAIL_RECIPIENTS, TARGET_KEYWORDS } from './constants';
import { analyzeSiteContent } from './services/geminiService';
import { triggerMailto } from './services/emailService';
import { Tender, LogEntry, ScanStatus } from './types';
import { LogViewer } from './components/LogViewer';
import { TenderList } from './components/TenderList';

// Helper to generate unique IDs
const uid = () => Math.random().toString(36).substr(2, 9);

function App() {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [tenders, setTenders] = useState<Tender[]>([]);
  const [status, setStatus] = useState<ScanStatus>({
    isScanning: false,
    progress: 0,
    currentTask: 'Idle'
  });

  const addLog = useCallback((message: string, type: LogEntry['type'] = 'info') => {
    setLogs(prev => [...prev, { id: uid(), timestamp: new Date(), message, type }]);
  }, []);

  /**
   * Fetches content with a robust fallback strategy.
   * Strategy:
   * 1. Try Local Proxy (Direct) -> works for most sites if server is running.
   * 2. Try Local Proxy (Jina) -> uses local server to fetch Jina (bypasses browser CORS).
   * 3. Try AllOrigins (Public Proxy) -> fallback if local server is dead.
   */
  const fetchWithFallback = async (targetUrl: string) => {
    const errors: string[] = [];
    
    // Strategy Definitions
    const strategies = [
      { 
        name: "Local Proxy", 
        url: (u: string) => `/proxy?url=${encodeURIComponent(u)}` 
      },
      { 
        name: "Local Proxy via Jina", 
        url: (u: string) => `/proxy?url=${encodeURIComponent("https://r.jina.ai/" + u)}` 
      },
      {
        name: "AllOrigins (Public)",
        url: (u: string) => `https://api.allorigins.win/get?url=${encodeURIComponent(u)}`,
        isJson: true
      }
    ];

    for (const strategy of strategies) {
      const fetchUrl = strategy.url(targetUrl);
      
      try {
        const res = await fetch(fetchUrl);
        
        if (!res.ok) {
          throw new Error(`HTTP ${res.status}`);
        }

        let text = '';
        
        if (strategy.isJson) {
          const json = await res.json();
          text = json.contents;
        } else {
          text = await res.text();
        }

        // Validate content
        if (!text || text.length < 50) {
          throw new Error("Empty or too short content");
        }

        // Check for common proxy error responses or SPA fallback
        if (text.includes("<!DOCTYPE html>") && text.includes("TenderWatch AI")) {
          throw new Error("Proxy returned app index.html (Server not reachable?)");
        }

        addLog(`Fetched ${new URL(targetUrl).hostname} via ${strategy.name}`, 'success');
        return text;

      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        errors.push(`${strategy.name}: ${msg}`);
      }
    }

    console.error("Fetch failed:", errors);
    throw new Error(`All strategies failed. ${errors[0]}`);
  };

  const handleScan = async () => {
    if (status.isScanning) return;
    
    setStatus({ isScanning: true, progress: 5, currentTask: 'Initializing Scan...' });
    setTenders([]); 
    addLog('Starting filtered tender scan (Last 30 Days)...', 'info');

    let allFoundTenders: Tender[] = [];
    
    // Fix: Use import.meta.env instead of process.env for Vite compatibility
    const apiKey = import.meta.env.API_KEY || "";

    try {
      const totalSites = TARGET_SITES.length;
      
      for (let i = 0; i < totalSites; i++) {
        const site = TARGET_SITES[i];
        const progressPerSite = 90 / totalSites;
        const currentProgress = 5 + (i * progressPerSite);

        setStatus({ isScanning: true, progress: currentProgress, currentTask: `Scanning ${site.name}...` });
        addLog(`Fetching content from ${site.name}...`, 'info');

        try {
          const htmlContent = await fetchWithFallback(site.url);
          
          addLog(`Content received. Analyzing...`, 'info');

          const analyzedTenders = await analyzeSiteContent(htmlContent, site.url, site.name, apiKey);
          
          if (analyzedTenders && analyzedTenders.length > 0) {
             addLog(`Found ${analyzedTenders.length} relevant tenders on ${site.name}!`, 'success');
             
             const formattedTenders: Tender[] = analyzedTenders.map((t: any) => ({
               ...t,
               source: site.name,
               dateFound: new Date().toLocaleDateString()
             }));

             allFoundTenders = [...allFoundTenders, ...formattedTenders];
             setTenders(prev => [...prev, ...formattedTenders]);
          } else {
            addLog(`No matching recent tenders found on ${site.name}.`, 'info');
          }

        } catch (error) {
          console.error(error);
          addLog(`Failed to scan ${site.name}: ${error instanceof Error ? error.message : 'Unknown error'}`, 'error');
        }
      }

      setStatus({ isScanning: false, progress: 100, currentTask: 'Scan Complete' });
      
      if (allFoundTenders.length > 0) {
        addLog(`Scan complete. Total tenders found: ${allFoundTenders.length}`, 'success');
        addLog(`Initiating email notification...`, 'info');
        
        const emailResult = await triggerMailto(allFoundTenders);
        
        if (emailResult.method === 'api' && emailResult.success) {
           addLog(`Email successfully sent to recipients via Server.`, 'success');
        } else if (emailResult.method === 'mailto') {
           addLog(`Automated email failed. Opened default mail client with draft.`, 'warning');
        } else {
           addLog(`Failed to send email. Check logs.`, 'error');
        }

      } else {
        addLog('Scan complete. No recent tenders found.', 'warning');
      }

    } catch (error) {
      setStatus({ isScanning: false, progress: 0, currentTask: 'Error' });
      addLog(`Critical System Error: ${error}`, 'error');
    }
  };

  const triggerBackgroundScan = async () => {
    if (!confirm("Trigger background scan on server?")) return;
    addLog("Triggering server-side scan...", "info");
    try {
      const res = await fetch('/api/trigger-scan');
      if (!res.ok) throw new Error(res.statusText);
      const data = await res.json();
      addLog(`Server: ${data.status}`, 'success');
    } catch(e) {
      addLog(`Trigger Failed: ${e}`, 'error');
    }
  };

  return (
    <div className="min-h-screen bg-white p-6 md:p-12 max-w-7xl mx-auto text-slate-900">
      <header className="flex flex-col md:flex-row justify-between items-center mb-8 border-b border-slate-200 pb-6">
        <div>
          <h1 className="text-3xl font-bold text-blue-600 tracking-tight">TenderWatch AI</h1>
          <p className="text-slate-500 mt-2">Automated Procurement Monitoring System (Last 30 Days)</p>
        </div>
        <div className="mt-4 md:mt-0 flex flex-col items-end">
          <div className="flex -space-x-2 mb-2">
            {EMAIL_RECIPIENTS.map((email, i) => (
              <div key={i} className="w-8 h-8 rounded-full bg-slate-100 border-2 border-white flex items-center justify-center text-xs text-slate-600 font-medium shadow-sm" title={email}>
                {email.charAt(0).toUpperCase()}
              </div>
            ))}
          </div>
          <div className="flex gap-2">
            <span className="text-xs text-slate-500">Auto-Scan: Daily 10:00 AM</span>
            <button onClick={triggerBackgroundScan} className="text-xs text-blue-500 underline">Test Remote</button>
          </div>
        </div>
      </header>

      <main className="grid grid-cols-1 lg:grid-cols-4 gap-8">
        {/* Left Column: Controls & Logs */}
        <div className="lg:col-span-1 space-y-6">
          <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-200">
            <h2 className="text-lg font-semibold text-slate-900 mb-4">Scanner Control</h2>
            
            <div className="mb-6">
              <p className="text-sm text-slate-500 mb-2">Target Keywords:</p>
              <div className="flex flex-wrap gap-1">
                {TARGET_KEYWORDS.slice(0, 6).map(k => (
                  <span key={k} className="text-[10px] bg-slate-100 text-slate-600 px-1 py-0.5 rounded border border-slate-200">{k}</span>
                ))}
                <span className="text-[10px] text-slate-400 px-1 self-center">+{TARGET_KEYWORDS.length - 6} more</span>
              </div>
            </div>

            <button
              onClick={handleScan}
              disabled={status.isScanning}
              className={`w-full py-3 px-4 rounded-lg font-bold text-white shadow-md transition-all transform active:scale-95 ${
                status.isScanning 
                  ? 'bg-slate-400 cursor-not-allowed opacity-75' 
                  : 'bg-blue-600 hover:bg-blue-700'
              }`}
            >
              {status.isScanning ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Scanning...
                </span>
              ) : (
                'START SCAN'
              )}
            </button>

            {status.isScanning && (
              <div className="mt-4">
                <div className="flex justify-between text-xs text-slate-500 mb-1">
                  <span>{status.currentTask}</span>
                  <span>{Math.round(status.progress)}%</span>
                </div>
                <div className="w-full bg-slate-100 rounded-full h-2">
                  <div 
                    className="bg-blue-600 h-2 rounded-full transition-all duration-300 ease-out"
                    style={{ width: `${status.progress}%` }}
                  />
                </div>
              </div>
            )}
          </div>

          <LogViewer logs={logs} />
        </div>

        {/* Right Column: Results */}
        <div className="lg:col-span-3">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold text-slate-900">Found Opportunities</h2>
            <span className="bg-blue-100 text-blue-800 text-xs font-bold px-2 py-1 rounded-full">
              {tenders.length}
            </span>
          </div>
          
          <TenderList tenders={tenders} />
        </div>
      </main>
    </div>
  );
}

export default App;
