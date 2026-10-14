import { lazy, Suspense, useSyncExternalStore } from "react";

import { BrowserRouter, Navigate, Outlet, Route, Routes } from "react-router";

import { auth } from "@/lib/auth";
import MainLayout from "@/pages/main/layout";
import NotFound from "@/pages/not-found";

import paths from "./routes.json";

const Login = lazy(() => import("./pages/auth/login/page"));
const Setup = lazy(() => import("./pages/auth/setup/page"));
const Dashboard = lazy(() => import("./pages/main/dashboard/page"));
const FunctionAssets = lazy(() => import("./pages/main/function/assets/page"));
const FunctionConversationsDetail = lazy(() => import("./pages/main/function/conversations/detail/page"));
const FunctionFindingsDetail = lazy(() => import("./pages/main/function/findings/detail/page"));
const FunctionFindings = lazy(() => import("./pages/main/function/findings/page"));
const FunctionTasksDetail = lazy(() => import("./pages/main/function/tasks/detail/page"));
const FunctionTasks = lazy(() => import("./pages/main/function/tasks/page"));
const SystemAgentsDetail = lazy(() => import("./pages/main/system/agents/detail/page"));
const SystemAgents = lazy(() => import("./pages/main/system/agents/page"));
const SystemInterceptApprovals = lazy(() => import("./pages/main/system/intercept/approvals/page"));
const SystemIntercept = lazy(() => import("./pages/main/system/intercept/page"));
const SystemLlm = lazy(() => import("./pages/main/system/llm/page"));
const SystemLogs = lazy(() => import("./pages/main/system/logs/page"));
const SystemMcp = lazy(() => import("./pages/main/system/mcp/page"));
const SystemSettings = lazy(() => import("./pages/main/system/settings/page"));
const SystemSkills = lazy(() => import("./pages/main/system/skills/page"));
const SystemTools = lazy(() => import("./pages/main/system/tools/page"));

function AuthBoundary({ authenticated }: { authenticated: boolean }) {
  const token = useSyncExternalStore(auth.subscribe, auth.getToken, () => null);
  if (authenticated && !token) return <Navigate to={paths.login} replace />;
  if (!authenticated && token) return <Navigate to={paths.FunctionTasks} replace />;
  return authenticated ? (
    <MainLayout>
      <Outlet />
    </MainLayout>
  ) : (
    <Outlet />
  );
}

export function AppRouter() {
  return (
    <BrowserRouter>
      <Suspense
        fallback={
          <div role="status" className="p-6 text-sm text-muted">
            正在加载…
          </div>
        }
      >
        <Routes>
          <Route path={paths.home} element={<Navigate to={paths.FunctionTasks} replace />} />
          <Route element={<AuthBoundary authenticated={false} />}>
            <Route path={paths.login} element={<Login />} />
            <Route path={paths.setup} element={<Setup />} />
          </Route>
          <Route element={<AuthBoundary authenticated />}>
            <Route path={paths.Dashboard} element={<Dashboard />} />
            <Route path={paths.FunctionAssets} element={<FunctionAssets />} />
            <Route path={paths.FunctionConversationsDetail} element={<FunctionConversationsDetail />} />
            <Route path={paths.FunctionFindingsDetail} element={<FunctionFindingsDetail />} />
            <Route path={paths.FunctionFindings} element={<FunctionFindings />} />
            <Route path={paths.FunctionTasksDetail} element={<FunctionTasksDetail />} />
            <Route path={paths.FunctionTasks} element={<FunctionTasks />} />
            <Route path={paths.SystemAgentsDetail} element={<SystemAgentsDetail />} />
            <Route path={paths.SystemAgents} element={<SystemAgents />} />
            <Route path={paths.SystemInterceptApprovals} element={<SystemInterceptApprovals />} />
            <Route path={paths.SystemIntercept} element={<SystemIntercept />} />
            <Route path={paths.SystemLlm} element={<SystemLlm />} />
            <Route path={paths.SystemLogs} element={<SystemLogs />} />
            <Route path={paths.SystemMcp} element={<SystemMcp />} />
            <Route path={paths.SystemSettings} element={<SystemSettings />} />
            <Route path={paths.SystemSkills} element={<SystemSkills />} />
            <Route path={paths.SystemTools} element={<SystemTools />} />
          </Route>
          <Route path="*" element={<NotFound />} />
        </Routes>
      </Suspense>
    </BrowserRouter>
  );
}
