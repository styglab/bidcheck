import { lazy, Suspense } from "react";
import { Navigate, Outlet, Route, Routes } from "react-router-dom";
import { PublicLayout } from "./PublicLayout";

const CompaniesPage = lazy(() =>
  import("../pages/CompaniesPage").then(({ CompaniesPage }) => ({ default: CompaniesPage })),
);
const NetworkExplorerPage = lazy(() =>
  import("../pages/NetworkExplorerPage").then(({ NetworkExplorerPage }) => ({
    default: NetworkExplorerPage,
  })),
);
const LandingPage = lazy(() =>
  import("../pages/LandingPage").then(({ LandingPage }) => ({ default: LandingPage })),
);
const NoticeProfilePage = lazy(() =>
  import("../pages/NoticeProfilePage").then(({ NoticeProfilePage }) => ({ default: NoticeProfilePage })),
);
const NoticesPage = lazy(() =>
  import("../pages/NoticesPage").then(({ NoticesPage }) => ({ default: NoticesPage })),
);
const CompanySetupPage = lazy(() =>
  import("../pages/CompanySetupPage").then(({ CompanySetupPage }) => ({ default: CompanySetupPage })),
);
const CompanyDetailPage = lazy(() =>
  import("../pages/CompanyDetailPage").then(({ CompanyDetailPage }) => ({ default: CompanyDetailPage })),
);
const OrganizationsPage = lazy(() =>
  import("../pages/OrganizationsPage").then(({ OrganizationsPage }) => ({ default: OrganizationsPage })),
);
const OrganizationDetailPage = lazy(() =>
  import("../pages/OrganizationDetailPage").then(({ OrganizationDetailPage }) => ({
    default: OrganizationDetailPage,
  })),
);
const NotFoundPage = lazy(() =>
  import("../pages/NotFoundPage").then(({ NotFoundPage }) => ({ default: NotFoundPage })),
);
const McpPage = lazy(() => import("../pages/McpPage").then(({ McpPage }) => ({ default: McpPage })));
const ContactPage = lazy(() =>
  import("../pages/ContactPage").then(({ ContactPage }) => ({ default: ContactPage })),
);

function RouteLoading() {
  return (
    <main
      aria-label="페이지 불러오는 중"
      aria-live="polite"
      className="mx-auto min-h-[calc(100vh-4rem)] w-full max-w-6xl px-4 py-10 sm:px-6 sm:py-14"
      role="status"
    >
      <div className="h-5 w-24 animate-pulse rounded-full bg-muted" />
      <div className="mt-5 h-10 w-full max-w-md animate-pulse rounded-xl bg-muted" />
      <div className="mt-3 h-5 w-full max-w-xl animate-pulse rounded-lg bg-muted" />
      <div className="mt-10 grid gap-4 md:grid-cols-3">
        <div className="h-40 animate-pulse rounded-2xl bg-muted" />
        <div className="h-40 animate-pulse rounded-2xl bg-muted" />
        <div className="h-40 animate-pulse rounded-2xl bg-muted" />
      </div>
      <span className="sr-only">페이지를 불러오고 있습니다.</span>
    </main>
  );
}

function LazyPageBoundary() {
  return (
    <Suspense fallback={<RouteLoading />}>
      <Outlet />
    </Suspense>
  );
}

export function App() {
  return (
    <Routes>
      <Route element={<PublicLayout />}>
        <Route element={<LazyPageBoundary />}>
          <Route index element={<LandingPage />} />
          <Route path="explore" element={<Navigate replace to="/notices" />} />
          <Route path="opportunities" element={<Navigate replace to="/organizations" />} />
          <Route path="markets" element={<Navigate replace to="/organizations" />} />
          <Route path="relations" element={<NetworkExplorerPage />} />
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
      </Route>
    </Routes>
  );
}
