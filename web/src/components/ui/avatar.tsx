"use client";

import * as React from "react";
import MuiAvatar from "@mui/material/Avatar";
import { cn } from "@/lib/utils";

const AvatarContext = React.createContext<{ imageLoaded: boolean; setImageLoaded: (loaded: boolean) => void } | null>(
  null,
);

function Avatar({
  className,
  size = "default",
  children,
  ...props
}: React.HTMLAttributes<HTMLSpanElement> & { size?: "default" | "sm" | "lg" }) {
  const [imageLoaded, setImageLoaded] = React.useState(false);
  return (
    <AvatarContext.Provider value={{ imageLoaded, setImageLoaded }}>
      <MuiAvatar
        component="span"
        data-slot="avatar"
        data-size={size}
        className={cn(
          "group/avatar relative flex size-8 shrink-0 overflow-visible rounded-full bg-transparent select-none",
          size === "lg" && "size-10",
          size === "sm" && "size-6",
          className,
        )}
        {...props}
      >
        {children}
      </MuiAvatar>
    </AvatarContext.Provider>
  );
}

function AvatarImage({ className, src, onLoad, onError, style, ...props }: React.ImgHTMLAttributes<HTMLImageElement>) {
  const avatar = React.useContext(AvatarContext);
  const [loadedSrc, setLoadedSrc] = React.useState<string>();
  const imageRef = React.useRef<HTMLImageElement>(null);
  const loaded = Boolean(src && loadedSrc === src);
  const setImageLoaded = avatar?.setImageLoaded;
  React.useLayoutEffect(() => {
    setImageLoaded?.(loaded);
    return () => setImageLoaded?.(false);
  }, [loaded, setImageLoaded]);
  React.useLayoutEffect(() => {
    if (src && imageRef.current?.complete && imageRef.current.naturalWidth > 0) setLoadedSrc(src);
  }, [src]);
  if (!src) return null;
  return (
    <img
      ref={imageRef}
      data-slot="avatar-image"
      src={src}
      className={cn("aspect-square size-full rounded-[inherit] object-cover", className)}
      {...props}
      style={{ ...style, display: loaded ? style?.display : "none" }}
      onLoad={(event) => {
        setLoadedSrc(src);
        onLoad?.(event);
      }}
      onError={(event) => {
        setLoadedSrc(undefined);
        onError?.(event);
      }}
    />
  );
}

function AvatarFallback({ className, ...props }: React.HTMLAttributes<HTMLSpanElement>) {
  const avatar = React.useContext(AvatarContext);
  if (avatar?.imageLoaded) return null;
  return (
    <span
      data-slot="avatar-fallback"
      className={cn(
        "flex size-full items-center justify-center rounded-[inherit] bg-muted text-sm text-muted-foreground",
        className,
      )}
      {...props}
    />
  );
}
function AvatarBadge({ className, ...props }: React.HTMLAttributes<HTMLSpanElement>) {
  return (
    <span
      data-slot="avatar-badge"
      className={cn(
        "absolute right-0 bottom-0 z-10 inline-flex size-2.5 items-center justify-center rounded-full bg-primary ring-2 ring-background",
        className,
      )}
      {...props}
    />
  );
}
function AvatarGroup({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      data-slot="avatar-group"
      className={cn(
        "group/avatar-group flex -space-x-2 *:data-[slot=avatar]:ring-2 *:data-[slot=avatar]:ring-background",
        className,
      )}
      {...props}
    />
  );
}
function AvatarGroupCount({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      data-slot="avatar-group-count"
      className={cn(
        "relative flex size-8 shrink-0 items-center justify-center rounded-full bg-muted text-sm text-muted-foreground",
        className,
      )}
      {...props}
    />
  );
}

export { Avatar, AvatarImage, AvatarFallback, AvatarGroup, AvatarGroupCount, AvatarBadge };
