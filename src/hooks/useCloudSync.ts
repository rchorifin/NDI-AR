import { useState, useEffect, useCallback, useRef } from 'react';
import { RecordingItem, CloudConfig } from '../types';
import { getCloudConfig, saveCloudConfig, saveStoredRecordingsMeta } from '../utils/storage';
import { sendSystemNotification } from '../utils/notifications';

interface UseCloudSyncProps {
  recordings: RecordingItem[];
  setRecordings: React.Dispatch<React.SetStateAction<RecordingItem[]>>;
}

export function useCloudSync({ recordings, setRecordings }: UseCloudSyncProps) {
  const [isOnline, setIsOnline] = useState<boolean>(() => {
    return typeof navigator !== 'undefined' ? navigator.onLine : true;
  });
  const [cloudConfig, setCloudConfig] = useState<CloudConfig>(() => getCloudConfig());
  const [activeUploadId, setActiveUploadId] = useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = useState<number>(0);
  const isSyncingRef = useRef(false);

  // Update cloud config
  const updateConfig = useCallback((newConfig: CloudConfig) => {
    setCloudConfig(newConfig);
    saveCloudConfig(newConfig);
  }, []);

  // Listen to network status changes
  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      sendSystemNotification({
        title: '🌐 Koneksi Internet Pulih (Online)',
        message: 'Koneksi jaringan terdeteksi. Memulai verifikasi antrean sinkronisasi cloud...',
        type: 'info',
      });
    };

    const handleOffline = () => {
      setIsOnline(false);
      sendSystemNotification({
        title: '📴 Mode Offline Aktif',
        message: 'Koneksi internet terputus. Semua rekaman baru akan disimpan di penyimpanan lokal dan dimasukkan antrean cloud otomatis.',
        type: 'warning',
      });
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Upload an individual file with chunked progress
  const uploadSingleItem = useCallback(
    async (item: RecordingItem): Promise<boolean> => {
      setActiveUploadId(item.id);
      setUploadProgress(5);

      // Update item status in UI
      setRecordings((prev) =>
        prev.map((r) =>
          r.id === item.id ? { ...r, cloudStatus: 'uploading', cloudProgress: 5 } : r
        )
      );

      // Simulate realistic chunked upload based on file size and bandwidth
      return new Promise<boolean>((resolve) => {
        let currentProg = 5;
        const interval = setInterval(() => {
          // Progress increments by 15-25%
          currentProg += Math.floor(Math.random() * 15) + 12;

          if (currentProg >= 100) {
            clearInterval(interval);
            currentProg = 100;
            setUploadProgress(100);

            const syncedTime = new Date().toISOString();
            const providerName =
              cloudConfig.provider === 'google_drive'
                ? 'Google Drive'
                : cloudConfig.provider === 'dropbox'
                ? 'Dropbox'
                : cloudConfig.provider === 's3'
                ? 'Amazon S3'
                : 'Cloud Storage';

            const simulatedCloudUrl = `https://cloud-storage.internal/view/${item.fileName}?synced=${encodeURIComponent(
              syncedTime
            )}`;

            setRecordings((prev) => {
              const updated = prev.map((r) =>
                r.id === item.id
                  ? {
                      ...r,
                      cloudStatus: 'synced' as const,
                      cloudProgress: 100,
                      cloudUrl: simulatedCloudUrl,
                      cloudProvider: cloudConfig.provider,
                      syncedAt: syncedTime,
                    }
                  : r
              );
              saveStoredRecordingsMeta(updated);
              return updated;
            });

            sendSystemNotification({
              title: '☁️ Sinkronisasi Cloud Berhasil',
              message: `File [${item.fileName}] sukses diunggah ke ${providerName} (${cloudConfig.destinationFolder}).`,
              type: 'success',
            });

            setTimeout(() => {
              setActiveUploadId(null);
              setUploadProgress(0);
              resolve(true);
            }, 600);
          } else {
            setUploadProgress(currentProg);
            setRecordings((prev) =>
              prev.map((r) =>
                r.id === item.id ? { ...r, cloudProgress: currentProg } : r
              )
            );
          }
        }, 300);
      });
    },
    [cloudConfig, setRecordings]
  );

  // Process entire sync queue
  const processSyncQueue = useCallback(async () => {
    if (!cloudConfig.enabled || !isOnline || isSyncingRef.current) return;

    // Find pending items
    const pendingItems = recordings.filter(
      (r) => r.cloudStatus === 'pending' || r.cloudStatus === 'failed'
    );

    if (pendingItems.length === 0) return;

    isSyncingRef.current = true;
    sendSystemNotification({
      title: '☁️ Memulai Antrean Sinkronisasi',
      message: `Terdapat ${pendingItems.length} rekaman dalam antrean. Mengunggah secara berurutan...`,
      type: 'info',
    });

    for (const item of pendingItems) {
      if (!isOnline) {
        break; // Stop if network drops again
      }
      await uploadSingleItem(item);
    }

    isSyncingRef.current = false;
  }, [cloudConfig.enabled, isOnline, recordings, uploadSingleItem]);

  // Trigger auto sync when internet reconnects or on changes
  useEffect(() => {
    if (isOnline && cloudConfig.enabled && cloudConfig.autoSyncOnReconnect) {
      const hasPending = recordings.some((r) => r.cloudStatus === 'pending');
      if (hasPending && !isSyncingRef.current) {
        // Debounce slightly to ensure connection stable
        const t = setTimeout(() => {
          processSyncQueue();
        }, 1200);
        return () => clearTimeout(t);
      }
    }
  }, [isOnline, cloudConfig.enabled, cloudConfig.autoSyncOnReconnect, recordings, processSyncQueue]);

  // Simulated toggle for testing offline/online without disabling computer Wi-Fi
  const toggleSimulatedNetwork = () => {
    const nextState = !isOnline;
    setIsOnline(nextState);
    if (nextState) {
      window.dispatchEvent(new Event('online'));
    } else {
      window.dispatchEvent(new Event('offline'));
    }
  };

  return {
    isOnline,
    cloudConfig,
    activeUploadId,
    uploadProgress,
    isSyncing: isSyncingRef.current,
    updateConfig,
    processSyncQueue,
    uploadSingleItem,
    toggleSimulatedNetwork,
  };
}
