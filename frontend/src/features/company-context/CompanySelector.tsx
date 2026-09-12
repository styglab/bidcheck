import * as Popover from "@radix-ui/react-popover";
import { Building2, ChevronDown, LoaderCircle, Search, X } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useCompanySearch } from "./api";
import { useCompany } from "./useCompany";

export function CompanySelector({ compact = false, mode = "select" }: { compact?: boolean; mode?: "select" | "apply" | "change" }) {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [search, setSearch] = useState("");
  const { currentCompany, selectCompany, clearCompany } = useCompany();
  const results = useCompanySearch(search);
  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <div className={`company-selector ${compact ? "compact" : ""}`}>
        <Popover.Trigger asChild>
          <button className={`company-trigger ${currentCompany ? "is-selected" : ""} mode-${mode}`} type="button">
            <span>{mode === "apply" ? "회사 선택" : mode === "change" ? "회사 변경" : currentCompany?.name ?? "+ 회사 적용"}</span>
            <ChevronDown size={15} />
          </button>
        </Popover.Trigger>
        <Popover.Portal>
          <Popover.Content className="company-popover" sideOffset={9} align="end" collisionPadding={16}>
            <div className="popover-title">
              <div>
                <strong>검토 업체 선택</strong>
                <p>회사명이나 사업자등록번호로 검색하세요.</p>
              </div>
              <Popover.Close asChild>
                <button className="icon-button" type="button" aria-label="업체 선택 닫기">
                  <X size={18} />
                </button>
              </Popover.Close>
            </div>
            <form
              className="grid grid-cols-[minmax(0,1fr)_72px] gap-2"
              onSubmit={(event) => {
                event.preventDefault();
                setSearch(input.trim());
              }}
            >
              <div className="relative min-w-0">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={16} />
                <Input
                  className="h-10 w-full pl-9 text-sm"
                  autoFocus
                  value={input}
                  onChange={(event) => setInput(event.target.value)}
                  placeholder="회사명 또는 사업자번호"
                  aria-label="회사명 또는 사업자등록번호"
                />
              </div>
              <Button className="h-10 bg-blue-800 hover:bg-blue-700" type="submit" disabled={input.trim().length < 2 || results.isFetching}>
                {results.isFetching ? <LoaderCircle className="animate-spin" aria-label="검색 중" /> : "검색"}
              </Button>
            </form>
            {results.isFetching && <div className="company-search-state flex items-center justify-center gap-2" role="status" aria-live="polite"><LoaderCircle className="animate-spin" size={17} /> 회사 정보를 조회하고 있습니다. 잠시만 기다려 주세요.</div>}
            {results.isError && <div className="company-search-state error">{results.error.message}</div>}
            {results.data?.items.map((item) => {
              const number = item.business_registration_number ?? "";
              const name =
                item.name ??
                String(item.properties.company_name ?? item.properties.business_name ?? "이름 미상 업체");
              return (
                <button
                  className="company-result"
                  type="button"
                  key={item.id}
                  disabled={!number}
                  onClick={() => {
                    selectCompany({
                      id: item.id,
                      name,
                      legalName: name,
                      businessNumber: number,
                      location: String(
                        item.properties.address ?? item.properties.full_address ?? "소재지 정보 없음",
                      ),
                    });
                    setOpen(false);
                  }}
                >
                  <span className="company-icon">
                    <Building2 size={18} />
                  </span>
                  <span>
                    <strong>{name}</strong>
                    <small>{number || "사업자등록번호 없음"}</small>
                    <em>{number ? "검토 업체로 선택 가능" : "법인 기본정보만 조회됨"}</em>
                  </span>
                  <b>선택</b>
                </button>
              );
            })}
            {search && results.data?.items.length === 0 && (
              <div className="company-search-state">검색 결과가 없습니다.</div>
            )}
            {currentCompany && (
              <button
                className="clear-company"
                type="button"
                onClick={() => {
                  clearCompany();
                  setOpen(false);
                }}
              >
                검토 업체 해제
              </button>
            )}
          </Popover.Content>
        </Popover.Portal>
      </div>
    </Popover.Root>
  );
}
