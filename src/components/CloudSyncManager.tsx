import React, { useState } from 'react';
import { Cloud, Wifi, WifiOff, RefreshCw, CheckCircle2, Clock, UploadCloud, Download, ExternalLink, Trash2, FolderSync } from 'lucide-react';
import { RecordingItem, CloudConfig, CloudProvider } from '../types';

interface CloudSyncManagerProps {
  isOnline: boolean;
  cloudConfig: CloudConfig;
  onUpdateCloudConfig: (config: CloudConfig) => void;
  recordings: RecordingItem[];
  onUploadSingle: (item: RecordingItem) => Promise<boolean>;
  onProcessSyncQueue: () => Promise<void>;
  onDeleteRecording: (id: string) => void;
  onToggleSimulatedNetwork: () => void;
  isSyncing: boolean;
  activeUploadId: string | null;
  uploadProgress: number;
}

export const CloudSyncManager: React.FC<CloudSyncManagerProps> = ({
  isOnline,
  cloudConfig,
  onUpdateCloudConfig,
  recordings,
  onUploadSingle,
  onProcessSyncQueue,
  onDeleteRecording,
  onToggleSimulatedNetwork,
  isSyncing,
  activeUploadId,
  uploadProgress,
}) => {
  const [saveSuccess, setSaveSuccess] = useState(false);

  const pendingCount = recordings.filter(
    (r) => r.cloudStatus === 'pending' || r.cloudStatus === 'failed'
  ).length;

  const syncedCount = recordings.filter((r) => r.cloudStatus === 'synced').length;

  // Format file size
  const formatSize = (bytes: number) => {
    const mb = bytes / (1024 * 1024);
    if (mb < 1000) return `${mb.toFixed(1)} MB`;
    return `${(mb / 1024).toFixed(2)} GB`;
  };

  // Format duration
  const formatDuration = (totalSec: number) => {
    const hours = Math.floor(totalSec / 3600);
    const mins = Math.floor((totalSec % 3600) / 60);
    const secs = totalSec % 60;
    if (hours > 0) return `${hours}j ${mins}m ${secs}d`;
    return `${mins}m ${secs}d`;
  };

  // Format timestamp
  const formatDate = (iso: string) => {
    try {
      const d = new Date(iso);
      return d.toLocaleString('id-ID', {
        dateStyle: 'medium',
        timeStyle: 'short',
      });
    } catch {
      return iso;
    }
  };

  // Download blob or simulated file
  const handleDownloadFile = (item: RecordingItem) => {
    if (item.blobUrl) {
      const a = document.createElement('a');
      a.href = item.blobUrl;
      a.download = item.fileName;
      a.click();
    } else {
      // Create empty container fallback for simulation
      const dummyBlob = new Blob([`NDI AutoRecord Pro: ${item.fileName}`], { type: 'video/mp4' });
      const url = URL.createObjectURL(dummyBlob);
      const a = document.createElement('a');
      a.href = url;
      a.download = item.fileName;
      a.click();
      URL.revokeObjectURL(url);
    }
  };

  return (
    <div className="space-y-6">
      {/* Network Status & Automatic Reconnect Sync Banner */}
      <div
        className={`border rounded-lg p-5 flex flex-wrap items-center justify-between gap-4 transition-colors ${
          isOnline
            ? 'bg-[#0f1828] border-blue-900/40 text-slate-200'
            : 'bg-[#1e1515] border-amber-900/50 text-amber-200'
        }`}
      >
        <div className="flex items-center gap-4">
          <div
            className={`w-12 h-12 rounded-lg flex items-center justify-center shrink-0 ${
              isOnline
                ? 'bg-emerald-950/60 text-emerald-400 border border-emerald-700/50'
                : 'bg-amber-950/60 text-amber-400 border border-amber-700/50'
            }`}
          >
            {isOnline ? <Wifi className="w-6 h-6" /> : <WifiOff className="w-6 h-6" />}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-base font-bold text-white">
                {isOnline ? 'Koneksi Internet Aktif (Online)' : 'Mode Offline Aktif (Tanpa Internet)'}
              </h3>
              <span
                className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded font-mono-nums ${
                  isOnline ? 'bg-emerald-900/60 text-emerald-300' : 'bg-amber-900/60 text-amber-300'
                }`}
              >
                {isOnline ? 'Cloud Siap' : 'Antrean Lokal'}
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-1">
              {isOnline
                ? `Sinkronisasi otomatis aktif: Rekaman offline akan diunggah ke ${cloudConfig.provider.toUpperCase()} (${cloudConfig.destinationFolder}).`
                : 'Aplikasi berjalan 100% offline. Semua hasil rekaman tersimpan aman di disk lokal dan otomatis masuk antrean cloud.'}
            </p>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-3">
          <button
            onClick={onToggleSimulatedNetwork}
            className={`px-3 py-2 text-xs font-semibold rounded border transition-colors ${
              isOnline
                ? 'bg-slate-900 border-slate-700 text-slate-300 hover:text-white hover:bg-slate-800'
                : 'bg-amber-800 hover:bg-amber-700 text-white border-amber-600'
            }`}
            title="Uji coba perubahan status online/offline untuk melihat auto-sinkronisasi"
          >
            {isOnline ? 'Simulasi: Putuskan Internet' : 'Simulasi: Hubungkan Internet (Pulih)'}
          </button>

          {isOnline && pendingCount > 0 && (
            <button
              onClick={() => onProcessSyncQueue()}
              disabled={isSyncing}
              className="flex items-center gap-2 px-4 py-2 bg-rose-600 hover:bg-rose-500 disabled:opacity-50 text-white text-xs font-bold rounded shadow transition-colors"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
              <span>{isSyncing ? 'Sedang Mengunggah...' : `Sinkronkan ${pendingCount} File Sekarang`}</span>
            </button>
          )}
        </div>
      </div>

      {/* Cloud Configuration Settings Deck */}
      <div className="bg-[#0f1420] border border-slate-800 rounded-lg p-5 space-y-4">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2.5">
            <Cloud className="w-5 h-5 text-rose-500" />
            <h3 className="text-sm font-bold text-white">Pengaturan Integrasi Cloud Storage</h3>
          </div>
          {saveSuccess && (
            <span className="text-xs text-emerald-400 flex items-center gap-1">
              <CheckCircle2 className="w-3.5 h-3.5" />
              Tersimpan
            </span>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Provider Selection */}
          <div className="space-y-1.5">
            <label className="text-xs text-slate-300 font-medium block">Penyedia Cloud:</label>
            <select
              value={cloudConfig.provider}
              onChange={(e) => {
                const next = { ...cloudConfig, provider: e.target.value as CloudProvider };
                onUpdateCloudConfig(next);
                setSaveSuccess(true);
                setTimeout(() => setSaveSuccess(false), 2000);
              }}
              className="w-full bg-slate-900 border border-slate-700 rounded px-3 py-2 text-xs text-slate-100 font-mono-nums"
            >
              <option value="google_drive">Google Drive Workspace</option>
              <option value="dropbox">Dropbox Business / Personal</option>
              <option value="s3">Amazon S3 / MinIO Object Storage</option>
              <option value="custom">WebDAV / SFTP Storage Server</option>
            </select>
          </div>

          {/* Account Email */}
          <div className="space-y-1.5">
            <label className="text-xs text-slate-300 font-medium block">Akun / Email Terhubung:</label>
            <input
              type="text"
              value={cloudConfig.accountEmail}
              onChange={(e) => {
                const next = { ...cloudConfig, accountEmail: e.target.value };
                onUpdateCloudConfig(next);
              }}
              className="w-full bg-slate-900 border border-slate-700 rounded px-3 py-2 text-xs font-mono-nums text-slate-100"
            />
          </div>

          {/* Destination Folder */}
          <div className="space-y-1.5">
            <label className="text-xs text-slate-300 font-medium block">Folder Tujuan di Cloud:</label>
            <input
              type="text"
              value={cloudConfig.destinationFolder}
              onChange={(e) => {
                const next = { ...cloudConfig, destinationFolder: e.target.value };
                onUpdateCloudConfig(next);
              }}
              className="w-full bg-slate-900 border border-slate-700 rounded px-3 py-2 text-xs font-mono-nums text-slate-100"
            />
          </div>
        </div>

        {/* Toggles */}
        <div className="pt-2 flex flex-wrap items-center justify-between gap-4 border-t border-slate-800/80 text-xs text-slate-300">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={cloudConfig.autoSyncOnReconnect}
              onChange={(e) => {
                const next = { ...cloudConfig, autoSyncOnReconnect: e.target.checked };
                onUpdateCloudConfig(next);
              }}
              className="rounded accent-rose-500 w-4 h-4"
            />
            <span className="font-semibold text-slate-100">
              Otomatis Sinkronkan Antrean Saat Internet Terhubung Kembali (Auto-Sync on Reconnect)
            </span>
          </label>

          <div className="flex items-center gap-2 text-slate-400 font-mono-nums">
            <span>Batas Kecepatan Unggah:</span>
            <select
              value={cloudConfig.bandwidthLimitMbps}
              onChange={(e) => {
                const next = { ...cloudConfig, bandwidthLimitMbps: Number(e.target.value) };
                onUpdateCloudConfig(next);
              }}
              className="bg-slate-900 border border-slate-700 rounded px-2 py-1 text-slate-200 text-xs"
            >
              <option value={10}>10 Mbps (Hemat Bandwidth)</option>
              <option value={50}>50 Mbps (Standar Broadcast)</option>
              <option value={100}>100 Mbps (Kecepatan Maksimal)</option>
            </select>
          </div>
        </div>
      </div>

      {/* Sync Queue & Recorded Archives Table */}
      <div className="bg-[#0f1420] border border-slate-800 rounded-lg overflow-hidden">
        <div className="p-4 border-b border-slate-800 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <FolderSync className="w-5 h-5 text-slate-400" />
            <h3 className="text-sm font-bold text-white">Daftar Rekaman & Status Sinkronisasi Cloud</h3>
          </div>
          <div className="flex items-center gap-4 text-xs font-mono-nums">
            <span className="text-emerald-400">Tersinkronisasi: <strong>{syncedCount}</strong></span>
            <span className="text-slate-700" aria-hidden="true">|</span>
            <span className="text-amber-400">Antrean Cloud: <strong>{pendingCount}</strong></span>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-slate-800 bg-[#090d14] text-slate-400 font-medium">
                <th className="py-3 px-4">Nama File Rekaman</th>
                <th className="py-3 px-4">Waktu & Tanggal</th>
                <th className="py-3 px-4">Durasi</th>
                <th className="py-3 px-4">Ukuran</th>
                <th className="py-3 px-4">Format</th>
                <th className="py-3 px-4">Status Cloud</th>
                <th className="py-3 px-4 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/80">
              {recordings.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-slate-500">
                    Belum ada rekaman di sistem. Jalankan rekaman terjadwal atau klik &apos;Mulai Rekam Manual&apos; di tab Monitor.
                  </td>
                </tr>
              ) : (
                recordings.map((item) => {
                  const isThisUploading = isSyncing && activeUploadId === item.id;
                  return (
                    <tr key={item.id} className="hover:bg-slate-800/30 transition-colors">
                      {/* File Name & Source */}
                      <td className="py-3 px-4">
                        <div className="font-semibold text-slate-100 font-mono-nums">{item.fileName}</div>
                        <div className="text-[11px] text-slate-400 mt-0.5">
                          {item.title} · <span className="text-slate-500">{item.sourceName}</span>
                        </div>
                      </td>

                      {/* Date & Time */}
                      <td className="py-3 px-4 font-mono-nums text-slate-300">
                        {formatDate(item.timestamp)}
                      </td>

                      {/* Duration */}
                      <td className="py-3 px-4 font-mono-nums text-slate-300">
                        {formatDuration(item.durationSeconds)}
                      </td>

                      {/* File Size */}
                      <td className="py-3 px-4 font-mono-nums font-bold text-slate-200">
                        {formatSize(item.fileSizeBytes)}
                      </td>

                      {/* Format */}
                      <td className="py-3 px-4 font-mono-nums uppercase">
                        <span className="px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 font-bold text-[10px]">
                          {item.format}
                        </span>
                      </td>

                      {/* Cloud Status */}
                      <td className="py-3 px-4">
                        {item.cloudStatus === 'synced' ? (
                          <div className="space-y-0.5">
                            <span className="inline-flex items-center gap-1.5 text-emerald-400 font-semibold">
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              <span>Tersinkronisasi</span>
                            </span>
                            {item.syncedAt && (
                              <div className="text-[10px] text-slate-500 font-mono-nums">
                                {formatDate(item.syncedAt)}
                              </div>
                            )}
                          </div>
                        ) : isThisUploading ? (
                          <div className="space-y-1 w-32">
                            <div className="flex justify-between text-[10px] font-mono-nums text-blue-400">
                              <span>Mengunggah...</span>
                              <span>{uploadProgress}%</span>
                            </div>
                            <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
                              <div
                                className="h-full bg-blue-500 transition-all duration-150"
                                style={{ width: `${uploadProgress}%` }}
                              />
                            </div>
                          </div>
                        ) : (
                          <div className="space-y-0.5">
                            <span className="inline-flex items-center gap-1.5 text-amber-400 font-medium">
                              <Clock className="w-3.5 h-3.5" />
                              <span>Antrean Cloud</span>
                            </span>
                            <div className="text-[10px] text-slate-500">
                              {isOnline ? 'Siap diunggah' : 'Menunggu jaringan'}
                            </div>
                          </div>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {/* Manual Upload trigger if pending */}
                          {item.cloudStatus !== 'synced' && isOnline && !isThisUploading && (
                            <button
                              onClick={() => onUploadSingle(item)}
                              className="p-1.5 text-slate-400 hover:text-emerald-400 hover:bg-slate-800 rounded transition-colors"
                              title="Unggah ke Cloud Sekarang"
                            >
                              <UploadCloud className="w-3.5 h-3.5" />
                            </button>
                          )}

                          {/* Download File */}
                          <button
                            onClick={() => handleDownloadFile(item)}
                            className="p-1.5 text-slate-400 hover:text-blue-400 hover:bg-slate-800 rounded transition-colors"
                            title="Unduh File Rekaman ke Komputer"
                          >
                            <Download className="w-3.5 h-3.5" />
                          </button>

                          {/* Delete Item */}
                          <button
                            onClick={() => onDeleteRecording(item.id)}
                            className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-slate-800 rounded transition-colors"
                            title="Hapus Rekaman"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
