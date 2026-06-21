import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
function Logo({ size = 40 }: { size?: number }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" width={size} height={size}>
      <defs>
        <linearGradient id="rg-bg" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#ff2828"/>
          <stop offset="100%" stopColor="#a8000c"/>
        </linearGradient>
        <linearGradient id="rg-face" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#ffffff"/>
          <stop offset="100%" stopColor="#e8e8e8"/>
        </linearGradient>
        <linearGradient id="rg-top" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#ffffff"/>
          <stop offset="100%" stopColor="#cccccc"/>
        </linearGradient>
        <linearGradient id="rg-side" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#bbbbbb"/>
          <stop offset="100%" stopColor="#888888"/>
        </linearGradient>
      </defs>
      <rect width="32" height="32" rx="7" fill="url(#rg-bg)"/>
      <rect x="8" y="6" width="5.5" height="19" rx="0.5" fill="url(#rg-face)"/>
      <rect x="8" y="19.5" width="14" height="5.5" rx="0.5" fill="url(#rg-face)"/>
      <rect x="8" y="6" width="5.5" height="1.5" rx="0.5" fill="url(#rg-top)"/>
      <rect x="13.5" y="19.5" width="8.5" height="1.5" fill="url(#rg-top)" opacity="0.8"/>
      <rect x="13" y="7.5" width="1.5" height="12" fill="url(#rg-side)"/>
      <rect x="21.5" y="21" width="1.5" height="4" rx="0.5" fill="url(#rg-side)"/>
      <rect x="13" y="19.5" width="1.5" height="1.5" fill="#999999"/>
    </svg>
  );
}
import toast from 'react-hot-toast';
import { authApi } from '../../api/auth';
import { useAuthStore } from '../../store/auth.store';
import { Input } from '../../components/ui/Input';
import { Button } from '../../components/ui/Button';

export function RegisterPage() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [pending, setPending] = useState(false);
  const navigate = useNavigate();

  const register = useMutation({
    mutationFn: authApi.register,
    onSuccess: (data: any) => {
      if (data.pending) {
        setPending(true);
      } else {
        navigate('/login');
        toast.success('계정이 생성되었습니다. 로그인해주세요.');
      }
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.message ?? '회원가입에 실패했습니다.');
    },
  });

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 8) {
      toast.error('비밀번호는 8자 이상이어야 합니다.');
      return;
    }
    register.mutate({ name, email, password });
  };

  if (pending) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-950 via-primary-950 to-gray-950 flex items-center justify-center p-4">
        <div className="w-full max-w-sm">
          <div className="flex items-center justify-center gap-4 mb-8">
            <Logo size={44} />
            <span className="text-3xl font-bold text-white">L.PMS</span>
          </div>
          <div className="bg-white rounded-2xl shadow-2xl p-8 text-center">
            <div className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4" style={{ background: 'linear-gradient(135deg, #f85032, #e73827)' }}>
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z"/>
                <path d="M12 8v4M12 16h.01"/>
              </svg>
            </div>
            <h2 className="text-xl font-bold text-gray-800 mb-2">승인 대기 중</h2>
            <p className="text-sm text-gray-500 mb-1">회원가입이 완료되었습니다.</p>
            <p className="text-sm text-gray-500 mb-6">관리자 승인 후 로그인하실 수 있습니다.</p>
            <Link to="/login" className="block w-full py-2.5 text-sm font-semibold text-white rounded-xl text-center transition-opacity hover:opacity-90" style={{ background: 'linear-gradient(135deg, #f85032, #e73827)' }}>
              로그인 페이지로
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-950 via-primary-950 to-gray-950 flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="flex items-center justify-center gap-4 mb-8">
          <Logo size={44} />
          <span className="text-3xl font-bold text-white">L.PMS</span>
        </div>

        <div className="bg-white rounded-2xl shadow-2xl p-8">
          <h1 className="text-xl font-bold text-gray-700 mb-1">회원가입</h1>
          <p className="text-sm text-gray-500 mb-6">새 계정을 만들어 시작하세요.</p>

          <form onSubmit={onSubmit} className="space-y-4">
            <Input
              label="이름"
              type="text"
              placeholder="홍길동"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
            <Input
              label="이메일"
              type="email"
              placeholder="name@company.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
            <Input
              label="비밀번호"
              type="password"
              placeholder="8자 이상 입력"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
            <Button
              type="submit"
              variant="primary"
              size="lg"
              loading={register.isPending}
              className="w-full"
            >
              계정 만들기
            </Button>
          </form>

          <p className="text-center text-sm text-gray-500 mt-5">
            이미 계정이 있으신가요?{' '}
            <Link to="/login" className="text-gray-600 font-medium hover:underline">
              로그인
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
