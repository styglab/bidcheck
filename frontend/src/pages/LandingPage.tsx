import {
  ArrowRight,
  Building2,
  FileText,
  Landmark,
  Network,
  Radar,
  Search,
  Sparkles,
  TrendingUp,
  Trophy,
} from "lucide-react";
import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { PageContainer } from "@/components/layout/page-container";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { useNotices } from "../features/notices/api";
import { useRecentAwards } from "../features/home/api";

const money = (value?: number) =>
  value == null
    ? "금액 미상"
    : value >= 100_000_000
      ? `${(value / 100_000_000).toLocaleString("ko-KR", { maximumFractionDigits: 1 })}억원`
      : `${value.toLocaleString("ko-KR")}원`;

const relationshipSignals = [
  {
    organization: "한국OO공사",
    company: "ABC정보기술",
    signal: "최근 거래 증가",
    detail: "최근 3년 4건 → 6건 → 8건",
    amount: "누적 72억원",
    color: "blue",
  },
  {
    organization: "OO진흥원",
    company: "XYZ테크",
    signal: "신규 관계",
    detail: "올해 신규 계약 6건",
    amount: "누적 28억원",
    color: "violet",
  },
  {
    organization: "OO공단",
    company: "대한시스템",
    signal: "장기 거래",
    detail: "4년 연속 계약",
    amount: "누적 51억원",
    color: "teal",
  },
];

function RelationshipChart() {
  return (
    <div className="mt-5">
      <div className="mb-3 flex items-center justify-between">
        <span className="text-xs font-medium text-muted-foreground">연도별 계약금액</span>
        <span className="text-xs text-emerald-700 dark:text-emerald-300">최근 거래 증가</span>
      </div>
      <svg
        className="h-32 w-full overflow-visible"
        viewBox="0 0 320 128"
        role="img"
        aria-label="2024년 14억원, 2025년 23억원, 2026년 35억원으로 증가한 계약금액"
      >
        <defs>
          <linearGradient id="relationship-area" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0" stopColor="#2563eb" stopOpacity=".28" />
            <stop offset="1" stopColor="#2563eb" stopOpacity="0" />
          </linearGradient>
        </defs>
        <path
          d="M18 101 C70 96, 88 80, 142 73 S225 35, 302 25 L302 112 L18 112 Z"
          fill="url(#relationship-area)"
        />
        <path
          d="M18 101 C70 96, 88 80, 142 73 S225 35, 302 25"
          fill="none"
          stroke="#2563eb"
          strokeWidth="3"
          strokeLinecap="round"
        />
        <g fill="#fff" stroke="#2563eb" strokeWidth="3">
          <circle cx="18" cy="101" r="5" />
          <circle cx="142" cy="73" r="5" />
          <circle cx="302" cy="25" r="5" />
        </g>
        <g fill="currentColor" className="text-muted-foreground" fontSize="10">
          <text x="8" y="126">
            2024
          </text>
          <text x="130" y="126">
            2025
          </text>
          <text x="278" y="126">
            2026
          </text>
        </g>
        <g fill="currentColor" className="text-foreground" fontSize="10" fontWeight="600">
          <text x="7" y="88">
            14억
          </text>
          <text x="130" y="60">
            23억
          </text>
          <text x="278" y="13">
            35억
          </text>
        </g>
      </svg>
    </div>
  );
}

export function LandingPage() {
  const [query, setQuery] = useState("");
  const [target, setTarget] = useState<"notices" | "companies" | "organizations">("notices");
  const navigate = useNavigate();
  const notices = useNotices({ page_size: 5 });
  const awards = useRecentAwards();
  const submit = () => navigate(`/${target}${query.trim() ? `?q=${encodeURIComponent(query.trim())}` : ""}`);
  return (
    <main className="overflow-hidden pb-20">
      <section className="relative border-b bg-gradient-to-b from-blue-50/80 via-background to-background dark:from-blue-950/25">
        <div className="pointer-events-none absolute left-[8%] top-16 size-64 rounded-full bg-violet-200/25 blur-3xl dark:bg-violet-800/10" />
        <div className="pointer-events-none absolute right-[5%] top-28 size-72 rounded-full bg-blue-200/30 blur-3xl dark:bg-blue-800/10" />
        <PageContainer className="relative grid min-h-0 max-w-6xl gap-14 pb-20 pt-16 lg:grid-cols-[1.15fr_.85fr] lg:items-center lg:py-24">
          <div className="home-reveal">
            <p className="inline-flex items-center gap-2 rounded-full border bg-background/80 px-3 py-1.5 text-xs font-semibold text-blue-800 shadow-sm backdrop-blur dark:text-blue-300">
              <Sparkles size={13} />
              공공조달 관계 탐색
            </p>
            <h1 className="mt-6 text-4xl font-bold leading-[1.12] tracking-[-0.04em] sm:text-6xl">
              조달 기록 속
              <br />
              <span className="bg-gradient-to-r from-blue-800 to-violet-700 bg-clip-text text-transparent dark:from-blue-300 dark:to-violet-300">
                관계를 발견하세요.
              </span>
            </h1>
            <p className="mt-6 max-w-xl text-base leading-7 text-muted-foreground sm:text-lg">
              기관과 업체가 언제부터, 얼마나 자주, 어떤 분야에서 거래했는지 연결해 보여드립니다.
            </p>
            <div className="mt-9 rounded-2xl border bg-background/90 p-2 shadow-[0_20px_60px_-28px_rgba(30,64,175,.45)] backdrop-blur">
              <div className="flex gap-1 px-1 pb-2">
                {[
                  ["notices", "공고"],
                  ["companies", "업체"],
                  ["organizations", "기관"],
                ].map(([value, label]) => (
                  <button
                    type="button"
                    key={value}
                    onClick={() => setTarget(value as typeof target)}
                    className={`rounded-lg px-4 py-2 text-sm font-medium transition-all ${target === value ? "bg-blue-800 text-white shadow-sm" : "text-muted-foreground hover:bg-muted"}`}
                  >
                    {label}
                  </button>
                ))}
              </div>
              <form
                className="flex gap-2"
                onSubmit={(event) => {
                  event.preventDefault();
                  submit();
                }}
              >
                <div className="relative flex-1">
                  <Search
                    className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground"
                    size={19}
                  />
                  <Input
                    className="h-12 border-0 bg-muted/50 pl-11 pr-14 shadow-none focus-visible:ring-1"
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    placeholder="공고명, 업체명, 기관명 검색"
                  />
                  <span className="absolute right-3 top-1/2 hidden -translate-y-1/2 rounded border bg-background px-1.5 py-0.5 text-[10px] text-muted-foreground sm:block">
                    Enter
                  </span>
                </div>
                <Button className="h-12 bg-blue-800 px-6 hover:bg-blue-700">검색</Button>
              </form>
            </div>
            <div className="mt-5 flex flex-wrap gap-2">
              <Button variant="outline" className="bg-background/60" asChild>
                <Link to="/notices">
                  <FileText size={15} />
                  공고 찾기
                </Link>
              </Button>
              <Button variant="outline" className="bg-background/60" asChild>
                <Link to="/companies">
                  <Building2 size={15} />
                  업체 찾기
                </Link>
              </Button>
              <Button variant="outline" className="bg-background/60" asChild>
                <Link to="/organizations">
                  <Landmark size={15} />
                  기관 찾기
                </Link>
              </Button>
            </div>
          </div>
          <div className="home-reveal-delayed relative mx-auto w-full max-w-md">
            <div className="absolute -inset-5 rotate-3 rounded-[2rem] border border-blue-200/60 bg-blue-100/30 dark:border-blue-900 dark:bg-blue-950/20" />
            <div className="relative rounded-[1.75rem] border bg-background/95 p-6 shadow-[0_30px_80px_-35px_rgba(15,23,42,.55)] backdrop-blur sm:p-7">
              <div className="flex items-center justify-between">
                <span className="inline-flex items-center gap-2 text-xs font-semibold">
                  <Network size={14} className="text-blue-700" />
                  관계 인텔리전스
                </span>
                <span className="rounded-full bg-amber-50 px-2 py-1 text-[10px] font-medium text-amber-800 dark:bg-amber-950 dark:text-amber-300">
                  샘플 데이터
                </span>
              </div>
              <div className="mt-6">
                <p className="text-xs text-muted-foreground">기관 × 업체</p>
                <h2 className="mt-1 text-xl font-bold">
                  한국OO공사 <span className="font-normal text-muted-foreground">×</span> ABC정보기술
                </h2>
              </div>
              <dl className="mt-5 grid grid-cols-3 gap-2">
                <div className="rounded-xl bg-muted/60 p-3">
                  <dt className="text-[10px] text-muted-foreground">최근 3년 계약</dt>
                  <dd className="mt-1 text-lg font-bold">18건</dd>
                </div>
                <div className="rounded-xl bg-muted/60 p-3">
                  <dt className="text-[10px] text-muted-foreground">누적 계약금액</dt>
                  <dd className="mt-1 text-lg font-bold">72억</dd>
                </div>
                <div className="rounded-xl bg-muted/60 p-3">
                  <dt className="text-[10px] text-muted-foreground">동일 분야</dt>
                  <dd className="mt-1 text-lg font-bold">11건</dd>
                </div>
              </dl>
              <RelationshipChart />
              <div className="mt-4 flex items-center justify-between border-t pt-4">
                <span className="text-xs text-muted-foreground">2023.04 최초 거래 · 2026.09 최근 거래</span>
                <ArrowRight size={15} className="text-blue-700" />
              </div>
            </div>
          </div>
        </PageContainer>
      </section>
      <PageContainer className="min-h-0 max-w-6xl py-16">
        <section>
          <div className="text-center">
            <p className="text-sm font-semibold text-blue-800 dark:text-blue-300">관계 탐색</p>
            <h2 className="mt-2 text-3xl font-bold tracking-tight">무엇을 확인할 수 있나요?</h2>
            <p className="mt-3 text-sm text-muted-foreground">
              단건 조회를 넘어 기관과 업체 사이에 반복되는 관계를 탐색합니다.
            </p>
          </div>
          <div className="mt-8 grid gap-4 md:grid-cols-3">
            <Link
              to="/organizations"
              className="group rounded-2xl border bg-card p-6 transition-all hover:-translate-y-1 hover:border-violet-300 hover:shadow-lg"
            >
              <span className="grid size-11 place-items-center rounded-xl bg-violet-50 text-violet-700 dark:bg-violet-950 dark:text-violet-300">
                <Landmark size={20} />
              </span>
              <h3 className="mt-5 font-bold">기관 관점</h3>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                이 기관은 어떤 업체와 반복해서 계약했을까?
              </p>
              <span className="mt-5 inline-flex items-center gap-1 text-xs font-semibold text-violet-700">
                기관 탐색 <ArrowRight size={13} className="transition-transform group-hover:translate-x-1" />
              </span>
            </Link>
            <Link
              to="/companies"
              className="group rounded-2xl border bg-card p-6 transition-all hover:-translate-y-1 hover:border-teal-300 hover:shadow-lg"
            >
              <span className="grid size-11 place-items-center rounded-xl bg-teal-50 text-teal-700 dark:bg-teal-950 dark:text-teal-300">
                <Building2 size={20} />
              </span>
              <h3 className="mt-5 font-bold">업체 관점</h3>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                이 업체는 어느 기관에서 주로 낙찰받았을까?
              </p>
              <span className="mt-5 inline-flex items-center gap-1 text-xs font-semibold text-teal-700">
                업체 탐색 <ArrowRight size={13} className="transition-transform group-hover:translate-x-1" />
              </span>
            </Link>
            <Link
              to="/notices"
              className="group rounded-2xl border bg-card p-6 transition-all hover:-translate-y-1 hover:border-blue-300 hover:shadow-lg"
            >
              <span className="grid size-11 place-items-center rounded-xl bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300">
                <Radar size={20} />
              </span>
              <h3 className="mt-5 font-bold">공고 관점</h3>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                이 사업의 과거 낙찰·계약업체는 누구일까?
              </p>
              <span className="mt-5 inline-flex items-center gap-1 text-xs font-semibold text-blue-700">
                공고 탐색 <ArrowRight size={13} className="transition-transform group-hover:translate-x-1" />
              </span>
            </Link>
          </div>
        </section>
        <section className="mb-20 mt-20 rounded-3xl border bg-muted/35 p-6 sm:p-9">
          <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
            <div>
              <div className="flex items-center gap-2">
                <p className="text-sm font-semibold text-blue-800 dark:text-blue-300">관계 신호</p>
                <span className="rounded-full border border-amber-300 bg-amber-50 px-2 py-0.5 text-[10px] text-amber-800 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-300">
                  샘플 데이터
                </span>
              </div>
              <h2 className="mt-2 text-3xl font-bold">주목할 조달 관계</h2>
            </div>
            <p className="max-w-sm text-sm leading-6 text-muted-foreground">
              반복·증가·신규 거래처럼 원본 목록에서는 놓치기 쉬운 관계의 변화를 보여줍니다.
            </p>
          </div>
          <div className="mt-8 grid gap-3 lg:grid-cols-3">
            {relationshipSignals.map((item) => (
              <article
                className="rounded-2xl border bg-background p-5 transition-all hover:-translate-y-0.5 hover:shadow-md"
                key={`${item.organization}-${item.company}`}
              >
                <div className="flex items-center justify-between">
                  <TrendingUp
                    size={16}
                    className={
                      item.color === "blue"
                        ? "text-blue-700 dark:text-blue-300"
                        : item.color === "violet"
                          ? "text-violet-700 dark:text-violet-300"
                          : "text-teal-700 dark:text-teal-300"
                    }
                  />
                  <span className="rounded-full bg-muted px-2 py-1 text-[10px] text-muted-foreground">
                    {item.signal}
                  </span>
                </div>
                <h3 className="mt-5 font-semibold">{item.organization}</h3>
                <div className="my-2 h-5 border-l border-dashed" />
                <h3 className="font-semibold">{item.company}</h3>
                <div className="mt-5 flex items-end justify-between border-t pt-4">
                  <span className="text-xs text-muted-foreground">{item.detail}</span>
                  <strong className="text-sm">{item.amount}</strong>
                </div>
              </article>
            ))}
          </div>
        </section>
        <section className="grid gap-12 lg:grid-cols-2">
          <div>
            <div className="flex items-end justify-between">
              <div>
                <p className="text-sm font-semibold text-blue-800 dark:text-blue-300">최근 공고</p>
                <h2 className="mt-2 text-2xl font-bold">새로 등록된 공고</h2>
              </div>
              <Link
                className="inline-flex items-center gap-1 text-sm font-medium text-blue-800 hover:underline dark:text-blue-300"
                to="/notices"
              >
                전체 보기 <ArrowRight size={14} />
              </Link>
            </div>
            {notices.isLoading ? (
              <Skeleton className="mt-6 h-72 rounded-2xl" />
            ) : (
              <div className="mt-6 divide-y overflow-hidden rounded-2xl border bg-card">
                {notices.data?.items.map((item) => (
                  <Link
                    className="group flex items-center gap-4 p-4 transition-colors hover:bg-muted/50"
                    key={item.id}
                    to={`/notices/${encodeURIComponent(item.id)}`}
                  >
                    <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300">
                      <FileText size={16} />
                    </span>
                    <span className="min-w-0 flex-1">
                      <strong className="block truncate text-sm group-hover:text-blue-800 dark:group-hover:text-blue-300">
                        {item.name}
                      </strong>
                      <span className="mt-1 block truncate text-xs text-muted-foreground">
                        {item.organization} · {money(item.allocated_budget)}
                      </span>
                    </span>
                    <ArrowRight className="size-4 -translate-x-1 text-muted-foreground opacity-0 transition-all group-hover:translate-x-0 group-hover:opacity-100" />
                  </Link>
                ))}
              </div>
            )}
          </div>
          <div>
            <div>
              <p className="text-sm font-semibold text-amber-700 dark:text-amber-300">최근 낙찰</p>
              <h2 className="mt-2 text-2xl font-bold">확정된 낙찰 결과</h2>
            </div>
            {awards.isLoading ? (
              <Skeleton className="mt-6 h-72 rounded-2xl" />
            ) : (
              <div className="mt-6 divide-y overflow-hidden rounded-2xl border bg-card">
                {awards.data?.items.map((item) => (
                  <div className="group flex gap-4 p-4 transition-colors hover:bg-muted/50" key={item.id}>
                    <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300">
                      <Trophy size={16} />
                    </span>
                    <div className="min-w-0 flex-1">
                      <Link
                        className="block truncate text-sm font-semibold hover:text-blue-800 hover:underline"
                        to={`/notices/${encodeURIComponent(item.bid_notice_id ?? "")}`}
                      >
                        {item.notice_name}
                      </Link>
                      <p className="mt-1 flex items-center justify-between gap-3 text-xs text-muted-foreground">
                        <Link
                          className="truncate hover:text-teal-700 hover:underline"
                          to={`/companies/${item.company_number}`}
                        >
                          {item.company_name}
                        </Link>
                        <strong className="shrink-0 text-foreground">{money(item.winning_amount)}</strong>
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>
      </PageContainer>
    </main>
  );
}
