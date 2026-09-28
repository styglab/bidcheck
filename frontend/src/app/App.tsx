import { lazy, Suspense } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { PublicLayout } from "./PublicLayout";
import { CompaniesPage } from "../pages/CompaniesPage";
import { LandingPage } from "../pages/LandingPage";
import { NoticeProfilePage } from "../pages/NoticeProfilePage";
import { NoticesPage } from "../pages/NoticesPage";
import { CompanySetupPage } from "../pages/CompanySetupPage";
import { CompanyDetailPage } from "../pages/CompanyDetailPage";
import { OrganizationsPage } from "../pages/OrganizationsPage";
import { OrganizationDetailPage } from "../pages/OrganizationDetailPage";
import { ExplorePage } from "../pages/ExplorePage";

const RelationsPage = lazy(() =>
  import("../pages/RelationsPage").then((module) => ({ default: module.RelationsPage })),
);

export function App() {
  return (
    <Routes>
      <Route element={<PublicLayout />}>
        <Route index element={<LandingPage />} />
        <Route path="explore" element={<ExplorePage />} />
        <Route
          path="relations"
          element={
            <Suspense fallback={null}>
              <RelationsPage />
            </Suspense>
          }
        />
        <Route path="notices" element={<NoticesPage />} />
        <Route path="notices/:noticeId" element={<NoticeProfilePage />} />
        <Route path="companies" element={<CompaniesPage />} />
        <Route path="companies/:businessNumber" element={<CompanyDetailPage />} />
        <Route path="organizations" element={<OrganizationsPage />} />
        <Route path="organizations/:organizationId" element={<OrganizationDetailPage />} />
        <Route path="company/setup" element={<CompanySetupPage />} />
        <Route path="*" element={<Navigate replace to="/" />} />
      </Route>
    </Routes>
  );
}
