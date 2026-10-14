import { Link } from "react-router";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
export default function NotFound() {
    return (<Stack sx={{ minHeight: "100dvh", alignItems: "center", justifyContent: "center", textAlign: "center", p: 3 }} spacing={1.5}>
      <Typography variant="h4">页面不存在</Typography>
      <Typography variant="body2" color="text.secondary">抱歉，您访问的页面不存在或已被移除。</Typography>
      <Link replace to="/function/tasks">
        <Button variant="contained">
          返回首页
        </Button>
      </Link>
    </Stack>);
}
