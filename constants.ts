import { TargetSite } from './types';

export const TARGET_SITES: TargetSite[] = [
  {
    id: 'maldives-gazette',
    name: 'Maldives Gazette',
    url: 'https://www.gazette.gov.mv/iulaan',
    description: 'Scans for Dhivehi content, translates, and filters.'
  },
  {
    id: 'srilanka-promise',
    name: 'Sri Lanka Promise',
    url: 'https://promise.lk/',
    description: 'Monitors local Sri Lankan tender announcements.'
  },
  {
    id: 'sl-gazette',
    name: 'Sri Lanka Gov Gazette',
    url: 'http://documents.gov.lk/en/gazette.php',
    description: 'Official Government Gazette archive.'
  }
];

export const TARGET_KEYWORDS = [
  "Autodesk", "Revit", "AutoCAD", "AEC Collection", "Civil 3D",
  "Adobe", "Creative Cloud", "Photoshop", "Illustrator",
  "Microsoft", "Office 365", "Azure",
  "Trimble", "SketchUp",
  "D5 Render"
];

export const EMAIL_RECIPIENTS = [
  "krishan.p@amicisholdings.com",
  "prabath@amicisholdings.com",
  "deric@amicisholdings.com",
  "ktharika503@gmail.com"
];

// Priority List of Proxies (Redundancy Strategy)
export const PROXIES = [
  // 1. Internal Cloudflare Function (Best for Production)
  "/proxy?url=",

  // 2. Jina.ai Reader (bypasses Cloudflare, renders JS, returns clean markdown)
  "https://r.jina.ai/",

  // 3. AllOrigins JSON API (safe + reliable)
  "https://api.allorigins.win/get?url=",

  // 4. CORSProxy.io (public CORS proxy)
  "https://corsproxy.io/?",

  // 5. CodeTabs global proxy
  "https://api.codetabs.com/v1/proxy?quest="
];