# 입찰체크 서비스 연동 가이드

이 문서는 다른 저장소에서 개발하는 입찰체크 서비스가 Teoria의 입찰공고, 참가요건 및 기업 자격 평가 기능을 사용하는 데 필요한 계약을 정리한다.

## 권장 연결 구조

```text
입찰체크 서비스 ──HTTPS + Bearer token──▶ Teoria Runtime API
                                           ├─ 정규화된 공고·참가요건 DB 조회
                                           └─ 공식 기관 API를 통한 기업 상태·자격 조회
```

외부 서비스는 Pipeline Connector, Teoria Data DB 또는 제공기관 API 키에 직접 접근하지 않는다. Pipeline은 데이터를 수집·정규화하고, Runtime API가 읽기 전용 DB와 Source API를 조합한다. AI Client가 Tool 호출이 필요한 경우에만 `입찰체크 서비스 → MCP Gateway → Runtime API` 구조를 선택한다.

## 접속 정보

운영자가 다음 두 값을 별도 보안 채널로 제공해야 한다.

| 값 | 예시 | 설명 |
|---|---|---|
| Runtime API base URL | `https://teoria.example.com/runtime-api` | 환경별 URL. 실제 경로는 배포 설정에 따름 |
| Runtime API token | 비공개 | 모든 `/v1/*` 호출에 사용하는 Bearer token |

```http
Authorization: Bearer <token>
Content-Type: application/json
```

`GET /health`는 인증 없이 상태만 확인한다. `GET /v1/version`은 Runtime 및 Registry 버전을, `GET /v1/capabilities`는 현재 제공되는 Capability와 JSON 입력 스키마를 반환한다. 클라이언트는 입력 스키마를 코드에 복제하기보다 이 discovery 응답을 계약 확인과 호환성 점검에 활용하는 것이 좋다.

## 기관·업체 계약 통계 기준

기관·업체 상세의 계약 통계는 Teoria의 `analyze_organization_procurement_profile`과
`analyze_company_procurement_profile` 응답을 사용한다. 산정 규칙의 단일 원본은 Teoria
저장소의 `docs/domains/public_procurement/contract_aggregation.md`이며 입찰체크에서
별도의 계산식으로 재집계하지 않는다.

업체 참여·성공률과 연도별 참여 카드는 `outcome.participation_analysis.summary` 및
`yearly_activity`를 사용한다. 참여는 `participation_count`, 그중 낙찰은
`observed_award_count`, 관측 성공률은 `observed_success_rate × 100`을 소수점 한 자리로
표시한다. 분자·분모는 `success_rate_numerator`·`success_rate_denominator`를 사용하며,
`independent_award_event_count`는 별도 낙찰 실적으로 구분한다. 별도 낙찰 건수로
성공률을 재계산하지 않는다. 계약금액은 기존 `yearly_activity`에서 같은 `year`의
`attributed_contract_amount`를 연결한다.

수집 중이며 참여가 `null`인 연도는 건수·성공률 대신 `collection_status_label`을
표시한다. 일부 관측 기록이 있으면 건수·관측 성공률 옆에 수집 상태를 함께 표시한다.
`null`을 0건이나 `-%`로 바꾸지 않으며, `failed`·`unknown`도 수집 중으로 단정하지 않는다.
실제로 수집 완료된 0건과 확인된 0%는 그대로 보존한다. 물음표 도움말은
`participation_analysis.basis`의 개찰 순위·최종 낙찰업체 보존 범위를 사용하고,
수집 완료도 전체 참여 이력의 완전성을 뜻하지 않음을 설명한다.

클라이언트는 다음 `outcome.analysis_basis` 값을 확인한다.

```json
{
  "contract_event_date_basis": "first_contract_date",
  "contract_amount_basis": "latest_version_at_or_before_period_end",
  "contract_amount_year_attribution": "first_contract_year",
  "contract_version_deduplication": "merged_by_contract_event"
}
```

- 계약 건수와 연도별 추이는 최초 계약일 기준이다.
- 조회 종료일 이전 최신 계약 버전의 금액을 최초 계약 연도에 표시한다.
- 최근 변경일인 `latest_contract_date`를 계약 추이의 연도로 사용하지 않는다.
- `summary.missing_first_contract_date_count`와 `summary.amount_completeness`를 숨기지
  않고 불완전한 집계임을 표시한다.
- 공동수급 금액은 Teoria가 반환한 `attributed_contract_amount`를 사용하며 전체
  계약금액을 업체마다 중복 합산하지 않는다.

계약 추이와 금액 근처에는 다음 문구를 표시한다.

> 계약 건수는 최초 계약일 기준이며, 금액은 조회 종료일 현재의 최신 계약금액입니다.

## 입찰체크의 기본 호출 순서

### 경쟁 탐색 Runtime Capability와 연동 현황

2026-10-13 Runtime의 `/v1/capabilities`에서 신규 5개를 포함한 34개 Capability를 확인했다.
현재 입찰체크의 통합 검색은 `autocomplete_procurement_entities`, 분야 선택은
`get_procurement_classification_catalog`를 사용한다. 공식 품목 코드가 선택된 관계
그래프는 `get_procurement_network`의 2단계 결과를 일괄 조회하고, 분야 패널은
`analyze_procurement_field_market`의 수집 범위 내 집계를 표시한다. 기관–업체 링크의
근거는 같은 snapshot의 `get_organization_company_relationship(view_mode=network_edge)`로
조회한다. `get_procurement_region_filter_options`는 읽기 API만 준비했으며, 네트워크와
분야 시장의 지역 필터는 Runtime이 지원할 때까지 화면에서 적용하지 않는다.
아래 응답시간은 단회 측정치나 협의 목표이며 검증된 P95가 아니다.

- `autocomplete_procurement_entities`: 공고·기관·조달업체·공식 분야/품목의 이름·번호를
  Runtime 내부 검색 인덱스에서 조회한다. 외부 기업정보 API와 실적 전체 집계를 호출하지 않는다.
  공고 후보에 기관 코드·기관명·업무구분·공식 분류·명시적 소재지와 지역 기준을 포함해
  후보 클릭 후 별도 시장 분석 없이 필터를 설정한다. 누락값은 null로 보존한다.
  query, types, limit(기본 8, 최대 20), cursor를 지원하고 prefix·초성·번호 검색과
  취소 가능한 요청, 정규화한 질의 캐시를 제공한다. 응답 목표는 P95 200ms 이하로 협의한다.
- `get_procurement_network`: root_type/id 또는 field_code, 필수 분야, work_type,
  region_basis/code, period_from/to_year, depth(최대 2), first_hop_limit,
  second_hop_limit을 입력받고 nodes·edges·관계 요약을 한 번에 반환한다. 업체마다
  `analyze_company_procurement_profile`을 호출하는 N+1 구조를 피하고 관계 전용 읽기 모델과
  서버의 일괄 집계·캐시를 사용한다. 노드 쌍당 edge 하나에 계약·낙찰·관측 참여·공동 참여를
  분리 보관한다. omitted_node/edge_count, truncation, coverage, updated_at와 집계 기준을
  반환한다. 응답 목표는 P95 캐시 1초, 최초 조회 2초 이하로 협의한다.
- 기관–업체 관계는 기존 `get_organization_company_relationship`을 확장하는 계획이다.
  기존 동작은 보존하고 네트워크와 같은 필터·집계·snapshot을 사용하는 명시적 조회 모드를
  추가한다. `get_procurement_relation_detail`은 신규로 만들지 않는다.
- 업체/기관의 노드 패널은 별도 프로필 조회를 유지한다. 분야의 전체 연도별 시장 집계,
  공식 분류 카탈로그와 지역 기준별 필터도 Runtime의 정식 Capability로 추가한다.

기존 최초 계약일 기준·변경 버전 병합·업체 식별 정규화·공동수급 귀속금액과 참여 원천의
관측 범위는 새 읽기 모델에서도 유지한다. 준비되지 않은 지역/분류는 지원된다고 응답하지
않는다. 응답 지연을 단계별 SQL·직렬화·외부 호출·캐시 적중 시간으로 계측해 원인을 확인한다.

입찰체크에서 수행한 단회 확인(2026-10-13, 키워드 '유지관리')은 2024년부터의
`latest_only` 공고 검색 7.49초, 최근 90일 `all` 공고 검색 0.95초였다. 서로 다른 조회
범위·차수 조건의 관측값이며 전체 성능이나 P95를 보장하는 벤치마크가 아니다.

### 1. 공고 검색

```http
POST /v1/capabilities/search_bid_notices:execute
```

```json
{
  "inputs": {
    "notice_published_at_from": "2026-08-01T00:00:00+09:00",
    "notice_published_at_to": "2026-08-13T23:59:59+09:00",
    "query": "정보시스템 운영",
    "work_type": "service",
    "bid_statuses": ["scheduled", "open", "unknown"],
    "notice_status": "active",
    "bid_deadline_at_from": "2026-08-14T00:00:00+09:00",
    "bid_deadline_at_to": "2026-08-31T23:59:59+09:00",
    "contract_method_name": "제한경쟁",
    "estimated_price_min": 100000000,
    "estimated_price_max": 500000000,
    "sort": "deadline_asc",
    "page": 1,
    "page_size": 20
  },
  "options": {
    "max_objects": 200,
    "include_property_provenance": false
  }
}
```

게시기간은 필수이고 나머지 검색 조건은 선택이다. `query`는 공고명·공고번호·공고기관명·수요기관명을
부분 일치로 검색한다. `work_type`에는 `goods`, `service`, `construction`, `foreign`, `other` 중
하나를 지정할 수 있다. `sort`는 게시일 최신순인 `published_desc`가 기본이고 마감 임박순은
`deadline_asc`이다. 마감일이 없는 공고는 마감 임박순의 마지막에 배치된다.

`page`는 1부터 시작하고 기본값은 1이다. `page_size`는 기본 20, 최대 100이다. 응답의
`pagination.total_items`와 `pagination.total_pages`는 연결된 기관 객체가 아닌 고유한
`bid_notice` 수를 기준으로 한다. 검색 결과가 없으면 `total_items`와 `total_pages`는 모두 0이다.
각 정렬은 `bid_notice_id`를 최종 tie-breaker로 사용한다.

공고 상태 표시는 Teoria의 `current_status`를 그대로 사용한다. 값은 `scheduled`,
`open`, `closed`, `awarded`, `contracted`, `failed`, `cancelled` 중 하나다. 기존
`bid_status`는 입찰 일정 상태, `notice_status`는 공고 원문의 활성·취소 상태이므로 화면용
진행 단계로 다시 해석하지 않는다. `failed`와 `cancelled`는 각각 유찰과 취소로 구분해
표시하고, 제공된 경우 `failure_reason` 또는 `cancellation_reason`을 함께 보여준다.

```json
{
  "pagination": {
    "page": 1,
    "page_size": 20,
    "total_items": 1284,
    "total_pages": 65
  },
  "truncated": false
}
```

뒤에 페이지가 남아 있다는 이유로 `truncated`가 참이 되지는 않는다. 페이지 검색에서는 현재
페이지의 공고와 연결 객체를 모두 반환하며, 이들이 실제 서버 제한으로 누락된 경우에만
`truncated=true`이다. 페이지 번호 방식은 숫자형 탐색을 위한 계약이므로 검색 도중 신규 공고가
추가되면 페이지 경계가 이동할 수 있다.

### 2. 공고와 참가요건 확인

공고 식별자는 `공고번호:공고차수` 형식이다. 예: `R25BK00934251:000`.

```http
POST /v1/capabilities/get_bid_notice:execute
```

```json
{
  "inputs": {
    "notice_number": "R25BK00934251",
    "notice_order": "000"
  }
}
```

공고 객체에는 공고명, 업무유형, 게시·마감·개찰 시각, 기관, 입찰·계약 방식, 추정가격, 배정예산, 원문 URL와 함께 다음 요건 추출 상태가 포함될 수 있다.

- `requirement_expression`: `all`, `any`, `not`, `leaf`로 구성된 참가요건 조건식
- `extraction_completeness`: 첨부문서 기반 요건 추출 완전성
- `requires_review`: 사람의 원문 검토가 필요한지 여부

개별 요건과 문서 근거가 필요하면 다음 Capability를 호출한다.

```http
POST /v1/capabilities/get_bid_requirements:execute
```

```json
{
  "inputs": {
    "notice_number": "R25BK00934251",
    "notice_order": "000"
  },
  "options": {
    "max_objects": 500,
    "include_property_provenance": true
  }
}
```

입찰체크는 `bid_requirement_set`을 요청 공고의 `bid_notice_id`로 선택한다.
해당 필드가 없으면 명시된 `notice_number`·`notice_order` 쌍을 사용한다. 여러 집합 중
첫 번째를 선택하지 않으며, 집합 객체가 있는데 요청 공고에 속한 집합을 정확히
하나 식별할 수 없으면 HTTP 502 (`requirement_set_mismatch`)로 처리한다.
최신 공고 링크는 명시된 `latest_bid_notice_id` 또는 현재 공고가 최신이라는
`is_latest_in_lineage=true`에 근거한다. 이력 배열 위치로 최신 공고를 추정하지 않는다.

`bid_requirement` 객체는 요건 유형·연산자·요구값, 원문, 적용 주체, 기준일, 필수 여부, 추출 신뢰도, 표준 판정 규칙 및 문서 근거를 제공한다. 화면에서는 정규화된 판정 결과와 함께 `original_text`, `proposition_text`, `evidence_summary`를 사용자가 확인할 수 있게 표시하는 것을 권장한다.

### 3. 회사의 종합 입찰 적격성 평가

대부분의 입찰체크 화면은 여러 조회 API를 직접 조합하지 않고 다음 단일 Capability를 사용하면 된다.

```http
POST /v1/capabilities/assess_company_bid_eligibility:execute
```

```json
{
  "inputs": {
    "business_registration_number": "1234567890",
    "bid_notice_id": "R25BK00934251:000",
    "reference_date": "2026-08-13",
    "participation_mode": "single"
  },
  "options": {
    "max_objects": 1000,
    "include_property_provenance": true
  }
}
```

`business_registration_number`와 `bid_notice_id`는 필수다. `reference_date`를 생략하면 공고의 입찰마감일을 기준으로 평가한다. `participation_mode`는 단독 또는 공동수급처럼 평가에 적용할 참가방식이며, 서비스가 의미를 확실히 아는 경우에만 전달한다.

평가 응답에서 확인할 핵심 객체는 다음과 같다.

| `type` | 용도 | 핵심 속성 |
|---|---|---|
| `bid_eligibility_assessment` | 전체 결과 | `outcome`, `lifecycle_status`, `satisfied_count`, `unsatisfied_count`, `needs_review_count`, 버전·지문 |
| `requirement_assessment` | 요건별 결과 | `outcome`, `reason_code`, 요구값, 평가값, 판단 요약 |
| `evidence` | 판단 근거 | 원천, 관찰값, 문서 페이지·조항·발췌, 유효기간, 관찰시각 |

`outcome`은 3값으로 처리해야 한다.

| 값 | 서비스 표시 예 | 의미 |
|---|---|---|
| `satisfied` | 충족 | 현재 근거로 요건 충족 |
| `unsatisfied` | 미충족 | 현재 근거로 요건 불충족 |
| `needs_review` | 확인 필요 | 근거 부족, 지원하지 않는 규칙, 모호성 또는 원문 검토 필요 |

`needs_review`를 `unsatisfied`로 간주하거나 “입찰 불가”로 단정하면 안 된다. 최종 법적 판단이 아니라 공식 데이터와 추출된 공고요건을 바탕으로 한 의사결정 지원 결과로 표시한다.

### 요건별 평가와 근거 연결

평가 객체의 전송 필드는 Teoria의
`platform/registries/domains/assessment/runtime_contract.yaml`을 기준으로 한다.

- `requirement_assessment`의 `required_value_text`, `evaluated_value_text`,
  `reasoning_summary`를 요구값·회사 확인값·판단 요약으로 표시한다.
- `links.type=requirement_assessment_supported_by_evidence`의 `source`는 요건 평가
  객체 ID, `target`은 `evidence` 객체 ID다. 입찰체크 adapter는 이 관계로만
  `requirement_assessments[].evidence_ids`를 구성한다. 배열 순서나 근거 속성의
  유사성으로 요건에 연결하지 않는다.
- 근거는 `evidence_kind`, `source_id`, `source_operation_id`, `document_id`,
  `page_number`, `section`, `clause`, `excerpt`, `observed_value_text`,
  `observed_at`, `valid_from`, `valid_until`을 제공할 수 있다.
- `observed_at`이 있으면 이 관찰시각을 우선한다. 없으면 `kind=source`인 provenance의
  관찰시각을 `observed_at_values`로 전달한다. 평가 실행시각을 원천 관찰시각으로
  대체하지 않는다. 누락된 기준일·유효기간은 확인 필요로 표시한다.
- 상세 평가 응답은 전체 평가 객체가 정확히 하나이며 요청 공고 ID·사업자등록번호와
  일치해야 한다. 각 요건 평가의 `assessment_id`는 전체 평가의 Runtime 객체 ID와,
  사업자등록번호는 요청 회사와 일치해야 한다. 전체 평가 속성의 `assessment_id`
  지문과 Runtime 객체 ID를 혼동하지 않는다. 소속 관계 링크가 제공되면 속성과도
  일치해야 한다. 누락·중복·소속 불일치 또는 `truncated=true` 응답은
  HTTP 502 (`assessment_response_mismatch`)로 처리한다.
- 검증된 요건 평가에 그래프 링크로 연결된 근거만 반환한다. 소속을 확인할 수 없는
  미연결 근거는 제외하며 원천의 판정값을 임의로 변경하지 않는다.
- 화면은 전체 참가요건을 개수 제한 없이 펼쳐 볼 수 있게 제공한다. 같은 업종코드의
  서로 다른 조건도 보존하며 조건식을 모두 충족·하나 이상 충족·부정 조건으로
  구분한다. 조건식 누락이나 알 수 없는 참조는 확인 필요로 표시한다.
- 전체 결과의 `reference_date`, `ruleset_version`, `registry_version`,
  `requirement_set_hash`, `evidence_fingerprint`와 개별 결과의 `evaluator_version`,
  `evaluated_at`을 함께 확인할 수 있어야 한다.

### 3.1 목록용 일괄 평가

공고 목록에서는 현재 페이지의 공고 ID를 한 번에 평가한다.

```http
POST /v1/capabilities/assess_company_bid_eligibilities:execute
```

```json
{
  "inputs": {
    "business_registration_number": "1234567890",
    "bid_notice_ids": ["R26BK01725727:000", "R26BK01726356:000"],
    "participation_mode": "single"
  },
  "options": {"max_objects": 100}
}
```

`outcome.items`는 공고별 `status`, `outcome`, 세 가지 결과 개수와 최대 2개의 `issues`를 반환한다. `status=error`인 항목은 `error_code`에 따라 요건 추출 전, 공고 확인 필요 또는 평가 오류로 표시한다. 상세 근거가 필요한 경우에만 단일 공고 평가 Capability를 호출한다.

입찰체크 내부 일괄 평가 API는 요청 공고마다 정확히 한 결과가 있는지 검증한다.
요청 밖 공고, 중복·누락, 알 수 없는 `status`·`outcome`, 음수·문자열·boolean 개수,
잘못된 주요요건·이슈 형식은 HTTP 502 (`assessment_response_mismatch`)로 처리한다.
`status=error` 항목도 요청 공고 결과로 보존하며 `error_code`를 필수로 요구한다.
응답에 사업자등록번호가 포함된 경우 요청 회사와 대조하지만, 해당 필드가 없는
요약 계약에서는 회사 소속까지 검증했다고 간주하지 않는다. 반환 순서는 중복을
제거한 요청 공고 순서로 정규화한다. AND·OR 조건이 있으므로 개별 판정 개수만으로
종합 판정값을 다시 계산하지 않는다.

상세 평가의 실행 상태는 `completed`(평가 완료), `review_required`(추가 검토 필요),
`failed`(평가 실행 실패)다. 실행 실패·누락·알 수 없는 상태에서는 화면의 종합 판정을
확인 필요로 표시하고 요건별 판정과 개수를 숨긴다. 검토 필요 상태에서는 원천의
세 가지 판정값을 그대로 표시한다. 화면의 조회 시각은 마지막 성공 응답을 받은
시각으로, 평가 기준일이나 원천 관찰시각을 뜻하지 않는다. 목록·상세에서 수동
재평가를 지원하고 상세 갱신 중에는 이전 조회 결과임을 명시한다.

## 공통 응답 형태

```json
{
  "status": "success",
  "capability": "assess_company_bid_eligibility",
  "objects": [
    {
      "ontology": "assessment",
      "type": "bid_eligibility_assessment",
      "id": "...",
      "properties": {},
      "provenance": [],
      "property_provenance": {}
    }
  ],
  "links": [],
  "total_objects": 1,
  "total_links": 0,
  "truncated": false,
  "registry": {
    "status": "published",
    "version": "..."
  }
}
```

객체 배열의 순서에 의존하지 말고 `ontology`, `type`, `id`로 분류한다. `links`는 객체 사이의 관계를 나타낸다. 감사·이의제기 대응이 필요하면 `include_property_provenance: true`를 사용하고 평가의 버전·지문 및 Registry 버전을 결과와 함께 보관한다. `objects`가 잘리면 근거나 요건별 결과가 누락될 수 있으므로 적격성 평가에서는 충분히 큰 `max_objects`를 지정하고 반드시 `truncated`를 검사한다.

## 입찰체크 내부 API의 평가·부분 응답

- 회사 기준 평가는 `/api/v1/assessments`와 `/api/v1/assessments/batch`로만 제공한다.
  로컬 지역·면허 판정용 `/api/v1/checks`는 제거했으며 해당 경로는 404를 반환한다.
- 계약 응답의 공고 ID는 확인된 공고번호와 차수 또는 원천의 `bid_notice_id`를 사용한다.
  차수가 없으면 연결 ID를 비워 두며 `000`으로 추정하지 않는다. 금액·입찰률의 0은 유지한다.
- 공고 activity 응답은 원천 `contract_pagination`, `truncated`, `relationship_context`를
  포함한다. 상세 화면은 이 관계 데이터를 재사용하며 일부 결과를 전체 이력으로 표시하지 않는다.
- 잘린 참가요건·참가 유의사항·평가 응답은 `teoria_truncated` 오류로 처리한다.
  연결 실패와 잘못된 응답은 각각 `teoria_connection_error`, `teoria_invalid_response`로
  변환하고 내부 예외 및 원문 업스트림 오류 메시지를 사용자에게 전달하지 않는다.

## 오류 처리

| HTTP | 대표 코드 | 처리 |
|---:|---|---|
| 401 | `unauthorized` | token 설정 확인. 사용자에게 원문 token을 노출하지 않음 |
| 404 | `unknown_capability`, `bid_notice_not_found` | Capability discovery 또는 공고번호·차수 확인 |
| 409 | `bid_requirements_not_found` | 요건 추출이 아직 없음을 표시하고 원문 검토 경로 제공 |
| 422 | `invalid_capability_input`, `invalid_bid_notice_id` | 입력 스키마·`공고번호:차수` 형식 확인 |
| 502 | Source/실행 오류 | 일시 오류로 분류하되 상세 오류에 따라 운영 알림 |
| 504 | `capability_timeout` | 제한된 횟수로 지수 backoff 재시도 |

외부 기관 API 조회를 포함한 평가는 일반 조회보다 오래 걸릴 수 있다.
시간 제한은 다음 순서로 설정한다.

| 계층 | 기본 시간 제한 | 적용 범위 |
|---|---:|---|
| Teoria 호출 | 125초 | 연결·조회·최대 1회 재시도·대기 시간을 합산한 단일 Capability |
| 입찰체크 API | 130초 | 여러 Capability 호출과 응답 조합을 포함한 전체 HTTP 요청 |
| Nginx | 135초 | 프록시 송신·응답 읽기의 무응답 구간 |
| 브라우저 | 140초 | 응답 본문 읽기까지 포함한 전체 요청 |

`TEORIA_TIMEOUT_SECONDS`와 `API_TIMEOUT_SECONDS`는 각각 125초·130초 이하의
양수로 설정한다. 상한을 늘릴 때는 Nginx와 브라우저 시간 제한을 함께 조정해야 한다.
502·504 또는 HTTPX timeout의 재시도는 Teoria 경계에서 최대 1회만 수행하며
동일 입력을 유지한다. 전체 호출의 deadline이 지나면 재시도와 조회를 취소한다.
프론트엔드와 프록시는 자동 재시도하지 않으며 화면에서 사용자가 재시도할 수 있다.
브라우저의 회사·기관 전환에 따른 요청 취소는 timeout 오류로 변환하지 않는다.

## 업체 정보 조회

입찰체크 서비스는 적격성 평가와 별도로 업체 상세 화면을 구성할 수 있다. 대부분의 조달정보는 사업자등록번호 10자리로 조회하며, 법인 기본·재무정보는 법인등록번호가 필요하다.

### 조달업체 종합 프로필

나라장터 등록업체 기본정보, 등록업종, 등록 공급물품 및 부정당제재를 한 번에 조회한다.

```http
POST /v1/capabilities/get_company_procurement_profile:execute
```

```json
{
  "inputs": {
    "business_registration_number": "1234567890"
  },
  "options": {
    "max_objects": 500,
    "include_property_provenance": true
  }
}
```

응답은 다음 객체와 이들의 관계를 포함할 수 있다.

| `type` | 내용 |
|---|---|
| `business_registration` | 조회 대상 사업자 식별정보 |
| `procurement_supplier` | 나라장터 조달업체 기본정보 |
| `registered_industry` | 나라장터 등록업종 |
| `registered_supply_product` | 나라장터 등록 공급물품 |
| `procurement_sanction` | 부정당제재 정보 |
| `public_organization` | 제재 처분 기관 |

이 Capability는 조달청 공식 API를 호출하므로 운영 Runtime에 해당 Source 인증정보가 설정되어 있어야 한다.

### 입찰 자격 프로필

특정 기준일에 유효한 여성기업·장애인기업 자격과 세부품명별 직접생산확인을 함께 조회한다.

```http
POST /v1/capabilities/get_company_bid_qualification_profile:execute
```

```json
{
  "inputs": {
    "business_registration_number": "1234567890",
    "reference_date": "2026-08-13"
  },
  "options": {
    "max_objects": 500,
    "include_property_provenance": true
  }
}
```

`reference_date`는 필수다. 응답의 `qualification`과 `direct_production_confirmation` 객체에서 상태와 유효기간을 확인한다. 입찰공고 평가 기준일과 동일한 날짜를 전달해야 화면의 업체 프로필과 평가 결과가 일치한다.

### 사업자 상태

국세청 기준의 현재 영업상태와 과세유형을 여러 사업자번호에 대해 한 번에 조회할 수 있다.

```http
POST /v1/capabilities/get_business_registration_status:execute
```

```json
{
  "inputs": {
    "business_registration_numbers": ["1234567890", "0987654321"]
  }
}
```

응답의 `taxpayer_status_observation` 객체에서 사업자 상태, 과세유형 및 관찰시각을 확인한다. 이 API는 사업자등록 진위확인과 다르다. 현재 입찰체크 Runtime 계약은 상호·대표자명·개업일자를 이용한 별도 진위확인 Capability를 공개하지 않는다.

### 혁신기업 인증 확인

다음 Capability는 모두 사업자등록번호 하나를 입력으로 받는다.

| Capability | 확인 내용 | 대표 결과 위치 |
|---|---|---|
| `verify_venture_company` | 현재 벤처기업 공시 여부 | 응답 최상위 `outcome` 및 `venture_company_disclosure` |
| `verify_innobiz_company` | 현재 이노비즈 인증 여부 | 응답 최상위 `outcome` 및 `innovation_certification_observation` |
| `verify_mainbiz_company` | 현재 메인비즈 인증 여부 | 응답 최상위 `outcome` 및 `innovation_certification_observation` |

```json
{
  "inputs": {
    "business_registration_number": "1234567890",
    "sort": "contract_desc",
    "page": 1,
    "page_size": 20
  }
}
```

`outcome`은 각 Capability가 정의한 현재 공시·인증 상태다. 객체가 없다는 사실만으로 상태를 추론하지 말고 `outcome`과 호출 성공 여부를 함께 확인한다.

### 공공조달 계약 이력

수집·정규화된 Teoria Data DB에서 업체가 참여한 공공조달 계약, 업체 역할, 공동도급 방식 및 지분율을 조회한다.

```http
POST /v1/capabilities/get_company_public_procurement_contracts:execute
```

```json
{
  "inputs": {
    "business_registration_number": "1234567890"
  },
  "options": {
    "max_objects": 1000
  }
}
```

이 조회는 `contract_participation`과 `contract` 객체를 반환한다. 페이지 집계 기준은 고유
`unified_contract_number`이며 기본 20건, 최대 100건이다. 응답의 `pagination`은 업체가 참여한
고유 계약 수를 나타낸다. 현재 계약업체 Source에는 계약일과 계약유형이 없으므로 이 Capability의
정렬은 계약번호 내림차순만 지원한다. 기간·유형 검색은 계약정보를 결합한 Runtime View를 추가한
뒤 확장해야 한다.

전체 공공조달 계약 검색은 `search_public_procurement_contracts`를 사용한다. 계약체결일 범위는
필수이며 계약명·계약번호·계약기관코드 자유어, 계약유형, 계약방법, 총계약금액 범위를 선택할 수
있다. 정렬은 `concluded_desc` 또는 `amount_desc`이고, 페이지 집계 기준은 고유 계약번호다.

```http
POST /v1/capabilities/search_public_procurement_contracts:execute
```

```json
{
  "inputs": {
    "concluded_date_from": "2026-01-01",
    "concluded_date_to": "2026-08-13",
    "query": "정보시스템",
    "contract_type": "service",
    "contract_method_name": "제한경쟁",
    "total_amount_min": 100000000,
    "total_amount_max": 500000000,
    "sort": "concluded_desc",
    "page": 1,
    "page_size": 20
  }
}
```

### 법인 기본정보와 재무정보

법인등록번호를 확보한 경우 다음 Capability를 사용할 수 있다.

| Capability | 필수 입력 | 내용 |
|---|---|---|
| `get_company_profile` | `corporate_registration_number` | 법인 기본정보, 주소, 연결된 사업자등록번호 |
| `get_company_financials` | `corporate_registration_number`, `fiscal_year` | 요약재무정보, 재무상태표, 손익계산서 |

사업자등록번호만 가지고 법인 기본·재무정보를 바로 조회할 수 있다고 가정하면 안 된다. 법인등록번호가 없으면 조달 프로필과 사업자 상태 등 사업자번호 기반 기능만 제공한다.

### 세부 조회 Capability

종합 프로필 전체가 필요하지 않은 화면이나 운영 진단에는 다음 API를 선택적으로 사용할 수 있다.

- `get_company_qualifications`: 기준일의 여성기업·장애인기업 자격
- `get_procurement_supplier`: 나라장터 조달업체 기본정보
- `get_procurement_supplier_industries`: 등록업종
- `get_procurement_supplier_products`: 등록 공급물품
- `get_procurement_supplier_sanctions`: 부정당제재
- `get_direct_production_confirmations`: 직접생산확인

정확한 입력과 현재 제공 여부는 배포된 서버의 `GET /v1/capabilities`가 반환하는 `input_schema`를 최종 기준으로 한다.

### 조회 결과 해석

다음 상태를 서로 구분해야 한다.

- 호출 성공 + 관련 객체 없음: 공식 원천에서 조건에 맞는 정보가 조회되지 않음
- Capability의 `outcome`이 미등록·미인증 상태: 정상적으로 확인된 부정 결과
- 502 또는 504: 제공기관 오류, 인증정보 문제 또는 timeout으로 확인하지 못함
- `truncated: true`: 조회에는 성공했지만 응답 객체 일부가 제한됨

업체 상세 화면은 “정보 없음”, “해당 없음”, “조회 실패”, “일부만 표시”를 같은 상태로 표현하지 않는다. 각 객체의 `provenance.observed_at` 또는 속성별 provenance도 함께 이용해 정보 기준시점을 표시한다.

## 보안 및 데이터 취급

- Runtime token은 서버 측 secret으로만 보관하고 브라우저·모바일 앱에 배포하지 않는다.
- 사업자번호와 평가 결과는 서비스의 개인정보·기업정보 보존정책에 따라 최소한으로 저장한다.
- 제공기관 API key와 Data DB 접속정보는 입찰체크 서비스에 전달하지 않는다.
- 응답 provenance에는 추적 가능한 원천 정보가 포함될 수 있으므로 일반 사용자용 응답과 운영 감사 로그의 노출 범위를 분리한다.
- 공고 첨부 원문과 추출 결과에는 별도의 보존기간이 적용될 수 있으므로 영구 조회를 전제로 하지 않는다.

## 현재 계약의 제약

- 검색은 게시기간을 필수로 하며 지역·업종과 cursor 페이지네이션은 현재 공개 Capability 입력에 없다.
  숫자형 페이지 탐색은 지원하지만 변경이 잦은 결과 집합의 안정적인 전체 순회는 별도 cursor 계약이 필요하다.
- 공고요건은 최신 `completed` 추출본을 사용한다. 첨부문서가 아직 처리되지 않았거나 추출이 불완전하면 평가가 `needs_review`가 될 수 있다.
- 모든 자연어 요건에 표준 판정 규칙이 연결되어 있지는 않다. 지원하지 않는 규칙은 자동 추측하지 않고 확인 필요로 남긴다.
- Runtime API token은 현재 단일 Bearer token 계약이며 사용자별 권한·quota 계약은 별도로 정의되어 있지 않다. 외부 공개 서비스에서는 API gateway에서 rate limit, token rotation 및 접근 로그를 추가해야 한다.

## 인수 체크리스트

- 운영 URL과 token을 비밀 채널로 수령했다.
- `/health`, `/v1/version`, `/v1/capabilities` 호출에 성공했다.
- discovery의 Registry 버전과 필수 Capability 존재 여부를 배포 시 검사한다.
- 검색 응답의 `truncated`를 처리한다.
- 평가 결과의 3값과 `needs_review` UX를 구현했다.
- 요건 원문, 판단 요약 및 근거를 함께 표시할 수 있다.
- 401, 404, 409, 422, 502, 504를 구분한다.
- token과 사업자정보가 로그에 평문으로 남지 않는다.
- 평가 결과와 함께 기준일, 참가방식, Registry·ruleset·evaluator 버전 또는 지문을 보관한다.

## 분석 첫 화면의 Runtime 조합

`/api/v1/home/relationships?period_years=3`는 `search_bid_awards`에서 최근 90일
낙찰 최대 100건을 조회하고 확인된 기관 기본 12곳(organization_limit, 최대 24곳)의 `analyze_organization_procurement_profile`
관계 통계를 사용한다. 성공한 기관의 `search_organization_supplier_entries`를 별도로
호출해 종료 연도 `entry_status=first_observed` 관계를 최대 3곳씩 조회한다.
`items`는 기간 전체 주요 관계, `new_relationships`는 종료 연도 신규 관측 관계다.
`organizations`에는 기관별 관계 최대 30개와 Runtime의 `company_structure`,
`data_completeness`, `truncated`를 그대로 전달한다. 전체 귀속 금액과 비중 계산 가능 여부가
확인되는 경우에만 미표시 업체 잔여 금액을 집계 총액에서 제외해 기타로 표시한다.
그 외에는 확인된 업체 금액만 비교하고 전체 비중을 표시하지 않는다.
`include_profiles=false`는 기관 후보 목록만 빠르게 반환한다. 첫 화면은 이 목록을 사용하고
현재 기관만 기존 `/organizations/{code}/procurement-profile`과 `supplier-entries`로 조회한다.
기관 분석은 자동 재생 없는 캐러셀로 한 기관씩 탐색하고 이전·다음 버튼과 스와이프를 제공한다.
신규 관계의 건수·금액은 `target_year_contract_count`·`target_year_attributed_contract_amount`다.

응답 `analysis_basis`에는 조회 연도·업무유형·탐색 낙찰 수·성공한 기관 수·조회 제한을
제공한다. `partial`, `truncated`, `failed_organization_count`,
`failed_new_relationship_count`로 누락 및 각 조회 실패를 보존한다. 주요 기관 조회가
모두 실패하면 `relationship_unavailable` 오류로 처리한다. 부분 여부를 보존한 목록 스냅샷을 최대 15분 캐시한다. 서버 시작 시 준비하고
이후 백그라운드에서 5분 주기로 갱신한다. 전체 실패는 캐시하지 않으며 갱신 실패 시
유효한 이전 스냅샷을 유지한다. `snapshot_updated_at`은 목록 갱신 시각이다.

`/api/v1/home/company-sectors`는 직전 완료 연도의 물품·용역·공사 계약을
`search_public_procurement_contracts`의 `sort=amount_desc`, 유형별 최대 100건으로
탐색한다. 현재 계약금액으로 정렬한 후보에서 공식 분야 최대 2개를 선택한다.
물품 계약에 공식 분류가 없으면 후보 계약업체 최대 6곳의
`analyze_company_procurement_profile.field_distribution`을 사용한다. 분야별로
최대 3개 후보 업체의 프로필을 같은 연도·업무유형·분야 조건으로 다시 조회한다.

업체 금액·건수·거래기관 수는 해당 조건의 Runtime `summary`를 그대로 사용한다.
지분율은 후보 선정에만 사용하며 계약금액을 재계산하지 않는다. 분야별 총시장규모나
전체 업체 순위 API는 제공되지 않으므로 탐색 표본을 전체 시장 순위로 표시하지 않는다.
유형별·분야별 `status`와 `partial`로 실패·누락을 구분하고, 전체 유형 실패는
`company_sectors_unavailable` 오류로 처리한다. 부분 여부를 보존한 목록 스냅샷을 최대 15분 캐시하고 백그라운드에서 주기적으로
갱신한다. 전체 실패는 캐시하지 않는다.


## 계약 실적 업체 검색

`GET /api/v1/companies/contract-discovery?q=정보시스템&period_years=3`는
`search_public_procurement_contracts`에 검색어와 현재 연도를 포함한 연도 범위를 전달한다.
`sort=amount_desc`, 첫 페이지 최대 100건에서 업체 식별자가 확인된 계약업체를 추출한다.
지역 필터나 전체 시장 순위는 제공하지 않는다. 업체별 계약 근거와 표본 내 계약 건수를
반환하며 동일 계약번호와 동일 업체의 반복 출현은 후보 내에서 중복 제거한다.

대표 계약금액은 원천의 계약 전체 금액이다. 공동수급 지분으로 업체 금액을 재계산하지 않는다.
검색어별 업체 귀속 금액 합계는 제공하지 않으며 기간 전체 프로필과 범위를 구분한다.
`partial`, `sampled_contract_count`, `matched_contract_count`, `unidentified_contract_count`와
`analysis_basis`로 잘림·표본 제한·식별 누락·조회 조건을 보존한다. 페이지 전체 건수를
확인하지 못한 경우도 부분 결과다. 검색어를 공식 분야 분류로 자동 변환하지 않는다.

## 조회 지연과 분석 캐시

기관·업체 프로필, 관계 분석, 참여 이력 등 읽기 전용 분석은 Capability·입력·응답 옵션이
같은 요청을 서버에서 함께 실행하고 최대 5분 재사용한다. 부분 데이터 상태도 보존해 재사용하며, 잘린
Runtime 응답은 상태를 보존해 최대 1분만 재사용한다. 예외와 참가자격 평가는 캐시하지
않는다. 소비자가 응답을 변경해도 다른 요청의 캐시가 바뀌지 않도록 복사본을 반환한다.

첫 화면 목록 스냅샷은 요청마다 모든 분석을 다시 계산하지 않는다. 시작 시 비동기로
준비하며 갱신 중에도 유효한 이전 스냅샷을 반환한다. 전체 실패는 기존 스냅샷을 덮어쓰지
않고 유효기간 이후에는 다시 조회한다. 목록 갱신 시각은 원천 관찰 시각이나 평가 기준일과
구분한다. 캐시는 프로세스 메모리 기반이며 재시작 직후 아직 준비되지 않은 조회와 처음
선택하는 상세 조건은 Teoria 응답을 기다릴 수 있다.

프론트는 업체 자격·기업 정보를 업체 정보 탭에서, 기관 신규 업체 전체 목록을 신규 업체
필터를 선택했을 때 조회한다. 기관 업체 탭에서는 공고 활동 요청을 시작하지 않는다.

첫 화면의 후보 기관 프로필은 상세와 같은 30개 관계를 조회한 뒤 첫 화면에서는 최대
30개 관계를 보존한다. 가상 데이터 샘플 화면은 제거했다. 후보 업체 프로필도 상세와 같은 20개 거래기관 범위를 조회한다.
명시적 시작·종료 연도가 같으면 `period_years`의 기본값 차이는 캐시 키에서 제외하되
실제 Runtime 입력은 그대로 전달한다. 따라서 첫 화면에서 상세로 이동할 때 같은 연도·
분야의 분석 결과를 재사용할 수 있다.
