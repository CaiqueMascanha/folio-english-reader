'use client';

import Link from 'next/link';
import { BookOpen, Bookmark, CircleHelp, Globe2, LibraryBig, NotebookPen } from 'lucide-react';
import {
  Sidebar, SidebarContent, SidebarGroup, SidebarHeader, SidebarMenu,
  SidebarMenuButton, SidebarMenuItem, useSidebar,
} from '@/components/ui/sidebar';

export const catalogUrl = 'https://english-e-reader.net/';
export const sections = [
  { id: 'all', label: 'Minha estante', icon: LibraryBig },
  { id: 'reading', label: 'Lendo agora', icon: BookOpen },
  { id: 'favorites', label: 'Favoritos', icon: Bookmark },
] as const;
export type LibraryView = (typeof sections)[number]['id'];

type LibrarySidebarProps = {
  view: LibraryView;
  counts: Record<LibraryView, number>;
  onView: (view: LibraryView) => void;
  onHelp: () => void;
};

export function LibrarySidebar({ view, counts, onView, onHelp }: LibrarySidebarProps) {
  const { setOpenMobile } = useSidebar();
  function select(next: LibraryView) {
    setOpenMobile(false);
    onView(next);
  }

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <button type="button" className="flex min-h-11 items-center gap-2 rounded-md text-left" onClick={() => select('all')} aria-label="Folio, voltar para a estante">
          <img src="/folio-mark.svg" width="38" height="38" alt="" />
          <strong className="text-3xl font-extrabold tracking-tighter group-data-[collapsible=icon]:hidden">folio<span className="text-lime-300">.</span></strong>
        </button>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup label="Biblioteca">
          <SidebarMenu>
            {sections.map(({ id, label, icon: Icon }) => (
              <SidebarMenuItem key={id}>
                <SidebarMenuButton isActive={view === id} aria-current={view === id ? 'page' : undefined}
                  aria-label={label} title={label} onClick={() => select(id)}>
                  <Icon size={19} /><span>{label}</span>
                  {counts[id] > 0 && <span className="ml-auto rounded-md bg-white/8 px-1.5 text-xs tabular-nums">{counts[id]}</span>}
                </SidebarMenuButton>
              </SidebarMenuItem>
            ))}
          </SidebarMenu>
        </SidebarGroup>
        <SidebarGroup label="Recursos">
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton render={<Link href="/vocabulary" />} title="Vocabulário" aria-label="Vocabulário" onClick={() => setOpenMobile(false)}>
                <NotebookPen size={19} /><span>Vocabulário</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
            <SidebarMenuItem>
              <SidebarMenuButton render={<a href={catalogUrl} target="_blank" rel="noreferrer" />} title="English e-Reader" aria-label="English e-Reader" onClick={() => setOpenMobile(false)}>
                <Globe2 size={19} /><span>English e-Reader</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
            <SidebarMenuItem>
              <SidebarMenuButton title="Como importar" aria-label="Como importar" onClick={() => { setOpenMobile(false); onHelp(); }}>
                <CircleHelp size={19} /><span>Como importar</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
}
