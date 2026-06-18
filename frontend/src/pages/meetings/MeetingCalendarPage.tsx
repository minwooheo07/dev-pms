import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ChevronLeft, ChevronRight, Plus, X, Clock, MapPin,
  Users, Calendar, Trash2, Pencil, Check, FileText,
} from 'lucide-react';
import toast from 'react-hot-toast';
import Holidays from 'date-holidays';
import { meetingsApi } from '../../api/meetings';
import { projectsApi } from '../../api/projects';
import { usersApi } from '../../api/users';
import { useAuthStore } from '../../store/auth.store';
import { Avatar } from '../../components/ui/Avatar';
import { Button } from '../../components/ui/Button';
import { formatDate, cn } from '../../lib/utils';

const hd = new Holidays('KR');

function getHolidayMap(year: number): Record<string, { name: string; substitute: boolean }> {
  const map: Record<string, { name: string; substitute: boolean }> = {};
  const list = hd.getHolidays(year);
  for (const h of list) {
    if (h.type !== 'public') continue;
    const key = h.date.slice(0, 10);
    map[key] = { name: h.name, substitute: !!(h as any).substitute };
  }
  return map;
}

interface MeetingForm {
  title: string;
  meetingDate: string;
  startTime: string;
  endTime: string;
  location: string;
  content: string;
  participantIds: string[];
  projectId: string;
}

const emptyForm = (date?: string): MeetingForm => ({
  title: '',
  meetingDate: date ?? new Date().toISOString().slice(0, 10),
  startTime: '',
  endTime: '',
  location: '',
  content: '',
  participantIds: [],
  projectId: '',
});

const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];

const EVENT_COLORS = [
  'bg-indigo-100 text-indigo-700 border-indigo-200',
  'bg-violet-100 text-violet-700 border-violet-200',
  'bg-blue-100 text-blue-700 border-blue-200',
  'bg-emerald-100 text-emerald-700 border-emerald-200',
  'bg-amber-100 text-amber-700 border-amber-200',
];

function colorForProject(projectId?: string) {
  if (!projectId) return EVENT_COLORS[0];
  let h = 0;
  for (let i = 0; i < projectId.length; i++) h = (h * 31 + projectId.charCodeAt(i)) % EVENT_COLORS.length;
  return EVENT_COLORS[h];
}

export function MeetingCalendarPage() {
  const qc = useQueryClient();
  const user = useAuthStore((s) => s.user);
  const isGlobalAdmin = user?.role === 'ADMIN';

  const [calMonth, setCalMonth] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editMeeting, setEditMeeting] = useState<any>(null);
  const [viewMeeting, setViewMeeting] = useState<any>(null);
  const [form, setForm] = useState<MeetingForm>(emptyForm());

  // 회의록 등록 모달 상태
  interface MinutesForm { title: string; content: string; meetingDate: string; startTime: string; endTime: string; attendees: string; projectId: string; }
  const [showMinutes, setShowMinutes] = useState(false);
  const [minutesForm, setMinutesForm] = useState<MinutesForm>({ title: '', content: '', meetingDate: '', startTime: '', endTime: '', attendees: '', projectId: '' });

  const { data: meetings } = useQuery({
    queryKey: ['meetings-all'],
    queryFn: () => meetingsApi.getAll(),
  });
  const { data: allUsers } = useQuery({ queryKey: ['users'], queryFn: usersApi.getAll });
  const { data: projects } = useQuery({ queryKey: ['projects'], queryFn: projectsApi.getAll });

  const invalidate = () => qc.invalidateQueries({ queryKey: ['meetings-all'] });

  const createMeeting = useMutation({
    mutationFn: () => meetingsApi.create({ ...form, participantIds: form.participantIds }),
    onSuccess: () => { invalidate(); setShowForm(false); setForm(emptyForm()); toast.success('회의가 등록되었습니다.'); },
    onError: (e: any) => toast.error(e.response?.data?.message ?? '등록에 실패했습니다.'),
  });

  const updateMeeting = useMutation({
    mutationFn: () => meetingsApi.update(editMeeting.id, { ...form }),
    onSuccess: () => { invalidate(); setEditMeeting(null); setViewMeeting(null); toast.success('회의가 수정되었습니다.'); },
    onError: (e: any) => toast.error(e.response?.data?.message ?? '수정에 실패했습니다.'),
  });

  const deleteMeeting = useMutation({
    mutationFn: (id: string) => meetingsApi.delete(id),
    onSuccess: () => { invalidate(); setViewMeeting(null); toast.success('회의가 삭제되었습니다.'); },
    onError: (e: any) => toast.error(e.response?.data?.message ?? '삭제에 실패했습니다.'),
  });

  const createMinutes = useMutation({
    mutationFn: () => meetingsApi.create({
      title: minutesForm.title,
      content: minutesForm.content || undefined,
      meetingDate: minutesForm.meetingDate || undefined,
      startTime: minutesForm.startTime || undefined,
      endTime: minutesForm.endTime || undefined,
      attendees: minutesForm.attendees || undefined,
      projectId: minutesForm.projectId || undefined,
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['meetings'] });
      setShowMinutes(false);
      toast.success('회의록이 저장되었습니다.');
    },
    onError: () => toast.error('저장에 실패했습니다.'),
  });

  const openMinutes = (m: any) => {
    setMinutesForm({
      title: m.title,
      content: m.content ?? '',
      meetingDate: m.meetingDate ? new Date(m.meetingDate).toISOString().slice(0, 10) : '',
      startTime: m.startTime ?? '',
      endTime: m.endTime ?? '',
      attendees: (m.participants ?? []).map((p: any) => p.user.name).join(', '),
      projectId: m.project?.id ?? '',
    });
    setShowMinutes(true);
  };

  // 캘린더 계산
  const calendarDays = useMemo(() => {
    const year = calMonth.getFullYear();
    const month = calMonth.getMonth();
    const firstDay = new Date(year, month, 1).getDay();
    const lastDate = new Date(year, month + 1, 0).getDate();
    const days: (string | null)[] = Array(firstDay).fill(null);
    for (let d = 1; d <= lastDate; d++) {
      days.push(`${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`);
    }
    while (days.length % 7 !== 0) days.push(null);
    return days;
  }, [calMonth]);

  // 날짜별 회의 매핑
  const meetingsByDate = useMemo(() => {
    const map: Record<string, any[]> = {};
    (meetings ?? []).forEach((m: any) => {
      const key = new Date(m.meetingDate).toISOString().slice(0, 10);
      if (!map[key]) map[key] = [];
      map[key].push(m);
    });
    return map;
  }, [meetings]);

  const openCreate = (date?: string) => {
    setForm(emptyForm(date));
    setEditMeeting(null);
    setShowForm(true);
  };

  const openEdit = (m: any) => {
    setForm({
      title: m.title,
      meetingDate: new Date(m.meetingDate).toISOString().slice(0, 10),
      startTime: m.startTime ?? '',
      endTime: m.endTime ?? '',
      location: m.location ?? '',
      content: m.content ?? '',
      participantIds: (m.participants ?? []).map((p: any) => p.user.id),
      projectId: m.project?.id ?? '',
    });
    setEditMeeting(m);
    setViewMeeting(null);
    setShowForm(true);
  };

  const toggleParticipant = (uid: string) => {
    setForm((f) => ({
      ...f,
      participantIds: f.participantIds.includes(uid)
        ? f.participantIds.filter((id) => id !== uid)
        : [...f.participantIds, uid],
    }));
  };

  const holidayMap = useMemo(() => {
    const year = calMonth.getFullYear();
    const map = getHolidayMap(year);
    if (calMonth.getMonth() === 11) Object.assign(map, getHolidayMap(year + 1));
    return map;
  }, [calMonth]);

  const today = new Date().toISOString().slice(0, 10);
  const selectedMeetings = selectedDay ? (meetingsByDate[selectedDay] ?? []) : [];

  return (
    <div className="flex h-full bg-gray-50">
      {/* 좌: 캘린더 */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 bg-white border-b border-gray-200 flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1">
              <button
                onClick={() => setCalMonth(new Date(calMonth.getFullYear(), calMonth.getMonth() - 1, 1))}
                className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500 hover:text-gray-700 transition-colors"
              >
                <ChevronLeft size={16} />
              </button>
              <button
                onClick={() => setCalMonth(new Date(calMonth.getFullYear(), calMonth.getMonth() + 1, 1))}
                className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500 hover:text-gray-700 transition-colors"
              >
                <ChevronRight size={16} />
              </button>
            </div>
            <h1 className="text-lg font-bold text-gray-900">
              {calMonth.getFullYear()}년 {calMonth.getMonth() + 1}월
            </h1>
            <button
              onClick={() => setCalMonth(new Date(new Date().getFullYear(), new Date().getMonth(), 1))}
              className="text-xs text-gray-400 hover:text-gray-600 border border-gray-200 px-2 py-1 rounded-lg transition-colors"
            >
              오늘
            </button>
          </div>
          <Button variant="primary" onClick={() => openCreate()}>
            <Plus size={15} /> 회의 추가하기
          </Button>
        </div>

        {/* 캘린더 그리드 */}
        <div className="flex-1 overflow-hidden flex flex-col p-4">
          {/* 요일 헤더 */}
          <div className="grid grid-cols-7 mb-1">
            {WEEKDAYS.map((d, i) => (
              <div
                key={d}
                className={cn(
                  'text-center text-xs font-semibold py-2',
                  i === 0 ? 'text-red-400' : i === 6 ? 'text-blue-400' : 'text-gray-400',
                )}
              >
                {d}
              </div>
            ))}
          </div>

          {/* 날짜 셀 */}
          <div className="flex-1 grid grid-cols-7 gap-px bg-gray-200 rounded-xl overflow-hidden">
            {calendarDays.map((day, idx) => {
              const isToday = day === today;
              const isSelected = day === selectedDay;
              const dayMeetings = day ? (meetingsByDate[day] ?? []) : [];
              const col = idx % 7;
              const holiday = day ? holidayMap[day] : undefined;
              const isHoliday = !!holiday;
              return (
                <div
                  key={idx}
                  onClick={() => day && setSelectedDay(isSelected ? null : day)}
                  className={cn(
                    'bg-white min-h-[90px] p-1.5 cursor-pointer hover:bg-gray-50 transition-colors relative',
                    !day && 'bg-gray-50 cursor-default',
                    isSelected && 'bg-indigo-50 hover:bg-indigo-50',
                    isHoliday && !isSelected && 'bg-red-50/30',
                  )}
                >
                  {day && (
                    <>
                      <div className="flex items-center justify-between mb-0.5">
                        <span
                          className={cn(
                            'inline-flex w-6 h-6 items-center justify-center text-xs font-semibold rounded-full',
                            isToday ? 'bg-indigo-600 text-white' :
                            (col === 0 || isHoliday) ? 'text-red-400' : col === 6 ? 'text-blue-400' : 'text-gray-600',
                            isSelected && !isToday && 'bg-indigo-100 text-indigo-700',
                          )}
                        >
                          {parseInt(day.slice(8))}
                        </span>
                        {dayMeetings.length > 0 && (
                          <button
                            onClick={(e) => { e.stopPropagation(); openCreate(day); }}
                            className="opacity-0 hover:opacity-100 group-hover:opacity-100 w-5 h-5 rounded flex items-center justify-center text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 transition-all"
                          >
                            <Plus size={11} />
                          </button>
                        )}
                      </div>
                      {holiday && (
                        <p className={cn(
                          'text-[9px] font-medium truncate leading-tight mb-0.5 px-0.5',
                          holiday.substitute ? 'text-orange-500' : 'text-red-400',
                        )}>
                          {holiday.substitute ? `대체 ${holiday.name}` : holiday.name}
                        </p>
                      )}
                      <div className="space-y-0.5">
                        {dayMeetings.slice(0, 3).map((m: any) => (
                          <button
                            key={m.id}
                            onClick={(e) => { e.stopPropagation(); setViewMeeting(m); setSelectedDay(day); }}
                            className={cn(
                              'w-full text-left px-1.5 py-1 rounded border leading-tight',
                              colorForProject(m.project?.id),
                            )}
                          >
                            {m.startTime && (
                              <span className="block text-[9px] opacity-70 font-medium">{m.startTime}</span>
                            )}
                            <span className="block text-[10px] font-bold truncate">{m.title}</span>
                          </button>
                        ))}
                        {dayMeetings.length > 3 && (
                          <p className="text-[10px] text-gray-400 px-1">+{dayMeetings.length - 3}개</p>
                        )}
                      </div>
                    </>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* 우: 선택된 날짜 회의 목록 */}
      {selectedDay && (
        <div className="w-72 flex-shrink-0 bg-white border-l border-gray-200 flex flex-col">
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
            <div>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
                {new Date(selectedDay + 'T12:00:00').toLocaleDateString('ko-KR', { month: 'long', day: 'numeric', weekday: 'short' })}
              </p>
              <p className="text-sm font-bold text-gray-900 mt-0.5">{selectedMeetings.length}개의 회의</p>
              {selectedDay && holidayMap[selectedDay] && (
                <p className={cn(
                  'text-[10px] font-semibold mt-0.5',
                  holidayMap[selectedDay].substitute ? 'text-orange-500' : 'text-red-400',
                )}>
                  {holidayMap[selectedDay].substitute ? `대체 ${holidayMap[selectedDay].name}` : holidayMap[selectedDay].name}
                </p>
              )}
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={() => openCreate(selectedDay)}
                className="p-1.5 text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                title="회의 추가"
              >
                <Plus size={15} />
              </button>
              <button onClick={() => setSelectedDay(null)} className="p-1.5 text-gray-400 hover:text-gray-600 rounded-lg transition-colors">
                <X size={15} />
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-3 space-y-2">
            {selectedMeetings.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-gray-400">
                <Calendar size={28} className="mb-2 opacity-30" />
                <p className="text-xs">등록된 회의가 없습니다</p>
                <button onClick={() => openCreate(selectedDay)} className="mt-2 text-xs text-indigo-600 font-medium hover:text-indigo-800">
                  회의 추가하기
                </button>
              </div>
            ) : (
              selectedMeetings.map((m: any) => (
                <div
                  key={m.id}
                  className="p-3 rounded-xl border border-gray-100 hover:border-indigo-200 hover:shadow-sm transition-all cursor-pointer group"
                  onClick={() => setViewMeeting(m)}
                >
                  <div className={cn('h-0.5 rounded-full mb-2.5', colorForProject(m.project?.id).split(' ')[0].replace('bg-', 'bg-'))} />
                  <p className="text-sm font-semibold text-gray-900 truncate">{m.title}</p>
                  {(m.startTime || m.endTime) && (
                    <div className="flex items-center gap-1 text-[11px] text-gray-400 mt-1">
                      <Clock size={10} />
                      <span>{m.startTime}{m.endTime ? ` ~ ${m.endTime}` : ''}</span>
                    </div>
                  )}
                  {m.location && (
                    <div className="flex items-center gap-1 text-[11px] text-gray-400 mt-0.5">
                      <MapPin size={10} />
                      <span className="truncate">{m.location}</span>
                    </div>
                  )}
                  {m.participants?.length > 0 && (
                    <div className="flex items-center gap-1 mt-1.5">
                      <div className="flex -space-x-1">
                        {m.participants.slice(0, 4).map((p: any) => (
                          <div
                            key={p.user.id}
                            className="w-5 h-5 rounded-full bg-indigo-100 border border-white flex items-center justify-center text-[9px] font-bold text-indigo-700"
                            title={p.user.name}
                          >
                            {p.user.name[0]}
                          </div>
                        ))}
                      </div>
                      {m.participants.length > 4 && (
                        <span className="text-[10px] text-gray-400">+{m.participants.length - 4}</span>
                      )}
                    </div>
                  )}
                  {m.project && (
                    <span className={cn('inline-block text-[10px] px-1.5 py-0.5 rounded-full border mt-1.5', colorForProject(m.project.id))}>
                      {m.project.name}
                    </span>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* 회의 등록/수정 모달 */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => { setShowForm(false); setEditMeeting(null); }} />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-xl max-h-[90vh] flex flex-col overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 bg-gradient-to-br from-indigo-50 via-white to-violet-50 border-b border-gray-200 flex-shrink-0">
              <h2 className="text-base font-bold text-gray-900">{editMeeting ? '회의 수정' : '회의 추가'}</h2>
              <button onClick={() => { setShowForm(false); setEditMeeting(null); }} className="text-gray-400 hover:text-gray-600 p-1">
                <X size={18} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              {/* 제목 */}
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1.5">회의 제목 *</label>
                <input
                  autoFocus
                  type="text"
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  placeholder="회의 제목을 입력하세요"
                  className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              {/* 날짜 + 시간 */}
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1.5">회의 일자 *</label>
                  <input
                    type="date"
                    value={form.meetingDate}
                    onChange={(e) => setForm({ ...form, meetingDate: e.target.value })}
                    className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1.5">시작 시간</label>
                  <input
                    type="time"
                    value={form.startTime}
                    onChange={(e) => setForm({ ...form, startTime: e.target.value })}
                    className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1.5">종료 시간</label>
                  <input
                    type="time"
                    value={form.endTime}
                    onChange={(e) => setForm({ ...form, endTime: e.target.value })}
                    className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>

              {/* 장소 */}
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1.5">
                  <MapPin size={11} className="inline mr-0.5" /> 장소
                </label>
                <input
                  type="text"
                  value={form.location}
                  onChange={(e) => setForm({ ...form, location: e.target.value })}
                  placeholder="회의실, 화상회의 링크 등"
                  className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              {/* 프로젝트 */}
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1.5">프로젝트 (선택)</label>
                <select
                  value={form.projectId}
                  onChange={(e) => setForm({ ...form, projectId: e.target.value })}
                  className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
                >
                  <option value="">프로젝트 없음</option>
                  {projects?.map((p: any) => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
              </div>

              {/* 참석자 선택 */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs font-semibold text-gray-600">
                    <Users size={11} className="inline mr-0.5" /> 참석자 선택
                    {form.participantIds.length > 0 && (
                      <span className="ml-1.5 text-indigo-600">{form.participantIds.length}명 선택</span>
                    )}
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      const allIds = (allUsers ?? []).map((u: any) => u.id);
                      const allSelected = allIds.every((id: string) => form.participantIds.includes(id));
                      setForm({ ...form, participantIds: allSelected ? [] : allIds });
                    }}
                    className="text-[11px] font-medium text-indigo-500 hover:text-indigo-700 transition-colors"
                  >
                    {((allUsers ?? []) as any[]).every((u) => form.participantIds.includes(u.id)) ? '전체 해제' : '전체 선택'}
                  </button>
                </div>
                <div className="grid grid-cols-5 gap-1 max-h-40 overflow-y-auto border border-gray-200 rounded-lg p-2">
                  {(allUsers ?? []).map((u: any) => {
                    const selected = form.participantIds.includes(u.id);
                    return (
                      <button
                        key={u.id}
                        type="button"
                        onClick={() => toggleParticipant(u.id)}
                        title={u.name}
                        className={cn(
                          'flex flex-col items-center gap-1 py-1.5 px-1 rounded-lg border text-center transition-all',
                          selected
                            ? 'bg-indigo-50 border-indigo-300'
                            : 'bg-white border-gray-200 hover:border-gray-300 hover:bg-gray-50',
                        )}
                      >
                        <div className="relative">
                          <Avatar name={u.name} avatar={u.avatar} size="xs" />
                          {selected && (
                            <span className="absolute -top-0.5 -right-0.5 w-3 h-3 bg-indigo-500 rounded-full flex items-center justify-center">
                              <Check size={7} className="text-white" />
                            </span>
                          )}
                        </div>
                        <span className={cn('text-[10px] font-medium leading-tight truncate w-full', selected ? 'text-indigo-700' : 'text-gray-600')}>
                          {u.name}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* 내용 */}
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1.5">회의 내용</label>
                <textarea
                  value={form.content}
                  onChange={(e) => setForm({ ...form, content: e.target.value })}
                  placeholder="회의 목적, 안건, 결론 등을 입력하세요..."
                  rows={4}
                  className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 px-6 py-4 border-t border-gray-100 flex-shrink-0">
              <Button variant="ghost" onClick={() => { setShowForm(false); setEditMeeting(null); }}>취소</Button>
              <Button
                variant="primary"
                onClick={() => editMeeting ? updateMeeting.mutate() : createMeeting.mutate()}
                disabled={!form.title.trim() || !form.meetingDate}
                loading={createMeeting.isPending || updateMeeting.isPending}
              >
                {editMeeting ? '저장' : '등록'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* 회의록 등록 모달 */}
      {showMinutes && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setShowMinutes(false)} />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] flex flex-col overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 bg-gradient-to-br from-indigo-50 via-white to-violet-50 border-b border-gray-200 flex-shrink-0">
              <h2 className="text-base font-bold text-gray-900">회의록 등록</h2>
              <button onClick={() => setShowMinutes(false)} className="text-gray-400 hover:text-gray-600 p-1"><X size={18} /></button>
            </div>
            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1.5">제목 *</label>
                <input
                  autoFocus
                  type="text"
                  value={minutesForm.title}
                  onChange={(e) => setMinutesForm({ ...minutesForm, title: e.target.value })}
                  className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <div className="flex gap-3">
                <div className="flex-1">
                  <label className="block text-xs font-semibold text-gray-600 mb-1.5">회의일</label>
                  <input
                    type="date"
                    value={minutesForm.meetingDate}
                    onChange={(e) => setMinutesForm({ ...minutesForm, meetingDate: e.target.value })}
                    className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div className="flex-1">
                  <label className="block text-xs font-semibold text-gray-600 mb-1.5">연관 프로젝트</label>
                  <select
                    value={minutesForm.projectId}
                    onChange={(e) => setMinutesForm({ ...minutesForm, projectId: e.target.value })}
                    className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
                  >
                    <option value="">없음</option>
                    {projects?.map((p: any) => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="flex gap-3">
                <div className="flex-1">
                  <label className="block text-xs font-semibold text-gray-600 mb-1.5">시작 시간</label>
                  <input type="time" value={minutesForm.startTime} onChange={(e) => setMinutesForm({ ...minutesForm, startTime: e.target.value })} className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                </div>
                <div className="flex-1">
                  <label className="block text-xs font-semibold text-gray-600 mb-1.5">종료 시간</label>
                  <input type="time" value={minutesForm.endTime} onChange={(e) => setMinutesForm({ ...minutesForm, endTime: e.target.value })} className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1.5">참석자</label>
                <input
                  type="text"
                  value={minutesForm.attendees}
                  onChange={(e) => setMinutesForm({ ...minutesForm, attendees: e.target.value })}
                  placeholder="예: 김철수, 이영희"
                  className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1.5">내용</label>
                <textarea
                  value={minutesForm.content}
                  onChange={(e) => setMinutesForm({ ...minutesForm, content: e.target.value })}
                  placeholder="회의 내용, 결정 사항, 액션 아이템 등을 기록하세요..."
                  rows={8}
                  className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 px-6 py-4 border-t border-gray-100 flex-shrink-0">
              <Button variant="ghost" onClick={() => setShowMinutes(false)}>취소</Button>
              <Button
                variant="primary"
                onClick={() => createMinutes.mutate()}
                disabled={!minutesForm.title.trim()}
                loading={createMinutes.isPending}
              >
                저장
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* 회의 상세 보기 모달 */}
      {viewMeeting && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setViewMeeting(null)} />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden">
            <div className="px-6 py-5 border-b border-gray-100">
              <div className="flex items-start gap-3">
                <div className={cn('w-2 h-10 rounded-full flex-shrink-0 mt-0.5', colorForProject(viewMeeting.project?.id).split(' ')[0])} />
                <div className="flex-1 min-w-0">
                  <h2 className="text-base font-bold text-gray-900">{viewMeeting.title}</h2>
                  {viewMeeting.project && (
                    <span className={cn('text-[11px] px-1.5 py-0.5 rounded-full border font-medium mt-1 inline-block', colorForProject(viewMeeting.project.id))}>
                      {viewMeeting.project.name}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-1 flex-shrink-0">
                  <button
                    onClick={() => openMinutes(viewMeeting)}
                    className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-indigo-600 hover:text-indigo-800 bg-indigo-50 hover:bg-indigo-100 rounded-lg transition-colors border border-indigo-200"
                    title="회의록 등록"
                  >
                    <FileText size={12} /> 회의록 등록
                  </button>
                  {(isGlobalAdmin || viewMeeting.createdBy?.id === user?.id) && (
                    <>
                      <button onClick={() => openEdit(viewMeeting)} className="p-1.5 text-gray-400 hover:text-indigo-500 hover:bg-indigo-50 rounded-lg transition-colors">
                        <Pencil size={14} />
                      </button>
                      <button
                        onClick={() => { if (confirm('회의를 삭제하시겠습니까?')) deleteMeeting.mutate(viewMeeting.id); }}
                        className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                      >
                        <Trash2 size={14} />
                      </button>
                    </>
                  )}
                  <button onClick={() => setViewMeeting(null)} className="p-1.5 text-gray-400 hover:text-gray-600 rounded-lg ml-1">
                    <X size={16} />
                  </button>
                </div>
              </div>
            </div>

            <div className="px-6 py-4 space-y-3">
              {/* 날짜/시간 */}
              <div className="flex items-center gap-2.5 text-sm text-gray-600">
                <Calendar size={15} className="text-gray-400 flex-shrink-0" />
                <span>{formatDate(viewMeeting.meetingDate)}</span>
                {(viewMeeting.startTime || viewMeeting.endTime) && (
                  <>
                    <span className="text-gray-300">|</span>
                    <Clock size={13} className="text-gray-400" />
                    <span>{viewMeeting.startTime}{viewMeeting.endTime ? ` ~ ${viewMeeting.endTime}` : ''}</span>
                  </>
                )}
              </div>

              {/* 장소 */}
              {viewMeeting.location && (
                <div className="flex items-center gap-2.5 text-sm text-gray-600">
                  <MapPin size={15} className="text-gray-400 flex-shrink-0" />
                  <span>{viewMeeting.location}</span>
                </div>
              )}

              {/* 참석자 */}
              {viewMeeting.participants?.length > 0 && (
                <div className="flex items-start gap-2.5">
                  <Users size={15} className="text-gray-400 mt-0.5 flex-shrink-0" />
                  <div className="flex flex-wrap gap-1.5">
                    {viewMeeting.participants.map((p: any) => (
                      <div key={p.user.id} className="flex items-center gap-1 bg-gray-100 text-gray-700 text-xs px-2 py-0.5 rounded-full">
                        <Avatar name={p.user.name} avatar={p.user.avatar} size="xs" />
                        {p.user.name}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* 내용 */}
              {viewMeeting.content && (
                <div className="mt-3 pt-3 border-t border-gray-100">
                  <p className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">{viewMeeting.content}</p>
                </div>
              )}

              {/* 작성자 */}
              <div className="flex items-center gap-1.5 pt-3 border-t border-gray-100">
                <Avatar name={viewMeeting.createdBy?.name ?? '?'} avatar={viewMeeting.createdBy?.avatar} size="xs" />
                <span className="text-[11px] text-gray-400">{viewMeeting.createdBy?.name} 작성</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
