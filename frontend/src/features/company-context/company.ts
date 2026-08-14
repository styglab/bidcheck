export type CompanySummary = {
  id: string;
  name: string;
  legalName: string;
  businessNumber: string;
  location: string;
};
export const demoCompany: CompanySummary = {
  id: "abc-software",
  name: "ABC소프트(주)",
  legalName: "ABC소프트 주식회사",
  businessNumber: "123-45-*****",
  location: "서울특별시 강남구",
};
