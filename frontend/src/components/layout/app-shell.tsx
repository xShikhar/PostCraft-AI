"use client";
import { useState, type ReactNode } from "react";
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
  const { logout } = useAuth();
  const nav = (v: WorkspaceView) => {
    setMobile(false);
    onNavigate(v);
  };
  const sidebar = (
    <Sidebar
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
    <div className="min-h-screen">
      <a href="#workspace-content" className="skip-link">
        Skip to content
      </a>
      <aside className="workspace-sidebar-surface hidden lg:block fixed inset-y-0 left-0 w-[236px] bg-surface-subtle border-r border-border-subtle z-40">
        {sidebar}
      </aside>
      <Dialog open={mobile} onOpenChange={setMobile}>
        <DialogContent className="workspace-drawer !left-0 !top-0 !translate-x-0 !translate-y-0 !h-dvh !max-w-[290px] !rounded-none !p-0 !gap-0 overflow-auto">
          <DialogTitle className="sr-only">Workspace navigation</DialogTitle>
          <DialogDescription className="sr-only">
            Navigate PostCraft and manage your session.
          </DialogDescription>
          {sidebar}
        </DialogContent>
      </Dialog>
      <div className="lg:pl-[236px]">
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
