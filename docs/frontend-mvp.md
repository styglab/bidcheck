# BidCheck Frontend MVP

## 1. 제품 정의

BidCheck(입찰체크)는 공공입찰 공고와 첨부문서에 흩어진 참가요건을 구조화해 보여주고, 선택한 업체의 정보와 비교해 각 요건을 검토하는 서비스다.

핵심 UX는 다음 두 상태로 정의한다.

- 업체 미선택: `공고 → 참가요건 확인`
- 업체 선택: `공고 × 업체 → 참가요건 검토`

별도의 입찰체크 화면을 만들지 않는다. 동일한 공고 화면에 업체 Context가 적용되면 Requirement 표시가 Assessment 표시로 확장된다.

## 2. 도메인과 화면 원칙

서비스의 중심(primary entity)은 `ProcurementNotice`다. `Company`는 공고의 참가요건을 검토하기 위한 선택적 Context다.

```text
ProcurementNotice
  └─ Requirement
       └─ Company 적용 → Assessment
```

공개 영역은 Sidebar 없이 Top Navigation을 사용한다. 공고 찾기를 가장 중요한 기능으로 취급하며 업체 조회는 보조 기능으로 둔다.

## 3. 공개 범위와 로그인 범위

로그인은 서비스 이용 조건이 아니라 결과를 저장하고 지속적으로 관리하기 위한 기능이다.

### 비로그인 가능

- 공고 검색·목록·상세
- 참가요건 조회
- 업체 검색·선택·변경·해제
- 공고 × 업체 기본 검토
- 판정 근거 확인
- 의견 보내기

### 로그인 필요

- 내 회사와 기본 검토 업체 저장
- 검토 결과와 이력 저장
- 인증·자격 관리
- 서류 업로드와 유효기간 관리
- 관심 공고 저장

## 4. Global Company Context

`currentCompany`는 선택 사항이며 Header, 랜딩, 공고 목록, 공고 상세에 동일하게 적용한다.

```ts
type CompanyContext = {
  currentCompany: CompanySummary | null
  selectCompany(company: CompanySummary): void
  clearCompany(): void
}
```

비로그인 사용자의 선택은 브라우저 localStorage에 유지한다. 업체 선택은 페이지 이동을 발생시키지 않는다.

## 5. 주요 경로

| 경로 | 역할 |
| --- | --- |
| `/` | 랜딩과 실제 서비스 진입점 |
| `/notices` | 공고 검색 및 Quick Assessment |
| `/notices/{id}` | 참가요건 및 Full Assessment |
| `/companies` | 검색 중심 업체 조회 |
| `/companies/{id}` | 업체 기본·조달·자격·실적 정보 |

로그인 후 관리 기능은 후속 단계에서 `/account/*` 아래에 둔다.

## 6. 랜딩 페이지

순서는 `Header → Hero → 공고 검색 → 진행 중 공고 → 기능 설명 → 이용 방법 → CTA → Footer`다. Hero가 첫 화면을 독점하지 않도록 검색 영역이 첫 viewport 또는 바로 다음에 보이게 한다.

Hero는 서비스 가치와 실제 Assessment 미리보기를 함께 보여준다. 공고 검색은 업체를 선택하지 않아도 사용할 수 있다. 업체를 선택하면 같은 공고 카드가 요건 중심 표시에서 Quick Assessment 중심 표시로 전환된다.

## 7. 공고 목록

목록에서는 구조화가 확실하고 빠르게 비교할 수 있는 지역제한, 업종코드, 기업규모, 나라장터 등록, 직접생산, 명시적 기업자격만 Quick Assessment한다.

표현은 다음 세 가지를 사용한다.

- 주요요건 충족
- 명확한 미충족 있음
- 상세검토 필요

`참여 가능/불가`처럼 최종 결론으로 오해할 표현은 사용하지 않는다.

## 8. 공고 상세

기본 탭은 참가요건이다. 탭은 `참가요건`, `제출서류`, `공고정보`, `첨부문서`를 사용한다.

업체가 없으면 Requirement와 공고 근거만 표시하며 충족 여부를 표시하지 않는다. 업체가 선택되면 같은 RequirementCard에 업체 증빙, 판정 상태, 판정 이유, 검증 출처를 추가한다.

```tsx
<RequirementCard
  requirement={requirement}
  company={currentCompany}
  assessment={assessment}
/>
```

업체 선택 이후에는 `분석 중`, `분석 완료`, `분석 실패` 상태를 구분한다.

## 9. Assessment 상태와 판정 원칙

사용자에게 보여주는 상태는 세 개만 사용한다.

| 값 | 표시 |
| --- | --- |
| `satisfied` | 충족 |
| `unsatisfied` | 미충족 |
| `needs_review` | 확인 필요 |

임의의 적합도나 AI 점수는 사용하지 않는다. `미충족`은 공식 정보로 반대 증거가 명확할 때만 사용하고, 정보가 없거나 자동 확정할 수 없는 경우에는 `확인 필요`로 분류한다.

내부적으로 확인 필요 사유는 `missing_company_data`, `ambiguous_requirement`, `stale_data`, `external_verification_required`, `unsupported_rule` 등으로 구분할 수 있다.

## 10. 근거와 신뢰

Requirement에는 가능한 경우 `source_document`, `source_page`, `source_clause`를 제공한다. Assessment에는 `company_evidence`, `verification_source`, `verified_at`, `reference_date`를 제공한다.

화면은 다음 흐름이 추적되도록 구성한다.

```text
공고 요구사항 → 회사 상태/증빙 → 판정 → 근거
```

정보 기준일, 마지막 확인일, 자격 유효기간은 서로 다른 의미이므로 구분해 표시한다.

## 11. 공통 컴포넌트

- `CompanySelector`: Header, 랜딩, 공고 목록·상세, 업체 상세에서 재사용
- `NoticeCard`: 업체 선택 여부에 따라 Requirement/Quick Assessment 전환
- `RequirementCard`: 선택적으로 Assessment를 포함
- `AssessmentSummary`: 충족·미충족·확인 필요 집계
- `FeedbackDialog`: 현재 문맥 식별자를 payload에 포함

CompanySelector는 초기, 검색 중, 결과 없음, 실패, 동명 업체, 비정상 사업자, 오래된 정보 상태를 고려한다.

## 12. Feedback

로그인 없이 접근할 수 있다. 유형은 분석 결과 오류, 누락된 참가요건, 업체정보 오류, 기능 제안, 기타를 제공한다. 가능한 경우 `notice_id`, `requirement_id`, `company_id`, `assessment_id`, `current_url`을 자동 포함한다.

## 13. MVP 범위

### 1차 구현

- 랜딩과 공고 검색 진입
- 공고 목록·상세
- 구조화된 Requirement
- 업체 검색·선택 및 localStorage 유지
- Quick/Full Assessment 표시
- 공고·업체 근거 표시
- 비로그인 Feedback

### 후속 구현

- 로그인과 내 회사
- 검토 결과·이력 저장
- 인증·자격 및 서류 관리
- 유효기간 알림
- 관심 공고와 계약·실적 관리

