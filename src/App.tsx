import React, { useState, useEffect, useCallback } from 'react';
import { DesktopTitleBar } from './components/DesktopTitleBar';
import { TopNav, ActiveTab } from './components/TopNav';
import { LiveMonitor } from './components/LiveMonitor';
import { ScheduleManager } from './components/ScheduleManager';
import { StorageSettings } from './components/StorageSettings';
import { CloudSyncManager } from './components/CloudSyncManager';
import { NotificationCenter } from './components/NotificationCenter';
import { INITIAL_NDI_SOURCES } from './utils/ndiSources';
import {
  getStoredRecordingsMeta,
  saveStoredRecordingsMeta,
  getStorageConfig,
  getCompressionConfig,
} from './utils/storage';
import {
  getStoredNotifications,
  subscribeNotifications,
  saveStoredNotifications,
} from './utils/notifications';
import { useNDIRecorder } from './hooks/useNDIRecorder';
import { useScheduler } from './hooks/useScheduler';
import { useCloudSync } from './hooks/useCloudSync';
import { NDISource, RecordingItem, ScheduleRule, SystemNotificationItem } from './types';

export default function App() {
  const [activeTab, setActiveTab] = useState<ActiveTab>('monitor');
  const [sources, setSources] = useState<NDISource[]>(INITIAL_NDI_SOURCES);
  const [activeSource, setActiveSource] = useState<NDISource>(INITIAL_NDI_SOURCES[0]);
  const [storageConfig, setStorageConfig] = useState(() => getStorageConfig());
  const [compressionConfig, setCompressionConfig] = useState(() => getCompressionConfig());
  const [recordings, setRecordings] = useState<RecordingItem[]>(() => getStoredRecordingsMeta());
  const [notifications, setNotifications] = useState<SystemNotificationItem[]>(() => getStoredNotifications());
  const [isNotificationOpen, setIsNotificationOpen] = useState(false);

  // Subscribe to real-time notification events
  useEffect(() => {
    const unsubscribe = subscribeNotifications((notif) => {
      setNotifications((prev) => [notif, ...prev].slice(0, 50));
    });
    return () => unsubscribe();
  }, []);

  // Handle completed recording
  const handleRecordingComplete = useCallback((item: RecordingItem) => {
    setRecordings((prev) => {
      const updated = [item, ...prev];
      saveStoredRecordingsMeta(updated);
      return updated;
    });
  }, []);

  // Recorder hook
  const {
    isRecording,
    isPaused,
    durationSeconds,
    recordedBytes,
    droppedFrames,
    vuLevels,
    startRecording,
    stopRecording,
    togglePause,
  } = useNDIRecorder(activeSource, handleRecordingComplete);

  // Scheduler callbacks
  const handleScheduledStart = useCallback(
    (rule: ScheduleRule, targetSource: NDISource) => {
      setActiveSource(targetSource);
      startRecording({
        source: targetSource,
        format: rule.format,
        presetId: rule.presetId,
        scheduleId: rule.id,
        scheduleTitle: rule.title,
        bitrateKbps: rule.presetId === 'master' ? 15000 : rule.presetId === 'high' ? 8000 : 4000,
        title: rule.title,
      });
    },
    [startRecording]
  );

  const handleScheduledStop = useCallback(() => {
    stopRecording();
  }, [stopRecording]);

  // Scheduler hook
  const {
    schedules,
    addSchedule,
    updateSchedule,
    deleteSchedule,
    toggleSchedule,
    getNextUpcomingSchedule,
  } = useScheduler({
    sources,
    isRecording,
    onTriggerStart: handleScheduledStart,
    onTriggerStop: handleScheduledStop,
  });

  // Cloud sync hook
  const {
    isOnline,
    cloudConfig,
    activeUploadId,
    uploadProgress,
    isSyncing,
    updateConfig: updateCloudConfig,
    processSyncQueue,
    uploadSingleItem,
    toggleSimulatedNetwork,
  } = useCloudSync({
    recordings,
    setRecordings,
  });

  // Delete recording item
  const handleDeleteRecording = useCallback((id: string) => {
    setRecordings((prev) => {
      const updated = prev.filter((r) => r.id !== id);
      saveStoredRecordingsMeta(updated);
      return updated;
    });
  }, []);

  // Quick manual record toggle
  const handleQuickRecordToggle = () => {
    if (isRecording) {
      stopRecording();
    } else {
      startRecording({
        source: activeSource,
        format: compressionConfig.format,
        presetId: compressionConfig.presetId,
        bitrateKbps: compressionConfig.videoBitrateKbps,
        fps: compressionConfig.fps,
        title: `Manual REC - ${activeSource.name.replace(/^ndi:\/\//i, '')}`,
      });
    }
  };

  // Trigger recording immediately from a schedule template
  const handleManualTriggerFromSchedule = (rule: ScheduleRule) => {
    const src = sources.find((s) => s.id === rule.sourceId) || activeSource;
    setActiveSource(src);
    setActiveTab('monitor');
    startRecording({
      source: src,
      format: rule.format,
      presetId: rule.presetId,
      scheduleId: rule.id,
      scheduleTitle: rule.title,
      bitrateKbps: rule.presetId === 'master' ? 15000 : rule.presetId === 'high' ? 8000 : 4000,
      title: rule.title,
    });
  };

  const pendingSyncCount = recordings.filter(
    (r) => r.cloudStatus === 'pending' || r.cloudStatus === 'failed'
  ).length;

  const unreadNotifCount = notifications.filter((n) => !n.read).length;

  const nextUpcoming = getNextUpcomingSchedule();

  const handleAddSource = useCallback((newSource: NDISource) => {
    setSources((prev) => [newSource, ...prev]);
    setActiveSource(newSource);
  }, []);

  return (
    <div className="min-h-screen bg-[#070a0f] text-slate-100 flex flex-col justify-between selection:bg-rose-600 selection:text-white">
      <div>
        {/* Native Desktop Style Title Bar */}
        <DesktopTitleBar
          isOnline={isOnline}
          isRecording={isRecording}
          onToggleSimulatedNetwork={toggleSimulatedNetwork}
          onOpenNotifications={() => setIsNotificationOpen(true)}
          unreadNotificationsCount={unreadNotifCount}
        />

        {/* Top Header Navigation (Conforming to Top Bar Contract) */}
        <TopNav
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          isRecording={isRecording}
          onQuickRecordToggle={handleQuickRecordToggle}
          pendingSyncCount={pendingSyncCount}
        />

        {/* Main Workspace Content Area */}
        <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6 w-full">
          {activeTab === 'monitor' && (
            <LiveMonitor
              sources={sources}
              activeSource={activeSource}
              onSelectSource={setActiveSource}
              onAddSource={handleAddSource}
              isRecording={isRecording}
              isPaused={isPaused}
              durationSeconds={durationSeconds}
              recordedBytes={recordedBytes}
              droppedFrames={droppedFrames}
              vuLevels={vuLevels}
              activeFormat={compressionConfig.format}
              onChangeFormat={(fmt) => {
                const next = { ...compressionConfig, format: fmt };
                setCompressionConfig(next);
              }}
              activePresetId={compressionConfig.presetId}
              onChangePresetId={(presetId) => {
                const next = { ...compressionConfig, presetId };
                setCompressionConfig(next);
              }}
              onStartRecord={handleQuickRecordToggle}
              onStopRecord={stopRecording}
              onTogglePause={togglePause}
            />
          )}

          {activeTab === 'schedules' && (
            <ScheduleManager
              schedules={schedules}
              sources={sources}
              onAddSchedule={addSchedule}
              onUpdateSchedule={updateSchedule}
              onDeleteSchedule={deleteSchedule}
              onToggleSchedule={toggleSchedule}
              onManualTrigger={handleManualTriggerFromSchedule}
              nextUpcoming={nextUpcoming}
            />
          )}

          {activeTab === 'storage' && (
            <StorageSettings
              storageConfig={storageConfig}
              setStorageConfig={setStorageConfig}
              compressionConfig={compressionConfig}
              setCompressionConfig={setCompressionConfig}
            />
          )}

          {activeTab === 'cloud' && (
            <CloudSyncManager
              isOnline={isOnline}
              cloudConfig={cloudConfig}
              onUpdateCloudConfig={updateCloudConfig}
              recordings={recordings}
              onUploadSingle={uploadSingleItem}
              onProcessSyncQueue={processSyncQueue}
              onDeleteRecording={handleDeleteRecording}
              onToggleSimulatedNetwork={toggleSimulatedNetwork}
              isSyncing={isSyncing}
              activeUploadId={activeUploadId}
              uploadProgress={uploadProgress}
            />
          )}
        </main>
      </div>

      {/* Real-time System Notification Center Drawer */}
      <NotificationCenter
        isOpen={isNotificationOpen}
        onClose={() => setIsNotificationOpen(false)}
        notifications={notifications}
        onClearAll={() => {
          setNotifications([]);
          saveStoredNotifications([]);
        }}
        onMarkAllRead={() => {
          setNotifications((prev) => {
            const updated = prev.map((n) => ({ ...n, read: true }));
            saveStoredNotifications(updated);
            return updated;
          });
        }}
      />

      {/* Broadcast Studio Desktop Footer / Workstation Status Strip */}
      <footer className="border-t border-slate-800 bg-[#070a0f] px-4 py-2 text-[11px] text-slate-400 select-none">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-3">
          {/* Engine Info */}
          <div className="flex items-center gap-3">
            <span className="font-semibold text-slate-300">NDI AutoRecord Pro</span>
            <span className="text-slate-600" aria-hidden="true">·</span>
            <span>Jalur: <span className="font-mono-nums text-slate-400">{storageConfig.directoryPath}</span></span>
            <span className="text-slate-600" aria-hidden="true">·</span>
            <span className="uppercase font-mono-nums text-slate-300">
              Format: {compressionConfig.format} ({compressionConfig.presetId})
            </span>
          </div>

          {/* Right Status */}
          <div className="flex items-center gap-4 font-mono-nums">
            <div className="flex items-center gap-1.5">
              <span className={`w-2 h-2 rounded-full ${isOnline ? 'bg-emerald-500' : 'bg-amber-500'}`} />
              <span>{isOnline ? 'Online (Auto-Sync Cloud Siap)' : 'Offline (Tersimpan Lokal)'}</span>
            </div>
            <span className="text-slate-600" aria-hidden="true">·</span>
            <span>{recordings.length} Berkas Tersimpan</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
