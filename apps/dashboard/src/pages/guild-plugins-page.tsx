import {
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnDef,
  type SortingState,
} from '@tanstack/react-table';
import Fuse from 'fuse.js';
import {
  Alert,
  AlertDescription,
  AlertTitle,
  Badge,
  Button,
  Card,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Skeleton,
  Spinner,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@nexura/ui';
import type { GuildPlugin } from '@nexura/types';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  AlertCircleIcon,
  ArrowLeftIcon,
  CogIcon,
  EyeIcon,
  FileClockIcon,
  FilterIcon,
  MoreHorizontalIcon,
  PackageIcon,
  PowerIcon,
  PowerOffIcon,
  RefreshCwIcon,
  SearchIcon,
  TrashIcon,
  UploadIcon,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { ErrorState } from '../components/error-state.js';
import { PageHeader } from '../components/page-header.js';
import { PluginUploadDialog } from '../components/plugin-upload-dialog.js';
import { guildPluginsQuery } from '../hooks/queries.js';
import { useGuildWorkspace } from '../hooks/use-guild-workspace.js';
import { api } from '../lib/api-client.js';
import { getGuildDashboardPath, getGuildPluginPath } from '../lib/guild-actions.js';

interface PluginMutation {
  pluginId: string;
  enabled: boolean;
}

type StatusFilter = 'all' | 'enabled' | 'disabled';

export function GuildPluginsPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { guildId, guild } = useGuildWorkspace();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [uploadOpen, setUploadOpen] = useState(false);

  const plugins = useQuery({
    ...guildPluginsQuery(guildId),
    enabled: guild.data?.botConnected === true,
  });

  const updatePlugin = useMutation({
    mutationFn: ({ pluginId, enabled }: PluginMutation) =>
      enabled
        ? api.enableGuildPlugin(guildId, pluginId)
        : api.disableGuildPlugin(guildId, pluginId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['guilds', guildId, 'plugins'] });
    },
  });

  if (guild.isLoading) {
    return <PluginPageSkeleton />;
  }
  if (guild.isError) {
    return <ErrorState message={guild.error.message} onRetry={() => void guild.refetch()} />;
  }
  if (!guild.data) {
    return <PluginPageSkeleton />;
  }

  const guildData = guild.data;
  if (!guildData.botConnected) {
    return (
      <ErrorState
        title="Bot connection required"
        message="Connect the Nexura bot before managing plugins for this server."
        onRetry={() => navigate(getGuildDashboardPath(guildId))}
      />
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        eyebrow={guildData.name}
        title="Plugins"
        description="Manage installed extensions and upload new plugins for this server."
        actions={
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => void plugins.refetch()}>
              <RefreshCwIcon className="size-4" />
              <span className="hidden sm:inline">Refresh</span>
            </Button>
            <Button size="sm" onClick={() => setUploadOpen(true)}>
              <UploadIcon className="size-4" />
              Upload plugin
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate(getGuildDashboardPath(guildId))}
            >
              <ArrowLeftIcon className="size-4" />
              Server
            </Button>
          </div>
        }
      />

      {updatePlugin.isError ? (
        <Alert variant="destructive">
          <AlertCircleIcon aria-hidden="true" />
          <AlertTitle>Unable to update plugin</AlertTitle>
          <AlertDescription>{updatePlugin.error.message}</AlertDescription>
        </Alert>
      ) : null}

      {plugins.isLoading ? <PluginTableSkeleton /> : null}
      {plugins.isError ? (
        <ErrorState message={plugins.error.message} onRetry={() => void plugins.refetch()} />
      ) : null}
      {plugins.isSuccess ? (
        <PluginManager
          plugins={plugins.data.data}
          search={search}
          onSearchChange={setSearch}
          statusFilter={statusFilter}
          onStatusFilterChange={setStatusFilter}
        pendingPluginId={updatePlugin.isPending ? updatePlugin.variables?.pluginId : null}
        onToggle={(pluginId, enabled) => updatePlugin.mutate({ pluginId, enabled })}
        onManage={(pluginId) => navigate(getGuildPluginPath(guildId, pluginId))}
        onLogs={(pluginId) => navigate(`${getGuildPluginPath(guildId, pluginId)}?tab=logs`)}
        onUpload={() => setUploadOpen(true)}
      />
      ) : null}

      <PluginUploadDialog guildId={guildId} open={uploadOpen} onOpenChange={setUploadOpen} />
    </div>
  );
}

interface PluginManagerProps {
  plugins: GuildPlugin[];
  search: string;
  onSearchChange: (value: string) => void;
  statusFilter: StatusFilter;
  onStatusFilterChange: (value: StatusFilter) => void;
  pendingPluginId: string | null;
  onToggle: (pluginId: string, enabled: boolean) => void;
  onManage: (pluginId: string) => void;
  onLogs: (pluginId: string) => void;
  onUpload: () => void;
}

function PluginManager({
  plugins,
  search,
  onSearchChange,
  statusFilter,
  onStatusFilterChange,
  pendingPluginId,
  onToggle,
  onManage,
  onLogs,
  onUpload,
}: PluginManagerProps) {
  const filteredPlugins = useFilteredPlugins(plugins, search, statusFilter);
  const [sorting, setSorting] = useState<SortingState>([{ id: 'name', desc: false }]);

  const columns = useMemo<ColumnDef<GuildPlugin>[]>(
    () => [
      {
        id: 'icon',
        header: '',
        cell: () => (
          <span className="flex size-8 items-center justify-center rounded-md bg-muted text-muted-foreground">
            <PackageIcon className="size-4" aria-hidden="true" />
          </span>
        ),
        enableSorting: false,
      },
      {
        accessorKey: 'name',
        header: 'Name',
        cell: ({ row }) => (
          <div className="flex flex-col">
            <span className="font-medium">{row.original.name}</span>
            <span className="font-mono text-xs text-muted-foreground">{row.original.id}</span>
          </div>
        ),
      },
      {
        accessorKey: 'version',
        header: 'Version',
        cell: ({ row }) => <span className="text-sm">v{row.original.version}</span>,
      },
      {
        accessorKey: 'author',
        header: 'Author',
        cell: ({ row }) => <span className="text-sm">{row.original.author}</span>,
      },
      {
        accessorKey: 'status',
        header: 'Status',
        cell: ({ row }) => <PluginStatusBadge plugin={row.original} />,
      },
      {
        accessorKey: 'enabled',
        header: 'Enabled',
        cell: ({ row }) => (
          <Badge variant={row.original.enabled ? 'success' : 'outline'}>
            {row.original.enabled ? 'Enabled' : 'Disabled'}
          </Badge>
        ),
      },
      {
        accessorKey: 'updatedAt',
        header: 'Updated',
        cell: ({ row }) => (
          <span className="text-sm text-muted-foreground">
            {new Date(row.original.updatedAt).toLocaleDateString()}
          </span>
        ),
      },
      {
        id: 'actions',
        header: '',
        cell: ({ row }) => (
          <PluginActions
            plugin={row.original}
            pending={pendingPluginId === row.original.id}
            onToggle={() => onToggle(row.original.id, !row.original.enabled)}
            onManage={() => onManage(row.original.id)}
            onLogs={() => onLogs(row.original.id)}
          />
        ),
        enableSorting: false,
      },
    ],
    [onToggle, onManage, onLogs, pendingPluginId],
  );

  const table = useReactTable({
    data: filteredPlugins,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
  });

  if (plugins.length === 0) {
    return <NoPlugins onUpload={onUpload} />;
  }

  return (
    <Card className="gap-0 overflow-hidden py-0">
      <div className="flex flex-col gap-3 border-b border-border px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative max-w-sm flex-1">
          <SearchIcon className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search plugins..."
            value={search}
            onChange={(event) => onSearchChange(event.target.value)}
            className="pl-9"
          />
        </div>
        <div className="flex items-center gap-2">
          <FilterIcon className="size-4 text-muted-foreground" />
          <Select value={statusFilter} onValueChange={(value) => onStatusFilterChange(value as StatusFilter)}>
            <SelectTrigger className="w-32">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="enabled">Enabled</SelectItem>
              <SelectItem value="disabled">Disabled</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {filteredPlugins.length === 0 ? (
        <div className="flex min-h-48 flex-col items-center justify-center gap-3 px-6 py-12 text-center">
          <span className="flex size-11 items-center justify-center rounded-lg bg-muted text-muted-foreground">
            <SearchIcon className="size-5" />
          </span>
          <p className="font-medium">No plugins match</p>
          <p className="text-sm text-muted-foreground">Try adjusting the search or filters.</p>
        </div>
      ) : (
        <>
          <div className="hidden md:block">
            <Table>
              <TableHeader>
                {table.getHeaderGroups().map((headerGroup) => (
                  <TableRow key={headerGroup.id}>
                    {headerGroup.headers.map((header) => (
                      <TableHead key={header.id}>
                        {header.isPlaceholder
                          ? null
                          : flexRender(header.column.columnDef.header, header.getContext())}
                      </TableHead>
                    ))}
                  </TableRow>
                ))}
              </TableHeader>
              <TableBody>
                {table.getRowModel().rows.map((row) => (
                  <TableRow key={row.id} data-testid={`plugin-row-${row.original.id}`}>
                    {row.getVisibleCells().map((cell) => (
                      <TableCell key={cell.id}>
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </TableCell>
                    ))}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <div className="grid gap-4 p-4 md:hidden">
            {filteredPlugins.map((plugin) => (
              <PluginCard
                key={plugin.id}
                plugin={plugin}
                pending={pendingPluginId === plugin.id}
                onToggle={() => onToggle(plugin.id, !plugin.enabled)}
                onManage={() => onManage(plugin.id)}
                onLogs={() => onLogs(plugin.id)}
              />
            ))}
          </div>
        </>
      )}
    </Card>
  );
}

function useFilteredPlugins(
  plugins: GuildPlugin[],
  search: string,
  statusFilter: StatusFilter,
): GuildPlugin[] {
  return useMemo(() => {
    let result = plugins;

    if (statusFilter !== 'all') {
      result = result.filter((plugin) =>
        statusFilter === 'enabled' ? plugin.enabled : !plugin.enabled,
      );
    }

    if (search.trim()) {
      const fuse = new Fuse(result, {
        keys: ['name', 'id', 'description', 'author'],
        threshold: 0.4,
      });
      result = fuse.search(search).map((item) => item.item);
    }

    return result;
  }, [plugins, search, statusFilter]);
}

function PluginStatusBadge({ plugin }: { plugin: GuildPlugin }) {
  if (plugin.status === 'ERROR') {
    return (
      <Badge variant="destructive">
        <AlertCircleIcon className="mr-1 size-3" />
        Error
      </Badge>
    );
  }
  return <Badge variant="secondary">Installed</Badge>;
}

interface PluginActionsProps {
  plugin: GuildPlugin;
  pending: boolean;
  onToggle: () => void;
  onManage: () => void;
  onLogs: () => void;
}

function PluginActions({ plugin, pending, onToggle, onManage, onLogs }: PluginActionsProps) {
  const hasDashboard = plugin.dashboard !== null;

  return (
    <div className="flex items-center justify-end gap-2">
      <Button
        size="sm"
        variant={plugin.enabled ? 'outline' : 'default'}
        disabled={pending}
        onClick={onToggle}
      >
        {pending ? (
          <Spinner />
        ) : plugin.enabled ? (
          <PowerOffIcon className="mr-1 size-4" />
        ) : (
          <PowerIcon className="mr-1 size-4" />
        )}
        {pending ? 'Updating' : plugin.enabled ? 'Disable' : 'Enable'}
      </Button>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button size="sm" variant="ghost">
            <MoreHorizontalIcon className="size-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {plugin.enabled && hasDashboard ? (
            <DropdownMenuItem onClick={onManage} aria-label={`Manage ${plugin.name}`}>
              <CogIcon className="mr-2 size-4" />
              Manage
            </DropdownMenuItem>
          ) : null}
          {plugin.enabled && !hasDashboard ? (
            <DropdownMenuItem disabled>
              <EyeIcon className="mr-2 size-4" />
              No dashboard
            </DropdownMenuItem>
          ) : null}
          <DropdownMenuItem onClick={onLogs}>
            <FileClockIcon className="mr-2 size-4" />
            View logs
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem disabled>
            <RefreshCwIcon className="mr-2 size-4" />
            Update
          </DropdownMenuItem>
          <DropdownMenuItem disabled className="text-destructive focus:text-destructive">
            <TrashIcon className="mr-2 size-4" />
            Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

function PluginCard({
  plugin,
  pending,
  onToggle,
  onManage,
  onLogs,
}: {
  plugin: GuildPlugin;
  pending: boolean;
  onToggle: () => void;
  onManage: () => void;
  onLogs: () => void;
}) {
  const hasDashboard = plugin.dashboard !== null;

  return (
    <div className="flex flex-col gap-4 rounded-lg border border-border bg-card p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="flex size-9 items-center justify-center rounded-md bg-muted text-muted-foreground">
            <PackageIcon className="size-4" />
          </span>
          <div>
            <p className="font-medium">{plugin.name}</p>
            <p className="font-mono text-xs text-muted-foreground">{plugin.id}</p>
          </div>
        </div>
        <PluginStatusBadge plugin={plugin} />
      </div>
      <div className="grid grid-cols-2 gap-2 text-sm">
        <div>
          <p className="text-xs text-muted-foreground">Version</p>
          <p>v{plugin.version}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Author</p>
          <p>{plugin.author}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Status</p>
          <p>{plugin.enabled ? 'Enabled' : 'Disabled'}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Updated</p>
          <p>{new Date(plugin.updatedAt).toLocaleDateString()}</p>
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button
          size="sm"
          variant={plugin.enabled ? 'outline' : 'default'}
          disabled={pending}
          onClick={onToggle}
          className="flex-1"
        >
          {pending ? <Spinner /> : plugin.enabled ? 'Disable' : 'Enable'}
        </Button>
        {plugin.enabled && hasDashboard ? (
          <Button size="sm" variant="outline" onClick={onManage} aria-label={`Manage ${plugin.name}`}>
            Manage
          </Button>
        ) : null}
        <Button size="sm" variant="ghost" onClick={onLogs}>
          Logs
        </Button>
      </div>
    </div>
  );
}

function NoPlugins({ onUpload }: { onUpload: () => void }) {
  return (
    <Empty className="min-h-72 border-solid bg-card">
      <EmptyHeader>
        <span className="flex size-11 items-center justify-center rounded-lg bg-muted text-muted-foreground">
          <PackageIcon className="size-5" aria-hidden="true" />
        </span>
        <EmptyTitle className="text-base">No plugins installed</EmptyTitle>
        <EmptyDescription>
          Upload a plugin package to extend this server with new features.
        </EmptyDescription>
      </EmptyHeader>
      <Button onClick={onUpload}>
        <UploadIcon className="mr-2 size-4" />
        Upload plugin
      </Button>
    </Empty>
  );
}

function PluginPageSkeleton() {
  return (
    <div className="flex flex-col gap-6" aria-busy="true" aria-label="Loading plugin workspace">
      <div className="space-y-3">
        <Skeleton className="h-3 w-28" />
        <Skeleton className="h-8 w-52" />
        <Skeleton className="h-4 w-full max-w-xl" />
      </div>
      <PluginTableSkeleton />
    </div>
  );
}

function PluginTableSkeleton() {
  return (
    <div className="flex flex-col gap-4" aria-busy="true" aria-label="Loading plugins">
      <div className="flex gap-2">
        <Skeleton className="h-10 w-full max-w-sm" />
        <Skeleton className="h-10 w-32" />
      </div>
      <Skeleton className="h-96 w-full" />
    </div>
  );
}
