import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Clock3, ExternalLink, Settings } from "lucide-react";
import type { InstanceSchedulerHeartbeatAgent } from "@paperclipai/shared";
import { Link } from "@/lib/router";
import { heartbeatsApi } from "../api/heartbeats";
import { agentsApi } from "../api/agents";
import { companiesApi } from "../api/companies";
import { useBreadcrumbs } from "../context/BreadcrumbContext";
import { EmptyState } from "../components/EmptyState";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { queryKeys } from "../lib/queryKeys";
import { formatDateTime, relativeTime } from "../lib/utils";

function asRecord(value: unknown): Record<string, unknown> | null {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function humanize(value: string) {
  return value.replaceAll("_", " ");
}

function buildAgentHref(agent: InstanceSchedulerHeartbeatAgent) {
  return `/${agent.companyIssuePrefix}/agents/${encodeURIComponent(agent.agentUrlKey)}`;
}

export function InstanceSettings() {
  const { setBreadcrumbs } = useBreadcrumbs();
  const queryClient = useQueryClient();
  const [actionError, setActionError] = useState<string | null>(null);

  useEffect(() => {
    setBreadcrumbs([
      { label: "Instance Settings" },
      { label: "Heartbeats" },
    ]);
  }, [setBreadcrumbs]);

  const heartbeatsQuery = useQuery({
    queryKey: queryKeys.instance.schedulerHeartbeats,
    queryFn: () => heartbeatsApi.listInstanceSchedulerAgents(),
    refetchInterval: 15_000,
  });

  const companiesQuery = useQuery({
    queryKey: queryKeys.companies.all,
    queryFn: () => companiesApi.list(),
  });

  const toggleOrgHeartbeatsMutation = useMutation({
    mutationFn: async ({ companyId, enabled }: { companyId: string; enabled: boolean }) => {
      // Update org-level setting
      await companiesApi.update(companyId, { heartbeatsEnabled: enabled });

      // Cascade to all agents in this org
      const orgAgents = agents.filter(a => a.companyId === companyId);
      const toUpdate = enabled
        ? orgAgents.filter(a => !a.heartbeatEnabled)
        : orgAgents.filter(a => a.heartbeatEnabled);

      if (toUpdate.length > 0) {
        await Promise.all(
          toUpdate.map(async (agentRow) => {
            const agent = await agentsApi.get(agentRow.id, agentRow.companyId);
            const runtimeConfig = asRecord(agent.runtimeConfig) ?? {};
            const heartbeat = asRecord(runtimeConfig.heartbeat) ?? {};
            return agentsApi.update(
              agentRow.id,
              { runtimeConfig: { ...runtimeConfig, heartbeat: { ...heartbeat, enabled } } },
              agentRow.companyId,
            );
          }),
        );
      }
    },
    onMutate: async ({ companyId, enabled }) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.instance.schedulerHeartbeats });
      await queryClient.cancelQueries({ queryKey: queryKeys.companies.all });
      const previousHeartbeats = queryClient.getQueryData<unknown[]>(queryKeys.instance.schedulerHeartbeats);
      const previousCompanies = queryClient.getQueryData<unknown[]>(queryKeys.companies.all);
      // Optimistically flip org-level flag and cascade heartbeatEnabled on all org agents
      queryClient.setQueryData<unknown[]>(queryKeys.instance.schedulerHeartbeats, (old = []) =>
        (old as InstanceSchedulerHeartbeatAgent[]).map(a =>
          a.companyId !== companyId ? a : {
            ...a,
            companyHeartbeatsEnabled: enabled,
            heartbeatEnabled: enabled,
            schedulerActive: enabled && a.status !== "paused" && a.status !== "terminated" && a.status !== "pending_approval" && a.intervalSec > 0,
          },
        ),
      );
      queryClient.setQueryData<unknown[]>(queryKeys.companies.all, (old = []) =>
        (old as Array<{ id: string; heartbeatsEnabled?: boolean }>).map(c =>
          c.id === companyId ? { ...c, heartbeatsEnabled: enabled } : c,
        ),
      );
      return { previousHeartbeats, previousCompanies };
    },
    onError: (error, _, context) => {
      setActionError(error instanceof Error ? error.message : "Failed to update heartbeat setting.");
      if (context?.previousHeartbeats !== undefined) {
        queryClient.setQueryData(queryKeys.instance.schedulerHeartbeats, context.previousHeartbeats);
      }
      if (context?.previousCompanies !== undefined) {
        queryClient.setQueryData(queryKeys.companies.all, context.previousCompanies);
      }
    },
    onSettled: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.instance.schedulerHeartbeats }),
        queryClient.invalidateQueries({ queryKey: queryKeys.companies.all }),
      ]);
    },
  });

  const toggleMutation = useMutation({
    mutationFn: async (agentRow: InstanceSchedulerHeartbeatAgent) => {
      const agent = await agentsApi.get(agentRow.id, agentRow.companyId);
      const runtimeConfig = asRecord(agent.runtimeConfig) ?? {};
      const heartbeat = asRecord(runtimeConfig.heartbeat) ?? {};

      return agentsApi.update(
        agentRow.id,
        {
          runtimeConfig: {
            ...runtimeConfig,
            heartbeat: {
              ...heartbeat,
              enabled: !agentRow.heartbeatEnabled,
            },
          },
        },
        agentRow.companyId,
      );
    },
    onSuccess: async (_, agentRow) => {
      setActionError(null);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.instance.schedulerHeartbeats }),
        queryClient.invalidateQueries({ queryKey: queryKeys.agents.list(agentRow.companyId) }),
        queryClient.invalidateQueries({ queryKey: queryKeys.agents.detail(agentRow.id) }),
      ]);
    },
    onError: (error) => {
      setActionError(error instanceof Error ? error.message : "Failed to update heartbeat.");
    },
  });

  const disableAllMutation = useMutation({
    mutationFn: async (agentRows: InstanceSchedulerHeartbeatAgent[]) => {
      const enabled = agentRows.filter((a) => a.heartbeatEnabled);
      if (enabled.length === 0) return enabled;

      const results = await Promise.allSettled(
        enabled.map(async (agentRow) => {
          const agent = await agentsApi.get(agentRow.id, agentRow.companyId);
          const runtimeConfig = asRecord(agent.runtimeConfig) ?? {};
          const heartbeat = asRecord(runtimeConfig.heartbeat) ?? {};
          await agentsApi.update(
            agentRow.id,
            {
              runtimeConfig: {
                ...runtimeConfig,
                heartbeat: { ...heartbeat, enabled: false },
              },
            },
            agentRow.companyId,
          );
        }),
      );

      const failures = results.filter((result): result is PromiseRejectedResult => result.status === "rejected");
      if (failures.length > 0) {
        const firstError = failures[0]?.reason;
        const detail = firstError instanceof Error ? firstError.message : "Unknown error";
        throw new Error(
          failures.length === 1
            ? `Failed to disable 1 timer heartbeat: ${detail}`
            : `Failed to disable ${failures.length} of ${enabled.length} timer heartbeats. First error: ${detail}`,
        );
      }
      return enabled;
    },
    onSuccess: async (updatedRows) => {
      setActionError(null);
      const companies = new Set(updatedRows.map((row) => row.companyId));
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.instance.schedulerHeartbeats }),
        ...Array.from(companies, (companyId) =>
          queryClient.invalidateQueries({ queryKey: queryKeys.agents.list(companyId) }),
        ),
        ...updatedRows.map((row) =>
          queryClient.invalidateQueries({ queryKey: queryKeys.agents.detail(row.id) }),
        ),
      ]);
    },
    onError: (error) => {
      setActionError(error instanceof Error ? error.message : "Failed to disable all heartbeats.");
    },
  });

  const agents = heartbeatsQuery.data ?? [];
  const activeCount = agents.filter((agent) => agent.schedulerActive).length;
  const disabledCount = agents.length - activeCount;
  const enabledCount = agents.filter((agent) => agent.heartbeatEnabled).length;
  const anyEnabled = enabledCount > 0;

  const grouped = useMemo(() => {
    const map = new Map<string, { companyId: string; companyName: string; agents: InstanceSchedulerHeartbeatAgent[]; companyHeartbeatsEnabled: boolean }>();
    for (const agent of agents) {
      let group = map.get(agent.companyId);
      if (!group) {
        group = { companyId: agent.companyId, companyName: agent.companyName, agents: [], companyHeartbeatsEnabled: agent.companyHeartbeatsEnabled };
        map.set(agent.companyId, group);
      }
      group.agents.push(agent);
    }
    return [...map.values()];
  }, [agents]);

  function getCompanyHeartbeatsEnabled(companyId: string): boolean {
    const cached = (queryClient.getQueryData<unknown[]>(queryKeys.instance.schedulerHeartbeats) as InstanceSchedulerHeartbeatAgent[] | undefined)?.find(a => a.companyId === companyId);
    if (cached) return cached.companyHeartbeatsEnabled;
    return (companiesQuery.data ?? []).find(c => c.id === companyId)?.heartbeatsEnabled ?? true;
  }

  if (heartbeatsQuery.isLoading) {
    return <div className="text-sm text-muted-foreground">Loading scheduler heartbeats...</div>;
  }

  if (heartbeatsQuery.error) {
    return (
      <div className="text-sm text-destructive">
        {heartbeatsQuery.error instanceof Error
          ? heartbeatsQuery.error.message
          : "Failed to load scheduler heartbeats."}
      </div>
    );
  }

  return (
    <div className="max-w-5xl space-y-6">
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <Settings className="h-5 w-5 text-muted-foreground" />
          <h1 className="text-lg font-semibold">Scheduler Heartbeats</h1>
        </div>
        <p className="text-sm text-muted-foreground">
          Agents with a timer heartbeat enabled across all of your companies.
        </p>
      </div>

      <div className="flex items-center gap-4 text-sm text-muted-foreground">
        <span><span className="font-semibold text-foreground">{activeCount}</span> active</span>
        <span><span className="font-semibold text-foreground">{disabledCount}</span> disabled</span>
        <span><span className="font-semibold text-foreground">{grouped.length}</span> {grouped.length === 1 ? "company" : "companies"}</span>
        {anyEnabled && (
          <Button
            variant="destructive"
            size="sm"
            className="ml-auto h-7 text-xs"
            disabled={disableAllMutation.isPending}
            onClick={() => {
              const noun = enabledCount === 1 ? "agent" : "agents";
              if (!window.confirm(`Disable timer heartbeats for all ${enabledCount} enabled ${noun}?`)) {
                return;
              }
              disableAllMutation.mutate(agents);
            }}
          >
            {disableAllMutation.isPending ? "Disabling..." : "Disable All"}
          </Button>
        )}
      </div>

      {actionError && (
        <div className="rounded-md border border-destructive/40 bg-destructive/5 px-3 py-2 text-sm text-destructive">
          {actionError}
        </div>
      )}

      {agents.length === 0 ? (
        <EmptyState
          icon={Clock3}
          message="No scheduler heartbeats match the current criteria."
        />
      ) : (
        <div className="space-y-4">
          {grouped.map((group) => (
            <Card key={group.companyId}>
              <CardContent className="p-0">
                <div className="border-b px-3 py-2 flex items-center gap-2">
                  <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    {group.companyName}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    className="ml-auto h-6 px-2 text-[10px]"
                    disabled={toggleOrgHeartbeatsMutation.isPending && toggleOrgHeartbeatsMutation.variables?.companyId === group.companyId}
                    onClick={() => {
                      const enabled = getCompanyHeartbeatsEnabled(group.companyId);
                      const noun = group.agents.length === 1 ? "agent" : "agents";
                      if (enabled) {
                        if (!window.confirm(`Disable timer heartbeats for all ${group.agents.length} ${noun} in ${group.companyName}?`)) return;
                      }
                      toggleOrgHeartbeatsMutation.mutate({ companyId: group.companyId, enabled: !enabled });
                    }}
                  >
                    {toggleOrgHeartbeatsMutation.isPending && toggleOrgHeartbeatsMutation.variables?.companyId === group.companyId
                      ? "..."
                      : getCompanyHeartbeatsEnabled(group.companyId)
                        ? "Disable Org"
                        : "Enable Org"}
                  </Button>
                </div>
                <div className="divide-y">
                  {group.agents.map((agent) => {
                    const saving = toggleMutation.isPending && toggleMutation.variables?.id === agent.id;
                    return (
                      <div
                        key={agent.id}
                        className="flex items-center gap-3 px-3 py-2 text-sm"
                      >
                        <Badge
                          variant={agent.schedulerActive ? "default" : "outline"}
                          className="shrink-0 text-[10px] px-1.5 py-0"
                        >
                          {agent.schedulerActive ? "On" : "Off"}
                        </Badge>
                        <Link
                          to={buildAgentHref(agent)}
                          className="font-medium truncate hover:underline"
                        >
                          {agent.agentName}
                        </Link>
                        <span className="hidden sm:inline text-muted-foreground truncate">
                          {humanize(agent.title ?? agent.role)}
                        </span>
                        <span className="text-muted-foreground tabular-nums shrink-0">
                          {agent.intervalSec}s
                        </span>
                        <span
                          className="hidden md:inline text-muted-foreground truncate"
                          title={agent.lastHeartbeatAt ? formatDateTime(agent.lastHeartbeatAt) : undefined}
                        >
                          {agent.lastHeartbeatAt
                            ? relativeTime(agent.lastHeartbeatAt)
                            : "never"}
                        </span>
                        <span className="ml-auto flex items-center gap-1.5 shrink-0">
                          <Link
                            to={buildAgentHref(agent)}
                            className="text-muted-foreground hover:text-foreground"
                            title="Full agent config"
                          >
                            <ExternalLink className="h-3.5 w-3.5" />
                          </Link>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 px-2 text-xs"
                            disabled={saving}
                            onClick={() => toggleMutation.mutate(agent)}
                          >
                            {saving ? "..." : agent.heartbeatEnabled ? "Disable Timer Heartbeat" : "Enable Timer Heartbeat"}
                          </Button>
                        </span>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
