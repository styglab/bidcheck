import { SearchX } from "lucide-react";
import { Link } from "react-router-dom";
import { PageContainer } from "@/components/layout/page-container";
import { StatusState } from "@/components/common/status-state";
import { Button } from "@/components/ui/button";

export function NotFoundPage() {
  return (
    <PageContainer className="max-w-3xl">
      <div className="py-20">
        <StatusState
          icon={<SearchX className="size-8" />}
          title="페이지를 찾을 수 없습니다"
          description="주소를 다시 확인하거나 홈에서 기관·업체·공고를 검색해 주세요."
          action={
            <Button asChild>
              <Link to="/">홈으로 이동</Link>
            </Button>
          }
        />
      </div>
    </PageContainer>
  );
}
