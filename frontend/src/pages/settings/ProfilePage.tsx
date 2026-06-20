import { useState, useEffect, useRef } from 'react';
import { useMutation } from '@tanstack/react-query';
import { User, Phone, Briefcase, Building, Save, Smile, Bell, X } from 'lucide-react';
import toast from 'react-hot-toast';
import { usersApi } from '../../api/users';
import { useAuthStore } from '../../store/auth.store';
import { useUiStore } from '../../store/ui.store';
import { Avatar } from '../../components/ui/Avatar';
import { Button } from '../../components/ui/Button';
import { PageHeader } from '../../components/ui/PageHeader';

const STATUS_PRESETS = [
  { emoji: '🟢', text: '업무 중' },
  { emoji: '🔴', text: '자리 비움' },
  { emoji: '🟡', text: '잠깐 자리 비움' },
  { emoji: '🎯', text: '집중 중 — 방해 금지' },
  { emoji: '📅', text: '미팅 중' },
  { emoji: '🏠', text: '재택 근무' },
  { emoji: '🌴', text: '휴가 중' },
  { emoji: '🤒', text: '병가' },
  { emoji: '⛔', text: '오프라인' },
];

const EMOJI_LIST = [
  '😀','😎','🥸','🤓','🥳','😇','🥰','🤩','😜','🤪','😏','🙃','🤔','🤠','🧐','😴','🤗','😈',
  '👻','🤖','👽','🤡','💀','👹','🧙','🧛','🧟','🧝','🦸','🧚','🧜','🧞',
  '🐱','🐶','🐸','🐼','🦊','🐨','🐮','🐯','🦁','🐻','🐰','🐭','🐺','🐧','🦉','🦅',
  '🌈','⭐','🔥','💎','🚀','🌙','🎯','🎮','🌊','🍀',
];

export function ProfilePage() {
  const { user, updateUser } = useAuthStore();
  const mentionAlarm = useUiStore((s) => s.mentionAlarm);
  const setMentionAlarm = useUiStore((s) => s.setMentionAlarm);
  const pickerRef = useRef<HTMLDivElement>(null);

  const [profile, setProfile] = useState({
    name: user?.name ?? '',
    position: user?.position ?? '',
    department: user?.department ?? '',
    phone: user?.phone ?? '',
    avatar: user?.avatar ?? '',
    statusEmoji: user?.statusEmoji ?? '🟢',
    statusText: user?.statusText ?? '',
  });

  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [showStatusPopup, setShowStatusPopup] = useState(false);
  const statusBadgeRef = useRef<HTMLButtonElement>(null);
  const statusPopupRef = useRef<HTMLDivElement>(null);


  useEffect(() => {
    if (user) {
      setProfile({
        name: user.name ?? '',
        position: user.position ?? '',
        department: user.department ?? '',
        phone: user.phone ?? '',
        avatar: user.avatar ?? '',
        statusEmoji: user.statusEmoji ?? '🟢',
        statusText: user.statusText ?? '',
      });
    }
  }, [user]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) {
        setShowEmojiPicker(false);
      }
    }
    if (showEmojiPicker) document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showEmojiPicker]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (
        statusPopupRef.current && !statusPopupRef.current.contains(e.target as Node) &&
        statusBadgeRef.current && !statusBadgeRef.current.contains(e.target as Node)
      ) {
        setShowStatusPopup(false);
      }
    }
    if (showStatusPopup) document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showStatusPopup]);

  const updateProfile = useMutation({
    mutationFn: () => usersApi.updateProfile(profile),
    onSuccess: (updated) => {
      updateUser({ ...user!, ...updated });
      toast.success('프로필이 저장되었습니다.');
    },
    onError: () => toast.error('저장에 실패했습니다.'),
  });


  return (
    <div className="flex flex-col h-full">
      <PageHeader title="프로필 설정" description="개인 정보 및 계정 설정을 관리합니다" />

      <div className="flex-1 overflow-y-auto p-6">
        <div className="max-w-2xl mx-auto space-y-6">

          {/* Avatar + 이메일 */}
          <div className={`relative bg-white/85 backdrop-blur-md rounded-xl border border-white/80 shadow-[0_4px_16px_rgba(0,0,0,0.08),0_1px_4px_rgba(0,0,0,0.04),0_0_0_1px_rgba(255,255,255,0.9)_inset] ring-1 ring-gray-900/5 p-6 overflow-visible ${showEmojiPicker || showStatusPopup ? 'z-50' : ''}`}>
            <div className="flex items-center gap-4">
              {/* 아바타 + 이모지 선택 버튼 */}
              <div className="relative flex-shrink-0" ref={pickerRef}>
                <Avatar name={profile.name || user?.name || ''} avatar={profile.avatar || undefined} size="lg" />
                <button
                  type="button"
                  onClick={() => setShowEmojiPicker((v) => !v)}
                  className="absolute -bottom-1 -right-1 w-5 h-5 bg-white border border-gray-300 rounded-full flex items-center justify-center shadow-sm hover:bg-primary-50 hover:border-gray-300 transition-colors"
                  title="이모지 변경"
                >
                  <Smile size={11} className="text-gray-500" />
                </button>

                {/* 이모지 피커 */}
                {showEmojiPicker && (
                  <div className="absolute top-full left-0 mt-2 z-50 bg-white rounded-2xl shadow-2xl border border-gray-200 p-3 w-72">
                    <div className="flex items-center justify-between mb-2.5">
                      <p className="text-xs font-semibold text-gray-500">캐릭터 이모지 선택</p>
                      {profile.avatar && (
                        <button
                          type="button"
                          onClick={() => { setProfile({ ...profile, avatar: '' }); setShowEmojiPicker(false); }}
                          className="text-[10px] text-gray-400 hover:text-red-500 transition-colors"
                        >
                          초기화
                        </button>
                      )}
                    </div>
                    <div className="grid grid-cols-10 gap-0.5">
                      {EMOJI_LIST.map((emoji) => (
                        <button
                          key={emoji}
                          type="button"
                          onClick={() => { setProfile({ ...profile, avatar: emoji }); setShowEmojiPicker(false); }}
                          className={`w-7 h-7 flex items-center justify-center text-lg rounded-lg transition-all hover:bg-primary-50 hover:scale-110 ${
                            profile.avatar === emoji ? 'bg-primary-100 ring-2 ring-primary-400' : ''
                          }`}
                        >
                          {emoji}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <div className="flex-1 min-w-0">
                {/* 이름 + 상태 뱃지 */}
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="text-base font-bold text-gray-600">{user?.name}</p>
                  <div className="relative">
                    <button
                      ref={statusBadgeRef}
                      type="button"
                      onClick={() => setShowStatusPopup((v) => !v)}
                      className="flex items-center gap-1.5 text-xs font-medium text-gray-500 bg-gray-100 hover:bg-gray-200 px-2.5 py-1 rounded-full transition-colors"
                    >
                      <span className="text-sm leading-none">{profile.statusEmoji || '🟢'}</span>
                      {profile.statusText
                        ? <span className="max-w-[120px] truncate">{profile.statusText}</span>
                        : <span className="text-gray-400">상태 설정</span>
                      }
                    </button>

                    {/* 상태 팝오버 */}
                    {showStatusPopup && (
                      <div
                        ref={statusPopupRef}
                        className="absolute left-0 top-full mt-2 z-50 w-72 bg-white rounded-2xl shadow-2xl border border-gray-100 overflow-hidden"
                      >
                        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
                          <p className="text-xs font-bold text-gray-700">내 상태</p>
                          <button onClick={() => setShowStatusPopup(false)} className="text-gray-400 hover:text-gray-600"><X size={14} /></button>
                        </div>

                        {/* 프리셋 */}
                        <div className="p-3 space-y-1">
                          {STATUS_PRESETS.map((p) => (
                            <button
                              key={p.emoji + p.text}
                              onClick={() => setProfile({ ...profile, statusEmoji: p.emoji, statusText: p.text })}
                              className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-left text-xs transition-colors ${profile.statusEmoji === p.emoji && profile.statusText === p.text ? 'bg-primary-50 text-primary-700 font-semibold' : 'hover:bg-gray-50 text-gray-600'}`}
                            >
                              <span className="text-base leading-none flex-shrink-0">{p.emoji}</span>
                              {p.text}
                            </button>
                          ))}
                        </div>

                        {/* 직접 입력 */}
                        <div className="px-3 pb-3 border-t border-gray-50 pt-2">
                          <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-2">직접 입력</p>
                          <div className="flex gap-2">
                            <div className="relative flex-shrink-0">
                              <button
                                onClick={() => setShowEmojiPicker((v) => !v)}
                                className="w-9 h-9 flex items-center justify-center text-lg border border-gray-200 rounded-lg hover:border-gray-300 transition-colors bg-white"
                              >
                                {profile.statusEmoji || '🟢'}
                              </button>
                              {showEmojiPicker && (
                                <div ref={pickerRef} className="absolute left-0 bottom-full mb-2 z-50 bg-white rounded-xl shadow-xl border border-gray-200 p-2 w-48 grid grid-cols-6 gap-1">
                                  {['🟢','🟡','🔴','⛔','🎯','📅','🏠','🌴','🤒','💼','☕','🎉','✈️','💤','🔕','🤫'].map((e) => (
                                    <button key={e} onClick={() => { setProfile({ ...profile, statusEmoji: e }); setShowEmojiPicker(false); }}
                                      className="w-7 h-7 flex items-center justify-center text-base hover:bg-gray-100 rounded transition-colors">
                                      {e}
                                    </button>
                                  ))}
                                </div>
                              )}
                            </div>
                            <input
                              type="text"
                              value={profile.statusText}
                              onChange={(e) => setProfile({ ...profile, statusText: e.target.value })}
                              maxLength={80}
                              placeholder="상태 메시지"
                              className="flex-1 text-xs border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-500"
                            />
                          </div>
                        </div>

                        {/* 저장 */}
                        <div className="px-3 pb-3">
                          <button
                            onClick={() => { updateProfile.mutate(); setShowStatusPopup(false); }}
                            disabled={updateProfile.isPending}
                            className="w-full py-2 text-xs font-semibold text-white rounded-xl disabled:opacity-40 transition-opacity"
                            style={{ background: 'linear-gradient(135deg, #f85032, #e73827)' }}
                          >
                            저장
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                <p className="text-sm text-gray-500 mt-0.5">{user?.email}</p>
                <span className={`mt-1 inline-block text-xs font-semibold px-2 py-0.5 rounded-full ${
                  user?.role === 'ADMIN' ? 'bg-primary-100 text-gray-800' : 'bg-gray-100 text-gray-600'
                }`}>
                  {user?.role === 'ADMIN' ? '관리자' : '일반 사용자'}
                </span>
                <p className="text-xs text-gray-400 mt-1.5">아바타를 클릭해 이모지를 선택하세요</p>
              </div>
            </div>
          </div>

          {/* 기본 정보 */}
          <div className="bg-white/85 backdrop-blur-md rounded-xl border border-white/80 shadow-[0_4px_16px_rgba(0,0,0,0.08),0_1px_4px_rgba(0,0,0,0.04),0_0_0_1px_rgba(255,255,255,0.9)_inset] ring-1 ring-gray-900/5 p-6">
            <h2 className="text-sm font-bold text-gray-800 mb-4 flex items-center gap-2">
              <User size={15} className="text-gray-600" /> 기본 정보
            </h2>
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1.5">이름 *</label>
                <input
                  type="text"
                  value={profile.name}
                  onChange={(e) => setProfile({ ...profile, name: e.target.value })}
                  className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-primary-500"
                  placeholder="이름을 입력하세요"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-500 mb-1.5">
                    <span className="flex items-center gap-1"><Briefcase size={11} /> 직급/직책</span>
                  </label>
                  <input
                    type="text"
                    value={profile.position}
                    onChange={(e) => setProfile({ ...profile, position: e.target.value })}
                    className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-primary-500"
                    placeholder="예: 과장, 시니어 개발자"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-500 mb-1.5">
                    <span className="flex items-center gap-1"><Building size={11} /> 부서</span>
                  </label>
                  <input
                    type="text"
                    value={profile.department}
                    onChange={(e) => setProfile({ ...profile, department: e.target.value })}
                    className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-primary-500"
                    placeholder="예: 개발팀, 기획팀"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1.5">
                  <span className="flex items-center gap-1"><Phone size={11} /> 전화번호</span>
                </label>
                <input
                  type="tel"
                  value={profile.phone}
                  onChange={(e) => setProfile({ ...profile, phone: e.target.value })}
                  className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-primary-500"
                  placeholder="예: 010-1234-5678"
                />
              </div>
            </div>

            <div className="mt-5 flex justify-end">
              <Button
                variant="primary"
                onClick={() => updateProfile.mutate()}
                disabled={!profile.name.trim()}
                loading={updateProfile.isPending}
              >
                <Save size={14} /> 저장
              </Button>
            </div>
          </div>

          {/* 알림 설정 */}
          <div className="bg-white/85 backdrop-blur-md rounded-xl border border-white/80 shadow-[0_4px_16px_rgba(0,0,0,0.08),0_1px_4px_rgba(0,0,0,0.04),0_0_0_1px_rgba(255,255,255,0.9)_inset] ring-1 ring-gray-900/5 p-6">
            <h2 className="text-sm font-bold text-gray-800 mb-4 flex items-center gap-2">
              <Bell size={15} className="text-gray-600" /> 알림 설정
            </h2>
            <div className="flex items-center justify-between py-2">
              <div>
                <p className="text-sm font-medium text-gray-800">멘션 알림</p>
                <p className="text-xs text-gray-400 mt-0.5">누군가 나를 멘션하면 화면 우측 하단에 알림 팝업이 표시됩니다</p>
              </div>
              <button
                type="button"
                onClick={() => setMentionAlarm(!mentionAlarm)}
                className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none ${
                  mentionAlarm ? 'bg-primary-600' : 'bg-gray-200'
                }`}
              >
                <span
                  className={`inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition-transform duration-200 ${
                    mentionAlarm ? 'translate-x-5' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
