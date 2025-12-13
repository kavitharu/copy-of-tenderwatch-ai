import React from 'react';
import { Tender } from '../types';

interface TenderListProps {
  tenders: Tender[];
}

export const TenderList: React.FC<TenderListProps> = ({ tenders }) => {
  if (tenders.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-64 border-2 border-dashed border-slate-300 rounded-lg text-slate-500 bg-slate-50">
        <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 mb-2 opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
        </svg>
        <p>No tenders found yet. Start a scan.</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {tenders.map((tender, idx) => (
        <div key={idx} className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm hover:shadow-md hover:border-blue-400 transition-all duration-300 flex flex-col">
          <div className="flex justify-between items-start mb-4">
            <span className="px-2 py-1 bg-blue-50 text-blue-700 text-xs font-medium rounded border border-blue-100">
              {tender.source}
            </span>
            <span className="text-slate-400 text-xs">{tender.dateFound}</span>
          </div>
          
          <h3 className="text-lg font-bold text-slate-900 mb-2 line-clamp-2" title={tender.title}>
            {tender.title}
          </h3>
          
          <p className="text-slate-600 text-sm mb-4 flex-grow leading-relaxed">
            {tender.snippet}
          </p>

          <div className="mb-4">
            <p className="text-xs text-slate-400 uppercase font-bold tracking-wider mb-1">Keywords Detected:</p>
            <div className="flex flex-wrap gap-1">
              {tender.keywordsFound.map(k => (
                <span key={k} className="text-xs bg-slate-100 text-slate-700 px-1.5 py-0.5 rounded border border-slate-200">
                  {k}
                </span>
              ))}
            </div>
          </div>

          <a 
            href={tender.url} 
            target="_blank" 
            rel="noopener noreferrer"
            className="mt-auto w-full bg-blue-600 hover:bg-blue-700 text-white text-center py-2 rounded-lg font-medium transition-colors flex items-center justify-center gap-2"
          >
            View Tender
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
            </svg>
          </a>
        </div>
      ))}
    </div>
  );
};