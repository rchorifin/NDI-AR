import React, { useState, useEffect } from 'react';
import { Radio, Wifi, WifiOff, Bell, BellOff, Minus, Square, X } from 'lucide-react';
import { isSystemNotificationSupported, getSystemNotificationPermission, requestSystemNotificationPermission } from '../utils/notifications';

interface DesktopTitleBarProps {
  isOnline: boolean;
  isRecording: boolean;
  onToggleSimulatedNetwork: () => void;
  onOpenNotifications: () => void;
  unreadNotificationsCount: number;
}

export const DesktopTitleBar: React.FC<DesktopTitleBarProps> = ({
  isOnline,
  isRecording,
  onToggleSimulatedNetwork,
  onOpenNotifications,
  unreadNotificationsCount,
}) => {
  const [localTime, setLocalTime] = useState<string>('');
  const [utcTime, setUtcTime] = useState<string>('');
  const [notifPermission, setNotifPermission] = useState<NotificationPermission>('default');
  const [showCloseModal, setShowCloseModal] = useState(false);

  useEffect(() => {
    if (isSystemNotificationSupported()) {
      setNotifPermission(getSystemNotificationPermission());
    }

    const interval = setInterval(() => {
      const now = new Date();
      setLocalTime(
        now.toLocaleTimeString('id-ID', {
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
          hour12: false,
        })
      );
      setUtcTime(
        now.toLocaleTimeString('en-US', {
          timeZone: 'UTC',
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
          hour12: false,
        })
      );
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  const handleRequestNotification = async () => {
    const res = await requestSystemNotificationPermission();
    setNotifPermission(res);
  };

  return (
    <div className="bg-[#070a0f] border-b border-slate-800/80 px-3 py-1.5 flex items-center justify-between text-xs select-none">
      {/* Left: Desktop Window Identity */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2">
          <div className="w-5 h-5 rounded bg-rose-600 flex items-center justify-center font-bold text-white text-[10px] tracking-wider shadow-sm">
            NDI
          </div>
          <span className="font-semibold text-slate-200 tracking-tight text-xs">
            NDI AutoRecord Pro <span className="text-slate-500 font-normal">| Studio Workstation v3.4</span>
          </span>
        </div>

        {/* Live Recording Badge */}
        {isRecording && (
          <div className="flex items-center gap-1.5 bg-rose-950/80 border border-rose-600/50 px-2 py-0.5 rounded text-rose-300 font-medium animate-pulse">
            <span className="w-2 h-2 rounded-full bg-rose-500"></span>
            <span className="font-mono-nums font-bold tracking-wider">REC ON AIR</span>
          </div>
        )}
      </div>

      {/* Middle: Broadcast Master Clocks & Network Telemetry */}
      <div className="hidden lg:flex items-center gap-4 text-slate-400 font-mono-nums">
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] uppercase text-slate-500 font-sans tracking-wide">Waktu Lokal:</span>
          <span className="text-slate-200 font-medium">{localTime || '--:--:--'}</span>
        </div>
        <span className="text-slate-700" aria-hidden="true">|</span>
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] uppercase text-slate-500 font-sans tracking-wide">UTC Zulu:</span>
          <span className="text-slate-400">{utcTime || '--:--:--'}Z</span>
        </div>
        <span className="text-slate-700" aria-hidden="true">|</span>

        {/* Online / Offline status with interactive testing toggle */}
        <button
          onClick={onToggleSimulatedNetwork}
          title="Klik untuk mensimulasikan koneksi Online / Offline untuk pengujian cloud"
          className={`flex items-center gap-1.5 px-2 py-0.5 rounded transition-colors ${
            isOnline
              ? 'text-emerald-400 hover:bg-emerald-950/30'
              : 'text-amber-400 hover:bg-amber-950/30 font-medium'
          }`}
        >
          {isOnline ? <Wifi className="w-3.5 h-3.5" /> : <WifiOff className="w-3.5 h-3.5" />}
          <span>{isOnline ? 'Online (Jaringan Aktif)' : 'Offline (Simpan Lokal)'}</span>
        </button>
      </div>

      {/* Right: Notification Toggle & Window Control Buttons */}
      <div className="flex items-center gap-3">
        {/* System Notification Permission */}
        {notifPermission !== 'granted' ? (
          <button
            onClick={handleRequestNotification}
            className="flex items-center gap-1.5 text-amber-400 hover:text-amber-300 transition-colors px-2 py-0.5 rounded bg-amber-950/40 border border-amber-800/40 text-[11px]"
            title="Izinkan notifikasi desktop untuk status rekaman real-time"
          >
            <BellOff className="w-3.5 h-3.5" />
            <span>Aktifkan Notif OS</span>
          </button>
        ) : (
          <button
            onClick={onOpenNotifications}
            className="relative p-1 text-slate-400 hover:text-slate-200 transition-colors"
            title="Buka Pusat Notifikasi Sistem"
          >
            <Bell className="w-3.5 h-3.5" />
            {unreadNotificationsCount > 0 && (
              <span className="absolute top-0 right-0 w-2 h-2 bg-rose-500 rounded-full" />
            )}
          </button>
        )}

        {/* Desktop Window Controls */}
        <div className="flex items-center gap-1 border-l border-slate-800 pl-2">
          <button
            onClick={() => window.blur()}
            title="Minimize"
            className="w-6 h-6 rounded flex items-center justify-center text-slate-400 hover:text-slate-200 hover:bg-slate-800/60 transition-colors"
          >
            <Minus className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => {
              if (document.fullscreenElement) {
                document.exitFullscreen().catch(() => {});
              } else {
                document.documentElement.requestFullscreen().catch(() => {});
              }
            }}
            title="Maximize / Fullscreen"
            className="w-6 h-6 rounded flex items-center justify-center text-slate-400 hover:text-slate-200 hover:bg-slate-800/60 transition-colors"
          >
            <Square className="w-3 h-3" />
          </button>
          <button
            onClick={() => setShowCloseModal(true)}
            title="Tutup Aplikasi"
            className="w-6 h-6 rounded flex items-center justify-center text-slate-400 hover:text-white hover:bg-rose-600 transition-colors"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Confirmation Modal when Close clicked */}
      {showCloseModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-xs p-4">
          <div className="w-full max-w-md bg-[#0f1523] border border-slate-800 rounded-lg p-6 shadow-2xl text-left">
            <h3 className="text-base font-bold text-slate-100">Konfirmasi Keluar Aplikasi</h3>
            <p className="mt-2 text-sm text-slate-300">
              {isRecording
                ? 'Peringatan: Perekaman saat ini sedang berlangsung! Jika ditutup, file rekaman akan diselesaikan dan disimpan.'
                : 'Aplikasi beroperasi di background untuk memantau jadwal rekaman otomatis. Anda yakin ingin menutup workstation?'}
            </p>
            <div className="mt-6 flex items-center justify-end gap-3">
              <button
                onClick={() => setShowCloseModal(false)}
                className="px-4 py-2 text-xs font-medium text-slate-300 bg-slate-800 rounded hover:bg-slate-700 transition-colors"
              >
                Batal
              </button>
              <button
                onClick={() => setShowCloseModal(false)}
                className="px-4 py-2 text-xs font-medium text-white bg-rose-600 rounded hover:bg-rose-500 transition-colors"
              >
                Tetap Berjalan di Latar Belakang
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
