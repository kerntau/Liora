import * as React from "react";

import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";

// 异步按钮：in-flight 期间自动 disabled + 旋转图标 + aria-busy，
// 避免"只改文案"或连点重复提交。
// 文案保持不变（只在前面插一个 spinner），所以按钮宽度不会在提交瞬间跳动。
export type AsyncButtonProps = React.ComponentProps<typeof Button> & {
  loading?: boolean;
  /** 加载时的读屏文案，默认「加载中」。 */
  loadingLabel?: string;
};

export function AsyncButton({
  loading = false,
  disabled,
  children,
  loadingLabel,
  ...props
}: AsyncButtonProps) {
  return (
    <Button
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      data-loading={loading || undefined}
      {...props}
    >
      {loading ? <Spinner label={loadingLabel} /> : null}
      {children}
    </Button>
  );
}
