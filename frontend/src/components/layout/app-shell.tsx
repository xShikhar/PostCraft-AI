"use client";
import { useEffect, useState, type ReactNode } from "react";
import { useSidebarPreference } from "./use-sidebar-preference";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { Sidebar, type WorkspaceView } from "./sidebar";
import { TopHeader } from "./top-header";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { useAuth } from "@/features/auth/hooks/use-auth";
export function AppShell({
  children,
  currentView,
  onNavigate,
  onNewPost,
  onOpenGeneration,
  headerTitle,
  username = "",
  isAdmin = false,
  onLogout,
}: {
  children: ReactNode;
  currentView: WorkspaceView;
  onNavigate: (v: WorkspaceView) => void;
  onNewPost: () => void;
  onOpenGeneration: (id: string) => void;
  headerTitle: string;
  username?: string;
  initials?: string;
  isAdmin?: boolean;
  onLogout?: () => void;
}) {
  const [mobile, setMobile] = useState(false);
  const { collapsed, toggle: toggleSidebar } = useSidebarPreference();
  useEffect(() => {
    // Re-measure native scroll scenes after the coordinated width transition.
    const timer = window.setTimeout(() => ScrollTrigger.refresh(), 600);
    return () => window.clearTimeout(timer);
  }, [collapsed]);
  const { logout } = useAuth();
  const nav = (v: WorkspaceView) => {
    setMobile(false);
    onNavigate(v);
  };
  const sidebar = (drawer = false) => (
    <Sidebar
      collapsed={!drawer && collapsed}
      onToggle={drawer ? () => setMobile(false) : toggleSidebar}
      drawer={drawer}
      currentView={currentView}
      onNavigate={nav}
      onNewPost={() => {
        setMobile(false);
        onNewPost();
      }}
      onLogout={onLogout || logout}
      username={username}
      isAdmin={isAdmin}
    />
  );
  return (
    <div className="workspace-shell min-h-screen" data-sidebar-collapsed={collapsed}>
      <a href="#workspace-content" className="skip-link">
        Skip to content
      </a>
      <aside className="workspace-sidebar-surface hidden lg:block fixed inset-y-0 left-0 bg-surface-subtle border-r border-border-subtle z-40">
        {sidebar()}
      </aside>
      <Dialog open={mobile} onOpenChange={setMobile}>
        <DialogContent className="workspace-drawer !left-0 !top-0 !translate-x-0 !translate-y-0 !h-dvh !max-w-[290px] !rounded-none !p-0 !gap-0 overflow-auto">
          <DialogTitle className="sr-only">Workspace navigation</DialogTitle>
          <DialogDescription className="sr-only">
            Navigate PostCraft and manage your session.
          </DialogDescription>
          {sidebar(true)}
        </DialogContent>
      </Dialog>
      <div className="workspace-main">
        <TopHeader
          title={headerTitle}
          username={username}
          onMenu={() => setMobile(true)}
          onProfile={() => nav("profile")}
          onOpenGeneration={onOpenGeneration}
        />
        <div
          id="workspace-content"
          className="max-w-[1440px] mx-auto px-5 sm:px-8 lg:px-10 py-8 sm:py-10"
        >
          {children}
        </div>
      </div>
    </div>
  );
}
