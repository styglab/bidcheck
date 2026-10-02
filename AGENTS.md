# AGENTS.md

이 문서는 이 저장소에서 작업하는 코딩 에이전트를 위한 지침이다. 사용자 요청이 이 문서보다 우선한다.
작업 전에는 변경할 파일과 호출 경로를 읽고, 기존 구조와 표현을 따른다.

## 제품과 핵심 제약

입찰체크는 공공입찰 공고와 참가요건을 보여주고, 선택한 회사 정보와 비교해 검토를 돕는 웹 서비스다.
제품과 화면 원칙은 `docs/page-architecture.md`와 `docs/frontend-mvp.md`를 우선 참고한다.

- 중심 엔티티는 공고(`ProcurementNotice`)이고 회사는 선택적으로 적용되는 전역 컨텍스트다.
- 판정값은 `satisfied`, `unsatisfied`, `needs_review` 세 가지를 유지한다.
- `needs_review`를 불충족으로 취급하거나 사용자에게 참여 가능·불가를 단정하지 않는다.
- 공고, 참가요건, 회사정보와 평가는 Teoria Runtime API에서 조회한다. 나라장터, Teoria DB 또는 기관 API에 직접 연결하지 않는다.
- Teoria 계약을 변경하거나 해석할 때는 `docs/bid-check-service.md`를 읽는다.
- 비밀값과 실제 토큰을 코드, 테스트, 문서 또는 로그에 넣지 않는다. 환경변수 예시는 `.env.example`만 수정한다.

## 현재 기술 구성

```text
브라우저 -> Nginx proxy -> React/Vite 정적 앱
                       -> FastAPI -> Teoria Runtime API
                                  -> PostgreSQL
```

- 프론트엔드: React, TypeScript strict mode, Vite, React Router, TanStack Query
- UI: Tailwind CSS 4, shadcn/Radix UI, lucide-react
- 프론트 테스트: Vitest, Testing Library, jsdom
- 백엔드: Python 3.12 이상, FastAPI, Pydantic Settings, HTTPX
- 데이터 계층: SQLAlchemy async, asyncpg, Alembic, PostgreSQL 17
- 백엔드 테스트 및 정적 검사: pytest, Ruff
- 실행 환경: Docker Compose, Nginx
- 패키지 관리자: 프론트엔드는 `npm`과 커밋된 `package-lock.json`, 백엔드는 `pip`과 `pyproject.toml`

## 저장소 지도

- `frontend/src/app`: 애플리케이션 셸, 라우팅과 전역 레이아웃
- `frontend/src/pages`: 경로 단위 페이지 조합
- `frontend/src/features`: 도메인 기능, 해당 기능의 API hooks와 타입
- `frontend/src/components/ui`: 범용 UI primitive
- `frontend/src/components/common`: 여러 기능에서 쓰는 제품 공통 컴포넌트
- `frontend/src/components/layout`: 재사용 레이아웃
- `frontend/src/shared/api/client.ts`: `/api/v1` 요청과 공통 API 오류 처리
- `backend/app/api/v1`: 얇은 HTTP 엔드포인트와 입력 검증
- `backend/app/services`: HTTP와 무관한 비즈니스 규칙
- `backend/app/integrations`: 외부 시스템 클라이언트
- `backend/app/services/teoria_adapter.py`: Teoria 객체를 서비스 응답으로 변환하는 경계
- `backend/app/schemas`: Pydantic 요청·응답 모델
- `backend/app/models`, `backend/app/db`: SQLAlchemy 모델과 세션
- `backend/alembic`: 데이터베이스 마이그레이션
- `docs`: 제품, 화면 및 Teoria 연동 계약
- `proxy`: 브라우저 요청을 프론트엔드와 백엔드로 분기하는 Nginx 설정

## 구현 규칙

### 공통

- 요청 범위 밖의 리팩터링이나 새 의존성 추가를 피한다.
- 기존 모듈이 같은 책임을 담당하면 새 파일을 만들기 전에 확장 가능성을 확인한다.
- 외부 계약의 필드명은 snake_case를 유지한다. 단순한 스타일 선호 때문에 API 필드를 변환하지 않는다.
- 날짜와 판정 문구 등 도메인 의미를 임의로 추론하지 않는다. 누락되거나 불확실한 정보는 확인 필요 상태로 보존한다.
- 생성물(`frontend/dist`, 캐시, 테스트 결과)과 `.env`는 커밋하지 않는다.

### 프론트엔드

- 함수형 컴포넌트와 hooks를 사용하고 `@/` 별칭은 `frontend/src`를 가리킨다.
- 서버 상태와 요청 캐시는 TanStack Query로 관리한다. 직접 `fetch`를 분산시키지 말고 `shared/api/client.ts`의 `api()`를 사용한다.
- 기능 전용 API 함수, query options, DTO 타입은 해당 `features/<feature>/api.ts`에 둔다.
- 페이지는 기능과 공통 컴포넌트를 조합하는 역할에 집중한다. 재사용 로직을 페이지 파일에 복제하지 않는다.
- `components/ui`에는 도메인을 모르는 primitive만 둔다. 입찰, 회사, 기관 개념이 들어가면 `features` 또는 `components/common`에 둔다.
- 선택 회사 전역 상태와 localStorage 동작은 `features/company-context`의 기존 Context를 사용한다.
- 사용자에게 표시되는 기존 한국어 용어와 상태 표현을 유지한다.
- 동작 변경에는 가능하면 Testing Library 기반 사용자 관점 테스트를 추가한다. 구현 세부보다 role, accessible name, 화면 결과를 검증한다.

### 백엔드

- 엔드포인트는 FastAPI 입력 검증, orchestration, 응답과 HTTP 오류 매핑을 담당한다. 재사용 가능한 판정 규칙은 `services`로 분리한다.
- Teoria 호출은 `integrations/teoria.py`의 `teoria_client`를 사용한다. 응답 객체 변환은 `services/teoria_adapter.py`에 모은다.
- 비동기 경로에서 동기 네트워크 또는 DB 호출을 추가하지 않는다.
- API 오류는 가능한 경우 `detail={"code": ..., "message": ...}` 형태를 유지한다. 업스트림 토큰이나 내부 예외를 노출하지 않는다.
- Teoria 응답 배열 순서에 의존하지 말고 객체 type과 id를 기준으로 처리한다. 중요한 응답의 `truncated` 상태를 무시하지 않는다.
- 스키마 변경은 새 Alembic revision으로 수행한다. 적용된 migration 파일을 다시 쓰지 않는다.
- 외부 호출 테스트는 실제 네트워크를 사용하지 않고 `monkeypatch`로 `teoria_client.execute`를 대체한다.

## 공통 모듈 기준

공통화는 단순 중복이 아니라 같은 책임과 같은 변경 이유를 가질 때 수행한다.

- 한 기능 안에서 재사용되는 코드는 먼저 해당 `features/<feature>` 또는 백엔드 도메인 모듈에 둔다.
- 여러 프론트 기능이 공유하며 도메인에 의존하지 않는 API 처리나 utility만 `shared`에 둔다.
- 여러 화면이 공유하는 도메인 UI는 `components/common`, 구조만 제공하는 UI는 `components/layout`, 시각 primitive는 `components/ui`에 둔다.
- 백엔드의 외부 응답 정규화는 adapter, 비즈니스 판정은 service, 전송 모델은 schema로 구분한다.
- 프론트엔드 TypeScript 타입과 백엔드 Pydantic 모델은 언어가 다르므로 파일을 억지로 공유하지 않는다. API 계약 변경 시 양쪽 타입과 테스트를 함께 갱신한다.
- 브라우저 전용 코드와 서버 전용 코드를 공통 모듈로 합치지 않는다.
- 한 곳에서만 쓰이는 코드나 미래 사용을 예상한 추상화는 만들지 않는다. 반복되더라도 의미나 변경 이유가 다르면 분리 상태를 유지한다.

## 실행과 검증

전체 서비스는 저장소 루트에서 실행한다. 외부 Docker 네트워크 `teoria_default`와 올바른 `.env`가 필요하다.

```bash
cp .env.example .env
docker compose up --build -d
```

프론트엔드:

```bash
cd frontend
npm ci
npm run dev
npm run lint
npm run format
npm test
npm run build
```

백엔드:

```bash
cd backend
python -m venv .venv
. .venv/bin/activate
pip install -e '.[dev]'
pytest
ruff check .
```

- 변경 중에는 가장 좁은 관련 테스트를 먼저 실행한다.
- 프론트 변경 완료 시 최소 `npm run lint`, `npm test`, `npm run build`를 실행한다.
- 백엔드 변경 완료 시 최소 `pytest`, `ruff check .`을 실행한다.
- Compose, Dockerfile, Nginx 또는 통합 경계를 변경하면 `docker compose config`를 확인하고 가능한 경우 전체 서비스를 빌드한다.
- 문서만 변경했다면 코드 테스트는 생략할 수 있지만, 명령과 경로가 실제 저장소와 일치하는지 확인한다.
- 실행하지 못한 검증과 이유를 최종 보고에 명시한다. 실행하지 않은 테스트를 통과했다고 말하지 않는다.

## 변경 완료 보고

최종 응답에는 변경 요약, 중요한 설계 판단, 실행한 검증과 결과, 남은 위험이나 미검증 항목을 간단히 포함한다.
