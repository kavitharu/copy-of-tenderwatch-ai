import React, { useEffect, useRef } from 'react';
import { LogEntry } from '../types';

interface LogViewerProps {
  logs: LogEntry[];
}

export const LogViewer: React.FC<LogViewerProps> = ({ logs }) => {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  return (
    <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 h-64 overflow-y-auto font-mono text-sm shadow-inner">
      <h3 className="text-slate-500 text-xs font-bold uppercase mb-2 tracking-wider">System Logs</h3>
      <div className="flex flex-col gap-1">
        {logs.map((log) => (
          <div key={log.id} className="flex gap-2">
            <span className="text-slate-400 whitespace-nowrap text-xs">
              [{log.timestamp.toLocaleTimeString()}]
            </span>
            <span className={`${
              log.type === 'error' ? 'text-red-600 font-semibold' :
              log.type === 'success' ? 'text-emerald-600 font-medium' :
              log.type === 'warning' ? 'text-amber-600' :
              'text-slate-700'
            }`}>
              {log.message}
            </span>
          </div>
        ))}
        {logs.length === 0 && <span className="text-slate-400 italic">Ready to scan...</span>}
        <div ref={bottomRef} />
      </div>
    </div>
  );
};