# 입찰체크

React/Vite 프론트엔드와 FastAPI 백엔드, PostgreSQL을 Docker Compose로 배포하는 기본 프로젝트입니다.

## 실행

```bash
cp .env.example .env
docker compose up --build -d
```

- 화면: `http://localhost:8082`
- API 문서: `http://localhost:8082/docs`
- 상태 확인: `http://localhost:8082/health`

포트가 사용 중이면 `.env`의 `HTTP_PORT`를 다른 값으로 변경하세요.

## 주요 API

- `GET /api/v1/bids`: 공고 목록
- `POST /api/v1/bids`: 공고 등록
- `POST /api/v1/checks`: 지역과 면허 조건 판정

운영 전 `.env`의 비밀번호와 비밀키를 반드시 변경하세요.
