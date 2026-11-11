import { useState, useEffect, useRef, useCallback } from 'react';
import { ScheduleRule, NDISource } from '../types';
import { getStoredSchedules, saveStoredSchedules } from '../utils/storage';
import { sendSystemNotification } from '../utils/notifications';

interface UseSchedulerProps {
  sources: NDISource[];
  isRecording: boolean;
  onTriggerStart: (schedule: ScheduleRule, source: NDISource) => void;
  onTriggerStop: (schedule: ScheduleRule) => void;
}

export function useScheduler({
  sources,
  isRecording,
  onTriggerStart,
  onTriggerStop,
}: UseSchedulerProps) {
  const [schedules, setSchedules] = useState<ScheduleRule[]>(() => getStoredSchedules());
  const [currentTime, setCurrentTime] = useState(new Date());
  const [activeScheduledRuleId, setActiveScheduledRuleId] = useState<string | null>(null);
  const warnedScheduleIdsRef = useRef<Set<string>>(new Set());

  // Save schedules when changed
  const updateSchedulesList = useCallback((updater: (prev: ScheduleRule[]) => ScheduleRule[]) => {
    setSchedules((prev) => {
      const next = updater(prev);
      saveStoredSchedules(next);
      return next;
    });
  }, []);

  const addSchedule = useCallback((rule: ScheduleRule) => {
    updateSchedulesList((prev) => [rule, ...prev]);
    sendSystemNotification({
      title: 'Jadwal Ditambahkan',
      message: `Jadwal [${rule.title}] berhasil disimpan dan diaktifkan.`,
      type: 'info',
    });
  }, [updateSchedulesList]);

  const updateSchedule = useCallback((updated: ScheduleRule) => {
    updateSchedulesList((prev) => prev.map((s) => (s.id === updated.id ? updated : s)));
  }, [updateSchedulesList]);

  const deleteSchedule = useCallback((id: string) => {
    updateSchedulesList((prev) => prev.filter((s) => s.id !== id));
  }, [updateSchedulesList]);

  const toggleSchedule = useCallback((id: string) => {
    updateSchedulesList((prev) =>
      prev.map((s) => {
        if (s.id === id) {
          const nextEnabled = !s.enabled;
          return {
            ...s,
            enabled: nextEnabled,
            status: nextEnabled ? 'waiting' : 'idle',
          };
        }
        return s;
      })
    );
  }, [updateSchedulesList]);

  // Main 1-second clock loop
  useEffect(() => {
    const timer = setInterval(() => {
      const now = new Date();
      setCurrentTime(now);

      const currentDayOfWeek = now.getDay(); // 0 = Sunday, 1 = Monday ... 6 = Saturday
      const currentDateStr = now.toISOString().slice(0, 10); // YYYY-MM-DD
      const currentHours = String(now.getHours()).padStart(2, '0');
      const currentMinutes = String(now.getMinutes()).padStart(2, '0');
      const currentSeconds = now.getSeconds();
      const currentHm = `${currentHours}:${currentMinutes}`;

      schedules.forEach((rule) => {
        if (!rule.enabled) return;

        // 1. Check Date / Day suitability
        let isEligibleDay = false;
        if (rule.repeatType === 'weekly') {
          isEligibleDay = rule.daysOfWeek.includes(currentDayOfWeek);
        } else if (rule.repeatType === 'once') {
          isEligibleDay = rule.specificDate === currentDateStr;
        } else if (rule.repeatType === 'date_range') {
          const startOk = !rule.startDate || currentDateStr >= rule.startDate;
          const endOk = !rule.endDate || currentDateStr <= rule.endDate;
          const dayOk = rule.daysOfWeek.length === 0 || rule.daysOfWeek.includes(currentDayOfWeek);
          isEligibleDay = startOk && endOk && dayOk;
        }

        if (!isEligibleDay) return;

        // 2. Pre-notification warning (5 minutes before)
        const [startH, startM] = rule.startTime.split(':').map(Number);
        const startTotalMinutes = startH * 60 + startM;
        const currentTotalMinutes = now.getHours() * 60 + now.getMinutes();
        const diffMinutes = startTotalMinutes - currentTotalMinutes;

        const warnKey = `${rule.id}_${currentDateStr}_5m`;
        if (diffMinutes === 5 && currentSeconds === 0 && !warnedScheduleIdsRef.current.has(warnKey)) {
          warnedScheduleIdsRef.current.add(warnKey);
          sendSystemNotification({
            title: '⚠️ Peringatan Jadwal Rekaman',
            message: `Jadwal [${rule.title}] akan dimulai otomatis dalam 5 menit (${rule.startTime}). Pastikan sinyal NDI standby.`,
            type: 'warning',
          });
        }

        // 3. Start Trigger Match
        // Trigger precisely when HM matches and we are in the first 2 seconds of the minute
        if (currentHm === rule.startTime && currentSeconds <= 2) {
          if (!isRecording && activeScheduledRuleId !== rule.id) {
            const targetSource = sources.find((s) => s.id === rule.sourceId) || sources[0];
            setActiveScheduledRuleId(rule.id);
            onTriggerStart(rule, targetSource);

            // Update status
            setSchedules((prev) =>
              prev.map((s) =>
                s.id === rule.id
                  ? { ...s, status: 'recording', lastTriggered: now.toISOString() }
                  : s
              )
            );

            sendSystemNotification({
              title: '🔴 Rekaman Terjadwal Dimulai',
              message: `Perekaman otomatis untuk [${rule.title}] telah dimulai. Format: ${rule.format.toUpperCase()} · Sumber: ${targetSource.name}`,
              type: 'recording',
            });
          }
        }

        // 4. End Trigger Match
        if (currentHm === rule.endTime && currentSeconds <= 2) {
          if (activeScheduledRuleId === rule.id || isRecording) {
            setActiveScheduledRuleId(null);
            onTriggerStop(rule);

            // Update status
            setSchedules((prev) =>
              prev.map((s) =>
                s.id === rule.id
                  ? {
                      ...s,
                      status: rule.repeatType === 'once' ? 'completed' : 'idle',
                      enabled: rule.repeatType === 'once' ? false : s.enabled,
                    }
                  : s
              )
            );

            sendSystemNotification({
              title: '⏹️ Rekaman Terjadwal Berakhir',
              message: `Perekaman otomatis [${rule.title}] telah selesai sesuai waktu akhir (${rule.endTime}). Memproses file...`,
              type: 'success',
            });
          }
        }
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [schedules, isRecording, activeScheduledRuleId, sources, onTriggerStart, onTriggerStop]);

  // Calculate next upcoming schedule countdown
  const getNextUpcomingSchedule = useCallback((): {
    schedule: ScheduleRule;
    startsInSeconds: number;
    targetDateStr: string;
  } | null => {
    const activeEnabled = schedules.filter((s) => s.enabled);
    if (activeEnabled.length === 0) return null;

    const now = currentTime;
    let closest: { schedule: ScheduleRule; startsInSeconds: number; targetDateStr: string } | null = null;

    for (const rule of activeEnabled) {
      const [rH, rM] = rule.startTime.split(':').map(Number);
      // Scan next 7 days
      for (let dayOffset = 0; dayOffset <= 7; dayOffset++) {
        const testDate = new Date(now);
        testDate.setDate(now.getDate() + dayOffset);
        testDate.setHours(rH, rM, 0, 0);

        const testDayOfWeek = testDate.getDay();
        const testDateStr = testDate.toISOString().slice(0, 10);

        let matches = false;
        if (rule.repeatType === 'weekly') {
          matches = rule.daysOfWeek.includes(testDayOfWeek);
        } else if (rule.repeatType === 'once') {
          matches = rule.specificDate === testDateStr;
        } else if (rule.repeatType === 'date_range') {
          const startOk = !rule.startDate || testDateStr >= rule.startDate;
          const endOk = !rule.endDate || testDateStr <= rule.endDate;
          const dayOk = rule.daysOfWeek.length === 0 || rule.daysOfWeek.includes(testDayOfWeek);
          matches = startOk && endOk && dayOk;
        }

        if (matches && testDate.getTime() > now.getTime()) {
          const diffSec = Math.floor((testDate.getTime() - now.getTime()) / 1000);
          if (!closest || diffSec < closest.startsInSeconds) {
            closest = {
              schedule: rule,
              startsInSeconds: diffSec,
              targetDateStr: testDateStr,
            };
          }
          break; // Found earliest occurrence for this rule
        }
      }
    }

    return closest;
  }, [schedules, currentTime]);

  return {
    schedules,
    currentTime,
    activeScheduledRuleId,
    addSchedule,
    updateSchedule,
    deleteSchedule,
    toggleSchedule,
    getNextUpcomingSchedule,
  };
}
