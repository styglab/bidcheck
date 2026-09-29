import { Braces, Bug, Database, Lightbulb } from "lucide-react";
import { PageContainer } from "@/components/layout/page-container";

const inquiryTypes = [
  { icon: Lightbulb, title: "기능 제안", description: "서비스에 필요한 기능을 제안해주세요." },
  { icon: Database, title: "데이터 문의", description: "데이터 오류나 추가 데이터에 대해 문의해주세요." },
  { icon: Bug, title: "오류 제보", description: "서비스 이용 중 발견한 문제를 알려주세요." },
  { icon: Braces, title: "MCP / API 문의", description: "개발 연동에 대해 문의해주세요." },
];

export function ContactPage() {
  return (
    <PageContainer className="max-w-5xl">
      <header className="py-6 sm:py-10">
        <p className="text-sm font-semibold text-blue-800 dark:text-blue-300">문의하기</p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">무엇을 도와드릴까요?</h1>
        <p className="mt-3 text-muted-foreground">문의 유형을 선택할 수 있는 접수 채널을 준비하고 있습니다.</p>
      </header>
      <section className="grid gap-4 sm:grid-cols-2">
        {inquiryTypes.map((item) => <article className="rounded-2xl border bg-card p-6" key={item.title}><item.icon className="size-5 text-blue-700" /><h2 className="mt-4 font-bold">{item.title}</h2><p className="mt-2 text-sm text-muted-foreground">{item.description}</p></article>)}
      </section>
    </PageContainer>
  );
}
