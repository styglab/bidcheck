import { Navigate, Route, Routes } from "react-router-dom";
import { PublicLayout } from "./PublicLayout";
import { CompaniesPage } from "../pages/CompaniesPage";
import { LandingPage } from "../pages/LandingPage";
import { NoticeDetailPage } from "../pages/NoticeDetailPage";
import { NoticesPage } from "../pages/NoticesPage";
import { CompanySetupPage } from "../pages/CompanySetupPage";

export function App() {
  return (
    <Routes>
      <Route element={<PublicLayout />}>
        <Route index element={<LandingPage />} />
        <Route path="notices" element={<NoticesPage />} />
        <Route path="notices/:noticeId" element={<NoticeDetailPage />} />
        <Route path="companies" element={<CompaniesPage />} />
        <Route path="company/setup" element={<CompanySetupPage />} />
        <Route path="*" element={<Navigate replace to="/" />} />
      </Route>
    </Routes>
  );
}
