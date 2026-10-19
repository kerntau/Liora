import * as React from "react";

/** Compose an existing link/control without adding another interactive element. */
export const Slot = React.forwardRef<HTMLElement, React.HTMLAttributes<HTMLElement> & { children?: React.ReactNode }>(
  function Slot({ children, ...props }, forwardedRef) {
    const content = React.Children.toArray(children);
    const child = content.length === 1 ? content[0] : null;
    if (!React.isValidElement<Record<string, unknown>>(child)) return null;
    const childProps = child.props;
    const merged: Record<string, unknown> = { ...props, ...childProps };
    for (const key of Object.keys(props)) {
      const outer = (props as Record<string, unknown>)[key];
      const inner = childProps[key];
      if (/^on[A-Z]/.test(key) && typeof outer === "function" && typeof inner === "function") {
        merged[key] = (...args: unknown[]) => {
          inner(...args);
          const event = args[0] as { defaultPrevented?: boolean } | undefined;
          if (!event?.defaultPrevented) outer(...args);
        };
      }
    }
    merged.className = [props.className, childProps.className].filter(Boolean).join(" ");
    merged.style = { ...props.style, ...(childProps.style as React.CSSProperties) };
    merged.ref = (node: HTMLElement | null) => {
      const refs = [forwardedRef, childProps.ref as React.Ref<HTMLElement> | undefined];
      const cleanups = refs.map((ref): unknown => {
        if (typeof ref === "function") return ref(node);
        if (ref) ref.current = node;
      });
      return () => {
        refs.forEach((ref, index) => {
          const cleanup = cleanups[index];
          if (typeof cleanup === "function") cleanup();
          else if (typeof ref === "function") ref(null);
          else if (ref) ref.current = null;
        });
      };
    };
    return React.cloneElement(child, merged);
  },
);
