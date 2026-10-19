"use client";

// Both surfaces use Material UI's modal Drawer: focus trapping, Escape, nested
// overlays, scroll lock and return focus stay consistent with side sheets.
import * as React from "react";
import { Sheet, SheetTrigger, SheetClose, SheetContent, SheetHeader, SheetFooter, SheetTitle, SheetDescription, SheetPortal, SheetOverlay } from "./sheet";

const Drawer = Sheet;
const DrawerTrigger = SheetTrigger;
const DrawerClose = SheetClose;
const DrawerPortal = SheetPortal;
const DrawerOverlay = SheetOverlay;
const DrawerHeader = SheetHeader;
const DrawerFooter = SheetFooter;
const DrawerTitle = SheetTitle;
const DrawerDescription = SheetDescription;
function DrawerContent({ side = "bottom", ...props }: React.ComponentProps<typeof SheetContent>) {
  return <SheetContent side={side} {...props} />;
}
export { Drawer, DrawerPortal, DrawerOverlay, DrawerTrigger, DrawerClose, DrawerContent, DrawerHeader, DrawerFooter, DrawerTitle, DrawerDescription };

