# L.PMS — 소규모 팀을 위한 프로젝트 관리 시스템

> Linear + Notion + Jira 스타일의 현대적인 SaaS PMS

## 기술 스택

| 구분 | 기술 |
|---|---|
| Frontend | React 19, TypeScript, TailwindCSS v4, Vite |
| Backend | NestJS, Prisma 7, PostgreSQL |
| 인증 | JWT (Access + Refresh Token) |
| 상태관리 | Zustand, TanStack Query |
| DnD | @dnd-kit |

## 시작하기

### 사전 조건
- Node.js 20+
- PostgreSQL 15+

### 1. PostgreSQL 데이터베이스 생성
```sql
CREATE DATABASE pms_db;
```

### 2. 환경변수 설정
`backend/.env` 파일에서 DB 연결 정보 수정:
```
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/pms_db?schema=public"
```

### 3. 초기 설정 (최초 1회)
```
setup.bat  (Windows)
```
또는 수동으로:
```bash
cd backend
npx prisma migrate dev --name init
```

### 4. 실행
```
start.bat  (Windows)
```
또는 수동으로:
```bash
# Terminal 1
cd backend && npm run start:dev

# Terminal 2
cd frontend && npm run dev
```

- Frontend: http://localhost:5173
- Backend API: http://localhost:3000/api

## 주요 기능

- ✅ 로그인 / 회원가입 (JWT)
- ✅ 프로젝트 생성/관리/멤버 초대
- ✅ 칸반보드 (드래그앤드롭)
- ✅ 간트차트
- ✅ 태스크 상세 (댓글, 첨부파일, 서브태스크)
- ✅ 알림 시스템
- ✅ 활동로그
- ✅ 대시보드

## 프로젝트 구조

```
pms/
├── backend/            # NestJS API 서버
│   ├── src/
│   │   ├── auth/       # JWT 인증
│   │   ├── users/      # 사용자
│   │   ├── projects/   # 프로젝트
│   │   ├── steps/      # 칸반 단계
│   │   ├── tasks/      # 태스크
│   │   ├── comments/   # 댓글
│   │   ├── attachments/# 첨부파일
│   │   ├── notifications/# 알림
│   │   ├── activity-logs/# 활동로그
│   │   └── labels/     # 레이블
│   └── prisma/         # DB 스키마
└── frontend/           # React SPA
    └── src/
        ├── pages/      # 페이지 컴포넌트
        ├── components/ # 재사용 컴포넌트
        ├── api/        # API 클라이언트
        ├── store/      # 상태 관리
        └── types/      # TypeScript 타입
```
