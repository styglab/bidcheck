export type NoticePreview = {
  id: string;
  dday: string;
  type: string;
  title: string;
  agency: string;
  price: string;
  method: string;
  requirements: string[];
  issue: string;
};
export const demoNotices: NoticePreview[] = [
  {
    id: "system-maintenance",
    dday: "D-4",
    type: "용역",
    title: "정보시스템 통합유지관리 용역",
    agency: "한국디지털진흥원",
    price: "5.8억원",
    method: "일반경쟁",
    requirements: ["중소기업", "SW사업자", "직접생산"],
    issue: "직접생산확인 정보 없음",
  },
  {
    id: "next-system",
    dday: "D-7",
    type: "용역",
    title: "차세대 업무시스템 구축",
    agency: "한국○○공사",
    price: "12.3억원",
    method: "일반경쟁",
    requirements: ["SW사업자", "공동수급", "유사실적"],
    issue: "유사실적 인정 범위 확인 필요",
  },
  {
    id: "computer-purchase",
    dday: "D-9",
    type: "물품",
    title: "전산장비 통합 구매",
    agency: "서울○○재단",
    price: "2.1억원",
    method: "제한경쟁",
    requirements: ["중소기업", "직접생산"],
    issue: "주요요건 충족",
  },
];
