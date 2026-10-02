import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { App } from "./app/App";
import { CompanyProvider } from "./features/company-context/CompanyContext";
import "./styles.css";
import { ThemeProvider } from "./features/theme/ThemeProvider";
import { AppErrorBoundary } from "./components/common/app-error-boundary";
import { RouteScrollManager } from "./components/common/route-scroll-manager";

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, refetchOnWindowFocus: false } },
});
ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <AppErrorBoundary><ThemeProvider><BrowserRouter>
          <RouteScrollManager />
          <CompanyProvider>
            <App />
          </CompanyProvider>
        </BrowserRouter></ThemeProvider></AppErrorBoundary>
    </QueryClientProvider>
  </React.StrictMode>,
);
