# 입찰체크

입찰공고와 참가요건을 확인하고, 선택한 회사의 조달·자격 정보와 비교하는 웹 서비스입니다.

## 구성

```text
브라우저 → Nginx → React/Vite
                 → FastAPI → Teoria Runtime API
                           → PostgreSQL
```

입찰체크는 나라장터나 Teoria 데이터베이스에 직접 접근하지 않습니다. 공고·참가요건·회사정보와 자격 평가는 Teoria Runtime API를 통해 조회합니다.

## 실행

Teoria Runtime이 연결된 외부 Docker 네트워크 `teoria_default`가 필요합니다.

```bash
cp .env.example .env
docker compose up --build -d
```

- 화면: `http://localhost:8082`
- API 문서: `http://localhost:8082/docs`
- 상태 확인: `http://localhost:8082/health`

포트가 사용 중이면 `.env`의 `HTTP_PORT`를 변경하세요. 운영 전에는 데이터베이스 비밀번호, `SECRET_KEY`, `TEORIA_RUNTIME_TOKEN`을 반드시 교체해야 합니다.

## 주요 화면

- `/`: 서비스 소개와 공고 검색 진입
- `/notices`: 입찰공고 검색·업무 유형 필터·회사 적용
- `/notices/:noticeId`: 공고정보·참가요건·회사 기준 평가
- `/company/setup`: 사업자등록번호로 회사 적용
- `/companies`: 업체 조회

## 주요 API

- `GET /api/v1/bids`: 최근 90일의 `scheduled`, `open`, `unknown` 공고 검색
- `GET /api/v1/bids/{notice_id}`: 공고와 참가요건 조회
- `GET /api/v1/companies/search`: 회사명 또는 사업자등록번호 검색
- `GET /api/v1/companies/{business_number}/profile`: 회사 조달·자격 정보 조회
- `POST /api/v1/assessments`: 공고와 회사의 참가요건 평가
- `POST /api/v1/assessments/batch`: 현재 목록 공고의 참가요건 일괄 평가
- `POST /api/v1/checks`: 단순 지역·면허 조건 판정

공고 데이터는 나라장터 API 제공 범위와 Teoria 수집 시점에 따라 실제 나라장터 화면과 차이가 있을 수 있습니다.

## 검증

```bash
cd frontend
npm run build
npm run lint
npm test
```

백엔드 개발 의존성을 설치한 환경에서는 다음을 실행합니다.

```bash
cd backend
pytest
ruff check .
```
