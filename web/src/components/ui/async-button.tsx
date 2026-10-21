import * as React from "react";

import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";

// 异步按钮：in-flight 期间自动 disabled + 旋转图标 + aria-busy，
// 避免"只改文案"或连点重复提交。
export type AsyncButtonProps = React.ComponentProps<typeof Button> & {
  loading?: boolean;
};

export function AsyncButton({
  loading = false,
  disabled,
  children,
  ...props
}: AsyncButtonProps) {
  return (
    <Button disabled={disabled || loading} aria-busy={loading || undefined} {...props}>
      {loading ? <Spinner /> : null}
      {children}
    </Button>
  );
}
