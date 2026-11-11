import React, { useState } from 'react';
import {
  Plus,
  Calendar,
  Clock,
  Radio,
  Trash2,
  Edit2,
  CheckCircle2,
  Play,
  AlertCircle,
  Cloud,
  Video,
  Volume2,
  Mic,
  Sparkles,
  Layers,
} from 'lucide-react';
import { ScheduleRule, NDISource, VideoFormat, CompressionPresetId, RepeatType } from '../types';

interface ScheduleManagerProps {
  schedules: ScheduleRule[];
  sources: NDISource[];
  onAddSchedule: (rule: ScheduleRule) => void;
  onUpdateSchedule: (rule: ScheduleRule) => void;
  onDeleteSchedule: (id: string) => void;
  onToggleSchedule: (id: string) => void;
  onManualTrigger: (rule: ScheduleRule) => void;
  nextUpcoming: {
    schedule: ScheduleRule;
    startsInSeconds: number;
    targetDateStr: string;
  } | null;
}

const DAY_NAMES = [
  { day: 1, label: 'Sen', full: 'Senin' },
  { day: 2, label: 'Sel', full: 'Selasa' },
  { day: 3, label: 'Rab', full: 'Rabu' },
  { day: 4, label: 'Kam', full: 'Kamis' },
  { day: 5, label: 'Jum', full: 'Jumat' },
  { day: 6, label: 'Sab', full: 'Sabtu' },
  { day: 0, label: 'Min', full: 'Minggu' },
];

export const ScheduleManager: React.FC<ScheduleManagerProps> = ({
  schedules,
  sources,
  onAddSchedule,
  onUpdateSchedule,
  onDeleteSchedule,
  onToggleSchedule,
  onManualTrigger,
  nextUpcoming,
}) => {
  const [filterType, setFilterType] = useState<'all' | 'weekly' | 'date'>('all');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  // Form states
  const [title, setTitle] = useState('');
  const [repeatType, setRepeatType] = useState<RepeatType>('weekly');
  const [selectedDays, setSelectedDays] = useState<number[]>([1, 2, 3, 4, 5]);
  const [specificDate, setSpecificDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [startDate, setStartDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [endDate, setEndDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 30);
    return d.toISOString().slice(0, 10);
  });
  const [startTime, setStartTime] = useState('09:00');
  const [endTime, setEndTime] = useState('10:30');
  const [sourceId, setSourceId] = useState<string>(() => {
    const vmix = sources.find((s) => s.id === 'src_vmix_cam_integrated');
    return vmix?.id || sources[0]?.id || 'src_vmix_cam_integrated';
  });
  const [format, setFormat] = useState<VideoFormat>('mp4');
  const [presetId, setPresetId] = useState<CompressionPresetId>('high');
  const [autoCloudSync, setAutoCloudSync] = useState(true);

  // Open modal for new schedule
  const handleOpenAddModal = () => {
    setEditingId(null);
    setTitle('');
    setRepeatType('weekly');
    setSelectedDays([1, 2, 3, 4, 5]);
    const today = new Date().toISOString().slice(0, 10);
    setSpecificDate(today);
    setStartDate(today);
    setStartTime('09:00');
    setEndTime('10:30');
    // Prioritize vMix Cam & Audio Terintegrasi
    const vmixSource = sources.find((s) => s.id === 'src_vmix_cam_integrated');
    setSourceId(vmixSource?.id || sources[0]?.id || 'src_vmix_cam_integrated');
    setFormat('mp4');
    setPresetId('high');
    setAutoCloudSync(true);
    setIsModalOpen(true);
  };

  // Open modal for editing
  const handleOpenEditModal = (rule: ScheduleRule) => {
    setEditingId(rule.id);
    setTitle(rule.title);
    setRepeatType(rule.repeatType);
    setSelectedDays(rule.daysOfWeek);
    setSpecificDate(rule.specificDate || new Date().toISOString().slice(0, 10));
    setStartDate(rule.startDate || new Date().toISOString().slice(0, 10));
    setEndDate(rule.endDate || new Date().toISOString().slice(0, 10));
    setStartTime(rule.startTime);
    setEndTime(rule.endTime);
    setSourceId(rule.sourceId);
    setFormat(rule.format);
    setPresetId(rule.presetId);
    setAutoCloudSync(rule.autoCloudSync);
    setIsModalOpen(true);
  };

  // Save form
  const handleSaveForm = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    if (editingId) {
      const existing = schedules.find((s) => s.id === editingId);
      if (existing) {
        onUpdateSchedule({
          ...existing,
          title: title.trim(),
          repeatType,
          daysOfWeek: selectedDays,
          specificDate: repeatType === 'once' ? specificDate : undefined,
          startDate: repeatType === 'date_range' ? startDate : undefined,
          endDate: repeatType === 'date_range' ? endDate : undefined,
          startTime,
          endTime,
          sourceId,
          format,
          presetId,
          autoCloudSync,
        });
      }
    } else {
      const newRule: ScheduleRule = {
        id: `sch_${Date.now()}`,
        title: title.trim(),
        enabled: true,
        repeatType,
        daysOfWeek: selectedDays,
        specificDate: repeatType === 'once' ? specificDate : undefined,
        startDate: repeatType === 'date_range' ? startDate : undefined,
        endDate: repeatType === 'date_range' ? endDate : undefined,
        startTime,
        endTime,
        sourceId,
        format,
        presetId,
        autoCloudSync,
        createdAt: new Date().toISOString(),
        status: 'waiting',
      };
      onAddSchedule(newRule);
    }
    setIsModalOpen(false);
  };

  // Toggle single day
  const toggleDay = (day: number) => {
    if (selectedDays.includes(day)) {
      setSelectedDays(selectedDays.filter((d) => d !== day));
    } else {
      setSelectedDays([...selectedDays, day]);
    }
  };

  // Filtered schedules
  const filteredSchedules = schedules.filter((s) => {
    if (filterType === 'weekly') return s.repeatType === 'weekly';
    if (filterType === 'date') return s.repeatType === 'once' || s.repeatType === 'date_range';
    return true;
  });

  // Format countdown string
  const formatCountdown = (totalSec: number) => {
    const hours = Math.floor(totalSec / 3600);
    const mins = Math.floor((totalSec % 3600) / 60);
    const secs = totalSec % 60;
    if (hours > 0) return `${hours} jam ${mins} menit`;
    if (mins > 0) return `${mins} menit ${secs} detik`;
    return `${secs} detik`;
  };

  return (
    <div className="space-y-6">
      {/* Top Banner: Next Scheduled Trigger Countdown */}
      {nextUpcoming ? (
        <div className="bg-[#0f1828] border border-blue-900/50 rounded-lg p-4 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="w-10 h-10 rounded-lg bg-blue-600/20 border border-blue-500/30 flex items-center justify-center text-blue-400 shrink-0">
              <Clock className="w-5 h-5 animate-spin" style={{ animationDuration: '60s' }} />
            </div>
            <div>
              <div className="flex items-center gap-2 text-xs text-blue-400 font-semibold tracking-wide uppercase">
                <span>Jadwal Rekaman Berikutnya</span>
                <span aria-hidden="true">·</span>
                <span className="font-mono-nums">{nextUpcoming.targetDateStr} Pukul {nextUpcoming.schedule.startTime}</span>
              </div>
              <h3 className="text-base font-bold text-white mt-0.5">{nextUpcoming.schedule.title}</h3>
              <div className="text-xs text-slate-400 mt-0.5 flex items-center gap-2">
                <span>Wadah: {nextUpcoming.schedule.format.toUpperCase()}</span>
                <span aria-hidden="true">·</span>
                <span>Sumber: {sources.find((s) => s.id === nextUpcoming.schedule.sourceId)?.name || 'NDI Master'}</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="text-right">
              <span className="text-[10px] text-slate-400 uppercase font-sans">Dimulai Dalam</span>
              <div className="text-xl font-bold font-mono-nums text-emerald-400">
                {formatCountdown(nextUpcoming.startsInSeconds)}
              </div>
            </div>
            <button
              onClick={() => onManualTrigger(nextUpcoming.schedule)}
              className="px-3 py-2 text-xs font-medium text-white bg-blue-600 hover:bg-blue-500 rounded transition-colors whitespace-nowrap"
            >
              Rekam Sekarang
            </button>
          </div>
        </div>
      ) : (
        <div className="bg-[#0f1420] border border-slate-800 rounded-lg p-4 text-xs text-slate-400 flex items-center justify-between">
          <span>Tidak ada jadwal rekaman yang aktif saat ini. Aktifkan jadwal di bawah atau tambahkan jadwal baru.</span>
          <button
            onClick={handleOpenAddModal}
            className="text-white bg-rose-600 hover:bg-rose-500 px-3 py-1.5 rounded font-medium transition-colors"
          >
            Buat Jadwal Pertama
          </button>
        </div>
      )}

      {/* Main Scheduler Management Strip */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        {/* Filter Segmented Controls */}
        <div className="flex items-center gap-1 p-1 bg-slate-900 border border-slate-800 rounded-lg">
          <button
            onClick={() => setFilterType('all')}
            className={`px-3 py-1.5 text-xs font-medium rounded transition-colors ${
              filterType === 'all' ? 'bg-slate-800 text-white shadow-xs' : 'text-slate-400 hover:text-white'
            }`}
          >
            Semua Jadwal ({schedules.length})
          </button>
          <button
            onClick={() => setFilterType('weekly')}
            className={`px-3 py-1.5 text-xs font-medium rounded transition-colors ${
              filterType === 'weekly' ? 'bg-slate-800 text-white shadow-xs' : 'text-slate-400 hover:text-white'
            }`}
          >
            Mingguan Berulang (Hari)
          </button>
          <button
            onClick={() => setFilterType('date')}
            className={`px-3 py-1.5 text-xs font-medium rounded transition-colors ${
              filterType === 'date' ? 'bg-slate-800 text-white shadow-xs' : 'text-slate-400 hover:text-white'
            }`}
          >
            Spesifik Tanggal
          </button>
        </div>

        {/* Add Schedule Button */}
        <button
          onClick={handleOpenAddModal}
          className="flex items-center gap-2 px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold rounded shadow-md transition-colors"
        >
          <Plus className="w-4 h-4" />
          <span>Tambah Jadwal Otomatis</span>
        </button>
      </div>

      {/* Schedules Data Table */}
      <div className="bg-[#0f1420] border border-slate-800 rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-slate-800 bg-[#090d14] text-slate-400 font-medium">
                <th className="py-3 px-4 w-12 text-center">Status</th>
                <th className="py-3 px-4">Nama Acara & Sumber</th>
                <th className="py-3 px-4">Acuan Hari & Tanggal</th>
                <th className="py-3 px-4">Waktu Mulai - Selesai</th>
                <th className="py-3 px-4">Format & Preset</th>
                <th className="py-3 px-4 text-center">Cloud Sync</th>
                <th className="py-3 px-4 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/80">
              {filteredSchedules.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-slate-500">
                    Belum ada jadwal yang cocok dengan filter yang dipilih.
                  </td>
                </tr>
              ) : (
                filteredSchedules.map((rule) => {
                  const source = sources.find((s) => s.id === rule.sourceId);
                  return (
                    <tr
                      key={rule.id}
                      className={`hover:bg-slate-800/40 transition-colors ${
                        !rule.enabled ? 'opacity-50' : ''
                      }`}
                    >
                      {/* Status Toggle Switch */}
                      <td className="py-3 px-4 text-center">
                        <button
                          onClick={() => onToggleSchedule(rule.id)}
                          className={`w-9 h-5 rounded-full p-0.5 transition-colors ${
                            rule.enabled ? 'bg-emerald-600' : 'bg-slate-700'
                          }`}
                          title={rule.enabled ? 'Jadwal Aktif (Klik untuk nonaktifkan)' : 'Jadwal Nonaktif (Klik untuk aktifkan)'}
                        >
                          <div
                            className={`w-4 h-4 rounded-full bg-white transition-transform ${
                              rule.enabled ? 'translate-x-4' : 'translate-x-0'
                            }`}
                          />
                        </button>
                      </td>

                      {/* Title & Source */}
                      <td className="py-3 px-4">
                        <div className="font-semibold text-slate-100">{rule.title}</div>
                        <div className="text-[11px] text-slate-400 flex items-center flex-wrap gap-1.5 mt-0.5">
                          <Radio className="w-3 h-3 text-slate-500 shrink-0" />
                          <span className="truncate max-w-[180px]">{source?.name || rule.sourceId}</span>
                          {rule.sourceId === 'src_vmix_cam_integrated' ? (
                            <span className="inline-flex items-center gap-1 text-[10px] bg-blue-900/70 text-blue-200 border border-blue-500/50 px-1.5 py-0.5 rounded font-mono-nums font-semibold shadow-xs">
                              <Video className="w-2.5 h-2.5 text-blue-400" />
                              <Volume2 className="w-2.5 h-2.5 text-emerald-400" />
                              vMix Cam + Audio 48kHz
                            </span>
                          ) : rule.sourceId.includes('vmix') ? (
                            <span className="text-[10px] bg-slate-800 text-blue-300 border border-slate-700 px-1.5 py-0.5 rounded font-mono-nums">
                              vMix NDI
                            </span>
                          ) : null}
                        </div>
                      </td>

                      {/* Days & Date Info */}
                      <td className="py-3 px-4">
                        {rule.repeatType === 'weekly' ? (
                          <div className="space-y-1">
                            <span className="text-[11px] text-slate-400">Mingguan Berulang:</span>
                            <div className="flex items-center gap-1">
                              {DAY_NAMES.map((d) => (
                                <span
                                  key={d.day}
                                  className={`text-[10px] font-mono-nums px-1.5 py-0.5 rounded ${
                                    rule.daysOfWeek.includes(d.day)
                                      ? 'bg-blue-900/60 text-blue-200 border border-blue-700/50 font-bold'
                                      : 'text-slate-600'
                                  }`}
                                >
                                  {d.label}
                                </span>
                              ))}
                            </div>
                          </div>
                        ) : rule.repeatType === 'once' ? (
                          <div className="space-y-0.5">
                            <span className="text-[10px] uppercase text-slate-500 font-medium">Tanggal Tunggal:</span>
                            <div className="font-mono-nums text-slate-200 font-semibold">{rule.specificDate}</div>
                          </div>
                        ) : (
                          <div className="space-y-0.5">
                            <span className="text-[10px] uppercase text-slate-500 font-medium">Rentang Tanggal:</span>
                            <div className="font-mono-nums text-slate-200">
                              {rule.startDate} s/d {rule.endDate}
                            </div>
                          </div>
                        )}
                      </td>

                      {/* Time Window */}
                      <td className="py-3 px-4 font-mono-nums">
                        <div className="text-slate-100 font-semibold text-sm">
                          {rule.startTime} - {rule.endTime}
                        </div>
                        <div className="text-[10px] text-slate-500 font-sans">
                          {(() => {
                            const [sh, sm] = rule.startTime.split(':').map(Number);
                            const [eh, em] = rule.endTime.split(':').map(Number);
                            let diff = (eh * 60 + em) - (sh * 60 + sm);
                            if (diff < 0) diff += 24 * 60;
                            return `Durasi: ${Math.floor(diff / 60)}j ${diff % 60}m`;
                          })()}
                        </div>
                      </td>

                      {/* Format & Preset */}
                      <td className="py-3 px-4 font-mono-nums">
                        <div className="font-bold text-slate-200 uppercase">{rule.format}</div>
                        <div className="text-[11px] text-slate-400 capitalize">{rule.presetId} Quality</div>
                      </td>

                      {/* Cloud Sync */}
                      <td className="py-3 px-4 text-center">
                        {rule.autoCloudSync ? (
                          <span className="inline-flex items-center gap-1 text-emerald-400 font-medium" title="Sinkronisasi otomatis aktif saat rekaman selesai">
                            <Cloud className="w-3.5 h-3.5" />
                            <span>Auto</span>
                          </span>
                        ) : (
                          <span className="text-slate-500">Lokal</span>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => onManualTrigger(rule)}
                            title="Jalankan Perekaman Jadwal Sekarang"
                            className="p-1.5 text-slate-400 hover:text-emerald-400 hover:bg-slate-800 rounded transition-colors"
                          >
                            <Play className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleOpenEditModal(rule)}
                            title="Edit Pengaturan Jadwal"
                            className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded transition-colors"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => onDeleteSchedule(rule.id)}
                            title="Hapus Jadwal"
                            className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-slate-800 rounded transition-colors"
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

      {/* Modal Dialog: Add / Edit Schedule */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="w-full max-w-xl bg-[#0f1523] border border-slate-800 rounded-lg shadow-2xl p-6 text-left my-8">
            <h3 className="text-base font-bold text-white mb-4">
              {editingId ? 'Edit Jadwal Perekaman' : 'Buat Jadwal Perekaman Baru'}
            </h3>

            <form onSubmit={handleSaveForm} className="space-y-4 text-xs">
              {/* Judul Acara */}
              <div>
                <label className="block text-slate-300 font-semibold mb-1">
                  Nama Acara / Judul Rekaman *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Contoh: Siaran Berita Pagi, Pertandingan Futsal Live"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded px-3 py-2 text-slate-100 focus:outline-hidden focus:border-rose-500"
                />
              </div>

              {/* Tipe Acuan Jadwal */}
              <div>
                <label className="block text-slate-300 font-semibold mb-1">
                  Tipe Penjadwalan (Acuan Hari / Tanggal) *
                </label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setRepeatType('weekly')}
                    className={`py-2 px-3 rounded text-center border font-medium transition-colors ${
                      repeatType === 'weekly'
                        ? 'bg-blue-900/60 border-blue-500 text-white'
                        : 'bg-slate-900 border-slate-700 text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    Berdasarkan Hari (Mingguan)
                  </button>
                  <button
                    type="button"
                    onClick={() => setRepeatType('once')}
                    className={`py-2 px-3 rounded text-center border font-medium transition-colors ${
                      repeatType === 'once'
                        ? 'bg-blue-900/60 border-blue-500 text-white'
                        : 'bg-slate-900 border-slate-700 text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    Tanggal Tunggal (Satu Kali)
                  </button>
                  <button
                    type="button"
                    onClick={() => setRepeatType('date_range')}
                    className={`py-2 px-3 rounded text-center border font-medium transition-colors ${
                      repeatType === 'date_range'
                        ? 'bg-blue-900/60 border-blue-500 text-white'
                        : 'bg-slate-900 border-slate-700 text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    Rentang Tanggal
                  </button>
                </div>
              </div>

              {/* Conditional: Days of Week Selector */}
              {repeatType === 'weekly' && (
                <div className="bg-slate-900/80 p-3 rounded border border-slate-800">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-slate-300 font-medium">Pilih Hari Perekaman:</span>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setSelectedDays([1, 2, 3, 4, 5])}
                        className="text-[10px] text-blue-400 hover:underline"
                      >
                        Sen-Jum
                      </button>
                      <button
                        type="button"
                        onClick={() => setSelectedDays([6, 0])}
                        className="text-[10px] text-blue-400 hover:underline"
                      >
                        Sab-Min
                      </button>
                      <button
                        type="button"
                        onClick={() => setSelectedDays([0, 1, 2, 3, 4, 5, 6])}
                        className="text-[10px] text-blue-400 hover:underline"
                      >
                        Setiap Hari
                      </button>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {DAY_NAMES.map((d) => {
                      const isSelected = selectedDays.includes(d.day);
                      return (
                        <button
                          key={d.day}
                          type="button"
                          onClick={() => toggleDay(d.day)}
                          className={`flex-1 py-1.5 rounded font-mono-nums font-semibold transition-colors ${
                            isSelected
                              ? 'bg-blue-600 text-white'
                              : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
                          }`}
                        >
                          {d.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Conditional: Specific Date */}
              {repeatType === 'once' && (
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">
                    Pilih Tanggal Perekaman (Acuan Tanggal) *
                  </label>
                  <input
                    type="date"
                    required
                    value={specificDate}
                    onChange={(e) => setSpecificDate(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 rounded px-3 py-2 text-slate-100 font-mono-nums focus:outline-hidden"
                  />
                </div>
              )}

              {/* Conditional: Date Range */}
              {repeatType === 'date_range' && (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-slate-300 font-semibold mb-1">Tanggal Mulai *</label>
                    <input
                      type="date"
                      required
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-700 rounded px-3 py-2 text-slate-100 font-mono-nums"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-300 font-semibold mb-1">Tanggal Selesai *</label>
                    <input
                      type="date"
                      required
                      value={endDate}
                      onChange={(e) => setEndDate(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-700 rounded px-3 py-2 text-slate-100 font-mono-nums"
                    />
                  </div>
                </div>
              )}

              {/* Acuan Waktu: Start Time & End Time */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">
                    Jam Mulai (Waktu Otomatis REC) *
                  </label>
                  <input
                    type="time"
                    required
                    value={startTime}
                    onChange={(e) => setStartTime(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 rounded px-3 py-2 text-slate-100 font-mono-nums focus:outline-hidden"
                  />
                </div>
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">
                    Jam Selesai (Waktu Berhenti REC) *
                  </label>
                  <input
                    type="time"
                    required
                    value={endTime}
                    onChange={(e) => setEndTime(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 rounded px-3 py-2 text-slate-100 font-mono-nums focus:outline-hidden"
                  />
                </div>
              </div>

              {/* Sumber Input NDI & Integrasi vMix Cam + Audio */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <label className="block text-slate-300 font-semibold">
                    Sumber Input Rekaman *
                  </label>
                  <span className="text-[10px] text-blue-400 font-mono-nums flex items-center gap-1">
                    <Sparkles className="w-3 h-3 text-blue-400" />
                    vMix Cam & Audio Ready
                  </span>
                </div>

                {/* Quick Selection Buttons for vMix */}
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setSourceId('src_vmix_cam_integrated')}
                    className={`p-2 rounded text-left border transition-all ${
                      sourceId === 'src_vmix_cam_integrated'
                        ? 'bg-blue-950/80 border-blue-500 text-white shadow-md shadow-blue-900/30 ring-1 ring-blue-500'
                        : 'bg-slate-900/90 border-slate-700 text-slate-400 hover:text-slate-200 hover:border-slate-600'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-[11px] text-blue-300 flex items-center gap-1">
                        <Video className="w-3 h-3 text-blue-400" />
                        vMix Cam & Audio
                      </span>
                      <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                    </div>
                    <div className="text-[10px] text-slate-400 mt-0.5 truncate">
                      Video DirectShow + 48kHz
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setSourceId('src_vmix_output1')}
                    className={`p-2 rounded text-left border transition-all ${
                      sourceId === 'src_vmix_output1'
                        ? 'bg-blue-950/80 border-blue-500 text-white shadow-md shadow-blue-900/30 ring-1 ring-blue-500'
                        : 'bg-slate-900/90 border-slate-700 text-slate-400 hover:text-slate-200 hover:border-slate-600'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-[11px] text-slate-200 flex items-center gap-1">
                        <Layers className="w-3 h-3 text-rose-400" />
                        vMix PGM Out 1
                      </span>
                    </div>
                    <div className="text-[10px] text-slate-400 mt-0.5 truncate">
                      Program Output NDI
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setSourceId('src_master_feed')}
                    className={`p-2 rounded text-left border transition-all ${
                      sourceId === 'src_master_feed'
                        ? 'bg-blue-950/80 border-blue-500 text-white shadow-md shadow-blue-900/30 ring-1 ring-blue-500'
                        : 'bg-slate-900/90 border-slate-700 text-slate-400 hover:text-slate-200 hover:border-slate-600'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-[11px] text-slate-200 flex items-center gap-1">
                        <Radio className="w-3 h-3 text-emerald-400" />
                        NDI Master Feed
                      </span>
                    </div>
                    <div className="text-[10px] text-slate-400 mt-0.5 truncate">
                      Broadcast Studio PC
                    </div>
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-slate-400 text-[11px] font-medium mb-1">
                      Pilihan Lengkap Sumber NDI / Perangkat
                    </label>
                    <select
                      value={sourceId}
                      onChange={(e) => setSourceId(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-700 rounded px-3 py-2 text-slate-100 font-mono-nums focus:outline-hidden focus:border-blue-500"
                    >
                      <optgroup label="🎬 vMix Live Production (Terintegrasi Cam & Audio)">
                        {sources
                          .filter((s) => s.id === 'src_vmix_cam_integrated')
                          .map((s) => (
                            <option key={s.id} value={s.id}>
                              ★ {s.name}
                            </option>
                          ))}
                        {sources
                          .filter((s) => s.name.toLowerCase().includes('vmix') && s.id !== 'src_vmix_cam_integrated')
                          .map((s) => (
                            <option key={s.id} value={s.id}>
                              {s.name}
                            </option>
                          ))}
                      </optgroup>
                      <optgroup label="📡 Broadcast Feeds & Hardware Lainnya">
                        {sources
                          .filter((s) => !s.name.toLowerCase().includes('vmix'))
                          .map((s) => (
                            <option key={s.id} value={s.id}>
                              {s.name}
                            </option>
                          ))}
                      </optgroup>
                    </select>
                  </div>

                  <div>
                    <label className="block text-slate-400 text-[11px] font-medium mb-1">
                      Format Wadah File *
                    </label>
                    <select
                      value={format}
                      onChange={(e) => setFormat(e.target.value as VideoFormat)}
                      className="w-full bg-slate-900 border border-slate-700 rounded px-3 py-2 text-slate-100 font-mono-nums focus:outline-hidden focus:border-blue-500"
                    >
                      <option value="mp4">MP4 (Standar Broadcast H.264 / AAC)</option>
                      <option value="mkv">MKV (Matroska Crash-Resistant Container)</option>
                    </select>
                  </div>
                </div>

                {/* Dedicated vMix Cam & Audio Terintegrasi Status Banner */}
                {sourceId === 'src_vmix_cam_integrated' && (
                  <div className="p-3 bg-gradient-to-r from-blue-950/70 via-[#0e172a] to-slate-900/80 border border-blue-500/40 rounded-lg space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="relative flex h-2.5 w-2.5">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                          <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
                        </span>
                        <span className="font-bold text-white text-xs flex items-center gap-1.5">
                          <Video className="w-3.5 h-3.5 text-blue-400" />
                          vMix Cam & Audio Terintegrasi Terpilih
                        </span>
                      </div>
                      <span className="text-[10px] bg-emerald-950/80 text-emerald-300 border border-emerald-500/40 px-2 py-0.5 rounded font-mono-nums font-semibold flex items-center gap-1">
                        <Volume2 className="w-3 h-3 text-emerald-400 animate-pulse" />
                        Audio 48kHz Stereo Muxed
                      </span>
                    </div>

                    {/* Technical Telemetry Grid */}
                    <div className="grid grid-cols-3 gap-2 text-[11px] bg-black/40 p-2.5 rounded border border-blue-900/40">
                      <div>
                        <span className="text-[10px] text-slate-400 uppercase font-sans tracking-wider block">Video Feed</span>
                        <span className="text-white font-mono-nums font-medium flex items-center gap-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-blue-400 inline-block"></span>
                          vMix Cam 1080p60
                        </span>
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-400 uppercase font-sans tracking-wider block">Audio Stream</span>
                        <span className="text-emerald-400 font-mono-nums font-medium flex items-center gap-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 inline-block animate-ping" style={{ animationDuration: '2s' }}></span>
                          48 kHz Stereo (L/R)
                        </span>
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-400 uppercase font-sans tracking-wider block">Sinkronisasi</span>
                        <span className="text-blue-300 font-mono-nums font-medium flex items-center gap-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 inline-block"></span>
                          Lip-Sync Locked
                        </span>
                      </div>
                    </div>

                    {/* Animated Stereo Audio VU indicator */}
                    <div className="bg-black/50 p-2 rounded border border-slate-800 flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2">
                        <Mic className="w-3.5 h-3.5 text-emerald-400" />
                        <span className="text-[10px] text-slate-300 font-medium">Monitoring Audio vMix:</span>
                      </div>
                      <div className="flex-1 flex items-center gap-2 max-w-[200px]">
                        <span className="text-[9px] font-mono text-slate-400">L</span>
                        <div className="flex-1 h-1.5 bg-slate-800 rounded overflow-hidden flex">
                          <div className="w-[65%] bg-emerald-500 animate-pulse rounded-l" />
                          <div className="w-[15%] bg-yellow-400" />
                        </div>
                        <span className="text-[9px] font-mono text-slate-400">R</span>
                        <div className="flex-1 h-1.5 bg-slate-800 rounded overflow-hidden flex">
                          <div className="w-[62%] bg-emerald-500 animate-pulse rounded-l" />
                          <div className="w-[12%] bg-yellow-400" />
                        </div>
                      </div>
                      <span className="text-[10px] font-mono text-emerald-400">-14 dBFS</span>
                    </div>

                    <div className="flex items-center gap-2 text-[11px] text-slate-300 pt-0.5">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                      <span>Saat waktu jadwal tercapai, sistem langsung mengaktifkan video kamera vMix dan audio stereo secara bersamaan tanpa intervensi manual.</span>
                    </div>
                  </div>
                )}
              </div>

              {/* Compression Preset & Auto Cloud Sync */}
              <div className="grid grid-cols-2 gap-3 items-center">
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Preset Kompresi *</label>
                  <select
                    value={presetId}
                    onChange={(e) => setPresetId(e.target.value as CompressionPresetId)}
                    className="w-full bg-slate-900 border border-slate-700 rounded px-3 py-2 text-slate-100"
                  >
                    <option value="master">Broadcast Master (15 Mbps, 60fps)</option>
                    <option value="high">High Quality (8 Mbps, 60fps)</option>
                    <option value="standard">Standard HD (4 Mbps, 30fps)</option>
                    <option value="compact">Compact Space (2 Mbps, 24fps)</option>
                  </select>
                </div>
                <div className="pt-4">
                  <label className="flex items-center gap-2 cursor-pointer text-slate-300">
                    <input
                      type="checkbox"
                      checked={autoCloudSync}
                      onChange={(e) => setAutoCloudSync(e.target.checked)}
                      className="rounded accent-rose-500 w-4 h-4"
                    />
                    <span>Otomatis Sinkron Cloud saat Selesai</span>
                  </label>
                </div>
              </div>

              {/* Form Buttons */}
              <div className="mt-6 pt-4 border-t border-slate-800 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 bg-slate-800 text-slate-300 rounded hover:bg-slate-700 transition-colors"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-rose-600 hover:bg-rose-500 text-white font-semibold rounded shadow-md transition-colors"
                >
                  {editingId ? 'Simpan Perubahan' : 'Buat Jadwal Otomatis'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
