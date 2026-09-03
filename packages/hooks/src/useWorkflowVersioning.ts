"use client";

/**
 * useWorkflowVersioning - Hook for managing workflow + versioning integration
 *
 * Handles:
 * - Version tracking with workflow state
 * - Edit mode based on workflow state
 * - Creating new versions when workflow is terminated
 */

import * as React from "react";
import { type ContentVersion } from "./useVersions";
import { apiRequest } from "./utils";

export interface WorkflowState {
  name: string;
  isEndState?: boolean;
}

export interface WorkflowInstance {
  id: string;
  terminated: boolean;
  current_state: string;
  workflow?: {
    workflow_json: string | { states: WorkflowState[] };
  };
}

export interface UseWorkflowVersioningReturn {
  /** Whether current version is the latest */
  isLastVersion: boolean;
  /** Key of the most recent version */
  lastVersionKey: string | null;
  /** Whether editing should be disabled based on workflow state */
  editDisabled: boolean;
  /** Whether action buttons (workflow commands) should be shown */
  showActionButtons: boolean;
  /** Whether the "Edit" button should be shown (for terminated workflows) */
  showActionEditButton: boolean;
  /** Create a new version or switch to latest version */
  createOrSwitchVersion: (
    createVersionFn: () => Promise<ContentVersion>
  ) => Promise<void>;
}

export interface UseWorkflowVersioningOptions {
  /** Optional router instance for navigation (framework-specific) */
  router?: {
    replace: (url: string) => void;
  };
  /** Optional search parameters (framework-specific) */
  searchParams?: URLSearchParams;
}

export interface UseWorkflowVersioningProps {
  versions: ContentVersion[] | null;
  currentVersion: ContentVersion | null;
  itemId: string | null;
  /** Workflow instance from WorkflowContext (optional) */
  workflowInstance?: WorkflowInstance | null;
  /** Options for framework-specific features (router, searchParams) */
  options?: UseWorkflowVersioningOptions;
}

/**
 * Sorts versions in ascending order by creation date
 */
function sortVersionsByDateAsc(versions: ContentVersion[]): ContentVersion[] {
  return [...versions].sort(
    (a, b) =>
      new Date(a.date_created).getTime() - new Date(b.date_created).getTime()
  );
}

/**
 * Gets the last (most recent) version from a sorted array
 */
function getLastVersion(
  versions: ContentVersion[] | null
): ContentVersion | null {
  if (!versions || versions.length === 0) return null;

  const sortedVersions = sortVersionsByDateAsc(versions);
  return sortedVersions[sortedVersions.length - 1] ?? null;
}


export function useWorkflowVersioning({
  versions,
  currentVersion,
  itemId,
  workflowInstance,
  options,
}: UseWorkflowVersioningProps): UseWorkflowVersioningReturn {
  const router = options?.router;
  const searchParams = options?.searchParams;
  const [lastVersionWorkflowInstance, setLastVersionWorkflowInstance] =
    React.useState<WorkflowInstance | null>(null);

  /**
   * Determines if the current version is the latest version
   */
  const isLastVersion = React.useMemo(() => {
    const sortedVersionsAsc = versions ? sortVersionsByDateAsc(versions) : [];
    const versionLength = versions ? versions.length : 0;
    const currentVersionIndex = currentVersion
      ? sortedVersionsAsc.findIndex((v) => v.id === currentVersion.id)
      : -1;

    return versionLength === 0 || currentVersionIndex === versionLength - 1;
  }, [versions, currentVersion]);

  /**
   * Gets the key of the most recent version
   */
  const lastVersionKey = React.useMemo(() => {
    if (!versions) return null;
    const lastVersion = getLastVersion(versions);
    return lastVersion ? lastVersion.key : null;
  }, [versions]);

  /**
   * Determines if editing should be disabled
   * Disabled when:
   * 1. No versions exist (user needs to create version first)
   * 2. Workflow is terminated (published)
   * 3. Workflow is in scheduled state
   */
  const editDisabled = React.useMemo(() => {
    // If no versions exist, disable editing until version is created
    if (!versions || versions.length === 0) {
      return true;
    }

    return (
      !!workflowInstance?.terminated ||
      workflowInstance?.current_state === "Scheduled Unpublish" ||
      workflowInstance?.current_state === "Scheduled Publish"
    );
  }, [workflowInstance, versions]);

  /**
   * Determines if action buttons should be shown
   */
  const showActionButtons = React.useMemo(() => {
    return !workflowInstance?.terminated;
  }, [workflowInstance]);

  /**
   * Determines if action edit button should be shown (for creating new version)
   * Shows when:
   * 1. No versions exist yet (need to create first version), OR
   * 2. Workflow is terminated (need to create new version to edit)
   */
  const showActionEditButton = React.useMemo(() => {
    // Show if no versions exist yet
    if (!versions || versions.length === 0) {
      return true;
    }

    // Show if workflow is terminated (published) and not in scheduled states
    return (
      !!workflowInstance?.terminated &&
      workflowInstance?.current_state !== "Scheduled Unpublish" &&
      workflowInstance?.current_state !== "Scheduled Publish"
    );
  }, [workflowInstance, versions]);

  // Fetch last version's workflow instance
  React.useEffect(() => {
    async function fetchLastVersionWorkflow() {
      if (!lastVersionKey || !itemId) {
        setLastVersionWorkflowInstance(null);
        return;
      }

      try {
        const filter = JSON.stringify({
          item_id: { _eq: itemId },
          version_key: { _eq: lastVersionKey },
        });

        const response = await apiRequest<{ data: WorkflowInstance[] }>(
          `/api/items/daas_wf_instance?filter=${encodeURIComponent(
            filter
          )}&fields=id,terminated,current_state,workflow.*`
        );

        const instance = response.data?.[0];
        setLastVersionWorkflowInstance(instance || null);
      } catch (error) {
        console.error("Failed to fetch last version workflow:", error);
        setLastVersionWorkflowInstance(null);
      }
    }

    fetchLastVersionWorkflow();
  }, [lastVersionKey, itemId, workflowInstance]);

  /**
   * Creates a new version or switches to the latest version based on workflow state
   */
  const createOrSwitchVersion = React.useCallback(
    async (createVersionFn: () => Promise<ContentVersion>) => {
      // Determine if we need to create a new version:
      // 1. No versions exist yet (first version)
      // 2. Workflow is terminated (need new version to edit)
      const noVersionsExist = !versions || versions.length === 0;
      const workflowTerminated =
        workflowInstance?.terminated &&
        (noVersionsExist || lastVersionWorkflowInstance?.terminated);
      const needsNewVersion = noVersionsExist || workflowTerminated;

      if (needsNewVersion) {
        console.log("[createOrSwitchVersion] Creating new version...");
        await createVersionFn();
      }
      // If current version isn't synchronized with latest version, update it
      else if (!currentVersion || currentVersion.key !== lastVersionKey) {
        console.log(
          "[createOrSwitchVersion] Switching to latest version:",
          lastVersionKey
        );
        if (router && searchParams) {
          const params = new URLSearchParams(searchParams.toString());
          if (lastVersionKey) {
            params.set("version", lastVersionKey);
          } else {
            params.delete("version");
          }
          router.replace(`?${params.toString()}`);
        }
      } else {
        console.log(
          "[createOrSwitchVersion] No action - already on latest version"
        );
      }
    },
    [
      workflowInstance,
      versions,
      lastVersionWorkflowInstance,
      currentVersion,
      lastVersionKey,
      router,
      searchParams,
    ]
  );

  return {
    isLastVersion,
    lastVersionKey,
    editDisabled,
    showActionButtons,
    showActionEditButton,
    createOrSwitchVersion,
  };
}
