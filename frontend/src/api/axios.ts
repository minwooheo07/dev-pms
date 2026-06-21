import axios from 'axios';
import { useAuthStore } from '../store/auth.store';

const api = axios.create({
  baseURL: '/api',
  withCredentials: true,
});

api.interceptors.request.use((config) => {
  const token = sessionStorage.getItem('accessToken') ?? localStorage.getItem('accessToken');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// 동시에 여러 요청이 401 날 때 refresh가 중복 실행되는 것을 방지
let isRefreshing = false;
let failedQueue: Array<{ resolve: (v: any) => void; reject: (e: any) => void }> = [];

function processQueue(error: any, token: string | null = null) {
  failedQueue.forEach(({ resolve, reject }) => {
    if (error) reject(error);
    else resolve(token);
  });
  failedQueue = [];
}

api.interceptors.response.use(
  (res) => res,
  async (error) => {
    const original = error.config;

    // 로그인 요청 자체의 401은 인증 갱신 로직 건너뜀 (틀린 비밀번호 등)
    const isAuthEndpoint = original.url?.includes('/auth/login') || original.url?.includes('/auth/register');
    if (error.response?.status === 401 && !original._retry && !isAuthEndpoint) {
      const refreshToken = sessionStorage.getItem('refreshToken') ?? localStorage.getItem('refreshToken');
      if (!refreshToken) {
        useAuthStore.getState().logout();
        window.location.href = '/login';
        return Promise.reject(error);
      }

      if (isRefreshing) {
        // 이미 갱신 중이면 큐에 넣고 대기
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        }).then((token) => {
          original.headers.Authorization = `Bearer ${token}`;
          return api(original);
        });
      }

      original._retry = true;
      isRefreshing = true;

      try {
        const { data } = await axios.post('/api/auth/refresh', { refreshToken });
        const keep = localStorage.getItem('pms_keep') === '1';
        if (keep) {
          localStorage.setItem('accessToken', data.accessToken);
          localStorage.setItem('refreshToken', data.refreshToken);
        } else {
          sessionStorage.setItem('accessToken', data.accessToken);
          sessionStorage.setItem('refreshToken', data.refreshToken);
        }
        api.defaults.headers.common.Authorization = `Bearer ${data.accessToken}`;
        processQueue(null, data.accessToken);
        original.headers.Authorization = `Bearer ${data.accessToken}`;
        return api(original);
      } catch (err) {
        processQueue(err, null);
        // Zustand persist(auth-storage)까지 완전히 초기화해야 루프 방지
        useAuthStore.getState().logout();
        window.location.href = '/login';
        return Promise.reject(err);
      } finally {
        isRefreshing = false;
      }
    }

    return Promise.reject(error);
  },
);

export default api;
