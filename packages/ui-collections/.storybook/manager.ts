import { addons } from 'storybook/manager-api';
import { enterpriseManagerTheme } from '../../storybook-enterprise-manager';

addons.setConfig({
  theme: enterpriseManagerTheme('@buildpad/ui-collections'),
});
