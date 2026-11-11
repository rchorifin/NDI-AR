import { RecordingItem, ScheduleRule, StorageConfig, CloudConfig, CompressionSettings } from '../types';

const DB_NAME = 'NDIAutoRecordDB';
const DB_VERSION = 1;
const STORE_RECORDINGS = 'recordings_blobs';

// Open IndexedDB database for large video file storage
function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !window.indexedDB) {
      reject(new Error('IndexedDB not supported'));
      return;
    }
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_RECORDINGS)) {
        db.createObjectStore(STORE_RECORDINGS, { keyPath: 'id' });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function storeBlobInIndexedDB(id: string, blob: Blob): Promise<void> {
  try {
    const db = await openDB();
    const tx = db.transaction(STORE_RECORDINGS, 'readwrite');
    const store = tx.objectStore(STORE_RECORDINGS);
    store.put({ id, blob, updatedAt: new Date().toISOString() });
    return new Promise((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch (err) {
    console.warn('Could not store blob in IndexedDB:', err);
  }
}

export async function getBlobFromIndexedDB(id: string): Promise<Blob | null> {
  try {
    const db = await openDB();
    const tx = db.transaction(STORE_RECORDINGS, 'readonly');
    const store = tx.objectStore(STORE_RECORDINGS);
    const req = store.get(id);
    return new Promise((resolve) => {
      req.onsuccess = () => {
        resolve(req.result ? req.result.blob : null);
      };
      req.onerror = () => resolve(null);
    });
  } catch {
    return null;
  }
}

export async function deleteBlobFromIndexedDB(id: string): Promise<void> {
  try {
    const db = await openDB();
    const tx = db.transaction(STORE_RECORDINGS, 'readwrite');
    const store = tx.objectStore(STORE_RECORDINGS);
    store.delete(id);
  } catch (err) {
    console.warn('Failed deleting blob:', err);
  }
}

// LocalStorage Keys
const KEY_SCHEDULES = 'ndi_autorec_schedules_v1';
const KEY_RECORDINGS_META = 'ndi_autorec_recordings_meta_v1';
const KEY_STORAGE_CONFIG = 'ndi_autorec_storage_cfg_v1';
const KEY_CLOUD_CONFIG = 'ndi_autorec_cloud_cfg_v1';
const KEY_COMPRESSION_CONFIG = 'ndi_autorec_compression_cfg_v1';

export const DEFAULT_STORAGE_CONFIG: StorageConfig = {
  directoryPath: 'D:\\NDI_Recordings\\Broadcast_Master\\',
  defaultFormat: 'mp4',
  defaultPreset: 'high',
  autoSplitHourly: false,
  autoDeleteDays: 30,
  availableDiskSpaceGb: 742.8,
  usedDiskSpaceGb: 194.2,
};

export const DEFAULT_CLOUD_CONFIG: CloudConfig = {
  enabled: true,
  autoSyncOnReconnect: true,
  provider: 'google_drive',
  accountEmail: 'rchorifin123@gmail.com',
  destinationFolder: '/Broadcast_Archive_2026/NDI_AutoRecord/',
  bandwidthLimitMbps: 50,
  endpointUrl: 'https://drive.google.com/drive/u/0/folders/ndi_archive',
};

export const DEFAULT_COMPRESSION_SETTINGS: CompressionSettings = {
  presetId: 'high',
  format: 'mp4',
  resolution: '1080p',
  width: 1920,
  height: 1080,
  fps: 60,
  videoBitrateKbps: 8000,
  audioBitrateKbps: 256,
  videoCodec: 'h264',
  audioCodec: 'aac',
};

export function getStoredSchedules(): ScheduleRule[] {
  try {
    const raw = localStorage.getItem(KEY_SCHEDULES);
    if (!raw) {
      // Seed default schedule so user immediately has realistic examples
      const initial: ScheduleRule[] = [
        {
          id: 'sch_news_morning',
          title: 'Siaran Berita Pagi (Senin - Jumat)',
          enabled: true,
          repeatType: 'weekly',
          daysOfWeek: [1, 2, 3, 4, 5],
          startTime: '06:00',
          endTime: '07:30',
          sourceId: 'src_cam_master',
          format: 'mp4',
          presetId: 'high',
          autoCloudSync: true,
          createdAt: new Date().toISOString(),
          status: 'idle',
        },
        {
          id: 'sch_talkshow_weekly',
          title: 'Live Talkshow Prime Time',
          enabled: true,
          repeatType: 'weekly',
          daysOfWeek: [3, 5],
          startTime: '19:30',
          endTime: '21:00',
          sourceId: 'src_obs_program',
          format: 'mkv',
          presetId: 'master',
          autoCloudSync: true,
          createdAt: new Date().toISOString(),
          status: 'idle',
        },
      ];
      localStorage.setItem(KEY_SCHEDULES, JSON.stringify(initial));
      return initial;
    }
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

export function saveStoredSchedules(schedules: ScheduleRule[]): void {
  try {
    localStorage.setItem(KEY_SCHEDULES, JSON.stringify(schedules));
  } catch (e) {
    console.error('Failed to save schedules', e);
  }
}

export function getStoredRecordingsMeta(): RecordingItem[] {
  try {
    const raw = localStorage.getItem(KEY_RECORDINGS_META);
    if (!raw) {
      const initialSample: RecordingItem[] = [
        {
          id: 'rec_sample_01',
          scheduleTitle: 'Siaran Berita Pagi (Senin - Jumat)',
          title: 'Siaran Berita Pagi - Segmen Utama',
          fileName: 'REC_20261110_060000_Master.mp4',
          sourceName: 'NDI://BROADCAST-PC/Master Feed 1',
          format: 'mp4',
          timestamp: new Date(Date.now() - 3600 * 1000 * 24).toISOString(),
          durationSeconds: 5400,
          fileSizeBytes: 5420000000, // ~5.4 GB
          storagePath: 'D:\\NDI_Recordings\\Broadcast_Master\\REC_20261110_060000_Master.mp4',
          cloudStatus: 'synced',
          cloudUrl: 'https://drive.google.com/file/d/rec_sample_01',
          cloudProvider: 'google_drive',
          syncedAt: new Date(Date.now() - 3600 * 1000 * 22).toISOString(),
        },
        {
          id: 'rec_sample_02',
          scheduleTitle: 'Live Talkshow Prime Time',
          title: 'Live Talkshow Prime Time - Episode 42',
          fileName: 'REC_20261110_193000_OBS.mkv',
          sourceName: 'NDI://OBS-STUDIO/Program Output',
          format: 'mkv',
          timestamp: new Date(Date.now() - 3600 * 1000 * 8).toISOString(),
          durationSeconds: 5400,
          fileSizeBytes: 8100000000, // ~8.1 GB
          storagePath: 'D:\\NDI_Recordings\\Broadcast_Master\\REC_20261110_193000_OBS.mkv',
          cloudStatus: 'pending',
          cloudProvider: 'google_drive',
        },
      ];
      localStorage.setItem(KEY_RECORDINGS_META, JSON.stringify(initialSample));
      return initialSample;
    }
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

export function saveStoredRecordingsMeta(recordings: RecordingItem[]): void {
  try {
    // Strip temporary blob and blobUrl before writing to localStorage
    const serializable = recordings.map(({ blob, blobUrl, ...rest }) => rest);
    localStorage.setItem(KEY_RECORDINGS_META, JSON.stringify(serializable));
  } catch (e) {
    console.error('Failed to save recordings metadata', e);
  }
}

export function getStorageConfig(): StorageConfig {
  try {
    const raw = localStorage.getItem(KEY_STORAGE_CONFIG);
    return raw ? { ...DEFAULT_STORAGE_CONFIG, ...JSON.parse(raw) } : DEFAULT_STORAGE_CONFIG;
  } catch {
    return DEFAULT_STORAGE_CONFIG;
  }
}

export function saveStorageConfig(config: StorageConfig): void {
  try {
    localStorage.setItem(KEY_STORAGE_CONFIG, JSON.stringify(config));
  } catch (e) {
    console.error('Failed saving storage config', e);
  }
}

export function getCloudConfig(): CloudConfig {
  try {
    const raw = localStorage.getItem(KEY_CLOUD_CONFIG);
    return raw ? { ...DEFAULT_CLOUD_CONFIG, ...JSON.parse(raw) } : DEFAULT_CLOUD_CONFIG;
  } catch {
    return DEFAULT_CLOUD_CONFIG;
  }
}

export function saveCloudConfig(config: CloudConfig): void {
  try {
    localStorage.setItem(KEY_CLOUD_CONFIG, JSON.stringify(config));
  } catch (e) {
    console.error('Failed saving cloud config', e);
  }
}

export function getCompressionConfig(): CompressionSettings {
  try {
    const raw = localStorage.getItem(KEY_COMPRESSION_CONFIG);
    return raw ? { ...DEFAULT_COMPRESSION_SETTINGS, ...JSON.parse(raw) } : DEFAULT_COMPRESSION_SETTINGS;
  } catch {
    return DEFAULT_COMPRESSION_SETTINGS;
  }
}

export function saveCompressionConfig(config: CompressionSettings): void {
  try {
    localStorage.setItem(KEY_COMPRESSION_CONFIG, JSON.stringify(config));
  } catch (e) {
    console.error('Failed saving compression config', e);
  }
}
