import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { User } from '../types';

// keepLoggedIn 여부에 따라 localStorage / sessionStorage를 선택하는 커스텀 스토리지
const rawStorage = {
  getItem: (name: string): string | null => {
    const raw = sessionStorage.getItem(name) ?? localStorage.getItem(name);
    if (raw === null) return null;
    // 과거 잘못된 배포로 "[object Object]" 등 깨진 값이 저장된 경우 방어
    try {
      JSON.parse(raw);
      return raw;
    } catch {
      localStorage.removeItem(name);
      sessionStorage.removeItem(name);
      return null;
    }
  },
  setItem: (name: string, value: string): void => {
    const keep = localStorage.getItem('pms_keep') === '1';
    // 기존에 localStorage에 데이터가 있으면(배포 전 로그인 사용자) 영구 세션으로 유지
    const hasLegacy = !keep && localStorage.getItem(name) !== null;
    if (keep || hasLegacy) {
      if (hasLegacy) localStorage.setItem('pms_keep', '1');
      localStorage.setItem(name, value);
      sessionStorage.removeItem(name);
    } else {
      sessionStorage.setItem(name, value);
      localStorage.removeItem(name);
    }
  },
  removeItem: (name: string): void => {
    localStorage.removeItem(name);
    sessionStorage.removeItem(name);
  },
};

interface AuthState {
  user: User | null;
  accessToken: string | null;
  refreshToken: string | null;
  _hasHydrated: boolean;
  setAuth: (user: User, accessToken: string, refreshToken: string, keepLoggedIn?: boolean) => void;
  updateUser: (user: User) => void;
  logout: () => void;
  isAuthenticated: () => boolean;
  setHasHydrated: (v: boolean) => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      accessToken: null,
      refreshToken: null,
      _hasHydrated: false,
      setAuth: (user, accessToken, refreshToken, keepLoggedIn = true) => {
        if (keepLoggedIn) {
          localStorage.setItem('pms_keep', '1');
          localStorage.setItem('accessToken', accessToken);
          localStorage.setItem('refreshToken', refreshToken);
          sessionStorage.removeItem('accessToken');
          sessionStorage.removeItem('refreshToken');
        } else {
          localStorage.removeItem('pms_keep');
          localStorage.removeItem('accessToken');
          localStorage.removeItem('refreshToken');
          sessionStorage.setItem('accessToken', accessToken);
          sessionStorage.setItem('refreshToken', refreshToken);
        }
        set({ user, accessToken, refreshToken });
      },
      updateUser: (user) => set({ user }),
      logout: () => {
        localStorage.removeItem('pms_keep');
        localStorage.removeItem('accessToken');
        localStorage.removeItem('refreshToken');
        sessionStorage.removeItem('accessToken');
        sessionStorage.removeItem('refreshToken');
        set({ user: null, accessToken: null, refreshToken: null });
      },
      isAuthenticated: () => !!get().user && !!get().accessToken,
      setHasHydrated: (v) => set({ _hasHydrated: v }),
    }),
    {
      name: 'auth-storage',
      storage: createJSONStorage(() => rawStorage),
      partialize: (s) => ({ user: s.user, accessToken: s.accessToken, refreshToken: s.refreshToken }),
      onRehydrateStorage: () => (state) => {
        state?.setHasHydrated(true);
      },
    },
  ),
);
