import {
  Pagination,
  Text,
} from "@mantine/core";
import React from "react";

export interface BottomPaginationProps {
  itemCountDisplay: string;
  page: number;
  onPageChange: (page: number) => void;
  totalPages: number;
}

export const BottomPagination: React.FC<BottomPaginationProps> = ({
  itemCountDisplay,
  page,
  onPageChange,
  totalPages,
}) => {
  if (totalPages <= 1) return null;

  return (
    <div className="collection-list-bottom-pagination" data-testid="collection-list-bottom-pagination">
      <Text size="sm" c="dimmed" data-testid="collection-list-bottom-count">
        {itemCountDisplay}
      </Text>
      <Pagination
        value={page}
        onChange={onPageChange}
        total={totalPages}
        size="sm"
        data-testid="collection-list-bottom-pagination-control"
      />
    </div>
  );
};
