/** `interfaces.workflowButton` — strings of the WorkflowButton interface and the `useWorkflow` hook. */
export interface WorkflowButtonTranslations {
  /** Default placeholder when no workflow instance exists (the `placeholder` prop overrides it) */
  placeholder: string;
  loading: string;
  /** Button text while a transition runs */
  processing: string;
  /** Tooltip on the disabled button */
  unsavedEditsTooltip: string;
  /** Current state text when the instance carries no state name */
  unknownCurrentState: string;
  /** Command option text: "{name} -> {nextState}" */
  commandText: string;
  /** `{nextState}` fallback in `commandText` */
  unknown: string;
  unknownCommand: string;
  unknownState: string;
  error: {
    /** "HTTP error! status: {status}" — thrown by the default API client */
    http: string;
    missingWorkflowId: string;
    missingConfig: string;
    /** Fallback when a fetch failure carries no message */
    fetch: string;
    noInstance: string;
  };
}

export const workflowButtonDefaults: WorkflowButtonTranslations = {
  placeholder: 'Initial State',
  loading: 'Loading workflow...',
  processing: 'Processing...',
  unsavedEditsTooltip: 'You have unsaved edits',
  unknownCurrentState: 'Unknown',
  commandText: '{name} -> {nextState}',
  unknown: 'Unknown',
  unknownCommand: 'Unknown Command',
  unknownState: 'Unknown State',
  error: {
    http: 'HTTP error! status: {status}',
    missingWorkflowId: 'Workflow ID is missing',
    missingConfig: 'Workflow configuration is missing',
    fetch: 'Fetch error',
    noInstance: 'No workflow instance available',
  },
};

export const workflowButtonId: WorkflowButtonTranslations = {
  placeholder: 'Status Awal',
  loading: 'Memuat alur kerja...',
  processing: 'Memproses...',
  unsavedEditsTooltip: 'Ada perubahan yang belum disimpan',
  unknownCurrentState: 'Tidak diketahui',
  commandText: '{name} -> {nextState}',
  unknown: 'Tidak diketahui',
  unknownCommand: 'Perintah Tidak Diketahui',
  unknownState: 'Status Tidak Diketahui',
  error: {
    http: 'Kesalahan HTTP! status: {status}',
    missingWorkflowId: 'ID alur kerja tidak ada',
    missingConfig: 'Konfigurasi alur kerja tidak ada',
    fetch: 'Kesalahan pengambilan data',
    noInstance: 'Tidak ada instans alur kerja yang tersedia',
  },
};
