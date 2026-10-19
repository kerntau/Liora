import CircularProgress from "@mui/material/CircularProgress";
import { cn } from "@/lib/utils";

function Spinner({ className, ...props }: React.ComponentProps<typeof CircularProgress>) {
  return <CircularProgress data-slot="spinner" aria-label="正在加载" size="1em" color="inherit" className={cn("size-4 shrink-0", className)} {...props} />;
}
export { Spinner };

