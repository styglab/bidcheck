import { Route, Routes } from "react-router-dom";
import { PublicLayout } from "./PublicLayout";
import { CompaniesPage } from "../pages/CompaniesPage";
import { LandingPage } from "../pages/LandingPage";
import { NoticeProfilePage } from "../pages/NoticeProfilePage";
import { NoticesPage } from "../pages/NoticesPage";
import { CompanySetupPage } from "../pages/CompanySetupPage";
import { CompanyDetailPage } from "../pages/CompanyDetailPage";
import { OrganizationsPage } from "../pages/OrganizationsPage";
import { OrganizationDetailPage } from "../pages/OrganizationDetailPage";
import { NotFoundPage } from "../pages/NotFoundPage";
import { ExplorePage } from "../pages/ExplorePage";
import { RelationsPage } from "../pages/RelationsPage";
import { McpPage } from "../pages/McpPage";
import { ContactPage } from "../pages/ContactPage";

export function App() {
  return (
    <Routes>
      <Route element={<PublicLayout />}>
        <Route index element={<LandingPage />} />
        <Route path="explore" element={<ExplorePage />} />
        <Route path="relations" element={<RelationsPage />} />
        <Route path="mcp" element={<McpPage />} />
        <Route path="contact" element={<ContactPage />} />
        <Route path="notices" element={<NoticesPage />} />
        <Route path="notices/:noticeId" element={<NoticeProfilePage />} />
        <Route path="companies" element={<CompaniesPage />} />
        <Route path="companies/:businessNumber" element={<CompanyDetailPage />} />
        <Route path="organizations" element={<OrganizationsPage />} />
        <Route path="organizations/:organizationId" element={<OrganizationDetailPage />} />
        <Route path="company/setup" element={<CompanySetupPage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  );
}
