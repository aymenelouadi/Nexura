import { BoxesIcon } from 'lucide-react';

import { useSidebar } from '../state/sidebar-context.js';
import { Brand } from './brand.js';
import { useNavigationGroups } from './app-navigation.js';
import { SidebarCollapseButton, SidebarNavGroup } from './sidebar/index.js';

export function AppSidebar() {
  const { collapsed, toggle } = useSidebar();
  const groups = useNavigationGroups();
  const primaryGroups = groups.filter((group) => group.type === 'primary');
  const footerGroup = groups.find((group) => group.type === 'footer');

  return (
    <aside
      className={cn(
        'fixed inset-y-0 left-0 hidden flex-col border-r border-border bg-sidebar transition-all duration-200 ease-in-out lg:flex',
        collapsed ? 'w-[72px] items-center px-2' : 'w-64 px-3',
      )}
    >
      <div
        className={cn(
          'flex h-16 shrink-0 items-center',
          collapsed ? 'justify-center' : 'justify-between px-1',
        )}
      >
        <Brand compact={collapsed} />
      </div>

      <div className="flex flex-1 flex-col overflow-y-auto py-4">
        <nav className="flex flex-col gap-6" aria-label="Primary navigation">
          {primaryGroups.map((group) => (
            <SidebarNavGroup
              key={group.label}
              label={group.label}
              items={group.items}
              collapsed={collapsed}
            />
          ))}
        </nav>
      </div>

      <div
        className={cn(
          'flex shrink-0 flex-col border-t border-border py-3',
          collapsed ? 'items-center gap-2' : 'gap-2',
        )}
      >
        {!collapsed && <OpenSourceCard />}
        {footerGroup && (
          <SidebarNavGroup
            label={footerGroup.label}
            items={footerGroup.items}
            collapsed={collapsed}
          />
        )}
        <div className={cn('flex', collapsed ? 'justify-center' : 'justify-end px-1')}> 
          <SidebarCollapseButton collapsed={collapsed} onToggle={toggle} />
        </div>
      </div>
    </aside>
  );
}

function OpenSourceCard() {
  return (
    <div className="border-b border-border pb-3">
      <div className="flex items-center gap-3 rounded-[10px] bg-sidebar-accent px-3 py-3">
        <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
          <BoxesIcon className="size-4" aria-hidden="true" />
        </span>
        <div className="min-w-0">
          <p className="truncate text-xs font-medium text-sidebar-foreground">Open-source core</p>
          <p className="truncate text-xs text-muted-foreground">Core runtime 2.5</p>
        </div>
      </div>
    </div>
  );
}

function cn(...classes: Array<string | false | null | undefined>): string {
  return classes.filter(Boolean).join(' ');
}
