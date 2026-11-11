import React, { useState } from 'react';
import { HardDrive, FolderOpen, Sliders, CheckCircle2, AlertTriangle, FileVideo, Cpu } from 'lucide-react';
import { StorageConfig, CompressionSettings, VideoFormat, CompressionPresetId } from '../types';
import { saveStorageConfig, saveCompressionConfig } from '../utils/storage';
import { sendSystemNotification } from '../utils/notifications';

interface StorageSettingsProps {
  storageConfig: StorageConfig;
  setStorageConfig: React.Dispatch<React.SetStateAction<StorageConfig>>;
  compressionConfig: CompressionSettings;
  setCompressionConfig: React.Dispatch<React.SetStateAction<CompressionSettings>>;
}

export const StorageSettings: React.FC<StorageSettingsProps> = ({
  storageConfig,
  setStorageConfig,
  compressionConfig,
  setCompressionConfig,
}) => {
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Update storage path
  const handleUpdateDirectory = (newPath: string) => {
    const updated = { ...storageConfig, directoryPath: newPath };
    setStorageConfig(updated);
    saveStorageConfig(updated);
  };

  // Directory picker via modern File System Access API
  const handleBrowseFolder = async () => {
    if ('showDirectoryPicker' in window) {
      try {
        const dirHandle = await (window as unknown as { showDirectoryPicker: () => Promise<{ name: string }> }).showDirectoryPicker();
        if (dirHandle && dirHandle.name) {
          handleUpdateDirectory(`C:\\Recordings\\${dirHandle.name}\\`);
          sendSystemNotification({
            title: 'Folder Penyimpanan Dipilih',
            message: `Jalur penyimpanan diubah ke: ${dirHandle.name}`,
            type: 'info',
          });
        }
      } catch (err) {
        // User cancelled picker
      }
    } else {
      alert('Gunakan kolom teks di bawah untuk memasukkan jalur folder penyimpanan desktop Anda.');
    }
  };

  // Change preset
  const handlePresetSelect = (presetId: CompressionPresetId) => {
    let settings: CompressionSettings = { ...compressionConfig, presetId };
    if (presetId === 'master') {
      settings = {
        ...settings,
        resolution: '1080p',
        width: 1920,
        height: 1080,
        fps: 60,
        videoBitrateKbps: 15000,
        audioBitrateKbps: 320,
        videoCodec: 'h264',
        audioCodec: 'aac',
      };
    } else if (presetId === 'high') {
      settings = {
        ...settings,
        resolution: '1080p',
        width: 1920,
        height: 1080,
        fps: 60,
        videoBitrateKbps: 8000,
        audioBitrateKbps: 256,
        videoCodec: 'h264',
        audioCodec: 'aac',
      };
    } else if (presetId === 'standard') {
      settings = {
        ...settings,
        resolution: '720p',
        width: 1280,
        height: 720,
        fps: 30,
        videoBitrateKbps: 4000,
        audioBitrateKbps: 192,
        videoCodec: 'h264',
        audioCodec: 'aac',
      };
    } else if (presetId === 'compact') {
      settings = {
        ...settings,
        resolution: '720p',
        width: 1280,
        height: 720,
        fps: 24,
        videoBitrateKbps: 2000,
        audioBitrateKbps: 128,
        videoCodec: 'vp9',
        audioCodec: 'opus',
      };
    }

    setCompressionConfig(settings);
    saveCompressionConfig(settings);
    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 2000);
  };

  // Calculate estimated file size
  const totalBitrateKbps = compressionConfig.videoBitrateKbps + compressionConfig.audioBitrateKbps;
  // Size per hour in GB = (kbps * 3600) / (8 * 1024 * 1024)
  const size1HourGb = (totalBitrateKbps * 3600) / (8 * 1024 * 1024);
  const size6HoursGb = size1HourGb * 6;
  const size24HoursGb = size1HourGb * 24;

  // Disk space calculations
  const totalDiskGb = storageConfig.availableDiskSpaceGb + storageConfig.usedDiskSpaceGb;
  const usedPercent = Math.round((storageConfig.usedDiskSpaceGb / totalDiskGb) * 100);

  return (
    <div className="space-y-6">
      {/* Section 1: Storage Path & Disk Usage */}
      <div className="bg-[#0f1420] border border-slate-800 rounded-lg p-5 space-y-4">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2.5">
            <HardDrive className="w-5 h-5 text-rose-500" />
            <h3 className="text-sm font-bold text-white">Jalur Direktori Penyimpanan Rekaman</h3>
          </div>
          <span className="text-xs text-slate-400 font-mono-nums">
            Sisa Ruang: <strong className="text-emerald-400">{storageConfig.availableDiskSpaceGb} GB</strong>
          </span>
        </div>

        {/* Directory Input */}
        <div className="space-y-2">
          <label className="text-xs text-slate-300 font-medium">
            Lokasi Folder Penyimpanan Lokal:
          </label>
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={storageConfig.directoryPath}
              onChange={(e) => handleUpdateDirectory(e.target.value)}
              className="flex-1 bg-slate-900 border border-slate-700 rounded px-3 py-2 text-xs font-mono-nums text-slate-100 focus:outline-hidden focus:border-rose-500"
            />
            <button
              onClick={handleBrowseFolder}
              className="flex items-center gap-1.5 px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium rounded border border-slate-700 transition-colors"
            >
              <FolderOpen className="w-4 h-4 text-slate-400" />
              <span>Telusuri...</span>
            </button>
          </div>
          <p className="text-[11px] text-slate-500">
            Hasil rekaman terjadwal dan manual akan otomatis disimpan ke folder di atas dengan penamaan berkode waktu (contoh: REC_YYYYMMDD_HHMMSS_Sumber.mp4).
          </p>
        </div>

        {/* Disk Capacity Bar */}
        <div className="space-y-1.5 pt-2">
          <div className="flex justify-between text-xs text-slate-400 font-mono-nums">
            <span>Kapasitas Drive ({usedPercent}% Terpakai)</span>
            <span>{storageConfig.usedDiskSpaceGb} GB digunakan dari {totalDiskGb.toFixed(0)} GB</span>
          </div>
          <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden">
            <div
              className={`h-full transition-all duration-300 ${
                usedPercent > 85 ? 'bg-rose-500' : usedPercent > 70 ? 'bg-amber-500' : 'bg-emerald-500'
              }`}
              style={{ width: `${usedPercent}%` }}
            />
          </div>
        </div>
      </div>

      {/* Section 2: Format & Compression Presets */}
      <div className="bg-[#0f1420] border border-slate-800 rounded-lg p-5 space-y-5">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2.5">
            <FileVideo className="w-5 h-5 text-rose-500" />
            <h3 className="text-sm font-bold text-white">Format File & Preset Kompresi</h3>
          </div>
          {saveSuccess && (
            <span className="text-xs text-emerald-400 flex items-center gap-1">
              <CheckCircle2 className="w-3.5 h-3.5" />
              Pengaturan Tersimpan
            </span>
          )}
        </div>

        {/* Container Format Selection: MP4 vs MKV */}
        <div className="space-y-2">
          <label className="text-xs text-slate-300 font-medium">Format Wadah File (Container):</label>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {/* MP4 Option */}
            <div
              onClick={() => {
                const next = { ...compressionConfig, format: 'mp4' as VideoFormat };
                setCompressionConfig(next);
                saveCompressionConfig(next);
              }}
              className={`p-3.5 rounded-lg border cursor-pointer transition-all ${
                compressionConfig.format === 'mp4'
                  ? 'bg-rose-950/20 border-rose-600 text-white shadow-sm'
                  : 'bg-slate-900 border-slate-800 text-slate-300 hover:border-slate-700'
              }`}
            >
              <div className="flex items-center justify-between mb-1">
                <span className="font-bold text-sm tracking-wide">MP4 (MPEG-4 Part 14)</span>
                <span className="text-[10px] uppercase font-mono-nums px-1.5 py-0.5 rounded bg-slate-800 text-slate-300">
                  Standar Universal
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Kompatibilitas tertinggi dengan Adobe Premiere, DaVinci Resolve, browser, dan pemutar media smart TV.
              </p>
            </div>

            {/* MKV Option */}
            <div
              onClick={() => {
                const next = { ...compressionConfig, format: 'mkv' as VideoFormat };
                setCompressionConfig(next);
                saveCompressionConfig(next);
              }}
              className={`p-3.5 rounded-lg border cursor-pointer transition-all ${
                compressionConfig.format === 'mkv'
                  ? 'bg-rose-950/20 border-rose-600 text-white shadow-sm'
                  : 'bg-slate-900 border-slate-800 text-slate-300 hover:border-slate-700'
              }`}
            >
              <div className="flex items-center justify-between mb-1">
                <span className="font-bold text-sm tracking-wide">MKV (Matroska Video)</span>
                <span className="text-[10px] uppercase font-mono-nums px-1.5 py-0.5 rounded bg-slate-800 text-slate-300">
                  Crash-Resistant
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Wadah tahan kerusakan jika listrik mati tiba-tiba atau software terputus mendadak di tengah siaran panjang.
              </p>
            </div>
          </div>
        </div>

        {/* Compression Presets */}
        <div className="space-y-2">
          <label className="text-xs text-slate-300 font-medium">Preset Kualitas & Kompresi:</label>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {[
              {
                id: 'master' as CompressionPresetId,
                title: 'Broadcast Master',
                res: '1080p 60fps',
                vBitrate: '15,000 kbps (15 Mbps)',
                aBitrate: '320 kbps AAC',
                desc: 'Kualitas master tanpa kompromi untuk rekaman arsip utama studio.',
              },
              {
                id: 'high' as CompressionPresetId,
                title: 'High Production',
                res: '1080p 60fps',
                vBitrate: '8,000 kbps (8 Mbps)',
                aBitrate: '256 kbps AAC',
                desc: 'Rasio kualitas dan ukuran seimbang untuk siaran TV harian.',
              },
              {
                id: 'standard' as CompressionPresetId,
                title: 'Standard HD',
                res: '720p 30fps',
                vBitrate: '4,000 kbps (4 Mbps)',
                aBitrate: '192 kbps',
                desc: 'Optimal untuk live streaming dan distribusi web ringan.',
              },
              {
                id: 'compact' as CompressionPresetId,
                title: 'Compact Space',
                res: '720p 24fps',
                vBitrate: '2,000 kbps (2 Mbps)',
                aBitrate: '128 kbps',
                desc: 'Hemat ruang penyimpanan untuk dokumentasi jangka panjang.',
              },
            ].map((p) => {
              const isActive = compressionConfig.presetId === p.id;
              return (
                <div
                  key={p.id}
                  onClick={() => handlePresetSelect(p.id)}
                  className={`p-3.5 rounded-lg border cursor-pointer transition-all flex flex-col justify-between ${
                    isActive
                      ? 'bg-blue-950/20 border-blue-500 text-white shadow-xs'
                      : 'bg-slate-900 border-slate-800 text-slate-300 hover:border-slate-700'
                  }`}
                >
                  <div>
                    <div className="font-bold text-xs text-white mb-1">{p.title}</div>
                    <div className="text-[11px] font-mono-nums text-slate-300 space-y-0.5">
                      <div>{p.res}</div>
                      <div className="text-emerald-400">{p.vBitrate}</div>
                      <div className="text-slate-500">{p.aBitrate}</div>
                    </div>
                  </div>
                  <p className="text-[11px] text-slate-400 mt-2">{p.desc}</p>
                </div>
              );
            })}
          </div>
        </div>

        {/* Detailed Bitrate Custom Adjuster */}
        <div className="bg-slate-900/60 border border-slate-800 rounded-lg p-4 space-y-4">
          <div className="flex items-center gap-2 text-xs font-semibold text-slate-200">
            <Sliders className="w-4 h-4 text-slate-400" />
            <span>Kustomisasi Bitrate & Parameter Kompresi</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Video Bitrate Slider */}
            <div className="space-y-1.5">
              <div className="flex justify-between text-xs">
                <span className="text-slate-400">Video Bitrate:</span>
                <span className="font-mono-nums font-bold text-slate-200">
                  {(compressionConfig.videoBitrateKbps / 1000).toFixed(1)} Mbps ({compressionConfig.videoBitrateKbps} kbps)
                </span>
              </div>
              <input
                type="range"
                min="1000"
                max="30000"
                step="500"
                value={compressionConfig.videoBitrateKbps}
                onChange={(e) => {
                  const val = Number(e.target.value);
                  const updated = {
                    ...compressionConfig,
                    presetId: 'custom' as CompressionPresetId,
                    videoBitrateKbps: val,
                  };
                  setCompressionConfig(updated);
                  saveCompressionConfig(updated);
                }}
                className="w-full h-1.5 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-rose-500"
              />
              <div className="flex justify-between text-[10px] text-slate-500 font-mono-nums">
                <span>1 Mbps</span>
                <span>15 Mbps</span>
                <span>30 Mbps</span>
              </div>
            </div>

            {/* Frame Rate (FPS) */}
            <div className="space-y-1.5">
              <label className="text-xs text-slate-400 block">Frame Rate (FPS):</label>
              <select
                value={compressionConfig.fps}
                onChange={(e) => {
                  const val = Number(e.target.value);
                  const updated = {
                    ...compressionConfig,
                    presetId: 'custom' as CompressionPresetId,
                    fps: val,
                  };
                  setCompressionConfig(updated);
                  saveCompressionConfig(updated);
                }}
                className="w-full bg-slate-900 border border-slate-700 rounded px-3 py-1.5 text-xs font-mono-nums text-slate-200"
              >
                <option value={60}>60.00 FPS (Smooth Broadcast)</option>
                <option value={50}>50.00 FPS (PAL Broadcast)</option>
                <option value={30}>30.00 FPS (Standard NTSC)</option>
                <option value={25}>25.00 FPS (Standard PAL)</option>
                <option value={24}>24.00 FPS (Cinematic 24p)</option>
              </select>
            </div>

            {/* Audio Bitrate */}
            <div className="space-y-1.5">
              <label className="text-xs text-slate-400 block">Audio Bitrate (Stereo):</label>
              <select
                value={compressionConfig.audioBitrateKbps}
                onChange={(e) => {
                  const val = Number(e.target.value);
                  const updated = {
                    ...compressionConfig,
                    presetId: 'custom' as CompressionPresetId,
                    audioBitrateKbps: val,
                  };
                  setCompressionConfig(updated);
                  saveCompressionConfig(updated);
                }}
                className="w-full bg-slate-900 border border-slate-700 rounded px-3 py-1.5 text-xs font-mono-nums text-slate-200"
              >
                <option value={320}>320 kbps (Studio Master)</option>
                <option value={256}>256 kbps (High Fidelity)</option>
                <option value={192}>192 kbps (Standard Broadcast)</option>
                <option value={128}>128 kbps (Voice / Compact)</option>
              </select>
            </div>
          </div>
        </div>

        {/* Section 3: Real-Time File Size Estimator */}
        <div className="bg-[#090d14] border border-slate-800 rounded-lg p-4">
          <div className="text-xs font-semibold text-slate-200 mb-2">
            Estimasi Ukuran File Perekaman Berdasarkan Bitrate Saat Ini:
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 font-mono-nums">
            <div className="bg-slate-900/60 p-3 rounded border border-slate-800">
              <span className="text-[11px] text-slate-400 font-sans block">Durasi 1 Jam</span>
              <span className="text-lg font-bold text-white">~{size1HourGb.toFixed(2)} GB</span>
              <span className="text-[10px] text-slate-500 font-sans block mt-0.5">
                {(size1HourGb * 1024).toFixed(0)} MB per jam siaran
              </span>
            </div>
            <div className="bg-slate-900/60 p-3 rounded border border-slate-800">
              <span className="text-[11px] text-slate-400 font-sans block">Durasi 6 Jam (Event Panjang)</span>
              <span className="text-lg font-bold text-white">~{size6HoursGb.toFixed(2)} GB</span>
              <span className="text-[10px] text-slate-500 font-sans block mt-0.5">
                Ideal untuk live turnamen / konferensi
              </span>
            </div>
            <div className="bg-slate-900/60 p-3 rounded border border-slate-800">
              <span className="text-[11px] text-slate-400 font-sans block">Durasi 24 Jam (Continuous)</span>
              <span className="text-lg font-bold text-white">~{size24HoursGb.toFixed(1)} GB</span>
              <span className="text-[10px] text-slate-500 font-sans block mt-0.5">
                Memerlukan minimal {(size24HoursGb * 1.2).toFixed(0)} GB free disk
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
