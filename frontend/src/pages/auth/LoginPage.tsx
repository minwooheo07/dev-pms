import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import { X, AlertCircle } from 'lucide-react';

function Logo({ size = 40 }: { size?: number }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" width={size} height={size}>
      <defs>
        <linearGradient id="lg-bg" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#ff2828"/>
          <stop offset="100%" stopColor="#a8000c"/>
        </linearGradient>
        <linearGradient id="lg-face" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#ffffff"/>
          <stop offset="100%" stopColor="#e8e8e8"/>
        </linearGradient>
        <linearGradient id="lg-top" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#ffffff"/>
          <stop offset="100%" stopColor="#cccccc"/>
        </linearGradient>
        <linearGradient id="lg-side" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#bbbbbb"/>
          <stop offset="100%" stopColor="#888888"/>
        </linearGradient>
      </defs>
      <rect width="32" height="32" rx="7" fill="url(#lg-bg)"/>
      <rect x="8" y="6" width="5.5" height="19" rx="0.5" fill="url(#lg-face)"/>
      <rect x="8" y="19.5" width="14" height="5.5" rx="0.5" fill="url(#lg-face)"/>
      <rect x="8" y="6" width="5.5" height="1.5" rx="0.5" fill="url(#lg-top)"/>
      <rect x="13.5" y="19.5" width="8.5" height="1.5" fill="url(#lg-top)" opacity="0.8"/>
      <rect x="13" y="7.5" width="1.5" height="12" fill="url(#lg-side)"/>
      <rect x="21.5" y="21" width="1.5" height="4" rx="0.5" fill="url(#lg-side)"/>
      <rect x="13" y="19.5" width="1.5" height="1.5" fill="#999999"/>
    </svg>
  );
}
import toast from 'react-hot-toast';
import { authApi } from '../../api/auth';
import { useAuthStore } from '../../store/auth.store';
import { Input } from '../../components/ui/Input';
import { Button } from '../../components/ui/Button';

type FindTab = 'id' | 'password';

export function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loginError, setLoginError] = useState<string | null>(null);
  const [isPendingError, setIsPendingError] = useState(false);
  const { setAuth } = useAuthStore();
  const navigate = useNavigate();

  // 찾기 모달
  const [showFind, setShowFind] = useState(false);
  const [findTab, setFindTab] = useState<FindTab>('id');
  const [findName, setFindName] = useState('');
  const [findPhone, setFindPhone] = useState('');
  const [findEmail, setFindEmail] = useState('');
  const [foundId, setFoundId] = useState<string | null>(null);
  const [foundPw, setFoundPw] = useState<string | null>(null);

  const login = useMutation({
    mutationFn: authApi.login,
    onSuccess: (data) => {
      setLoginError(null);
      setAuth(data.user, data.accessToken, data.refreshToken);
      navigate('/dashboard');
      toast.success(`안녕하세요, ${data.user.name}님!`);
    },
    onError: (err: any) => {
      const msg = err.response?.data?.message ?? '로그인에 실패했습니다.';
      const isPending = err.response?.status === 403 && msg.includes('승인 대기');
      setIsPendingError(isPending);
      setLoginError(msg);
      if (!isPending) setPassword('');
    },
  });

  const findId = useMutation({
    mutationFn: () => authApi.findId(findName, findPhone),
    onSuccess: (data) => setFoundId(data.email),
    onError: (err: any) => toast.error(err.response?.data?.message ?? '일치하는 계정이 없습니다.'),
  });

  const findPassword = useMutation({
    mutationFn: () => authApi.findPassword(findName, findEmail),
    onSuccess: (data) => setFoundPw(data.tempPassword),
    onError: (err: any) => toast.error(err.response?.data?.message ?? '일치하는 계정이 없습니다.'),
  });

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) return;
    setLoginError(null);
    login.mutate({ email, password });
  };

  const openFind = (tab: FindTab) => {
    setFindTab(tab);
    setFindName('');
    setFindPhone('');
    setFindEmail('');
    setFoundId(null);
    setFoundPw(null);
    setShowFind(true);
  };

  const closeFind = () => {
    setShowFind(false);
    setFoundId(null);
    setFoundPw(null);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-950 via-primary-950 to-gray-950 flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="flex items-center justify-center gap-4 mb-8">
          <Logo size={44} />
          <span className="text-3xl font-bold text-white">L.PMS</span>
        </div>

        <div className="bg-white rounded-2xl shadow-2xl p-8">
          <h1 className="text-xl font-bold text-gray-700 mb-1">로그인</h1>
          <p className="text-sm text-gray-500 mb-6">계정에 로그인하여 시작하세요.</p>

          <form onSubmit={onSubmit} className="space-y-4" noValidate>
            <Input
              label="이메일"
              type="email"
              placeholder="name@company.com"
              value={email}
              onChange={(e) => { setEmail(e.target.value); setLoginError(null); }}
              autoComplete="email"
            />
            <Input
              label="비밀번호"
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => { setPassword(e.target.value); setLoginError(null); }}
              autoComplete="current-password"
            />

            {/* 에러 팝업 */}
            {loginError && (
              <div className={`flex items-start gap-2.5 px-3.5 py-3 rounded-xl border animate-slide-up ${isPendingError ? 'bg-amber-50 border-amber-200' : 'bg-red-50 border-red-200'}`}>
                <AlertCircle size={15} className={`flex-shrink-0 mt-0.5 ${isPendingError ? 'text-amber-500' : 'text-red-500'}`} />
                <p className={`text-sm font-medium flex-1 ${isPendingError ? 'text-amber-700' : 'text-red-700'}`}>{loginError}</p>
                <button
                  type="button"
                  onClick={() => setLoginError(null)}
                  className="text-red-400 hover:text-red-600 flex-shrink-0"
                >
                  <X size={14} />
                </button>
              </div>
            )}

            <Button
              type="submit"
              variant="primary"
              size="lg"
              loading={login.isPending}
              disabled={!email || !password}
              className="w-full"
            >
              로그인
            </Button>
          </form>

          {/* 아이디/비번 찾기 */}
          <div className="flex items-center justify-center gap-3 mt-4">
            <button
              type="button"
              onClick={() => openFind('id')}
              className="text-xs text-gray-400 hover:text-red-600 transition-colors"
            >
              아이디 찾기
            </button>
            <span className="text-gray-200">|</span>
            <button
              type="button"
              onClick={() => openFind('password')}
              className="text-xs text-gray-400 hover:text-red-600 transition-colors"
            >
              비밀번호 찾기
            </button>
          </div>

          <p className="text-center text-sm text-gray-500 mt-4">
            계정이 없으신가요?{' '}
            <Link to="/register" className="text-gray-600 font-medium hover:underline">
              회원가입
            </Link>
          </p>
        </div>

        <p className="text-center text-xs text-white/70 mt-6 font-medium tracking-wide">
          소규모 팀을 위한 프로젝트 관리 도구
        </p>
      </div>

      {/* 찾기 모달 */}
      {showFind && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm">
            {/* 헤더 */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <div className="flex gap-4">
                <button
                  onClick={() => { setFindTab('id'); setFoundId(null); setFoundPw(null); }}
                  className={`text-sm font-semibold pb-0.5 transition-colors ${findTab === 'id' ? 'text-gray-600 border-b-2 border-primary-600' : 'text-gray-400 hover:text-gray-600'}`}
                >
                  아이디 찾기
                </button>
                <button
                  onClick={() => { setFindTab('password'); setFoundId(null); setFoundPw(null); }}
                  className={`text-sm font-semibold pb-0.5 transition-colors ${findTab === 'password' ? 'text-gray-600 border-b-2 border-primary-600' : 'text-gray-400 hover:text-gray-600'}`}
                >
                  비밀번호 찾기
                </button>
              </div>
              <button onClick={closeFind} className="text-gray-400 hover:text-gray-600">
                <X size={18} />
              </button>
            </div>

            <div className="px-6 py-5 space-y-4">
              {findTab === 'id' ? (
                <>
                  {!foundId ? (
                    <>
                      <p className="text-xs text-gray-500">가입 시 등록한 이름과 전화번호를 입력하세요.</p>
                      <Input
                        label="이름"
                        placeholder="홍길동"
                        value={findName}
                        onChange={(e) => setFindName(e.target.value)}
                      />
                      <Input
                        label="전화번호"
                        placeholder="010-1234-5678"
                        value={findPhone}
                        onChange={(e) => setFindPhone(e.target.value)}
                      />
                      <Button
                        variant="primary"
                        className="w-full"
                        loading={findId.isPending}
                        onClick={() => findId.mutate()}
                        disabled={!findName || !findPhone}
                      >
                        아이디 찾기
                      </Button>
                    </>
                  ) : (
                    <div className="text-center py-4 space-y-3">
                      <p className="text-sm text-gray-500">회원님의 아이디는</p>
                      <p className="text-lg font-bold text-gray-600 bg-primary-50 rounded-xl py-3">{foundId}</p>
                      <p className="text-xs text-gray-400">입니다.</p>
                      <Button variant="secondary" className="w-full" onClick={closeFind}>확인</Button>
                    </div>
                  )}
                </>
              ) : (
                <>
                  {!foundPw ? (
                    <>
                      <p className="text-xs text-gray-500">가입 시 등록한 이름과 이메일을 입력하세요.<br />임시 비밀번호가 발급됩니다.</p>
                      <Input
                        label="이름"
                        placeholder="홍길동"
                        value={findName}
                        onChange={(e) => setFindName(e.target.value)}
                      />
                      <Input
                        label="이메일"
                        type="email"
                        placeholder="name@company.com"
                        value={findEmail}
                        onChange={(e) => setFindEmail(e.target.value)}
                      />
                      <Button
                        variant="primary"
                        className="w-full"
                        loading={findPassword.isPending}
                        onClick={() => findPassword.mutate()}
                        disabled={!findName || !findEmail}
                      >
                        비밀번호 찾기
                      </Button>
                    </>
                  ) : (
                    <div className="text-center py-4 space-y-3">
                      <p className="text-sm text-gray-500">임시 비밀번호가 발급되었습니다.</p>
                      <p className="text-lg font-bold text-gray-600 bg-primary-50 rounded-xl py-3 tracking-widest">{foundPw}</p>
                      <p className="text-xs text-gray-400">로그인 후 프로필 설정에서 비밀번호를 변경하세요.</p>
                      <Button variant="secondary" className="w-full" onClick={closeFind}>확인</Button>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
