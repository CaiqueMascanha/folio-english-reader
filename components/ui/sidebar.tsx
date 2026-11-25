'use client';

// Sidebar from shadcn/ui (Base UI), adapted for Folio. See licenses/shadcn-ui.txt.
import { Dialog } from '@base-ui/react/dialog';
import { mergeProps } from '@base-ui/react/merge-props';
import { useRender } from '@base-ui/react/use-render';
import { PanelLeft, X } from 'lucide-react';
import {
  createContext, useCallback, useContext, useEffect, useRef, useState, useSyncExternalStore,
  type ComponentProps, type ReactNode, type RefObject,
} from 'react';
import { cn } from '@/lib/utils';

const mobileQuery = '(max-width: 1023.98px)';

function subscribeToViewport(notify: () => void) {
  const media = window.matchMedia(mobileQuery);
  media.addEventListener('change', notify);
  return () => media.removeEventListener('change', notify);
}

type SidebarContextValue = {
  open: boolean;
  openMobile: boolean;
  isMobile: boolean;
  setOpenMobile: (open: boolean) => void;
  toggleSidebar: () => void;
  trigger: RefObject<HTMLButtonElement | null>;
};

const SidebarContext = createContext<SidebarContextValue | null>(null);

export function useSidebar() {
  const value = useContext(SidebarContext);
  if (!value) throw new Error('useSidebar requires a SidebarProvider');
  return value;
}

export function SidebarProvider({ defaultOpen, children }: { defaultOpen: boolean; children: ReactNode }) {
  const [open, setOpen] = useState(defaultOpen);
  const [openMobile, setOpenMobile] = useState(false);
  const trigger = useRef<HTMLButtonElement>(null);
  const isMobile = useSyncExternalStore(subscribeToViewport, () => window.matchMedia(mobileQuery).matches, () => false);

  const toggleSidebar = useCallback(() => {
    if (isMobile) {
      setOpenMobile((current) => !current);
    } else {
      setOpen(!open);
      document.cookie = `sidebar_state=${!open}; path=/; max-age=604800; SameSite=Lax`;
    }
  }, [isMobile, open]);

  useEffect(() => {
    if (!isMobile) setOpenMobile(false);
  }, [isMobile]);

  useEffect(() => {
    function handleShortcut(event: KeyboardEvent) {
      if (event.key.toLowerCase() !== 'b' || !(event.ctrlKey || event.metaKey)) return;
      if (event.target instanceof HTMLElement && event.target.closest('input, textarea, [contenteditable=true], [role=dialog]')) return;
      event.preventDefault();
      toggleSidebar();
    }
    window.addEventListener('keydown', handleShortcut);
    return () => window.removeEventListener('keydown', handleShortcut);
  }, [toggleSidebar]);

  return (
    <SidebarContext.Provider value={{ open, openMobile, setOpenMobile, isMobile, toggleSidebar, trigger }}>
      <div data-slot="sidebar-wrapper" className="flex min-h-dvh w-full">{children}</div>
    </SidebarContext.Provider>
  );
}

export function SidebarTrigger() {
  const { open, openMobile, isMobile, toggleSidebar, trigger } = useSidebar();
  const expanded = isMobile ? openMobile : open;
  const label = isMobile ? 'Abrir menu' : expanded ? 'Recolher barra lateral' : 'Expandir barra lateral';
  return (
    <button ref={trigger} type="button" data-slot="sidebar-trigger" aria-label={label} title={label}
      aria-expanded={expanded} aria-haspopup={isMobile ? 'dialog' : undefined} aria-controls="folio-sidebar"
      onClick={toggleSidebar} className="grid size-11 shrink-0 place-items-center rounded-lg text-violet-200 hover:bg-white/8">
      <PanelLeft size={20} />
    </button>
  );
}

export function Sidebar({ children, collapsible }: { children: ReactNode; collapsible: 'icon' }) {
  const { open, openMobile, isMobile, setOpenMobile, trigger } = useSidebar();
  if (isMobile) {
    return (
      <Dialog.Root open={openMobile} onOpenChange={setOpenMobile}>
        <Dialog.Portal>
          <Dialog.Backdrop className="fixed inset-0 z-40 bg-black/65 transition-opacity duration-200 data-ending-style:opacity-0 data-starting-style:opacity-0 motion-reduce:transition-none" />
          <Dialog.Popup id="folio-sidebar" finalFocus={trigger} data-slot="sidebar" data-mobile="true"
            className="fixed inset-y-0 left-0 z-50 flex h-dvh w-[min(18rem,90vw)] flex-col bg-sidebar text-sidebar-foreground shadow-2xl outline-none transition-transform duration-200 data-ending-style:-translate-x-full data-starting-style:-translate-x-full motion-reduce:transition-none">
            <Dialog.Title className="sr-only">Navegação da estante</Dialog.Title>
            <Dialog.Close aria-label="Fechar menu" className="absolute top-3 right-2 grid size-11 place-items-center rounded-md hover:bg-white/8"><X size={18} /></Dialog.Close>
            {children}
          </Dialog.Popup>
        </Dialog.Portal>
      </Dialog.Root>
    );
  }

  return (
    <aside id="folio-sidebar" data-slot="sidebar" data-state={open ? 'expanded' : 'collapsed'}
      data-collapsible={open ? undefined : collapsible}
      className="group sticky top-0 hidden h-dvh w-60 shrink-0 flex-col bg-sidebar text-sidebar-foreground transition-[width] duration-200 data-[collapsible=icon]:w-16 motion-reduce:transition-none lg:flex">
      {children}
    </aside>
  );
}

export function SidebarHeader({ children }: { children: ReactNode }) {
  return <div data-slot="sidebar-header" className="flex min-h-[68px] items-center px-3">{children}</div>;
}

export function SidebarContent({ children }: { children: ReactNode }) {
  return <nav aria-label="Navegação principal" data-slot="sidebar-content" className="flex min-h-0 flex-1 flex-col gap-6 overflow-y-auto px-1 py-3">{children}</nav>;
}

export function SidebarGroup({ label, children }: { label: string; children: ReactNode }) {
  return (
    <section data-slot="sidebar-group" aria-label={label} className="px-2">
      <h2 data-slot="sidebar-group-label" className="px-3 py-2 text-[11px] font-semibold tracking-wider text-muted-foreground group-data-[collapsible=icon]:sr-only">{label}</h2>
      {children}
    </section>
  );
}

export function SidebarMenu({ children }: { children: ReactNode }) {
  return <ul data-slot="sidebar-menu" className="flex min-w-0 flex-col gap-1">{children}</ul>;
}

export function SidebarMenuItem({ children }: { children: ReactNode }) {
  return <li data-slot="sidebar-menu-item">{children}</li>;
}

export function SidebarMenuButton({ render, isActive = false, className, ...props }:
  useRender.ComponentProps<'button'> & ComponentProps<'button'> & { isActive?: boolean }) {
  return useRender({
    defaultTagName: 'button',
    render,
    state: { slot: 'sidebar-menu-button', sidebar: 'menu-button', active: isActive },
    props: mergeProps<'button'>({
      className: cn('flex min-h-11 w-full items-center gap-3 overflow-hidden rounded-lg px-3 text-left text-sm transition-colors hover:bg-white/5 data-active:font-semibold group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:px-0 group-data-[collapsible=icon]:[&>span]:hidden', className),
    }, props),
  });
}

