import React from 'react';
import { Bell, CheckCheck, Trash2, X, Volume2, ShieldCheck, AlertCircle, Info, Radio } from 'lucide-react';
import { SystemNotificationItem } from '../types';
import { playNotificationChime, requestSystemNotificationPermission, getSystemNotificationPermission } from '../utils/notifications';

interface NotificationCenterProps {
  isOpen: boolean;
  onClose: () => void;
  notifications: SystemNotificationItem[];
  onClearAll: () => void;
  onMarkAllRead: () => void;
}

export const NotificationCenter: React.FC<NotificationCenterProps> = ({
  isOpen,
  onClose,
  notifications,
  onClearAll,
  onMarkAllRead,
}) => {
  if (!isOpen) return null;

  const permission = typeof window !== 'undefined' ? getSystemNotificationPermission() : 'denied';

  const handleAuthorize = async () => {
    await requestSystemNotificationPermission();
  };

  const formatTimestamp = (iso: string) => {
    try {
      const d = new Date(iso);
      return d.toLocaleTimeString('id-ID', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false,
      });
    } catch {
      return iso;
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="w-full max-w-md bg-[#0d121c] border-l border-slate-800 h-full flex flex-col shadow-2xl">
        {/* Header */}
        <div className="p-4 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Bell className="w-4 h-4 text-rose-500" />
            <h3 className="text-sm font-bold text-white">Pusat Notifikasi Sistem Real-Time</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* OS Notification Status Banner */}
        <div className="p-3 bg-slate-900/90 border-b border-slate-800 text-xs">
          {permission === 'granted' ? (
            <div className="flex items-center justify-between text-emerald-400">
              <span className="flex items-center gap-1.5 font-medium">
                <ShieldCheck className="w-4 h-4" />
                Notifikasi Sistem OS Aktif
              </span>
              <span className="text-[10px] text-slate-400 font-mono-nums">Browser Native API</span>
            </div>
          ) : (
            <div className="flex items-center justify-between gap-2 text-amber-300">
              <span className="flex items-center gap-1.5">
                <AlertCircle className="w-4 h-4 text-amber-400 shrink-0" />
                <span>Notifikasi desktop OS belum diizinkan</span>
              </span>
              <button
                onClick={handleAuthorize}
                className="px-2 py-1 bg-amber-600 hover:bg-amber-500 text-white rounded text-[10px] font-bold shrink-0 transition-colors"
              >
                Izinkan OS
              </button>
            </div>
          )}

          {/* Audio Chime Test Strip */}
          <div className="mt-2 pt-2 border-t border-slate-800/80 flex items-center justify-between text-[11px] text-slate-400">
            <span>Uji Nada Studio:</span>
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => playNotificationChime('recording')}
                className="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-rose-400 font-mono-nums text-[10px]"
              >
                REC Chime
              </button>
              <button
                onClick={() => playNotificationChime('success')}
                className="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-emerald-400 font-mono-nums text-[10px]"
              >
                Selesai
              </button>
              <button
                onClick={() => playNotificationChime('alert')}
                className="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-amber-400 font-mono-nums text-[10px]"
              >
                Peringatan
              </button>
            </div>
          </div>
        </div>

        {/* Notifications List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {notifications.length === 0 ? (
            <div className="py-12 text-center text-slate-500 text-xs">
              Belum ada riwayat notifikasi. Semua aktivitas rekaman dan cloud akan dicatat di sini.
            </div>
          ) : (
            notifications.map((item) => {
              const isRec = item.type === 'recording';
              const isSuccess = item.type === 'success';
              const isWarn = item.type === 'warning' || item.type === 'error';

              return (
                <div
                  key={item.id}
                  className={`p-3 rounded-lg border text-xs transition-all ${
                    isRec
                      ? 'bg-rose-950/20 border-rose-800/40 text-slate-200'
                      : isSuccess
                      ? 'bg-emerald-950/20 border-emerald-800/40 text-slate-200'
                      : isWarn
                      ? 'bg-amber-950/20 border-amber-800/40 text-slate-200'
                      : 'bg-slate-900 border-slate-800 text-slate-300'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span
                      className={`font-semibold flex items-center gap-1.5 ${
                        isRec
                          ? 'text-rose-400'
                          : isSuccess
                          ? 'text-emerald-400'
                          : isWarn
                          ? 'text-amber-400'
                          : 'text-slate-200'
                      }`}
                    >
                      {isRec && <Radio className="w-3.5 h-3.5 animate-pulse" />}
                      {item.title}
                    </span>
                    <span className="text-[10px] text-slate-500 font-mono-nums">
                      {formatTimestamp(item.timestamp)}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-400 leading-relaxed">{item.message}</p>
                </div>
              );
            })
          )}
        </div>

        {/* Footer Actions */}
        <div className="p-3 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400">
          <button
            onClick={onMarkAllRead}
            className="flex items-center gap-1 hover:text-white transition-colors"
          >
            <CheckCheck className="w-3.5 h-3.5" />
            <span>Tandai Semua Terbaca</span>
          </button>
          <button
            onClick={onClearAll}
            className="flex items-center gap-1 hover:text-rose-400 transition-colors"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Bersihkan Riwayat</span>
          </button>
        </div>
      </div>
    </div>
  );
};
