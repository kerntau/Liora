import * as React from "react";
import { Autocomplete, Chip, IconButton, MenuItem, Select, TextField } from "@mui/material";
import { ArrowDownIcon, ArrowUpIcon, XIcon } from "lucide-react";
import type { LLMProfile } from "@/lib/types";
interface TaskLLMProfileChainProps {
    profiles: LLMProfile[];
    value: string[];
    onValueChange: (value: string[]) => void;
    activeProfileId?: string;
    onActiveProfileChange?: (value: string) => void;
    disabled?: boolean;
    inputId?: string;
    portalContainer?: React.RefObject<HTMLElement | null>;
}
function ProfileRoleBadge({ index, currentIndex }: {
    index: number;
    currentIndex: number;
}) {
    if (index === currentIndex) {
        return <Chip size="small" color="primary" label="当前" />;
    }
    if (index < currentIndex) {
        return <Chip size="small" title="当前游标之前的配置不会被自动故障转移选中" label="已跳过" />;
    }
    return (<Chip size="small" label={`备用 ${index - currentIndex}`} />);
}
export function TaskLLMProfileChain({ profiles, value, onValueChange, activeProfileId, onActiveProfileChange, disabled = false, }: TaskLLMProfileChainProps) {
    const profilesByID = React.useMemo(() => new Map(profiles.map((profile) => [profile.id, profile])), [profiles]);
    const currentProfileID = activeProfileId && value.includes(activeProfileId) ? activeProfileId : value[0];
    const currentIndex = value.indexOf(currentProfileID);
    const move = (index: number, offset: -1 | 1) => {
        const target = index + offset;
        if (target < 0 || target >= value.length)
            return;
        const next = [...value];
        [next[index], next[target]] = [next[target], next[index]];
        onValueChange(next);
    };
    const remove = (id: string) => {
        const next = value.filter((profileID) => profileID !== id);
        onValueChange(next);
        if (activeProfileId === id)
            onActiveProfileChange?.(next[0] ?? "");
    };
    return (<div className="flex flex-col gap-3">
      <div className="space-y-1.5">
        <Autocomplete
          multiple
          disableCloseOnSelect
          options={profiles}
          value={value.map((id) => profilesByID.get(id)).filter((profile): profile is LLMProfile => Boolean(profile))}
          disabled={disabled || profiles.length === 0}
          getOptionLabel={(profile) => `${profile.name} ${profile.model}`}
          isOptionEqualToValue={(option, selected) => option.id === selected.id}
          onChange={(_, selected) => {
            const chosen = selected.map((profile) => String(profile.id));
            const next = [...value.filter((id) => chosen.includes(id)), ...chosen.filter((id) => !value.includes(id))];
            onValueChange(next);
            if (activeProfileId && !next.includes(activeProfileId))
                onActiveProfileChange?.(next[0] ?? "");
            else if (!activeProfileId && next.length)
                onActiveProfileChange?.(next[0]);
          }}
          renderInput={(params) => <TextField {...params} size="small" label="LLM 配置" placeholder={profiles.length ? "搜索并选择 LLM 配置" : "暂无可用 LLM 配置"} />}
          renderOption={(props, profile) => <li {...props} key={profile.id}><span className="font-medium">{profile.name}</span><span className="ml-2 text-muted text-xs">{profile.model}</span></li>}
        />
      </div>

      {value.length === 0 ? (<p className="text-muted text-xs">未指定配置时，任务跟随 Agent 或全局激活配置。</p>) : (<div className="flex flex-col divide-y divide-border rounded-lg border border-border bg-surface-secondary/40">
          {value.map((id, index) => {
                const profile = profilesByID.get(id);
                return (<div key={id} className="grid min-w-0 grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2 px-3 py-2 sm:flex">
                <span className="w-5 shrink-0 text-center text-muted text-xs tabular-nums">{index + 1}</span>
                <div className="min-w-0 sm:flex-1">
                  <p className="truncate font-medium text-sm text-foreground">{profile?.name ?? `配置 #${id}`}</p>
                  <p className="truncate text-muted text-xs">{profile?.model ?? "配置已不可用"}</p>
                </div>
                <ProfileRoleBadge index={index} currentIndex={currentIndex}/>
                <div className="col-span-2 col-start-2 flex shrink-0 items-center gap-1 justify-self-end sm:col-auto sm:justify-self-auto">
                  <IconButton type="button" size="small" aria-label="上移配置" onClick={() => move(index, -1)} disabled={disabled || index === 0}>
                    <ArrowUpIcon className="size-3.5"/>
                  </IconButton>
                  <IconButton type="button" size="small" aria-label="下移配置" onClick={() => move(index, 1)} disabled={disabled || index === value.length - 1}>
                    <ArrowDownIcon className="size-3.5"/>
                  </IconButton>
                  <IconButton type="button" size="small" aria-label="移除配置" onClick={() => remove(id)} disabled={disabled}>
                    <XIcon className="size-3.5"/>
                  </IconButton>
                </div>
              </div>);
            })}
        </div>)}

      {onActiveProfileChange && value.length > 0 && (<div className="flex flex-col items-stretch gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-3 pt-1">
          <span className="font-medium text-sm text-foreground">当前配置</span>
          <Select value={activeProfileId && value.includes(activeProfileId) ? activeProfileId : value[0]} disabled={disabled} aria-label="切换当前激活配置" onChange={(event) => onActiveProfileChange(String(event.target.value))} size="small" sx={{ minWidth: 192, maxWidth: 256 }}>
            {value.map((id) => { const profile = profilesByID.get(id); return <MenuItem key={id} value={id}>{profile?.name ?? `配置 #${id}`}</MenuItem>; })}
          </Select>
        </div>)}
    </div>);
}
