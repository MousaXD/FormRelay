import { defineConfig } from 'wxt';

export default defineConfig({
  modules: ['@wxt-dev/module-react'],
  manifest: ({ browser }) => ({
    name: 'FormRelay',
    description: 'Export web forms to JSON and safely fill them from completed JSON. Local only.',
    icons: {
      16: 'icons/icon-16.png',
      32: 'icons/icon-32.png',
      48: 'icons/icon-48.png',
      128: 'icons/icon-128.png',
    },
    action: {
      default_title: 'FormRelay',
      default_icon: {
        16: 'icons/icon-16.png',
        32: 'icons/icon-32.png',
      },
    },
    permissions: ['activeTab', 'scripting'],
    ...(browser === 'firefox'
      ? {
          browser_specific_settings: {
            gecko: {
              id: 'mousashriteh0@gmail.com',
              strict_min_version: '142.0',
              update_url: 'https://raw.githubusercontent.com/MousaXD/FormRelay/main/updates.json',
              data_collection_permissions: { required: ['none'] },
            },
          },
        }
      : {}),
  }),
});
