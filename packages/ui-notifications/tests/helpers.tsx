import React from 'react';
import { render } from '@testing-library/react';
import { MantineProvider } from '@mantine/core';

export function renderWithMantine(ui: React.ReactElement) {
  // env="test": no transitions or portals, so a popover's content is in the tree as soon as it opens.
  return render(<MantineProvider env="test">{ui}</MantineProvider>);
}
