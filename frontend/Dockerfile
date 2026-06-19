# ───────────── 1) Build stage ─────────────
FROM node:22-slim AS builder
WORKDIR /app

COPY package*.json ./
# react 19 vs @emoji-mart/react peer 충돌 회피
RUN npm install --legacy-peer-deps

COPY . .
# tsc 타입체크는 건너뛰고 vite로만 번들 (dev와 동일하게 타입 무시)
RUN npx vite build      # -> /app/dist

# ───────────── 2) Serve stage (nginx) ─────────────
FROM nginx:stable AS runner

# 정적 빌드 결과물
COPY --from=builder /app/dist /usr/share/nginx/html
# 프록시 포함 nginx 설정
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80
