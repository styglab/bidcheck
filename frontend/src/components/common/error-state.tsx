import { AlertTriangle, Home, RefreshCw } from "lucide-react";
import { Link } from "react-router-dom";
import { ApiError } from "@/shared/api/client";
import { Button } from "@/components/ui/button";
import { PageContainer } from "@/components/layout/page-container";
import { StatusState } from "./status-state";

function copy(error: unknown, entity = "정보") {
  if (error instanceof ApiError) {
    if (error.status === 404)
      return {
        title: `${entity}를 찾을 수 없습니다`,
        description: "주소가 잘못되었거나 더 이상 제공되지 않는 정보입니다.",
      };
    if (error.status === 401 || error.status === 403)
      return { title: "접근 권한이 없습니다", description: "로그인 상태와 접근 권한을 확인해 주세요." };
    if ([502, 503, 504].includes(error.status))
      return {
        title: "데이터 조회가 지연되고 있습니다",
        description: "외부 조달 데이터 연결이 원활하지 않습니다. 잠시 후 다시 시도해 주세요.",
      };
    return { title: `${entity}를 불러오지 못했습니다`, description: error.message };
  }
  return {
    title: `${entity}를 불러오지 못했습니다`,
    description: "일시적인 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.",
  };
}

export function PageError({
  error,
  entity,
  onRetry,
}: {
  error: unknown;
  entity?: string;
  onRetry?: () => void;
}) {
  const message = copy(error, entity);
  return (
    <PageContainer className="max-w-3xl">
      <div className="py-16">
        <StatusState
          icon={<AlertTriangle className="size-8 text-red-600" />}
          title={message.title}
          description={message.description}
          action={
            <div className="flex gap-2">
              {onRetry && (
                <Button onClick={onRetry}>
                  <RefreshCw className="mr-2 size-4" />
                  다시 시도
                </Button>
              )}
              <Button asChild variant="outline">
                <Link to="/">
                  <Home className="mr-2 size-4" />
                  홈으로
                </Link>
              </Button>
            </div>
          }
        />
      </div>
    </PageContainer>
  );
}

export function SectionError({
  error,
  title,
  onRetry,
}: {
  error: unknown;
  title?: string;
  onRetry: () => void;
}) {
  const message = copy(error, title ?? "데이터");
  return (
    <StatusState
      icon={<AlertTriangle className="size-6 text-amber-600" />}
      title={message.title}
      description={message.description}
      action={
        <Button size="sm" variant="outline" onClick={onRetry}>
          <RefreshCw className="mr-2 size-4" />
          다시 불러오기
        </Button>
      }
    />
  );
}
