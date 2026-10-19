import { useMemo, type ComponentProps } from "react";
import { Link as RouterLink, useLocation, useNavigate, useSearchParams as useRouterSearchParams } from "react-router";

// Keep the original UI's navigation contract on the current SPA runtime.
export default function Link({ href, prefetch: _prefetch, ...props }: Omit<ComponentProps<typeof RouterLink>, "to" | "prefetch"> & {
  href: string;
  prefetch?: boolean;
}) {
  return <RouterLink to={href} {...props} />;
}

export function usePathname() {
  return useLocation().pathname;
}

export function useSearchParams() {
  return useRouterSearchParams()[0];
}

export function useRouter() {
  const navigate = useNavigate();
  return useMemo(() => ({
    push: (href: string) => navigate(href),
    replace: (href: string) => navigate(href, { replace: true }),
    back: () => navigate(-1),
  }), [navigate]);
}
