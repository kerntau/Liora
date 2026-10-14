import * as React from "react";
import { useNavigate } from "react-router";
import Autocomplete from "@mui/material/Autocomplete";
import Dialog from "@mui/material/Dialog";
import IconButton from "@mui/material/IconButton";
import ListItemIcon from "@mui/material/ListItemIcon";
import ListItemText from "@mui/material/ListItemText";
import MenuItem from "@mui/material/MenuItem";
import TextField from "@mui/material/TextField";
import { Search } from "lucide-react";
import type { NavMainItem } from "@/navigation/sidebar/sidebar-items";
import { sidebarItems } from "@/navigation/sidebar/sidebar-items";

type SearchItem = { id: string; group: string; label: string; url: string; icon?: NavMainItem["icon"]; disabled?: boolean; newTab?: boolean };
const searchItems: SearchItem[] = sidebarItems.flatMap((group) => group.items.flatMap((item) => item.subItems ? item.subItems.map((sub) => ({ id: sub.id, group: item.title, label: sub.title, url: sub.url, icon: item.icon, disabled: sub.disabled, newTab: sub.newTab })) : [{ id: item.id, group: group.label ?? "其他", label: item.title, url: item.url, icon: item.icon, disabled: item.disabled, newTab: item.newTab }]));
const available = searchItems.filter((item) => !item.disabled && !item.url.includes("coming-soon"));

export function SearchDialog() {
  const [open, setOpen] = React.useState(false); const [query, setQuery] = React.useState(""); const navigate = useNavigate();
  React.useEffect(() => { const down = (event: KeyboardEvent) => { if (event.key === "j" && (event.metaKey || event.ctrlKey)) { event.preventDefault(); setOpen((value) => !value); } }; document.addEventListener("keydown", down); return () => document.removeEventListener("keydown", down); }, []);
  const options = React.useMemo(() => { const list = query.trim() ? searchItems : available; const q = query.toLowerCase(); return list.filter((item) => !q || `${item.label} ${item.group} ${item.url}`.toLowerCase().includes(q)); }, [query]);
  const select = (_event: React.SyntheticEvent, item: SearchItem | null) => { if (!item) return; setOpen(false); setQuery(""); if (item.newTab) window.open(item.url, "_blank", "noopener,noreferrer"); else navigate(item.url); };
  return <>
    <IconButton size="small" aria-label="搜索页面" onClick={() => setOpen(true)}><Search size={18} /></IconButton>
    <Dialog fullWidth maxWidth="sm" open={open} onClose={() => { setOpen(false); setQuery(""); }}>
      <Autocomplete open autoHighlight options={options} inputValue={query} onInputChange={(_event, value) => setQuery(value)} onChange={select} getOptionLabel={(item) => item.label} groupBy={(item) => item.group} noOptionsText="没有匹配的页面。" renderInput={(params) => <TextField {...params} autoFocus placeholder="搜索任务、资产、漏洞和设置…" label="搜索页面" />} renderOption={(props, item) => { const Icon = item.icon; return <MenuItem {...props} key={item.id}><ListItemIcon>{Icon ? <Icon size={18} /> : null}</ListItemIcon><ListItemText primary={item.label} secondary={item.url} /></MenuItem>; }} sx={{ p: 2 }} />
    </Dialog>
  </>;
}
