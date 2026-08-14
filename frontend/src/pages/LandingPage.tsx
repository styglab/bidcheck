import { ArrowRight, Building2, Search } from "lucide-react";
import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { CompanySelector } from "../features/company-context/CompanySelector";
import { useCompany } from "../features/company-context/useCompany";
import { NoticeTable } from "../features/notices/NoticeTable";

export function LandingPage() {
  const [query, setQuery] = useState("");
  const navigate = useNavigate();
  const { currentCompany, clearCompany } = useCompany();
  return (
    <main id="top">
      <section className="hero">
        <div className="shell">
          <span className="eyebrow">공공입찰 참가요건 검토</span>
          <h1>
            이 공고, 우리 업체가
            <br />
            <em>참여할 수 있을까?</em>
          </h1>
          <p>
            흩어진 참가요건을 한눈에 확인하고,
            <br />
            업체를 선택하면 충족 여부와 판단 근거까지 검토할 수 있습니다.
          </p>
          <Link to="/notices" className="primary-button">
            공고 찾아보기 <ArrowRight size={18} />
          </Link>
        </div>
      </section>
      <section className="search-area">
        <div className="shell content-shell">
          <div className="section-heading">
            <div>
              <span className="eyebrow">NOTICE SEARCH</span>
              <h2>입찰공고를 찾아보세요</h2>
            </div>
            <p>로그인 없이 바로 확인할 수 있습니다.</p>
          </div>
          <form
            className="search-form"
            onSubmit={(event) => {
              event.preventDefault();
              navigate(`/notices${query ? `?q=${encodeURIComponent(query)}` : ""}`);
            }}
          >
            <Search size={22} />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              aria-label="공고 검색"
              placeholder="공고명 · 공고번호 · 발주기관 검색"
            />
            <button>검색</button>
          </form>
          <div className="categories" aria-label="공고 업무유형">
            <button type="button" disabled>
              전체 <small>준비 중</small>
            </button>
            <button type="button" className="active" aria-pressed="true">
              용역
            </button>
            <button type="button" disabled>
              물품 <small>준비 중</small>
            </button>
            <button type="button" disabled>
              공사 <small>준비 중</small>
            </button>
          </div>
        </div>
      </section>
      <section className="notices">
        <div className="shell content-shell">
          <div className="notice-title">
            <div>
              <h2>마감이 가까운 공고</h2>
              <p>진행 중인 공고 중 마감일이 가까운 순서입니다.</p>
            </div>
            <Link to="/notices">
              전체 공고 보기 <ArrowRight size={15} />
            </Link>
          </div>
          <div className="context-bar">
            <div className="context-copy">
              <span className="company-icon">
                <Building2 size={18} />
              </span>
              <div>
                <strong>
                  {currentCompany ? `현재 검토 업체 · ${currentCompany.name}` : "검토 업체를 선택해 보세요"}
                </strong>
                <p>
                  {currentCompany
                    ? "아래 공고에 동일한 업체 기준을 적용하고 있습니다."
                    : "선택 사항 · 업체를 선택하면 공고별 주요요건을 빠르게 비교합니다."}
                </p>
              </div>
            </div>
            <CompanySelector />
            {currentCompany && (
              <button className="context-clear" type="button" onClick={clearCompany}>
                해제
              </button>
            )}
          </div>
          <NoticeTable filters={{ page_size: 5, work_type: "service" }} />
          <p className="table-note">
            목록에서는 구조화된 주요 요건만 빠르게 비교합니다. 전체 조건은 공고 상세에서 확인하세요.
          </p>
        </div>
      </section>
      <section className="features" id="features">
        <div className="shell content-shell">
          <div className="feature-intro">
            <span className="eyebrow">WHY BIDCHECK</span>
            <h2>요구사항부터 판단 근거까지</h2>
          </div>
          <div className="feature-list">
            <article>
              <b>01</b>
              <h3>공고 요건 분석</h3>
              <p>공고문과 첨부문서의 참가요건을 구조화합니다.</p>
            </article>
            <article>
              <b>02</b>
              <h3>업체 정보 적용</h3>
              <p>선택한 업체의 자격과 공고 요건을 비교합니다.</p>
            </article>
            <article>
              <b>03</b>
              <h3>판정 근거 확인</h3>
              <p>충족 여부와 함께 원문과 업체 증빙을 연결합니다.</p>
            </article>
          </div>
        </div>
      </section>
      <footer>
        <div>
          <Link className="logo" to="/">
            <span>Bid</span>Check
          </Link>
          <p>공공입찰 참가요건을 더 분명하게.</p>
        </div>
        <nav>
          <Link to="/notices">공고 찾기</Link>
          <Link to="/companies">업체 조회</Link>
          <a href="mailto:feedback@bidcheck.kr">의견 보내기</a>
        </nav>
        <small>© 2026 BidCheck · 제공되는 검토 결과는 입찰 참가의 최종 판단을 대신하지 않습니다.</small>
      </footer>
    </main>
  );
}
