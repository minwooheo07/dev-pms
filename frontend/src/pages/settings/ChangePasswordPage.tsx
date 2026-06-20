import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import { Lock, Eye, EyeOff, ChevronLeft, CheckCircle } from 'lucide-react';
import toast from 'react-hot-toast';
import { usersApi } from '../../api/users';
import { PageHeader } from '../../components/ui/PageHeader';
import { Button } from '../../components/ui/Button';

export function ChangePasswordPage() {
  const navigate = useNavigate();
  const [form, setForm] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });
  const [showPw, setShowPw] = useState({ current: false, next: false, confirm: false });
  const [done, setDone] = useState(false);

  const pwValid =
    form.currentPassword.length > 0 &&
    form.newPassword.length >= 6 &&
    form.newPassword === form.confirmPassword;

  const changePassword = useMutation({
    mutationFn: () => usersApi.changePassword({ currentPassword: form.currentPassword, newPassword: form.newPassword }),
    onSuccess: () => {
      setDone(true);
      toast.success('비밀번호가 변경되었습니다.');
    },
    onError: (e: any) => toast.error(e.response?.data?.message ?? '비밀번호 변경에 실패했습니다.'),
  });

  return (
    <div className="flex flex-col h-full">
      <PageHeader title="비밀번호 변경" description="계정 보안을 위해 주기적으로 비밀번호를 변경하세요" />

      <div className="flex-1 overflow-y-auto p-6">
        <div className="max-w-md mx-auto">
          {done ? (
            <div className="bg-white/85 backdrop-blur-md rounded-xl border border-white/80 shadow-[0_4px_16px_rgba(0,0,0,0.08)] ring-1 ring-gray-900/5 p-10 flex flex-col items-center gap-4 text-center">
              <div className="w-16 h-16 rounded-full flex items-center justify-center" style={{ background: 'linear-gradient(135deg,#f85032,#e73827)' }}>
                <CheckCircle size={32} className="text-white" />
              </div>
              <div>
                <p className="text-lg font-bold text-gray-800 mb-1">비밀번호가 변경됐습니다</p>
                <p className="text-sm text-gray-400">다음 로그인부터 새 비밀번호를 사용하세요.</p>
              </div>
              <button
                onClick={() => navigate(-1)}
                className="mt-2 px-6 py-2.5 text-sm font-semibold text-white rounded-xl"
                style={{ background: 'linear-gradient(135deg,#f85032,#e73827)' }}
              >
                돌아가기
              </button>
            </div>
          ) : (
            <div className="bg-white/85 backdrop-blur-md rounded-xl border border-white/80 shadow-[0_4px_16px_rgba(0,0,0,0.08),0_1px_4px_rgba(0,0,0,0.04),0_0_0_1px_rgba(255,255,255,0.9)_inset] ring-1 ring-gray-900/5 p-6">
              <h2 className="text-sm font-bold text-gray-800 mb-5 flex items-center gap-2">
                <Lock size={15} className="text-gray-600" /> 비밀번호 변경
              </h2>

              <div className="space-y-4">
                {/* 현재 비밀번호 */}
                <div>
                  <label className="block text-xs font-semibold text-gray-500 mb-1.5">현재 비밀번호</label>
                  <div className="relative">
                    <input
                      autoFocus
                      type={showPw.current ? 'text' : 'password'}
                      value={form.currentPassword}
                      onChange={(e) => setForm({ ...form, currentPassword: e.target.value })}
                      onKeyDown={(e) => e.key === 'Enter' && pwValid && changePassword.mutate()}
                      className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2.5 pr-10 focus:outline-none focus:ring-2 focus:ring-primary-500"
                      placeholder="현재 비밀번호"
                    />
                    <button type="button" onClick={() => setShowPw({ ...showPw, current: !showPw.current })}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                      {showPw.current ? <EyeOff size={15} /> : <Eye size={15} />}
                    </button>
                  </div>
                </div>

                {/* 새 비밀번호 */}
                <div>
                  <label className="block text-xs font-semibold text-gray-500 mb-1.5">새 비밀번호 (6자 이상)</label>
                  <div className="relative">
                    <input
                      type={showPw.next ? 'text' : 'password'}
                      value={form.newPassword}
                      onChange={(e) => setForm({ ...form, newPassword: e.target.value })}
                      onKeyDown={(e) => e.key === 'Enter' && pwValid && changePassword.mutate()}
                      className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2.5 pr-10 focus:outline-none focus:ring-2 focus:ring-primary-500"
                      placeholder="새 비밀번호"
                    />
                    <button type="button" onClick={() => setShowPw({ ...showPw, next: !showPw.next })}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                      {showPw.next ? <EyeOff size={15} /> : <Eye size={15} />}
                    </button>
                  </div>
                </div>

                {/* 새 비밀번호 확인 */}
                <div>
                  <label className="block text-xs font-semibold text-gray-500 mb-1.5">새 비밀번호 확인</label>
                  <div className="relative">
                    <input
                      type={showPw.confirm ? 'text' : 'password'}
                      value={form.confirmPassword}
                      onChange={(e) => setForm({ ...form, confirmPassword: e.target.value })}
                      onKeyDown={(e) => e.key === 'Enter' && pwValid && changePassword.mutate()}
                      className={`w-full text-sm border rounded-lg px-3 py-2.5 pr-10 focus:outline-none focus:ring-2 focus:ring-primary-500 ${
                        form.confirmPassword && form.newPassword !== form.confirmPassword
                          ? 'border-red-300'
                          : 'border-gray-300'
                      }`}
                      placeholder="새 비밀번호 재입력"
                    />
                    <button type="button" onClick={() => setShowPw({ ...showPw, confirm: !showPw.confirm })}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                      {showPw.confirm ? <EyeOff size={15} /> : <Eye size={15} />}
                    </button>
                  </div>
                  {form.confirmPassword && form.newPassword !== form.confirmPassword && (
                    <p className="text-xs text-red-500 mt-1">비밀번호가 일치하지 않습니다.</p>
                  )}
                </div>
              </div>

              <div className="mt-6 flex justify-end gap-2">
                <button
                  onClick={() => navigate(-1)}
                  className="px-4 py-2.5 text-sm font-medium text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-xl transition-colors"
                >
                  취소
                </button>
                <Button
                  variant="primary"
                  onClick={() => changePassword.mutate()}
                  disabled={!pwValid}
                  loading={changePassword.isPending}
                >
                  <Lock size={14} /> 변경하기
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
