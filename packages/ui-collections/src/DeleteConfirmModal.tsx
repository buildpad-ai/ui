import {
  Button,
  Group,
  Modal,
  Stack,
  Text,
} from "@mantine/core";
import { useBuildpadI18n, useBuildpadTranslations } from "@buildpad/services";
import type { CollectionsTranslations, DeepPartial } from "@buildpad/utils";
import React from "react";

export interface DeleteConfirmModalProps {
  opened: boolean;
  count: number;
  loading: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  /** Per-instance overrides of the `collections` dictionary namespace (prop > provider > defaults) */
  translations?: DeepPartial<CollectionsTranslations>;
}

export const DeleteConfirmModal: React.FC<DeleteConfirmModalProps> = ({
  opened,
  count,
  loading,
  onConfirm,
  onCancel,
  translations,
}) => {
  // Strings: component prop > provider dictionary > English defaults.
  const t = useBuildpadTranslations((d) => d.collections, translations);
  const { formatCount } = useBuildpadI18n();

  return (
    <Modal
      opened={opened}
      onClose={onCancel}
      title={t.deleteConfirm.title}
      centered
      size="sm"
      data-testid="delete-confirm-modal"
    >
      <Stack gap="md">
        <Text size="sm">
          {formatCount(count, t.deleteConfirm.message)}
        </Text>
        <Group justify="flex-end">
          <Button
            variant="default"
            onClick={onCancel}
            disabled={loading}
          >
            {t.deleteConfirm.cancel}
          </Button>
          <Button
            color="red"
            onClick={onConfirm}
            loading={loading}
            data-testid="delete-confirm-btn"
          >
            {t.deleteConfirm.confirm}
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
};
