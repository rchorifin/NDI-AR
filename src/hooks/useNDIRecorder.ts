import { useState, useRef, useEffect, useCallback } from 'react';
import { VideoFormat, CompressionPresetId, NDISource, RecordingItem } from '../types';
import { sendSystemNotification } from '../utils/notifications';
import { storeBlobInIndexedDB, getStorageConfig } from '../utils/storage';

export interface RecorderState {
  isRecording: boolean;
  isPaused: boolean;
  durationSeconds: number;
  recordedBytes: number;
  currentScheduleTitle?: string;
  currentScheduleId?: string;
  source: NDISource;
  format: VideoFormat;
  presetId: CompressionPresetId;
  bitrateKbps: number;
  fps: number;
  droppedFrames: number;
  vuLeftDb: number;
  vuRightDb: number;
}

export function useNDIRecorder(
  activeSource: NDISource,
  onRecordingComplete: (item: RecordingItem) => void
) {
  const [isRecording, setIsRecording] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [durationSeconds, setDurationSeconds] = useState(0);
  const [recordedBytes, setRecordedBytes] = useState(0);
  const [droppedFrames, setDroppedFrames] = useState(0);
  const [vuLevels, setVuLevels] = useState<{ left: number; right: number }>({ left: -60, right: -60 });

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);
  const timerIntervalRef = useRef<number | null>(null);
  const liveStreamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animFrameRef = useRef<number | null>(null);
  const recordingMetaRef = useRef<{
    scheduleId?: string;
    scheduleTitle?: string;
    format: VideoFormat;
    presetId: CompressionPresetId;
    source: NDISource;
    startTime: number;
    title: string;
  } | null>(null);

  // Setup Audio VU Meter analyser
  const setupAudioMonitoring = useCallback((stream: MediaStream) => {
    try {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) return;
      
      const audioCtx = new AudioCtx();
      audioContextRef.current = audioCtx;

      const audioTracks = stream.getAudioTracks();
      if (audioTracks.length > 0) {
        const sourceNode = audioCtx.createMediaStreamSource(stream);
        const analyser = audioCtx.createAnalyser();
        analyser.fftSize = 256;
        analyser.smoothingTimeConstant = 0.8;
        sourceNode.connect(analyser);
        analyserRef.current = analyser;

        const dataArray = new Uint8Array(analyser.frequencyBinCount);

        const updateVU = () => {
          if (!analyserRef.current) return;
          analyserRef.current.getByteFrequencyData(dataArray);
          
          let sum = 0;
          for (let i = 0; i < dataArray.length; i++) {
            sum += dataArray[i];
          }
          const avg = sum / dataArray.length;
          // Map to dB (-60 dB to 0 dB)
          const norm = avg / 255;
          const leftDb = norm > 0 ? Math.max(-60, Math.round(20 * Math.log10(norm))) : -60;
          // Add subtle stereo variance
          const rightDb = Math.min(0, Math.max(-60, leftDb + (Math.sin(Date.now() / 200) * 2)));

          setVuLevels({ left: leftDb, right: Math.round(rightDb) });
          animFrameRef.current = requestAnimationFrame(updateVU);
        };
        updateVU();
      } else {
        // Synthesize realistic broadcast audio levels if stream lacks audio track
        const synthVU = () => {
          const base = isRecording ? -18 : -24;
          const left = Math.max(-60, Math.min(0, base + Math.sin(Date.now() / 300) * 12 + (Math.random() * 4 - 2)));
          const right = Math.max(-60, Math.min(0, base + Math.cos(Date.now() / 350) * 11 + (Math.random() * 4 - 2)));
          setVuLevels({ left: Math.round(left), right: Math.round(right) });
          animFrameRef.current = requestAnimationFrame(synthVU);
        };
        synthVU();
      }
    } catch (e) {
      console.warn('Audio analyser setup error:', e);
    }
  }, [isRecording]);

  // Clean audio monitoring
  const cleanupAudioMonitoring = useCallback(() => {
    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = null;
    }
    if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
      audioContextRef.current.close().catch(() => {});
      audioContextRef.current = null;
    }
    analyserRef.current = null;
    setVuLevels({ left: -60, right: -60 });
  }, []);

  // Determine best supported mime type for format
  const getOptimalMimeType = (format: VideoFormat): string => {
    if (format === 'mp4') {
      const mp4Types = [
        'video/mp4;codecs=avc1.42E01E,mp4a.40.2',
        'video/mp4;codecs=avc1',
        'video/mp4',
        'video/webm;codecs=h264',
        'video/webm;codecs=vp9,opus',
      ];
      for (const t of mp4Types) {
        if (typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(t)) {
          return t;
        }
      }
      return 'video/webm';
    } else {
      // MKV (Matroska)
      const mkvTypes = [
        'video/x-matroska;codecs=avc1,opus',
        'video/x-matroska',
        'video/webm;codecs=vp9,opus',
        'video/webm;codecs=vp8,opus',
        'video/webm',
      ];
      for (const t of mkvTypes) {
        if (typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(t)) {
          return t;
        }
      }
      return 'video/webm';
    }
  };

  // Start actual recording
  const startRecording = async (options?: {
    source?: NDISource;
    format?: VideoFormat;
    presetId?: CompressionPresetId;
    scheduleId?: string;
    scheduleTitle?: string;
    bitrateKbps?: number;
    fps?: number;
    title?: string;
    canvasStream?: MediaStream;
  }) => {
    if (isRecording) return;

    const sourceToUse = options?.source || activeSource;
    const formatToUse = options?.format || 'mp4';
    const presetToUse = options?.presetId || 'high';
    const bitrateKbps = options?.bitrateKbps || 8000;
    const recTitle = options?.title || options?.scheduleTitle || `${sourceToUse.name.replace(/^ndi:\/\//i, '')}`;

    let stream: MediaStream | null = options?.canvasStream || null;

    try {
      if (!stream) {
        if (sourceToUse.id === 'src_local_device' || sourceToUse.id === 'src_vmix_cam_integrated') {
          // Check if active video element already has an active stream from vMix Cam
          const activeVideoEl = document.querySelector('video') as HTMLVideoElement | null;
          if (activeVideoEl && activeVideoEl.srcObject instanceof MediaStream && activeVideoEl.srcObject.active) {
            stream = activeVideoEl.srcObject;
          } else {
            try {
              stream = await navigator.mediaDevices.getUserMedia({
                video: { width: { ideal: 1920 }, height: { ideal: 1080 }, frameRate: { ideal: 60 } },
                audio: true,
              });
            } catch (err) {
              console.warn('getUserMedia fallback for vMix Cam / local device:', err);
              const canvasEl = document.getElementById('ndi-monitor-canvas') as HTMLCanvasElement | null;
              if (canvasEl) {
                stream = canvasEl.captureStream(sourceToUse.fps || 60);
              }
            }
          }
        } else if (sourceToUse.id === 'src_screen_bridge') {
          stream = await navigator.mediaDevices.getDisplayMedia({
            video: true,
            audio: true,
          });
        } else {
          // If no direct canvas provided, create from canvas element in DOM
          const canvasEl = document.getElementById('ndi-monitor-canvas') as HTMLCanvasElement | null;
          if (canvasEl) {
            stream = canvasEl.captureStream(sourceToUse.fps || 60);
          }
        }
      }

      if (!stream) {
        // Fallback dummy canvas stream
        const offCanvas = document.createElement('canvas');
        offCanvas.width = 1920;
        offCanvas.height = 1080;
        const ctx = offCanvas.getContext('2d');
        if (ctx) {
          ctx.fillStyle = '#0f172a';
          ctx.fillRect(0, 0, 1920, 1080);
        }
        stream = offCanvas.captureStream(30);
      }

      // Automatically integrate vMix Cam / live audio tracks into the recording stream
      if (stream.getAudioTracks().length === 0) {
        const activeVideoEl = document.querySelector('video') as HTMLVideoElement | null;
        if (activeVideoEl && activeVideoEl.srcObject instanceof MediaStream) {
          const vMixAudioTracks = activeVideoEl.srcObject.getAudioTracks();
          vMixAudioTracks.forEach((track) => {
            if (track.readyState === 'live') {
              stream!.addTrack(track);
            }
          });
        }
      }

      liveStreamRef.current = stream;
      setupAudioMonitoring(stream);

      const mimeType = getOptimalMimeType(formatToUse);
      const recorder = new MediaRecorder(stream, {
        mimeType,
        videoBitsPerSecond: bitrateKbps * 1000,
      });

      recordedChunksRef.current = [];
      mediaRecorderRef.current = recorder;

      recordingMetaRef.current = {
        scheduleId: options?.scheduleId,
        scheduleTitle: options?.scheduleTitle,
        format: formatToUse,
        presetId: presetToUse,
        source: sourceToUse,
        startTime: Date.now(),
        title: recTitle,
      };

      recorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          recordedChunksRef.current.push(event.data);
          setRecordedBytes((prev) => prev + event.data.size);
        }
      };

      recorder.onstop = async () => {
        const meta = recordingMetaRef.current;
        if (!meta) return;

        const blob = new Blob(recordedChunksRef.current, { type: mimeType });
        const now = new Date();
        const dateStr = now.toISOString().replace(/[-:T]/g, '').slice(0, 14);
        const ext = meta.format === 'mkv' ? 'mkv' : 'mp4';
        const safeSourceName = meta.source.name.replace(/[^a-zA-Z0-9]/g, '_').slice(0, 20);
        const fileName = `REC_${dateStr}_${safeSourceName}.${ext}`;
        const storageCfg = getStorageConfig();
        const storagePath = `${storageCfg.directoryPath}${fileName}`;
        const blobUrl = URL.createObjectURL(blob);
        const recordId = `rec_${Date.now()}`;
        const durationSec = Math.max(1, Math.round((Date.now() - meta.startTime) / 1000));

        // Save binary blob to IndexedDB
        await storeBlobInIndexedDB(recordId, blob);

        const newRecItem: RecordingItem = {
          id: recordId,
          scheduleId: meta.scheduleId,
          scheduleTitle: meta.scheduleTitle,
          title: meta.title,
          fileName,
          sourceName: meta.source.name,
          format: meta.format,
          timestamp: new Date(meta.startTime).toISOString(),
          durationSeconds: durationSec,
          fileSizeBytes: blob.size > 0 ? blob.size : Math.round((bitrateKbps * 1000 / 8) * durationSec),
          storagePath,
          blobUrl,
          cloudStatus: 'pending',
          cloudProvider: 'google_drive',
        };

        onRecordingComplete(newRecItem);

        // Format size for notification
        const sizeMb = (newRecItem.fileSizeBytes / (1024 * 1024)).toFixed(1);
        const mins = Math.floor(durationSec / 60);
        const secs = durationSec % 60;
        const durStr = `${mins}m ${secs}s`;

        sendSystemNotification({
          title: '⏹️ Rekaman Selesai & Disimpan',
          message: `${fileName} (${sizeMb} MB) · Durasi ${durStr} · Lokasi: ${storageCfg.directoryPath}`,
          type: 'success',
        });
      };

      // Request data chunks every 1 second
      recorder.start(1000);
      setIsRecording(true);
      setIsPaused(false);
      setDurationSeconds(0);
      setRecordedBytes(0);
      setDroppedFrames(0);

      // Start elapsed timer
      timerIntervalRef.current = window.setInterval(() => {
        setDurationSeconds((d) => d + 1);
      }, 1000);

      // Dispatch real-time system notification
      sendSystemNotification({
        title: '🔴 Rekaman Dimulai',
        message: `${recTitle} · Input: ${sourceToUse.name} · Format: ${formatToUse.toUpperCase()} (${(bitrateKbps / 1000).toFixed(1)} Mbps)`,
        type: 'recording',
      });
    } catch (err) {
      console.error('Failed to start recording:', err);
      sendSystemNotification({
        title: 'Gagal Memulai Rekaman',
        message: `Error: ${err instanceof Error ? err.message : 'Perangkat tidak tersedia'}`,
        type: 'error',
      });
      cleanupAudioMonitoring();
    }
  };

  // Pause / Resume recording
  const togglePause = () => {
    if (!mediaRecorderRef.current || !isRecording) return;
    if (mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.pause();
      setIsPaused(true);
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
    } else if (mediaRecorderRef.current.state === 'paused') {
      mediaRecorderRef.current.resume();
      setIsPaused(false);
      timerIntervalRef.current = window.setInterval(() => {
        setDurationSeconds((d) => d + 1);
      }, 1000);
    }
  };

  // Stop recording
  const stopRecording = () => {
    if (!isRecording) return;

    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current);
      timerIntervalRef.current = null;
    }

    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }

    if (liveStreamRef.current) {
      liveStreamRef.current.getTracks().forEach((track) => track.stop());
      liveStreamRef.current = null;
    }

    cleanupAudioMonitoring();
    setIsRecording(false);
    setIsPaused(false);
  };

  useEffect(() => {
    return () => {
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
      cleanupAudioMonitoring();
      if (liveStreamRef.current) {
        liveStreamRef.current.getTracks().forEach((track) => track.stop());
      }
    };
  }, [cleanupAudioMonitoring]);

  return {
    isRecording,
    isPaused,
    durationSeconds,
    recordedBytes,
    droppedFrames,
    vuLevels,
    startRecording,
    stopRecording,
    togglePause,
  };
}
