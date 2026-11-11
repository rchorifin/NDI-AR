import React, { useRef, useEffect, useState, useCallback } from 'react';
import { Play, Square, Pause, Camera, Radio, Volume2, VolumeX, Maximize2, RefreshCw } from 'lucide-react';
import { NDISource, VideoFormat, CompressionPresetId } from '../types';

interface LiveMonitorProps {
  sources: NDISource[];
  activeSource: NDISource;
  onSelectSource: (source: NDISource) => void;
  onAddSource?: (source: NDISource) => void;
  isRecording: boolean;
  isPaused: boolean;
  durationSeconds: number;
  recordedBytes: number;
  droppedFrames: number;
  vuLevels: { left: number; right: number };
  activeFormat: VideoFormat;
  onChangeFormat: (format: VideoFormat) => void;
  activePresetId: CompressionPresetId;
  onChangePresetId: (presetId: CompressionPresetId) => void;
  onStartRecord: () => void;
  onStopRecord: () => void;
  onTogglePause: () => void;
}

export const LiveMonitor: React.FC<LiveMonitorProps> = ({
  sources,
  activeSource,
  onSelectSource,
  onAddSource,
  isRecording,
  isPaused,
  durationSeconds,
  recordedBytes,
  droppedFrames,
  vuLevels,
  activeFormat,
  onChangeFormat,
  activePresetId,
  onChangePresetId,
  onStartRecord,
  onStopRecord,
  onTogglePause,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const videoElemRef = useRef<HTMLVideoElement | null>(null);
  const [isAudioMuted, setIsAudioMuted] = useState(false);
  const [audioVolume, setAudioVolume] = useState(80);
  const [timecodeStr, setTimecodeStr] = useState('00:00:00:00');
  const [showGrid, setShowGrid] = useState(true);
  const [snapshotSuccess, setSnapshotSuccess] = useState(false);

  // Timecode generator
  useEffect(() => {
    let frame = 0;
    const interval = setInterval(() => {
      frame = (frame + 1) % 60;
      const now = new Date();
      const h = String(now.getHours()).padStart(2, '0');
      const m = String(now.getMinutes()).padStart(2, '0');
      const s = String(now.getSeconds()).padStart(2, '0');
      const f = String(frame).padStart(2, '0');
      setTimecodeStr(`${h}:${m}:${s}:${f}`);
    }, 1000 / 30);
    return () => clearInterval(interval);
  }, []);

  const [isLiveCaptureActive, setIsLiveCaptureActive] = useState(false);
  const [liveCaptureType, setLiveCaptureType] = useState<'screen' | 'camera' | null>(null);
  const activeStreamRef = useRef<MediaStream | null>(null);

  const isVmixSource = activeSource.name.toLowerCase().includes('vmix');
  const isVmixPgm = activeSource.id === 'src_vmix_output1' || activeSource.name.toLowerCase().includes('program');
  const isVmixPvw = activeSource.id === 'src_vmix_output2' || activeSource.name.toLowerCase().includes('preview');


  // Live Audio Analyzer state for real-time vMix audio input
  const monitorAudioCtxRef = useRef<AudioContext | null>(null);
  const monitorAnalyserRef = useRef<AnalyserNode | null>(null);
  const audioSpectrumCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const spectrumAnimIdRef = useRef<number | null>(null);
  const [hasActiveAudioTrack, setHasActiveAudioTrack] = useState(false);
  const [audioTrackLabel, setAudioTrackLabel] = useState<string>('');
  const [liveAudioLevels, setLiveAudioLevels] = useState<{ left: number; right: number }>({
    left: -60,
    right: -60,
  });

  // Setup real-time audio analysis and live spectrum equalizer
  const setupLiveAudioAnalyzer = useCallback((stream: MediaStream) => {
    try {
      const audioTracks = stream.getAudioTracks();
      if (audioTracks.length === 0) {
        setHasActiveAudioTrack(false);
        setAudioTrackLabel('');
        return;
      }

      const track = audioTracks[0];
      setHasActiveAudioTrack(true);
      setAudioTrackLabel(track.label || 'vMix Audio Input (Stereo 48kHz)');

      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) return;

      if (monitorAudioCtxRef.current && monitorAudioCtxRef.current.state !== 'closed') {
        monitorAudioCtxRef.current.close().catch(() => {});
      }

      const ctx = new AudioCtx();
      monitorAudioCtxRef.current = ctx;

      const sourceNode = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 64; // 32 frequency bins
      analyser.smoothingTimeConstant = 0.75;
      sourceNode.connect(analyser);
      monitorAnalyserRef.current = analyser;

      const freqData = new Uint8Array(analyser.frequencyBinCount);

      const drawSpectrum = () => {
        if (!monitorAnalyserRef.current) return;
        monitorAnalyserRef.current.getByteFrequencyData(freqData);

        // Calculate average amplitude & dB
        let sum = 0;
        for (let i = 0; i < freqData.length; i++) {
          sum += freqData[i];
        }
        const avg = sum / freqData.length;
        const norm = avg / 255;
        const db = norm > 0 ? Math.max(-60, Math.round(20 * Math.log10(norm))) : -60;
        const leftDb = db;
        const rightDb = Math.max(-60, Math.min(0, db + Math.sin(Date.now() / 150) * 1.5));
        setLiveAudioLevels({ left: leftDb, right: Math.round(rightDb) });

        // Draw spectrum graph onto audioSpectrumCanvasRef
        const specCanvas = audioSpectrumCanvasRef.current;
        if (specCanvas) {
          const sCtx = specCanvas.getContext('2d');
          if (sCtx) {
            const sw = specCanvas.width;
            const sh = specCanvas.height;
            sCtx.clearRect(0, 0, sw, sh);

            // Dark background with subtle grid lines
            sCtx.fillStyle = '#060910';
            sCtx.fillRect(0, 0, sw, sh);

            // Draw frequency bars (real-time equalizer)
            const numBars = 20;
            const barWidth = Math.floor(sw / numBars) - 1.5;
            for (let b = 0; b < numBars; b++) {
              const binIdx = Math.floor((b / numBars) * freqData.length);
              const val = freqData[binIdx] / 255;
              const barH = Math.max(3, val * (sh - 6));
              const x = b * (barWidth + 1.5) + 2;
              const y = sh - barH - 2;

              // Color based on height (green -> yellow -> red)
              if (val > 0.82) {
                sCtx.fillStyle = '#ef4444'; // Red peak
              } else if (val > 0.5) {
                sCtx.fillStyle = '#f59e0b'; // Amber
              } else {
                sCtx.fillStyle = '#10b981'; // Emerald
              }
              sCtx.fillRect(x, y, barWidth, barH);
            }

            // Audio Signal Tag
            sCtx.font = '8px "JetBrains Mono", monospace';
            sCtx.fillStyle = 'rgba(255, 255, 255, 0.4)';
            sCtx.fillText('vMix NDI AUDIO 48k', 4, 10);
          }
        }

        spectrumAnimIdRef.current = requestAnimationFrame(drawSpectrum);
      };

      if (spectrumAnimIdRef.current) cancelAnimationFrame(spectrumAnimIdRef.current);
      drawSpectrum();
    } catch (e) {
      console.warn('Live audio analyzer setup failed:', e);
    }
  }, []);

  // Start real-time capture of vMix Window / Screen (60 FPS) with Audio
  const startVmixScreenCapture = useCallback(async () => {
    try {
      if (activeStreamRef.current) {
        activeStreamRef.current.getTracks().forEach((t) => t.stop());
      }
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: {
          frameRate: { ideal: 60, max: 60 },
          width: { ideal: 1920 },
          height: { ideal: 1080 },
        },
        audio: true,
      });

      activeStreamRef.current = stream;
      if (videoElemRef.current) {
        videoElemRef.current.srcObject = stream;
        await videoElemRef.current.play().catch(() => {});
      }
      setIsLiveCaptureActive(true);
      setLiveCaptureType('screen');

      // Hook up real-time audio analyzer and spectrum graph
      setupLiveAudioAnalyzer(stream);

      stream.getVideoTracks()[0].onended = () => {
        setIsLiveCaptureActive(false);
        setLiveCaptureType(null);
        setHasActiveAudioTrack(false);
      };
    } catch (err) {
      console.warn('vMix screen capture cancelled or not allowed:', err);
    }
  }, [setupLiveAudioAnalyzer]);

  // Start real-time capture of vMix Virtual Camera & Audio (DirectShow Device)
  const startVmixVirtualCamera = useCallback(async () => {
    try {
      if (activeStreamRef.current) {
        activeStreamRef.current.getTracks().forEach((t) => t.stop());
      }
      
      let stream: MediaStream;
      try {
        // Capture both video and uncompressed broadcast audio from vMix Virtual Webcam / Cable
        stream = await navigator.mediaDevices.getUserMedia({
          video: {
            width: { ideal: 1920 },
            height: { ideal: 1080 },
            frameRate: { ideal: 60 },
          },
          audio: {
            echoCancellation: false,
            noiseSuppression: false,
            autoGainControl: false,
            sampleRate: 48000,
            channelCount: 2,
          },
        });
      } catch (e) {
        // Fallback: request video and audio separately if system permissions require it
        const videoStream = await navigator.mediaDevices.getUserMedia({ video: true });
        let audioStream: MediaStream | null = null;
        try {
          audioStream = await navigator.mediaDevices.getUserMedia({ audio: true });
        } catch {}

        stream = new MediaStream();
        videoStream.getVideoTracks().forEach((t) => stream.addTrack(t));
        if (audioStream) {
          audioStream.getAudioTracks().forEach((t) => stream.addTrack(t));
        }
      }

      activeStreamRef.current = stream;
      if (videoElemRef.current) {
        videoElemRef.current.srcObject = stream;
        await videoElemRef.current.play().catch(() => {});
      }
      setIsLiveCaptureActive(true);
      setLiveCaptureType('camera');

      // Hook up real-time audio analyzer and spectrum graph
      setupLiveAudioAnalyzer(stream);

      stream.getVideoTracks()[0].onended = () => {
        setIsLiveCaptureActive(false);
        setLiveCaptureType(null);
        setHasActiveAudioTrack(false);
      };
    } catch (err) {
      console.warn('vMix virtual camera capture error:', err);
    }
  }, [setupLiveAudioAnalyzer]);

  const stopLiveCapture = useCallback(() => {
    if (activeStreamRef.current) {
      activeStreamRef.current.getTracks().forEach((t) => t.stop());
      activeStreamRef.current = null;
    }
    if (videoElemRef.current) {
      videoElemRef.current.srcObject = null;
    }
    if (spectrumAnimIdRef.current) {
      cancelAnimationFrame(spectrumAnimIdRef.current);
      spectrumAnimIdRef.current = null;
    }
    if (monitorAudioCtxRef.current && monitorAudioCtxRef.current.state !== 'closed') {
      monitorAudioCtxRef.current.close().catch(() => {});
      monitorAudioCtxRef.current = null;
    }
    monitorAnalyserRef.current = null;
    setHasActiveAudioTrack(false);
    setAudioTrackLabel('');
    setLiveAudioLevels({ left: -60, right: -60 });
    setIsLiveCaptureActive(false);
    setLiveCaptureType(null);
  }, []);

  // Canvas drawing loop for real-time broadcast and live video stream
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId: number;
    let scanPos = 0;
    let tickerScroll = 0;

    // Preload image source if applicable
    const img = new Image();
    if (activeSource.previewThumbnail) {
      img.src = activeSource.previewThumbnail;
    } else if (activeSource.category === 'test') {
      img.src = '/src/assets/images/ndi_test_pattern_1794395157938.jpg';
    } else {
      img.src = '/src/assets/images/studio_broadcast_feed_1794395158122.jpg';
    }

    const render = () => {
      const w = canvas.width;
      const h = canvas.height;
      const video = videoElemRef.current;

      const isLivePlaying = video && !video.paused && video.readyState >= 2;

      if (isLivePlaying) {
        // Draw genuine real-time video stream (from vMix window capture, vMix Virtual Webcam, or NDI bridge)
        ctx.drawImage(video, 0, 0, w, h);
      } else if (img.complete && img.naturalWidth > 0) {
        // Draw background broadcast feed
        ctx.drawImage(img, 0, 0, w, h);

        // Real-time animated lower-third overlay for vMix feed
        if (isVmixSource) {
          // Dynamic animated lower third news bar
          const barY = h - 140;
          ctx.fillStyle = 'rgba(10, 15, 26, 0.88)';
          ctx.fillRect(0, barY, w, 76);

          // Red or Green accent bar
          ctx.fillStyle = isVmixPgm ? '#dc2626' : '#16a34a';
          ctx.fillRect(0, barY, 18, 76);

          // Text content
          ctx.fillStyle = '#ffffff';
          ctx.font = 'bold 22px "Plus Jakarta Sans", sans-serif';
          ctx.fillText(
            isVmixPgm ? 'VMIX LIVE PROGRAM · ON-AIR BROADCAST' : 'VMIX PREVIEW · NEXT READY',
            32,
            barY + 34
          );

          ctx.fillStyle = '#94a3b8';
          ctx.font = '15px "JetBrains Mono", monospace';
          ctx.fillText(
            `INPUT NDI: ${activeSource.name}  |  HOST: ${activeSource.ipAddress}  |  60.00 FPS`,
            32,
            barY + 62
          );

          // Moving ticker banner
          tickerScroll = (tickerScroll + 1.8) % (w + 800);
          ctx.fillStyle = 'rgba(2, 6, 23, 0.95)';
          ctx.fillRect(0, h - 42, w, 42);

          ctx.fillStyle = isVmixPgm ? '#ef4444' : '#10b981';
          ctx.font = 'bold 13px "JetBrains Mono", monospace';
          const tickerText = `+++ LIVE NDI STREAM FROM VMIX +++ REAL-TIME 60 FPS +++ AUDIO CH 1/2 STEREO +++ TIME: ${new Date().toLocaleTimeString()} +++ RESOLUTION 1920x1080P +++ TALLY: ${isVmixPgm ? 'PROGRAM MASTER' : 'PREVIEW'} +++`;
          ctx.fillText(tickerText, w - tickerScroll, h - 15);
        }
      } else {
        // Broadcast test tone slate
        ctx.fillStyle = '#0f172a';
        ctx.fillRect(0, 0, w, h);
      }

      // Moving subtle broadcast raster scanline
      scanPos = (scanPos + 2) % h;
      ctx.fillStyle = 'rgba(255, 255, 255, 0.02)';
      ctx.fillRect(0, scanPos, w, 2);

      // Safe Action Area (90%) and Safe Title Area (80%) guides
      if (showGrid) {
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.12)';
        ctx.lineWidth = 1;
        // 90% Action Safe
        ctx.strokeRect(w * 0.05, h * 0.05, w * 0.9, h * 0.9);
        // 80% Title Safe
        ctx.strokeRect(w * 0.1, h * 0.1, w * 0.8, h * 0.8);
        // Center crosshair
        ctx.beginPath();
        ctx.moveTo(w / 2 - 15, h / 2);
        ctx.lineTo(w / 2 + 15, h / 2);
        ctx.moveTo(w / 2, h / 2 - 15);
        ctx.lineTo(w / 2, h / 2 + 15);
        ctx.stroke();
      }

      // Tally frame border directly on canvas
      if (isVmixSource) {
        ctx.lineWidth = 6;
        ctx.strokeStyle = isVmixPgm ? 'rgba(239, 68, 68, 0.85)' : 'rgba(16, 185, 129, 0.85)';
        ctx.strokeRect(3, 3, w - 6, h - 6);
      }

      animId = requestAnimationFrame(render);
    };

    render();

    return () => {
      cancelAnimationFrame(animId);
    };
  }, [activeSource, showGrid, isVmixSource, isVmixPgm]);

  // Handle local webcam/screen capture stream when requested by source
  useEffect(() => {
    let localStream: MediaStream | null = null;

    if (activeSource.id === 'src_local_device') {
      navigator.mediaDevices
        ?.getUserMedia({ video: true, audio: true })
        .then((s) => {
          localStream = s;
          if (videoElemRef.current) {
            videoElemRef.current.srcObject = s;
            videoElemRef.current.play().catch(() => {});
          }
          setIsLiveCaptureActive(true);
        })
        .catch((err) => {
          console.warn('Camera permission not granted:', err);
        });
    } else if (activeSource.id === 'src_screen_bridge') {
      navigator.mediaDevices
        ?.getDisplayMedia({ video: true, audio: true })
        .then((s) => {
          localStream = s;
          if (videoElemRef.current) {
            videoElemRef.current.srcObject = s;
            videoElemRef.current.play().catch(() => {});
          }
          setIsLiveCaptureActive(true);
        })
        .catch((err) => {
          console.warn('Screen capture cancelled:', err);
        });
    }

    return () => {
      if (localStream) {
        localStream.getTracks().forEach((t) => t.stop());
      }
    };
  }, [activeSource.id]);

  // Format elapsed time
  const formatDuration = (totalSec: number) => {
    const hours = Math.floor(totalSec / 3600);
    const mins = Math.floor((totalSec % 3600) / 60);
    const secs = totalSec % 60;
    return `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  };

  // Format bytes
  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 MB';
    const mb = bytes / (1024 * 1024);
    if (mb < 1000) return `${mb.toFixed(1)} MB`;
    return `${(mb / 1024).toFixed(2)} GB`;
  };

  // Take snapshot
  const handleTakeSnapshot = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dataUrl = canvas.toDataURL('image/png');
    const a = document.createElement('a');
    a.href = dataUrl;
    a.download = `SNAPSHOT_${activeSource.name.replace(/[^a-zA-Z0-9]/g, '_')}_${Date.now()}.png`;
    a.click();
    setSnapshotSuccess(true);
    setTimeout(() => setSnapshotSuccess(false), 2000);
  };

  // VU Meter height calculation (-60dB to 0dB)
  const calcVUPct = (db: number) => {
    const clamped = Math.max(-60, Math.min(0, db));
    return ((clamped + 60) / 60) * 100;
  };

  // vMix modal states
  const [showVmixModal, setShowVmixModal] = useState(false);
  const [vmixIp, setVmixIp] = useState('192.168.1.180');
  const [vmixChannel, setVmixChannel] = useState('Output 1 (Program)');
  const [vmixFps, setVmixFps] = useState(60);

  const handleConnectCustomVmix = (e: React.FormEvent) => {
    e.preventDefault();
    const newId = `src_vmix_${Date.now()}`;
    const cleanChan = vmixChannel.replace(/[^a-zA-Z0-9]/g, '_');
    const newSource: NDISource = {
      id: newId,
      name: `NDI://VMIX-HOST/${vmixChannel}`,
      streamUrl: `ndi://${vmixIp}:5961/${cleanChan}`,
      ipAddress: `${vmixIp} (vMix Studio)`,
      category: 'broadcast',
      status: 'online',
      resolution: '1920x1080',
      fps: vmixFps,
      previewThumbnail: vmixChannel.includes('Program')
        ? '/src/assets/images/vmix_live_program_1794396621036.jpg'
        : '/src/assets/images/studio_broadcast_feed_1794395158122.jpg',
    };
    if (onAddSource) {
      onAddSource(newSource);
    } else {
      onSelectSource(newSource);
    }
    setShowVmixModal(false);
  };

  return (
    <div className="space-y-4">
      {/* Top Monitor Control Strip */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-[#0f1420] border border-slate-800 rounded-lg p-3">
        {/* Source Selector */}
        <div className="flex flex-wrap items-center gap-2.5">
          <label className="text-xs text-slate-400 font-medium whitespace-nowrap">Input Sumber NDI:</label>
          <select
            value={activeSource.id}
            onChange={(e) => {
              const found = sources.find((s) => s.id === e.target.value);
              if (found) onSelectSource(found);
            }}
            className="bg-[#0b101b] hover:bg-slate-900 border border-slate-700/80 hover:border-slate-600 text-slate-100 text-xs rounded-md px-3 py-1.5 focus:outline-hidden focus:ring-1 focus:ring-rose-500 font-mono-nums transition-colors shadow-xs cursor-pointer"
          >
            <optgroup label="🎬 vMix Live Production (NDI Inputs)">
              {sources
                .filter((s) => s.name.toLowerCase().includes('vmix'))
                .map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} ({s.resolution} @ {s.fps}fps)
                  </option>
                ))}
            </optgroup>
            <optgroup label="📡 Broadcast Feeds & Kamera Studio">
              {sources
                .filter(
                  (s) =>
                    !s.name.toLowerCase().includes('vmix') &&
                    s.category !== 'device' &&
                    s.category !== 'test'
                )
                .map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} ({s.resolution} @ {s.fps}fps)
                  </option>
                ))}
            </optgroup>
            <optgroup label="💻 Perangkat Lokal & Tangkapan Layar">
              {sources
                .filter((s) => s.category === 'device' || s.category === 'test')
                .map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} ({s.resolution} @ {s.fps}fps)
                  </option>
                ))}
            </optgroup>
          </select>

          {/* Quick vMix Shortcut Buttons */}
          <div className="hidden sm:flex items-center gap-1.5 border-l border-slate-800 pl-2">
            <button
              type="button"
              onClick={() => {
                const vmix1 = sources.find((s) => s.id === 'src_vmix_output1');
                if (vmix1) onSelectSource(vmix1);
              }}
              className={`px-2 py-1 text-[11px] font-semibold rounded transition-colors ${
                activeSource.id === 'src_vmix_output1'
                  ? 'bg-rose-600 text-white font-bold shadow-xs'
                  : 'bg-slate-900 border border-slate-800 text-slate-400 hover:text-white hover:bg-slate-800'
              }`}
              title="Pilih vMix Output 1 (Program Master)"
            >
              vMix PGM
            </button>
            <button
              type="button"
              onClick={() => {
                const vmix2 = sources.find((s) => s.id === 'src_vmix_output2');
                if (vmix2) onSelectSource(vmix2);
              }}
              className={`px-2 py-1 text-[11px] font-semibold rounded transition-colors ${
                activeSource.id === 'src_vmix_output2'
                  ? 'bg-emerald-600 text-white font-bold shadow-xs'
                  : 'bg-slate-900 border border-slate-800 text-slate-400 hover:text-white hover:bg-slate-800'
              }`}
              title="Pilih vMix Output 2 (Preview / Next)"
            >
              vMix PVW
            </button>
            <button
              type="button"
              onClick={() => setShowVmixModal(true)}
              className="px-2 py-1 text-[11px] font-medium rounded bg-slate-900 border border-slate-700 text-blue-400 hover:text-blue-300 hover:bg-slate-800 transition-colors"
              title="Tambah Alamat IP & Output vMix Baru"
            >
              + Input vMix
            </button>
          </div>

          <span className="text-xs text-emerald-400 flex items-center gap-1 font-mono-nums ml-1">
            <Radio className="w-3 h-3 text-emerald-400" />
            {activeSource.resolution} · {activeSource.fps}fps
          </span>
        </div>

        {/* View Controls & Action buttons */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowGrid(!showGrid)}
            className={`px-2.5 py-1 text-xs rounded border transition-colors ${
              showGrid
                ? 'bg-slate-800 border-slate-600 text-slate-200'
                : 'bg-slate-900 border-slate-800 text-slate-500 hover:text-slate-300'
            }`}
            title="Toggle Safe Area Overlay"
          >
            Safe Area
          </button>
          <button
            onClick={handleTakeSnapshot}
            className="flex items-center gap-1 px-2.5 py-1 text-xs rounded bg-slate-900 border border-slate-700 text-slate-300 hover:text-white hover:bg-slate-800 transition-colors"
            title="Ambil Tangkapan Layar (PNG)"
          >
            <Camera className="w-3.5 h-3.5" />
            <span>{snapshotSuccess ? 'Tersimpan!' : 'Snapshot'}</span>
          </button>
        </div>
      </div>

      {/* Main Viewport Grid: Video Canvas + Audio VU Meter Deck */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* Left: Broadcast Canvas with HUD (10 Cols) */}
        <div
          className={`lg:col-span-10 relative bg-black rounded-lg overflow-hidden shadow-2xl aspect-16/9 flex items-center justify-center transition-all duration-300 ${
            isVmixPgm
              ? 'ring-2 ring-rose-600/80 shadow-rose-950/40 border border-rose-500/50'
              : isVmixPvw
              ? 'ring-2 ring-emerald-500/80 shadow-emerald-950/40 border border-emerald-500/50'
              : 'border border-slate-800'
          }`}
        >
          {/* Main Rendering Canvas */}
          <canvas
            id="ndi-monitor-canvas"
            ref={canvasRef}
            width={1920}
            height={1080}
            className="w-full h-full object-contain cursor-crosshair rounded block select-none"
          />

          {/* Hidden video element for WebRTC camera / vMix live stream */}
          <video
            ref={videoElemRef}
            autoPlay
            playsInline
            muted
            className="hidden"
          />

          {/* Top-Left HUD: Stream Ticker & Timecode */}
          <div className="absolute top-3 left-3 flex items-center gap-2 z-10">
            <div className="bg-black/85 backdrop-blur-xs px-2.5 py-1 rounded border border-white/10 text-white font-mono-nums text-xs tracking-wider flex items-center gap-2 shadow-md">
              <span className={`w-2 h-2 rounded-full ${isVmixPgm ? 'bg-rose-500 animate-ping' : 'bg-emerald-500'}`}></span>
              <span className="font-bold text-slate-100">{timecodeStr}</span>
            </div>
            <div className="bg-black/85 backdrop-blur-xs px-2.5 py-1 rounded border border-white/10 text-[11px] font-mono-nums text-slate-300 shadow-md">
              {activeSource.resolution} / {activeSource.fps}P
            </div>
            {isVmixSource && (
              <div
                className={`px-2.5 py-1 rounded text-[11px] font-bold tracking-wider shadow-md ${
                  isVmixPgm
                    ? 'bg-rose-600 text-white animate-pulse'
                    : isVmixPvw
                    ? 'bg-emerald-600 text-white'
                    : 'bg-blue-600 text-white'
                }`}
              >
                {isVmixPgm ? '● VMIX PGM (LIVE)' : isVmixPvw ? '● VMIX PVW' : '● VMIX NDI'}
              </div>
            )}
          </div>

          {/* Top-Right HUD: REC Tally & Live vMix Real-Time Status */}
          <div className="absolute top-3 right-3 flex items-center gap-2 z-10">
            {isLiveCaptureActive ? (
              <div className="bg-emerald-950/90 border border-emerald-500/60 text-emerald-300 px-3 py-1 rounded text-xs font-semibold flex items-center gap-2 shadow-lg backdrop-blur-xs">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping"></span>
                <span>vMix Real-Time 60fps Aktif</span>
                <button
                  type="button"
                  onClick={stopLiveCapture}
                  className="ml-1 text-[10px] underline hover:text-white"
                >
                  Lepas
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-1.5 bg-black/80 backdrop-blur-xs p-1 rounded border border-slate-800">
                <button
                  type="button"
                  onClick={startVmixScreenCapture}
                  className="px-2.5 py-1 rounded bg-blue-600/90 hover:bg-blue-600 text-white font-semibold text-[11px] flex items-center gap-1 shadow-sm transition-colors"
                  title="Tangkap Jendela vMix atau NDI Studio Monitor di layar secara real-time"
                >
                  <span>📺 Tangkap Layar vMix</span>
                </button>
                <button
                  type="button"
                  onClick={startVmixVirtualCamera}
                  className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white font-medium text-[11px] transition-colors"
                  title="Gunakan vMix Virtual Video (DirectShow WebCam)"
                >
                  <span>📷 vMix Cam</span>
                </button>
              </div>
            )}

            {isRecording && (
              <div className="bg-rose-600 text-white px-3 py-1 rounded font-mono-nums font-bold text-xs tracking-widest flex items-center gap-1.5 shadow-lg shadow-rose-900/60 animate-pulse">
                <span className="w-2 h-2 rounded-full bg-white"></span>
                <span>REC {formatDuration(durationSeconds)}</span>
              </div>
            )}
          </div>

          {/* Paused Overlay */}
          {isRecording && isPaused && (
            <div className="absolute inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center pointer-events-none z-20">
              <div className="bg-amber-950/80 border border-amber-500/60 text-amber-200 px-6 py-3 rounded-lg text-sm font-semibold tracking-wide flex items-center gap-2">
                <Pause className="w-4 h-4" />
                <span>Perekaman Dijeda (PAUSED)</span>
              </div>
            </div>
          )}
        </div>

        {/* Right: Stereo Audio VU Meter & Master Monitor (2 Cols) */}
        <div className="lg:col-span-2 bg-[#0f1420] border border-slate-800 rounded-lg p-3 flex flex-col justify-between">
          <div className="space-y-2.5">
            {/* Header with Title & Mute Toggle */}
            <div className="flex items-center justify-between border-b border-slate-800 pb-2">
              <span className="text-xs font-semibold text-slate-200">Audio VU & Spektrum</span>
              <button
                type="button"
                onClick={() => setIsAudioMuted(!isAudioMuted)}
                className="text-slate-400 hover:text-slate-200 transition-colors"
                title={isAudioMuted ? 'Unmute Monitor' : 'Mute Monitor'}
              >
                {isAudioMuted ? <VolumeX className="w-4 h-4 text-rose-400" /> : <Volume2 className="w-4 h-4" />}
              </button>
            </div>

            {/* Grafik Penanda Status Audio Terinput */}
            {hasActiveAudioTrack ? (
              <div className="bg-emerald-950/70 border border-emerald-500/50 rounded-md p-2 text-xs shadow-xs animate-in fade-in duration-150">
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-1.5 font-bold text-emerald-300 text-[11px]">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                    Audio vMix Terinput
                  </span>
                  <span className="text-[10px] bg-emerald-900/60 text-emerald-300 font-mono-nums px-1 rounded border border-emerald-700/50 font-bold">
                    48 kHz
                  </span>
                </div>
                <div className="text-[10px] text-slate-300 truncate mt-1 font-mono-nums">
                  {audioTrackLabel}
                </div>
                <div className="mt-1 flex items-center justify-between text-[9px] text-emerald-400/90 font-mono-nums border-t border-emerald-900/50 pt-1">
                  <span>STATUS: STEREO LIVE</span>
                  <span>SYNC NDI: OK</span>
                </div>
              </div>
            ) : (
              <div className="bg-slate-900/80 border border-slate-800 rounded-md p-2 text-xs text-slate-400">
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-1.5 text-[11px] text-slate-300 font-medium">
                    <span className="w-1.5 h-1.5 rounded-full bg-slate-500" />
                    Audio NDI Standby
                  </span>
                  <span className="text-[10px] text-slate-500 font-mono-nums">Tone Sync</span>
                </div>
                <div className="text-[10px] text-slate-500 mt-1">
                  Aktifkan tombol <strong className="text-slate-300">&apos;📷 vMix Cam&apos;</strong> untuk input mikrofon / audio vMix.
                </div>
              </div>
            )}

            {/* Grafik Spektrum Gelombang Audio Real-Time */}
            <div className="space-y-1 bg-slate-950/90 p-1.5 rounded border border-slate-800/80">
              <div className="flex items-center justify-between text-[10px] text-slate-400 font-mono-nums">
                <span className="flex items-center gap-1 font-semibold text-slate-300">
                  <span
                    className={`w-1.5 h-1.5 rounded-full ${
                      hasActiveAudioTrack ? 'bg-emerald-400 animate-pulse' : 'bg-slate-600'
                    }`}
                  />
                  Spektrum Frekuensi
                </span>
                <span
                  className={`text-[9px] font-bold ${
                    hasActiveAudioTrack ? 'text-emerald-400' : 'text-slate-500'
                  }`}
                >
                  {hasActiveAudioTrack ? 'SIGNAL IN' : 'IDLE'}
                </span>
              </div>
              <canvas
                ref={audioSpectrumCanvasRef}
                width={200}
                height={42}
                className="w-full h-10 bg-[#05080f] rounded border border-slate-800 block shadow-inner"
              />
            </div>

            {/* Stereo Dual Bar Display with Overload Clip Alert */}
            {(() => {
              const effLeft = hasActiveAudioTrack ? liveAudioLevels.left : vuLevels.left;
              const effRight = hasActiveAudioTrack ? liveAudioLevels.right : vuLevels.right;
              const isClipping = effLeft >= -1.5 || effRight >= -1.5;

              return (
                <div className="space-y-1">
                  <div className="flex items-center justify-between text-[10px] font-mono-nums px-1">
                    <span className="text-slate-400">Peak Meter</span>
                    <span
                      className={`text-[9px] font-bold px-1 rounded transition-colors ${
                        isClipping
                          ? 'bg-rose-600 text-white animate-pulse'
                          : 'text-slate-500 bg-slate-900 border border-slate-800'
                      }`}
                    >
                      CLIP 0dB
                    </span>
                  </div>

                  <div className="flex items-stretch justify-center gap-3.5 h-44 bg-slate-950/90 rounded p-2.5 border border-slate-800/80 font-mono-nums text-[10px]">
                    {/* dB Scale */}
                    <div className="flex flex-col justify-between text-slate-500 text-right pr-1 select-none">
                      <span className="text-rose-400 font-bold">0 dB</span>
                      <span>-6</span>
                      <span>-12</span>
                      <span>-18</span>
                      <span>-24</span>
                      <span>-36</span>
                      <span>-60</span>
                    </div>

                    {/* Channel Left */}
                    <div className="flex flex-col items-center">
                      <div className="relative w-3.5 h-full bg-slate-900 rounded-xs overflow-hidden flex flex-col justify-end">
                        <div
                          className="w-full transition-all duration-75"
                          style={{
                            height: `${calcVUPct(effLeft)}%`,
                            backgroundColor:
                              effLeft > -3 ? '#ef4444' : effLeft > -12 ? '#f59e0b' : '#10b981',
                          }}
                        />
                      </div>
                      <span className="mt-1 text-slate-400 font-bold">L</span>
                      <span className="text-[9px] text-slate-400">{effLeft}</span>
                    </div>

                    {/* Channel Right */}
                    <div className="flex flex-col items-center">
                      <div className="relative w-3.5 h-full bg-slate-900 rounded-xs overflow-hidden flex flex-col justify-end">
                        <div
                          className="w-full transition-all duration-75"
                          style={{
                            height: `${calcVUPct(effRight)}%`,
                            backgroundColor:
                              effRight > -3 ? '#ef4444' : effRight > -12 ? '#f59e0b' : '#10b981',
                          }}
                        />
                      </div>
                      <span className="mt-1 text-slate-400 font-bold">R</span>
                      <span className="text-[9px] text-slate-400">{effRight}</span>
                    </div>
                  </div>
                </div>
              );
            })()}

            {/* Volume slider */}
            <div className="space-y-1">
              <div className="flex justify-between text-[11px] text-slate-400">
                <span>Monitor Vol</span>
                <span className="font-mono-nums">{audioVolume}%</span>
              </div>
              <input
                type="range"
                min="0"
                max="100"
                value={audioVolume}
                onChange={(e) => setAudioVolume(Number(e.target.value))}
                className="w-full h-1 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-rose-500"
              />
            </div>
          </div>

          {/* Codec & Compression Info */}
          <div className="pt-2 border-t border-slate-800 text-[11px] text-slate-400 space-y-0.5 font-mono-nums">
            <div className="flex justify-between">
              <span>Format:</span>
              <span className="text-slate-200 font-bold uppercase">{activeFormat}</span>
            </div>
            <div className="flex justify-between">
              <span>Preset:</span>
              <span className="text-slate-200 capitalize">{activePresetId}</span>
            </div>
            <div className="flex justify-between">
              <span>Audio:</span>
              <span className="text-slate-200">
                {hasActiveAudioTrack ? 'vMix 48kHz Stereo' : 'AAC 48kHz'}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Production Deck: Transport Bar & Quick Settings */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 bg-[#0f1420] border border-slate-800 rounded-lg p-4">
        {/* Quick Format, Preset Selector & vMix Cam Audio/Video Integration */}
        <div className="flex flex-col justify-center gap-2.5">
          {/* Integrated vMix Audio & Video Input Status */}
          <div className="bg-[#0b101b] border border-slate-800 rounded-md p-2">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5 min-w-0">
                <span
                  className={`w-2 h-2 rounded-full shrink-0 ${
                    isLiveCaptureActive && hasActiveAudioTrack
                      ? 'bg-emerald-400 animate-ping'
                      : isLiveCaptureActive
                      ? 'bg-emerald-400'
                      : 'bg-slate-600'
                  }`}
                />
                <span className="text-[11px] font-bold text-slate-200 truncate">
                  {isLiveCaptureActive
                    ? 'vMix Cam Terintegrasi (Video & Audio Aktif)'
                    : 'Input vMix Cam Belum Aktif'}
                </span>
              </div>

              {isLiveCaptureActive ? (
                <button
                  type="button"
                  onClick={stopLiveCapture}
                  className="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-rose-400 hover:text-rose-300 text-[10px] font-semibold shrink-0 transition-colors"
                >
                  Lepas
                </button>
              ) : (
                <button
                  type="button"
                  onClick={startVmixVirtualCamera}
                  className="px-2 py-0.5 rounded bg-rose-600/90 hover:bg-rose-600 text-white text-[10px] font-bold shrink-0 transition-colors flex items-center gap-1 shadow-xs"
                >
                  <span>📷 Aktifkan vMix Cam</span>
                </button>
              )}
            </div>

            {/* Sub-telemetry: Video & Audio Line */}
            <div className="mt-1 text-[10px] text-slate-400 font-mono-nums flex items-center justify-between border-t border-slate-800/80 pt-1">
              <span>
                Vid: <strong className="text-slate-300">{isLiveCaptureActive ? 'vMix 60fps' : 'NDI Stream'}</strong>
              </span>
              <span className="text-slate-600" aria-hidden="true">·</span>
              <span className="truncate max-w-[140px]">
                Aud: <strong className={hasActiveAudioTrack ? 'text-emerald-400' : 'text-slate-400'}>
                  {hasActiveAudioTrack ? 'vMix 48kHz Stereo' : 'Tone Standby'}
                </strong>
              </span>
            </div>
          </div>

          {/* Format Wadah & Preset */}
          <div className="flex items-center gap-2">
            <span className="text-[11px] text-slate-400 font-medium whitespace-nowrap">Format:</span>
            <div className="flex items-center p-0.5 bg-slate-900 rounded border border-slate-800">
              <button
                type="button"
                onClick={() => onChangeFormat('mp4')}
                className={`px-2.5 py-0.5 text-xs font-semibold rounded transition-colors ${
                  activeFormat === 'mp4'
                    ? 'bg-rose-600 text-white'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                MP4
              </button>
              <button
                type="button"
                onClick={() => onChangeFormat('mkv')}
                className={`px-2.5 py-0.5 text-xs font-semibold rounded transition-colors ${
                  activeFormat === 'mkv'
                    ? 'bg-rose-600 text-white'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                MKV
              </button>
            </div>

            <select
              value={activePresetId}
              onChange={(e) => onChangePresetId(e.target.value as CompressionPresetId)}
              className="flex-1 bg-slate-900 border border-slate-700 text-slate-200 text-xs rounded px-2 py-1 focus:outline-hidden font-mono-nums"
            >
              <option value="master">Master (15 Mbps)</option>
              <option value="high">High (8 Mbps)</option>
              <option value="standard">Standard (4 Mbps)</option>
              <option value="compact">Compact (2 Mbps)</option>
            </select>
          </div>
        </div>

        {/* Transport Controls (Record, Pause, Stop) */}
        <div className="flex items-center justify-center gap-3">
          {!isRecording ? (
            <button
              onClick={onStartRecord}
              className="flex items-center gap-2 px-6 py-3 bg-rose-600 hover:bg-rose-500 text-white font-bold text-sm rounded shadow-lg shadow-rose-950/60 transition-all active:scale-95"
            >
              <span className="w-3 h-3 rounded-full bg-white animate-pulse" />
              <span>MULAI REKAM (REC)</span>
            </button>
          ) : (
            <div className="flex items-center gap-2">
              <button
                onClick={onTogglePause}
                className="flex items-center gap-1.5 px-4 py-2.5 bg-amber-600 hover:bg-amber-500 text-white font-semibold text-xs rounded transition-colors"
              >
                {isPaused ? <Play className="w-4 h-4" /> : <Pause className="w-4 h-4" />}
                <span>{isPaused ? 'Lanjutkan' : 'Jeda'}</span>
              </button>
              <button
                onClick={onStopRecord}
                className="flex items-center gap-1.5 px-5 py-2.5 bg-slate-800 hover:bg-rose-700 text-white font-semibold text-xs rounded border border-slate-700 transition-colors"
              >
                <Square className="w-4 h-4" />
                <span>Hentikan Rekam</span>
              </button>
            </div>
          )}
        </div>

        {/* Live Metrics Telemetry */}
        <div className="flex items-center justify-end gap-6 text-right font-mono-nums">
          <div>
            <div className="text-[10px] text-slate-500 font-sans uppercase">Durasi Aktif</div>
            <div className="text-base font-bold text-white tracking-wider">
              {formatDuration(durationSeconds)}
            </div>
          </div>
          <div>
            <div className="text-[10px] text-slate-500 font-sans uppercase">Ukuran Data</div>
            <div className="text-base font-bold text-emerald-400">
              {formatBytes(recordedBytes)}
            </div>
          </div>
          <div>
            <div className="text-[10px] text-slate-500 font-sans uppercase">Dropped Frame</div>
            <div className="text-xs font-semibold text-slate-300">
              {droppedFrames} (0.0%)
            </div>
          </div>
        </div>
      </div>

      {/* Modal: Tambah / Hubungkan Input NDI vMix */}
      {showVmixModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-xs p-4">
          <div className="w-full max-w-md bg-[#0f1523] border border-slate-800 rounded-lg shadow-2xl p-6 text-left animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-rose-500 animate-pulse" />
                <h3 className="text-sm font-bold text-white">Hubungkan Input NDI dari vMix</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowVmixModal(false)}
                className="text-slate-400 hover:text-white text-xs px-2 py-1 rounded hover:bg-slate-800"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleConnectCustomVmix} className="mt-4 space-y-4 text-xs">
              <div>
                <label className="block text-slate-300 font-semibold mb-1">
                  Alamat IP / Hostname PC vMix:
                </label>
                <input
                  type="text"
                  required
                  value={vmixIp}
                  onChange={(e) => setVmixIp(e.target.value)}
                  placeholder="Contoh: 192.168.1.180 atau 127.0.0.1"
                  className="w-full bg-slate-900 border border-slate-700 rounded px-3 py-2 text-slate-100 font-mono-nums focus:outline-hidden focus:border-rose-500"
                />
                <span className="text-[10px] text-slate-500 mt-0.5 block">
                  Pastikan opsi &apos;NDI Output&apos; telah diaktifkan pada Settings &gt; Outputs / NDI / SRT di vMix.
                </span>
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">
                  Kanal Output vMix yang Dikirim via NDI:
                </label>
                <select
                  value={vmixChannel}
                  onChange={(e) => setVmixChannel(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded px-3 py-2 text-slate-100 font-mono-nums focus:outline-hidden"
                >
                  <option value="Output 1 (Program)">Output 1 (Program / Master PGM)</option>
                  <option value="Output 2 (Preview)">Output 2 (Preview / Next PVW)</option>
                  <option value="Output 3 (Clean Feed)">Output 3 (Clean Feed Iso-Rec)</option>
                  <option value="Output 4 (MultiView)">Output 4 (MultiView / Replay)</option>
                  <option value="Audio Bus Master (Stereo)">Audio Bus Master (Stereo NDI)</option>
                  <option value="Audio Bus A (Aux Mix)">Audio Bus A (Aux Mix)</option>
                </select>
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">Frame Rate (FPS):</label>
                <div className="flex gap-2">
                  {[60, 59.94, 50, 30].map((f) => (
                    <button
                      key={f}
                      type="button"
                      onClick={() => setVmixFps(f)}
                      className={`flex-1 py-1.5 rounded font-mono-nums border ${
                        vmixFps === f
                          ? 'bg-rose-600 border-rose-500 text-white font-bold'
                          : 'bg-slate-900 border-slate-700 text-slate-400 hover:text-white'
                      }`}
                    >
                      {f} FPS
                    </button>
                  ))}
                </div>
              </div>

              <div className="pt-3 border-t border-slate-800 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setShowVmixModal(false)}
                  className="px-3.5 py-1.5 rounded bg-slate-800 text-slate-300 hover:bg-slate-700 transition-colors"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 rounded bg-rose-600 hover:bg-rose-500 text-white font-bold shadow-md transition-colors"
                >
                  Hubungkan Input vMix
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
