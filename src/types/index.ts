export type VideoFormat = 'mp4' | 'mkv';

export type CompressionPresetId = 'master' | 'high' | 'standard' | 'compact' | 'custom';

export interface CompressionSettings {
  presetId: CompressionPresetId;
  format: VideoFormat;
  resolution: '1080p' | '720p' | '4k';
  width: number;
  height: number;
  fps: number;
  videoBitrateKbps: number;
  audioBitrateKbps: number;
  videoCodec: 'h264' | 'vp9' | 'av1';
  audioCodec: 'aac' | 'opus';
}

export interface NDISource {
  id: string;
  name: string;
  streamUrl: string;
  ipAddress: string;
  category: 'broadcast' | 'camera' | 'graphics' | 'device' | 'test';
  status: 'online' | 'standby' | 'signal_lost';
  resolution: string;
  fps: number;
  previewThumbnail?: string;
}

export type RepeatType = 'weekly' | 'date_range' | 'once';

export interface ScheduleRule {
  id: string;
  title: string;
  enabled: boolean;
  repeatType: RepeatType;
  // 0 = Minggu, 1 = Senin, 2 = Selasa, 3 = Rabu, 4 = Kamis, 5 = Jumat, 6 = Sabtu
  daysOfWeek: number[];
  specificDate?: string; // YYYY-MM-DD (for 'once')
  startDate?: string;    // YYYY-MM-DD (for 'date_range')
  endDate?: string;      // YYYY-MM-DD (for 'date_range')
  startTime: string;     // HH:mm (e.g. "09:00")
  endTime: string;       // HH:mm (e.g. "10:30")
  sourceId: string;
  format: VideoFormat;
  presetId: CompressionPresetId;
  autoCloudSync: boolean;
  createdAt: string;
  lastTriggered?: string;
  status: 'idle' | 'waiting' | 'recording' | 'completed' | 'error';
}

export interface RecordingItem {
  id: string;
  scheduleId?: string;
  scheduleTitle?: string;
  title: string;
  fileName: string;
  sourceName: string;
  format: VideoFormat;
  timestamp: string;
  durationSeconds: number;
  fileSizeBytes: number;
  storagePath: string;
  blobUrl?: string;
  blob?: Blob;
  cloudStatus: 'pending' | 'uploading' | 'synced' | 'failed' | 'disabled';
  cloudProgress?: number;
  cloudUrl?: string;
  cloudProvider?: 'google_drive' | 'dropbox' | 's3' | 'custom';
  syncedAt?: string;
}

export interface StorageConfig {
  directoryPath: string;
  defaultFormat: VideoFormat;
  defaultPreset: CompressionPresetId;
  autoSplitHourly: boolean;
  autoDeleteDays: number; // 0 for never
  availableDiskSpaceGb: number;
  usedDiskSpaceGb: number;
}

export type CloudProvider = 'google_drive' | 'dropbox' | 's3' | 'custom';

export interface CloudConfig {
  enabled: boolean;
  autoSyncOnReconnect: boolean;
  provider: CloudProvider;
  accountEmail: string;
  destinationFolder: string;
  bandwidthLimitMbps: number;
  apiKeyOrToken?: string;
  bucketName?: string;
  endpointUrl?: string;
}

export interface SystemNotificationItem {
  id: string;
  title: string;
  message: string;
  type: 'info' | 'success' | 'warning' | 'error' | 'recording';
  timestamp: string;
  read: boolean;
  actionUrl?: string;
}
