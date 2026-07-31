import { useState, useCallback } from 'react';
import { notifications } from '@mantine/notifications';
import type { M2MRelationInfo } from './useRelationM2M';
import { apiRequest, isValidPrimaryKey } from './utils';

export interface M2MItem {
  id: string | number;
  [key: string]: unknown;
}

export interface M2MQueryParams {
  limit: number;
  page: number;
  search?: string;
  sortField?: string;
  sortDirection?: 'asc' | 'desc';
  fields: string[];
  enableSearchFilter?: boolean;
}

interface ItemsResponse {
  data: M2MItem[];
  meta?: {
    total_count?: number;
  };
}

/**
 * Custom hook for managing M2M relationship items (CRUD operations)
 * Similar to DaaS useRelationMultiple composable
 */
export function useRelationM2MItems(
  relationInfo: M2MRelationInfo | null,
  primaryKey: string | number | null
) {
  const [items, setItems] = useState<M2MItem[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [selectedPrimaryKeys, setSelectedPrimaryKeys] = useState<(string | number)[]>([]);

  // Check if operations can be performed (item must be saved first)
  const canPerformOperations = isValidPrimaryKey(primaryKey);

  // Load junction items
  const loadItems = useCallback(async (params: M2MQueryParams) => {
    if (!relationInfo || !isValidPrimaryKey(primaryKey)) {
      setItems([]);
      setTotalCount(0);
      return;
    }

    try {
      setLoading(true);
      
      // Build query parameters
      const queryParams = new URLSearchParams();
      queryParams.set('limit', String(params.limit));
      queryParams.set('offset', String((params.page - 1) * params.limit));
      queryParams.set('meta', 'total_count');
      
      // Build filter
      const filter = {
        [relationInfo.reverseJunctionField.field]: {
          _eq: primaryKey
        }
      };
      queryParams.set('filter', JSON.stringify(filter));

      // Include related collection data
      const fieldsToFetch = [
        relationInfo.junctionPrimaryKeyField.field,
        ...params.fields.map(f => f.includes('.') ? f : `${relationInfo.junctionField.field}.${f}`)
      ];
      queryParams.set('fields', fieldsToFetch.join(','));

      if (params.sortField) {
        queryParams.set('sort', params.sortDirection === 'desc' ? `-${params.sortField}` : params.sortField);
      } else if (relationInfo.sortField) {
        queryParams.set('sort', relationInfo.sortField);
      }

      if (params.search && params.enableSearchFilter) {
        queryParams.set('search', params.search);
      }

      const response = await apiRequest<ItemsResponse>(
        `/api/items/${relationInfo.junctionCollection.collection}?${queryParams.toString()}`
      );
      
      const loadedItems = response.data || [];
      setItems(loadedItems);
      setTotalCount(response.meta?.total_count || 0);

      // Extract selected primary keys for filtering
      const pks = loadedItems.map((item) => {
        const relatedData = item[relationInfo.junctionField.field] as Record<string, unknown> | undefined;
        return relatedData?.[relationInfo.relatedPrimaryKeyField.field] as string | number | undefined;
      }).filter(Boolean);
      setSelectedPrimaryKeys(pks as (string | number)[]);

    } catch {
      notifications.show({
        title: 'Error',
        message: 'Failed to load related items',
        color: 'red',
      });
    } finally {
      setLoading(false);
    }
  }, [relationInfo, primaryKey]);

  // Create new junction record
  const createJunctionItem = useCallback(async (relatedItemId: string | number) => {
    if (!relationInfo) {
      return null;
    }

    if (!isValidPrimaryKey(primaryKey)) {
      notifications.show({
        title: 'Save Required',
        message: 'Please save the item first before adding related items',
        color: 'yellow',
      });
      return null;
    }

    try {
      const junctionItem = {
        [relationInfo.reverseJunctionField.field]: primaryKey,
        [relationInfo.junctionField.field]: relatedItemId,
      };

      const result = await apiRequest<{ data: M2MItem }>(
        `/api/items/${relationInfo.junctionCollection.collection}`,
        {
          method: 'POST',
          body: JSON.stringify(junctionItem),
        }
      );
      
      notifications.show({
        title: 'Success',
        message: 'Item added successfully',
        color: 'green',
      });
      return result.data;
    } catch {
      notifications.show({
        title: 'Error',
        message: 'Failed to add item',
        color: 'red',
      });
      throw new Error('Failed to add item');
    }
  }, [relationInfo, primaryKey]);

  // Select existing items from the RELATED collection
  const selectItems = useCallback(async (selectedIds: (string | number)[]) => {
    if (!relationInfo) {
      return;
    }

    if (!isValidPrimaryKey(primaryKey)) {
      notifications.show({
        title: 'Save Required',
        message: 'Please save the item first before adding related items',
        color: 'yellow',
      });
      return;
    }

    try {
      const junctionItems = selectedIds.map(relatedId => ({
        [relationInfo.reverseJunctionField.field]: primaryKey,
        [relationInfo.junctionField.field]: relatedId,
      }));

      await Promise.all(
        junctionItems.map(item => 
          apiRequest(
            `/api/items/${relationInfo.junctionCollection.collection}`,
            {
              method: 'POST',
              body: JSON.stringify(item),
            }
          )
        )
      );

      notifications.show({
        title: 'Success',
        message: `Added ${selectedIds.length} items`,
        color: 'green',
      });

      return junctionItems;
    } catch {
      notifications.show({
        title: 'Error',
        message: 'Failed to add selected items',
        color: 'red',
      });
      throw new Error('Failed to add selected items');
    }
  }, [relationInfo, primaryKey]);

  // Remove item (delete junction record)
  const removeItem = useCallback(async (item: M2MItem) => {
    if (!relationInfo) {
      return;
    }

    try {
      await apiRequest(
        `/api/items/${relationInfo.junctionCollection.collection}/${item.id}`,
        {
          method: 'DELETE',
        }
      );
      notifications.show({
        title: 'Success',
        message: 'Item removed successfully',
        color: 'green',
      });
    } catch {
      notifications.show({
        title: 'Error',
        message: 'Failed to remove item',
        color: 'red',
      });
      throw new Error('Failed to remove item');
    }
  }, [relationInfo]);

  // Update sort order for items
  const updateSortOrder = useCallback(async (sortedItems: M2MItem[]) => {
    if (!relationInfo?.sortField) {
      return;
    }

    try {
      await Promise.all(
        sortedItems.map((item, idx) =>
          apiRequest(
            `/api/items/${relationInfo.junctionCollection.collection}/${item.id}`,
            {
              method: 'PATCH',
              body: JSON.stringify({
                [relationInfo.sortField!]: idx + 1
              }),
            }
          )
        )
      );

      setItems(sortedItems);
    } catch {
      notifications.show({
        title: 'Error',
        message: 'Failed to update sort order',
        color: 'red',
      });
      throw new Error('Failed to update sort order');
    }
  }, [relationInfo]);

  // Move item up in sort order
  const moveItemUp = useCallback(async (index: number) => {
    if (index === 0 || !relationInfo?.sortField) {
      return;
    }
    
    const newItems = [...items];
    [newItems[index - 1], newItems[index]] = [newItems[index], newItems[index - 1]];
    
    await updateSortOrder(newItems);
  }, [items, relationInfo, updateSortOrder]);

  // Move item down in sort order
  const moveItemDown = useCallback(async (index: number) => {
    if (index === items.length - 1 || !relationInfo?.sortField) {
      return;
    }
    
    const newItems = [...items];
    [newItems[index], newItems[index + 1]] = [newItems[index + 1], newItems[index]];
    
    await updateSortOrder(newItems);
  }, [items, relationInfo, updateSortOrder]);

  return {
    items,
    totalCount,
    loading,
    selectedPrimaryKeys,
    canPerformOperations,
    loadItems,
    createJunctionItem,
    selectItems,
    removeItem,
    updateSortOrder,
    moveItemUp,
    moveItemDown,
    setItems
  };
}
