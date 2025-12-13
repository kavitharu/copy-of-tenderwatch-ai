export interface Tender {
  title: string;
  source: string;
  url: string;
  keywordsFound: string[];
  snippet: string; // The text context where keyword was found (translated if necessary)
  dateFound: string;
  originalLanguage?: string;
}

export interface LogEntry {
  id: string;
  timestamp: Date;
  message: string;
  type: 'info' | 'success' | 'error' | 'warning';
}

export interface TargetSite {
  id: string;
  name: string;
  url: string;
  description: string;
}

export interface ScanStatus {
  isScanning: boolean;
  progress: number; // 0 to 100
  currentTask: string;
}