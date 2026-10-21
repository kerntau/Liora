import * as React from "react";

// 统一的数据获取状态机：idle → loading → ready / error。
// 每个请求带序号 + AbortController，避免并发响应乱序覆盖；
// 重新请求时保留上一份数据（keepPrevious），防止列表闪空。
export type AsyncStatus = "idle" | "loading" | "ready" | "error";

export type AsyncData<T> = {
  data: T | undefined;
  error: Error | null;
  status: AsyncStatus;
  /** 首次加载：还没有任何数据可渲染，适合骨架屏。 */
  initialLoading: boolean;
  /** 任意一次请求进行中（含刷新、轮询），适合非遮挡指示。 */
  pending: boolean;
  /** 重新拉取（保留当前数据）。 */
  reload: () => void;
};

export function useAsyncData<T>(
  load: (signal: AbortSignal) => Promise<T>,
  deps: React.DependencyList,
  options: { keepPrevious?: boolean } = {},
): AsyncData<T> {
  const { keepPrevious = true } = options;
  const [state, setState] = React.useState<{
    data: T | undefined;
    error: Error | null;
    status: AsyncStatus;
  }>({ data: undefined, error: null, status: "idle" });
  const [tick, setTick] = React.useState(0);
  const seq = React.useRef(0);
  const loadRef = React.useRef(load);
  loadRef.current = load;

  // biome-ignore lint/correctness/useExhaustiveDependencies: deps 由调用方声明，tick 用于手动 reload。
  React.useEffect(() => {
    const id = ++seq.current;
    const controller = new AbortController();
    setState((prev) => ({
      data: keepPrevious ? prev.data : undefined,
      error: null,
      status: "loading",
    }));

    loadRef.current(controller.signal).then(
      (data) => {
        if (seq.current !== id) return;
        setState({ data, error: null, status: "ready" });
      },
      (cause: unknown) => {
        if (seq.current !== id || controller.signal.aborted) return;
        const error = cause instanceof Error ? cause : new Error(String(cause));
        setState((prev) => ({ data: prev.data, error, status: "error" }));
      },
    );

    return () => controller.abort();
  }, [...deps, tick]);

  const reload = React.useCallback(() => setTick((n) => n + 1), []);

  return {
    data: state.data,
    error: state.error,
    status: state.status,
    initialLoading: state.status === "loading" && state.data === undefined,
    pending: state.status === "loading",
    reload,
  };
}
