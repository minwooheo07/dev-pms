import api from '../api/axios';
import toast from 'react-hot-toast';

// 인증 헤더를 실어 파일을 blob으로 받아 새 탭에서 연다(이미지·PDF 미리보기 유지).
// 비동기 후 window.open이 팝업 차단되지 않도록 클릭 제스처에서 먼저 빈 탭을 연다.
export async function openFileInNewTab(path: string) {
  const win = window.open('', '_blank');
  try {
    const res = await api.get(path, { responseType: 'blob' });
    const url = URL.createObjectURL(res.data as Blob);
    if (win) win.location.href = url;
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
  } catch {
    win?.close();
    toast.error('파일을 불러오지 못했습니다.');
  }
}

// 인증 헤더를 실어 파일을 blob으로 받아 곧바로 저장(다운로드)한다.
export async function downloadFile(path: string, fallbackName = 'download') {
  try {
    const res = await api.get(path, { responseType: 'blob' });
    const cd = (res.headers['content-disposition'] as string | undefined) ?? '';
    const m = cd.match(/filename\*=UTF-8''([^;]+)/i);
    const filename = m ? decodeURIComponent(m[1]) : fallbackName;

    const url = URL.createObjectURL(res.data as Blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  } catch {
    toast.error('파일을 다운로드하지 못했습니다.');
  }
}
