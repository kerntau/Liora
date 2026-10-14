import { Link } from "react-router";
import { Button } from "@heroui/react";
export default function NotFound() {
    return (<div className="flex h-dvh flex-col items-center justify-center space-y-3 text-center p-4">
      <h1 className="font-semibold text-2xl text-foreground">页面不存在</h1>
      <p className="text-muted text-sm">抱歉，您访问的页面不存在或已被移除。</p>
      <Link replace to="/function/tasks">
        <Button size="md" variant={"primary"}>
          返回首页
        </Button>
      </Link>
    </div>);
}
