import * as React from "react";
import { Button, Chip, ComboBox, Input, ListBox, Select } from "@heroui/react";
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
        return (<Chip size="sm" color="accent" variant={"primary"}>
        <Chip.Label>当前</Chip.Label>
      </Chip>);
    }
    if (index < currentIndex) {
        return (<Chip size="sm" color="default" title="当前游标之前的配置不会被自动故障转移选中" variant={"soft"}>
        <Chip.Label>已跳过</Chip.Label>
      </Chip>);
    }
    return (<Chip size="sm" color="default" variant={"soft"}>
      <Chip.Label>备用 {index - currentIndex}</Chip.Label>
    </Chip>);
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
        <ComboBox selectionMode="multiple" value={value} isDisabled={disabled || profiles.length === 0} aria-label="选择并添加 LLM 配置" onChange={(keys) => {
            const chosen = Array.from(keys).map(String);
            const next = [...value.filter((id) => chosen.includes(id)), ...chosen.filter((id) => !value.includes(id))];
            onValueChange(next);
            if (activeProfileId && !next.includes(activeProfileId))
                onActiveProfileChange?.(next[0] ?? "");
            else if (!activeProfileId && next.length)
                onActiveProfileChange?.(next[0]);
        }}>
          <ComboBox.InputGroup>
            <ComboBox.Value />
            <Input placeholder={profiles.length ? "搜索并选择 LLM 配置" : "暂无可用 LLM 配置"}/>
            <ComboBox.Trigger />
          </ComboBox.InputGroup>
          <ComboBox.Popover>
            <ListBox items={profiles}>
              {(profile) => (<ListBox.Item id={profile.id} textValue={profile.name + " " + profile.model}>
                  <span className="font-medium">{profile.name}</span>
                  <span className="ml-2 text-muted text-xs">{profile.model}</span>
                </ListBox.Item>)}
            </ListBox>
          </ComboBox.Popover>
        </ComboBox>
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
                  <Button type="button" size="sm" isIconOnly aria-label="上移配置" onPress={() => move(index, -1)} isDisabled={disabled || index === 0} variant={"ghost"}>
                    <ArrowUpIcon className="size-3.5"/>
                  </Button>
                  <Button type="button" size="sm" isIconOnly aria-label="下移配置" onPress={() => move(index, 1)} isDisabled={disabled || index === value.length - 1} variant={"ghost"}>
                    <ArrowDownIcon className="size-3.5"/>
                  </Button>
                  <Button type="button" size="sm" isIconOnly aria-label="移除配置" onPress={() => remove(id)} isDisabled={disabled} variant={"ghost"}>
                    <XIcon className="size-3.5"/>
                  </Button>
                </div>
              </div>);
            })}
        </div>)}

      {onActiveProfileChange && value.length > 0 && (<div className="flex flex-col items-stretch gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-3 pt-1">
          <span className="font-medium text-sm text-foreground">当前配置</span>
          <Select selectedKey={activeProfileId && value.includes(activeProfileId) ? activeProfileId : value[0]} isDisabled={disabled} className="w-full sm:min-w-48 sm:max-w-64" aria-label="切换当前激活配置" onSelectionChange={(key) => {
                if (key !== null)
                    ((key) => key && onActiveProfileChange(String(key)))(String(key));
            }}>
            <Select.Trigger className="h-8 text-xs">
              <Select.Value />
            </Select.Trigger>
            <Select.Popover>
              <ListBox>
                {value.map((id) => {
                const profile = profilesByID.get(id);
                return (<ListBox.Item key={id} id={id} textValue={profile?.name ?? `配置 #${id}`}>
                      {profile?.name ?? `配置 #${id}`}
                    </ListBox.Item>);
            })}
              </ListBox>
            </Select.Popover>
          </Select>
        </div>)}
    </div>);
}
