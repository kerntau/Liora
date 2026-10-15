import type { ReactNode } from "react";
import * as React from "react";

import {
  AccordionDetails,
  AccordionSummary,
  Box,
  CardContent,
  CardHeader,
  CardMedia,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  FormControlLabel,
  IconButton,
  InputAdornment,
  LinearProgress,
  MenuItem,
  Accordion as MuiAccordion,
  Avatar as MuiAvatar,
  Button as MuiButton,
  Card as MuiCard,
  Checkbox as MuiCheckbox,
  Chip as MuiChip,
  Drawer as MuiDrawer,
  Radio as MuiRadio,
  RadioGroup as MuiRadioGroup,
  Select as MuiSelect,
  Switch as MuiSwitch,
  Table as MuiTable,
  Tabs as MuiTabs,
  TextField as MuiTextField,
  ToggleButton as MuiToggleButton,
  ToggleButtonGroup as MuiToggleButtonGroup,
  Tooltip as MuiTooltip,
  Paper,
  Tab,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
} from "@mui/material";

type AnyProps = Record<string, any> & { children?: ReactNode; className?: string };

function muiVariant(variant: string | undefined): "contained" | "outlined" | "text" {
  if (variant === "outline" || variant === "secondary") return "outlined";
  if (variant === "ghost" || variant === "light" || variant === "tertiary") return "text";
  return "contained";
}

export const Button: any = React.forwardRef<HTMLButtonElement, AnyProps>(function CompatButton(
  { children, onPress, isDisabled, isIconOnly, size, variant, color, onClick, slot, ...props },
  ref,
) {
  const click = onClick ?? onPress;
  if (slot === "close") {
    return (
      <CloseButton
        ref={ref}
        disabled={isDisabled}
        onClick={click}
        size={size === "lg" ? "large" : "small"}
        variant={muiVariant(variant)}
        color={color === "danger" ? "error" : color}
        slot={slot}
        {...props}
      >
        {children}
      </CloseButton>
    );
  }
  if (isIconOnly) {
    return (
      <IconButton
        ref={ref}
        disabled={isDisabled}
        onClick={click}
        size={size === "lg" ? "medium" : "small"}
        color={color === "danger" ? "error" : color}
        {...props}
      >
        {children}
      </IconButton>
    );
  }
  return (
    <MuiButton
      ref={ref}
      disabled={isDisabled}
      onClick={click}
      size={size === "lg" ? "large" : "small"}
      variant={muiVariant(variant)}
      color={color === "danger" ? "error" : color}
      {...props}
    >
      {children}
    </MuiButton>
  );
});
export function buttonVariants({ variant, size, isIconOnly }: AnyProps = {}) {
  return `inline-flex items-center justify-center ${variant === "ghost" ? "hover:bg-accent/10" : ""} ${size === "sm" ? "h-8" : ""} ${isIconOnly ? "aspect-square" : ""}`;
}

const Card: any = (props: AnyProps) => <MuiCard variant="outlined" {...props} />;
Card.Content = (props: AnyProps) => <CardContent {...props} />;
Card.Header = (props: AnyProps) => <CardHeader {...props} />;
Card.Title = (props: AnyProps) => <Typography variant="h6" {...props} />;
Card.Description = (props: AnyProps) => <Typography variant="body2" color="text.secondary" {...props} />;

export { Card };

export const Description = (props: AnyProps) => <Typography variant="body2" color="text.secondary" {...props} />;
export const Label = (props: AnyProps) => <Box component={props.htmlFor ? "label" : "span"} {...props} />;
export const Input = React.forwardRef<HTMLInputElement, AnyProps>((props, ref) => (
  <MuiTextField inputRef={ref} size="small" fullWidth {...props} />
));
export const TextArea = React.forwardRef<HTMLTextAreaElement, AnyProps>((props, ref) => (
  <MuiTextField inputRef={ref} size="small" fullWidth multiline minRows={3} {...props} />
));
export const TextField: any = (props: AnyProps) => <MuiTextField size="small" fullWidth {...props} />;
const InputGroup: any = (props: AnyProps) => <Box className={props.className}>{props.children}</Box>;
InputGroup.Input = (props: AnyProps) => <MuiTextField size="small" fullWidth {...props} />;

export { InputGroup };

const Chip = ({ children, label, color, ...props }: AnyProps) => (
  <MuiChip
    size="small"
    variant="outlined"
    color={color === "danger" ? "error" : color === "accent" ? "primary" : color}
    label={children ?? label}
    {...props}
  />
);

export { Chip };

const Checkbox: any = (props: AnyProps) => {
  const { children, isSelected, isIndeterminate, onChange, isDisabled, ...rest } = props;
  const control = (
    <MuiCheckbox
      checked={isSelected === true}
      indeterminate={isIndeterminate}
      disabled={isDisabled}
      onChange={(e) => onChange?.(e.target.checked)}
      {...rest}
    />
  );
  return children ? <FormControlLabel control={control} label={children} /> : control;
};
Checkbox.Content = (props: AnyProps) => <>{props.children}</>;
Checkbox.Control = (props: AnyProps) => <>{props.children}</>;
Checkbox.Indicator = () => null;

export { Checkbox };

export const Switch: any = ({ children, isSelected, onChange, isDisabled, ...props }: AnyProps) => {
  const control = (
    <MuiSwitch
      checked={isSelected === true}
      disabled={isDisabled}
      onChange={(e) => onChange?.(e.target.checked)}
      {...props}
    />
  );
  return children ? <FormControlLabel control={control} label={children} /> : control;
};
Switch.Control = (props: AnyProps) => <>{props.children}</>;
Switch.Thumb = () => null;

export const Spinner = (props: AnyProps) => <CircularProgress size={props.size === "sm" ? 16 : 20} {...props} />;
export const Skeleton = (props: AnyProps) => (
  <Box className={props.className} sx={{ bgcolor: "action.hover", borderRadius: 1, minHeight: 20 }} {...props} />
);
export const Surface = (props: AnyProps) => <Paper variant="outlined" {...props} />;
export const ScrollShadow = (props: AnyProps) => <Box sx={{ overflow: "auto" }} {...props} />;

function NumberFieldImpl({ children, value, onChange, isDisabled, ...props }: AnyProps) {
  return (
    <MuiTextField
      type="number"
      size="small"
      value={Number.isNaN(value) ? "" : (value ?? "")}
      disabled={isDisabled}
      onChange={(e) => onChange?.(e.target.value === "" ? NaN : Number(e.target.value))}
      {...props}
    />
  );
}
export const NumberField: any = NumberFieldImpl;
NumberField.Group = (props: AnyProps) => <Box className="flex items-center">{props.children}</Box>;
NumberField.Input = (props: AnyProps) => <>{props.children}</>;
NumberField.DecrementButton = () => null;
NumberField.IncrementButton = () => null;

const Select: any = ({ children, selectedKey, onSelectionChange, isDisabled, ...props }: AnyProps) => {
  const items: ReactNode[] = [];
  const collect = (node: ReactNode): void => {
    React.Children.forEach(node, (child) => {
      if (!React.isValidElement(child)) return;
      if (child.type === ListBoxItem || (child.props as AnyProps)?.value !== undefined) items.push(child);
      else collect((child.props as AnyProps).children);
    });
  };
  collect(children);
  return (
    <MuiSelect
      size="small"
      fullWidth
      value={selectedKey ?? ""}
      disabled={isDisabled}
      onChange={(e) => onSelectionChange?.(e.target.value)}
      {...props}
    >
      {items}
    </MuiSelect>
  );
};
Select.Trigger = (props: AnyProps) => <>{props.children}</>;
Select.Value = () => null;
Select.Popover = (props: AnyProps) => <>{props.children}</>;

export { Select };

function ListBoxItem({ id, children, textValue, ...props }: AnyProps) {
  return (
    <MenuItem value={id} {...props}>
      {children ?? textValue}
    </MenuItem>
  );
}
const ListBox: any = ({ children, items, renderEmptyState, onAction, ...props }: AnyProps) => {
  const content = items
    ? items.map((item: AnyProps) => (
        <ListBoxItem key={item.id} id={String(item.id)} onClick={() => onAction?.(String(item.id))}>
          {item.name}
        </ListBoxItem>
      ))
    : children;
  return <>{content ?? renderEmptyState?.()}</>;
};
ListBox.Item = ListBoxItem;

export { ListBox };

function DialogParts({ children }: AnyProps) {
  return <>{children}</>;
}
const DialogContext = React.createContext<{ onOpenChange?: (open: boolean) => void; rooted: boolean }>({
  rooted: false,
});
const CloseButton = ({ onClick, slot, ...props }: AnyProps) => {
  const context = React.useContext(DialogContext);
  return (
    <MuiButton
      onClick={(event) => {
        onClick?.(event);
        if (slot === "close") context.onOpenChange?.(false);
      }}
      {...props}
    />
  );
};
const Modal: any = ({ isOpen, onOpenChange, children }: AnyProps) => (
  <DialogContext.Provider value={{ onOpenChange, rooted: true }}>
    <Dialog open={!!isOpen} onClose={() => onOpenChange?.(false)} fullWidth maxWidth="sm">
      {children}
    </Dialog>
  </DialogContext.Provider>
);
Modal.Backdrop = (props: AnyProps) => {
  const context = React.useContext(DialogContext);
  return context.rooted ? (
    <>{props.children}</>
  ) : (
    <DialogContext.Provider value={{ onOpenChange: props.onOpenChange, rooted: true }}>
      <Dialog open={!!props.isOpen} onClose={() => props.onOpenChange?.(false)} fullWidth maxWidth="sm">
        {props.children}
      </Dialog>
    </DialogContext.Provider>
  );
};
Modal.Container = DialogParts;
Modal.Dialog = (props: AnyProps) => <Box {...props}>{props.children}</Box>;
Modal.CloseTrigger = ({ onClick, ...props }: AnyProps) => {
  const context = React.useContext(DialogContext);
  return (
    <IconButton
      aria-label="关闭"
      size="small"
      onClick={(event) => {
        onClick?.(event);
        context.onOpenChange?.(false);
      }}
      {...props}
    />
  );
};
Modal.Header = (props: AnyProps) => <DialogTitle {...props} />;
Modal.Heading = (props: AnyProps) => <Typography component="h2" variant="h6" {...props} />;
Modal.Footer = (props: AnyProps) => <DialogActions {...props} />;

export { Modal };

const AlertDialog: any = ({ isOpen, onOpenChange, children }: AnyProps) => (
  <DialogContext.Provider value={{ onOpenChange, rooted: true }}>
    <Dialog open={!!isOpen} onClose={() => onOpenChange?.(false)} fullWidth maxWidth="sm">
      {children}
    </Dialog>
  </DialogContext.Provider>
);
AlertDialog.Backdrop = (props: AnyProps) => {
  const context = React.useContext(DialogContext);
  return context.rooted ? (
    <>{props.children}</>
  ) : (
    <DialogContext.Provider value={{ onOpenChange: props.onOpenChange, rooted: true }}>
      <Dialog open={!!props.isOpen} onClose={() => props.onOpenChange?.(false)} fullWidth maxWidth="sm">
        {props.children}
      </Dialog>
    </DialogContext.Provider>
  );
};
AlertDialog.Container = DialogParts;
AlertDialog.Dialog = (props: AnyProps) => <Box {...props}>{props.children}</Box>;
AlertDialog.Header = (props: AnyProps) => <DialogTitle {...props} />;
AlertDialog.Heading = (props: AnyProps) => <Typography component="h2" variant="h6" {...props} />;
AlertDialog.Body = (props: AnyProps) => <DialogContent {...props} />;
AlertDialog.Footer = (props: AnyProps) => <DialogActions {...props} />;

export { AlertDialog };

const Drawer: any = ({ isOpen, onOpenChange, children }: AnyProps) => (
  <DialogContext.Provider value={{ onOpenChange, rooted: true }}>
    <MuiDrawer anchor="right" open={!!isOpen} onClose={() => onOpenChange?.(false)}>
      {children}
    </MuiDrawer>
  </DialogContext.Provider>
);
Drawer.Backdrop = DialogParts;
Drawer.Content = DialogParts;
Drawer.Dialog = (props: AnyProps) => (
  <Box
    sx={{
      width: { xs: "100vw", sm: 760 },
      maxWidth: "100vw",
      height: "100vh",
      display: "flex",
      flexDirection: "column",
    }}
    {...props}
  >
    {props.children}
  </Box>
);
Drawer.CloseTrigger = ({ onClick, ...props }: AnyProps) => {
  const context = React.useContext(DialogContext);
  return (
    <IconButton
      aria-label="关闭"
      size="small"
      onClick={(event) => {
        onClick?.(event);
        context.onOpenChange?.(false);
      }}
      {...props}
    />
  );
};
Drawer.Header = (props: AnyProps) => <Box sx={{ p: 2 }} {...props} />;
Drawer.Heading = (props: AnyProps) => <Typography component="h2" variant="h6" {...props} />;
Drawer.Footer = (props: AnyProps) => <Box sx={{ p: 2 }} {...props} />;

export { Drawer };

const TabsContext = React.createContext<{ selectedKey?: string; onSelectionChange?: (key: string) => void }>({});
const Tabs: any = ({ selectedKey, onSelectionChange, children }: AnyProps) => (
  <TabsContext.Provider value={{ selectedKey, onSelectionChange }}>
    <Box>{children}</Box>
  </TabsContext.Provider>
);
Tabs.ListContainer = (props: AnyProps) => <>{props.children}</>;
Tabs.List = ({ children, selectedKey, onSelectionChange, ...props }: AnyProps) => {
  const context = React.useContext(TabsContext);
  const tabs = React.Children.map(children, (child) => {
    if (!React.isValidElement(child) || child.type !== Tabs.Tab) return child;
    const { id, children: label, ...tabProps } = child.props as AnyProps;
    return <Tab key={child.key ?? id} value={id} label={label} {...tabProps} />;
  });
  return (
    <MuiTabs
      value={selectedKey ?? context.selectedKey ?? false}
      onChange={(_, value) => (onSelectionChange ?? context.onSelectionChange)?.(value)}
      variant="scrollable"
      scrollButtons="auto"
      {...props}
    >
      {tabs}
    </MuiTabs>
  );
};
Tabs.Tab = function CompatTab() {
  return null;
};
Tabs.Panel = ({ id, selectedKey, children, ...props }: AnyProps) => {
  const context = React.useContext(TabsContext);
  return (selectedKey ?? context.selectedKey) === id ? (
    <Box role="tabpanel" {...props}>
      {children}
    </Box>
  ) : null;
};
Tabs.Indicator = () => null;

export { Tabs };

const Table: any = (props: AnyProps) => (
  <TableContainer>
    <MuiTable size="small" {...props} />
  </TableContainer>
);
Table.ScrollContainer = (props: AnyProps) => <TableContainer {...props} />;
Table.Content = (props: AnyProps) => {
  const { selectionMode, selectedKeys, onSelectionChange, sortDescriptor, onSortChange, children, ...rest } = props;
  return (
    <MuiTable aria-label={rest["aria-label"]} size="small" {...rest}>
      {children}
    </MuiTable>
  );
};
Table.Header = (props: AnyProps) => <TableHead {...props} />;
Table.Body = (props: AnyProps) => <TableBody {...props} />;
Table.Row = (props: AnyProps) => <TableRow hover {...props} />;
Table.Column = ({ isRowHeader, allowsSorting, children, ...props }: AnyProps) => (
  <TableCell component="th" scope="col" {...props}>
    {children}
  </TableCell>
);
Table.Cell = (props: AnyProps) => <TableCell {...props} />;
Table.SortableColumnHeader = ({ children, sortDirection, onClick, ...props }: AnyProps) => (
  <MuiButton type="button" variant="text" size="small" onClick={onClick} {...props}>
    {children}
    {sortDirection === "ascending" ? " ↑" : sortDirection === "descending" ? " ↓" : ""}
  </MuiButton>
);

export { Table };

const SearchField: any = ({ value, onChange, children, ...props }: AnyProps) => (
  <MuiTextField
    type="search"
    size="small"
    value={value ?? ""}
    onChange={(e) => onChange?.(e.target.value)}
    fullWidth
    {...props}
  >
    {children}
  </MuiTextField>
);
SearchField.Group = (props: AnyProps) => <>{props.children}</>;
SearchField.Input = (props: AnyProps) => <>{props.children}</>;
SearchField.SearchIcon = () => null;
SearchField.ClearButton = () => null;

export { SearchField };

const Disclosure: any = (props: AnyProps) => (
  <MuiAccordion disableGutters elevation={0} {...props}>
    {React.Children.toArray(props.children)}
  </MuiAccordion>
);
Disclosure.Heading = (props: AnyProps) => <AccordionSummary {...props} />;
Disclosure.Trigger = (props: AnyProps) => <Typography component="span" {...props} />;
Disclosure.Content = (props: AnyProps) => <AccordionDetails {...props} />;
Disclosure.Body = (props: AnyProps) => <>{props.children}</>;

export { Disclosure };

export const Avatar: any = ({ children, ...props }: AnyProps) => <MuiAvatar {...props}>{children}</MuiAvatar>;
Avatar.Image = (props: AnyProps) => <CardMedia component="img" {...props} />;
Avatar.Fallback = (props: AnyProps) => <>{props.children}</>;
export const Tooltip: any = ({ children, ...props }: AnyProps) => (
  <MuiTooltip title={props.title ?? props.children}>{(children ?? <span />) as React.ReactElement}</MuiTooltip>
);
Tooltip.Content = (props: AnyProps) => <>{props.children}</>;
export const RadioGroup = (props: AnyProps) => <MuiRadioGroup {...props} />;
export const Radio: any = ({ children, value, ...props }: AnyProps) => (
  <FormControlLabel value={value} control={<MuiRadio {...props} />} label={children} />
);
Radio.Content = (props: AnyProps) => <>{props.children}</>;
Radio.Control = (props: AnyProps) => <>{props.children}</>;
Radio.Indicator = () => null;
export const ToggleButtonGroup: any = ({ selectedKeys, onSelectionChange, children, ...props }: AnyProps) => (
  <MuiToggleButtonGroup
    value={selectedKeys ? [...selectedKeys][0] : null}
    exclusive
    onChange={(_, value) => value != null && onSelectionChange?.(new Set([value]))}
    {...props}
  >
    {children}
  </MuiToggleButtonGroup>
);
export const ToggleButton: any = ({ id, children, ...props }: AnyProps) => (
  <MuiToggleButton value={id} {...props}>
    {children}
  </MuiToggleButton>
);
export const Meter: any = ({ value, ...props }: AnyProps) => (
  <LinearProgress variant="determinate" value={value} {...props} />
);
Meter.Track = (props: AnyProps) => <>{props.children}</>;
Meter.Fill = (props: AnyProps) => <LinearProgress {...props} />;
export const Fieldset = (props: AnyProps) => <Box component="fieldset" {...props} />;
export const ComboBox: any = (props: AnyProps) => <Box {...props}>{props.children}</Box>;
ComboBox.InputGroup = (props: AnyProps) => <Box {...props}>{props.children}</Box>;
ComboBox.Trigger = () => null;
ComboBox.Popover = (props: AnyProps) => <Box sx={{ maxHeight: 280, overflow: "auto" }}>{props.children}</Box>;

export const Alert = (props: AnyProps) => <Paper variant="outlined" {...props} />;
export const Separator = (props: AnyProps) => <Divider {...props} />;
