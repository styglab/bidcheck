import { Component, type ErrorInfo, type ReactNode } from "react";
import { AlertTriangle, Home, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageContainer } from "@/components/layout/page-container";
import { StatusState } from "./status-state";

export class AppErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("Unhandled rendering error", error, info);
  }

  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <PageContainer className="max-w-3xl">
        <div className="py-20">
          <StatusState
            icon={<AlertTriangle className="size-8 text-red-600" />}
            title="화면을 표시하지 못했습니다"
            description="예상하지 못한 오류가 발생했습니다. 화면을 새로고침하거나 홈으로 이동해 주세요."
            action={
              <div className="flex gap-2">
                <Button onClick={() => window.location.reload()}>
                  <RefreshCw className="mr-2 size-4" />
                  새로고침
                </Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    window.location.href = "/";
                  }}
                >
                  <Home className="mr-2 size-4" />
                  홈으로
                </Button>
              </div>
            }
          />
        </div>
      </PageContainer>
    );
  }
}
