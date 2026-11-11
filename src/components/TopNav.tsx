import React from 'react';
import { PWAInstallButton } from './PWAInstallButton';

export type ActiveTab = 'monitor' | 'schedules' | 'storage' | 'cloud';

interface TopNavProps {
  activeTab: ActiveTab;
  setActiveTab: (tab: ActiveTab) => void;
  isRecording: boolean;
  onQuickRecordToggle: () => void;
  pendingSyncCount: number;
}

export const TopNav: React.FC<TopNavProps> = ({
  activeTab,
  setActiveTab,
  isRecording,
  onQuickRecordToggle,
  pendingSyncCount,
}) => {
  return (
    <header className="flex items-center justify-between gap-8 px-6 py-3.5 bg-[#0b0f17] border-b border-slate-800">
      {/* Zone 1: Single text element wordmark */}
      <a
        href="#"
        onClick={(e) => {
          e.preventDefault();
          setActiveTab('monitor');
        }}
        className="text-lg font-bold tracking-tight text-white whitespace-nowrap shrink-0 flex items-center gap-2.5"
      >
        <span className="w-2.5 h-2.5 rounded-full bg-rose-500 shadow-sm shadow-rose-500/50" />
        NDI AutoRecord Pro
      </a>

      {/* Zone 2: 4 clean single-line text navigation tabs */}
      <nav className="flex items-center gap-1 md:gap-2">
        <button
          onClick={() => setActiveTab('monitor')}
          className={`px-3 py-1.5 text-xs font-medium rounded transition-colors whitespace-nowrap shrink-0 ${
            activeTab === 'monitor'
              ? 'bg-slate-800 text-white shadow-xs'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          Monitor & Rekam
        </button>
        <button
          onClick={() => setActiveTab('schedules')}
          className={`px-3 py-1.5 text-xs font-medium rounded transition-colors whitespace-nowrap shrink-0 ${
            activeTab === 'schedules'
              ? 'bg-slate-800 text-white shadow-xs'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          Jadwal Otomatis
        </button>
        <button
          onClick={() => setActiveTab('storage')}
          className={`px-3 py-1.5 text-xs font-medium rounded transition-colors whitespace-nowrap shrink-0 ${
            activeTab === 'storage'
              ? 'bg-slate-800 text-white shadow-xs'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          Penyimpanan & Format
        </button>
        <button
          onClick={() => setActiveTab('cloud')}
          className={`relative px-3 py-1.5 text-xs font-medium rounded transition-colors whitespace-nowrap shrink-0 ${
            activeTab === 'cloud'
              ? 'bg-slate-800 text-white shadow-xs'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          Sinkronisasi Cloud
          {pendingSyncCount > 0 && (
            <span className="ml-1.5 px-1.5 py-0.2 bg-amber-500/20 text-amber-300 border border-amber-500/30 rounded text-[10px] font-mono-nums">
              {pendingSyncCount}
            </span>
          )}
        </button>
      </nav>

      {/* Zone 3: 1 primary action */}
      <div className="flex items-center gap-3 shrink-0">
        <PWAInstallButton />
        <button
          onClick={onQuickRecordToggle}
          className={`px-4 py-2 text-xs font-medium rounded transition-colors whitespace-nowrap shrink-0 flex items-center gap-2 ${
            isRecording
              ? 'bg-rose-600 hover:bg-rose-700 text-white shadow-sm shadow-rose-900/50'
              : 'bg-rose-600/90 hover:bg-rose-600 text-white'
          }`}
        >
          <span
            className={`w-2 h-2 rounded-full bg-white ${
              isRecording ? 'animate-ping' : ''
            }`}
          />
          {isRecording ? 'Hentikan Rekam (REC)' : 'Mulai Rekam Manual'}
        </button>
      </div>
    </header>
  );
};
