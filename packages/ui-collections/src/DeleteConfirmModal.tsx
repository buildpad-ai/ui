import {
  Button,
  Group,
  Modal,
  Stack,
  Text,
} from "@mantine/core";
import React from "react";

export interface DeleteConfirmModalProps {
  opened: boolean;
  count: number;
  loading: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export const DeleteConfirmModal: React.FC<DeleteConfirmModalProps> = ({
  opened,
  count,
  loading,
  onConfirm,
  onCancel,
}) => {
  return (
    <Modal
      opened={opened}
      onClose={onCancel}
      title="Confirm Delete"
      centered
      size="sm"
      data-testid="delete-confirm-modal"
    >
      <Stack gap="md">
        <Text size="sm">
          Are you sure you want to delete {count}{" "}
          {count === 1 ? "item" : "items"}? This action cannot be undone.
        </Text>
        <Group justify="flex-end">
          <Button
            variant="default"
            onClick={onCancel}
            disabled={loading}
          >
            Cancel
          </Button>
          <Button
            color="red"
            onClick={onConfirm}
            loading={loading}
            data-testid="delete-confirm-btn"
          >
            Delete
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
};
