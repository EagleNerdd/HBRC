import { App, BrowserWindow, Menu, shell } from 'electron';
import { DebugWindow } from './windows/Debug';
import { PLATFORM } from '@shared/constants/main';
import { GITHUB_REPOSITORY_URL, MenuItemId, ON_MENU_ITEM_CLICKED, ON_MENU_ITEM_PROCESSED } from '@shared/constants';
import { HBRCApplication } from '@main/app/base';
import { AboutUsWindow } from './windows/AboutUs';
import { isDebug } from './utils';

export const initMenu = (app: App) => {
  const macMenu = [
    {
      label: app.name,
      submenu: [],
    },
  ];

  const menuTemplate = [
    // { role: 'appMenu' }
    ...(PLATFORM.IS_MAC ? macMenu : []),
    // { role: 'fileMenu' }
  ];

  const menu = Menu.buildFromTemplate(menuTemplate);
  Menu.setApplicationMenu(menu);
};

export const initMenuForMainWindow = (
  app: App,
  mainApp: HBRCApplication,
  mainWindow: BrowserWindow,
  options?: { excludeMenuItemIds?: MenuItemId[]; includeMenuItemIds?: MenuItemId[] }
) => {
  const { excludeMenuItemIds, includeMenuItemIds } = options || {};
  const sendMenuClickedToRenderer = (menuItemId: string, data?: any) => {
    mainWindow.webContents.send(ON_MENU_ITEM_CLICKED, menuItemId, data);
  };

  const sendMenuProcessedToRenderer = (menuItemId: string, data?: any) => {
    mainWindow.webContents.send(ON_MENU_ITEM_PROCESSED, menuItemId, data);
  };

  const serverSubmenu = [
    {
      id: MenuItemId.DISCONNECT_SERVER,
      label: 'Disconnect',
      click: async () => {
        await mainApp.disconnectServer();
        sendMenuClickedToRenderer(MenuItemId.DISCONNECT_SERVER);
      },
    },
    {
      label: 'Exit',
      click: () => app.quit(),
    },
  ];
  if (isDebug()) {
    serverSubmenu.push({
      id: MenuItemId.DEBUG,
      label: 'Debug',
      click: async () => {
        await DebugWindow();
      },
    });
  }

  const serverMenu: any = {
    id: MenuItemId.SERVER,
    label: 'Server',
    submenu: serverSubmenu,
  };

  const manageMenu = {
    id: MenuItemId.MANAGE,
    label: 'Manage',
    submenu: [
      {
        id: MenuItemId.ADD_INSTANCE,
        label: 'Add Instance',
        click: () => {
          sendMenuClickedToRenderer(MenuItemId.ADD_INSTANCE);
        },
      },
      {
        id: MenuItemId.START_ALL_INSTANCES,
        label: 'Start all instances',
        click: async () => {
          sendMenuClickedToRenderer(MenuItemId.START_ALL_INSTANCES);
          await mainApp.getInstanceManager().startAllInstances();
          sendMenuProcessedToRenderer(MenuItemId.START_ALL_INSTANCES);
        },
      },
      {
        id: MenuItemId.STOP_ALL_INSTANCES,
        label: 'Stop all instances',
        click: async () => {
          sendMenuClickedToRenderer(MenuItemId.STOP_ALL_INSTANCES);
          await mainApp.getInstanceManager().stopAllInstances();
          sendMenuProcessedToRenderer(MenuItemId.STOP_ALL_INSTANCES);
        },
      },
    ],
  };

  const helpMenu = {
    id: MenuItemId.HELP,
    label: 'Help',
    submenu: [
      {
        id: MenuItemId.DOCUMENT,
        label: 'Document',
        click: () => {
          shell.openExternal(GITHUB_REPOSITORY_URL);
        },
      },
      {
        id: MenuItemId.ABOUT_US,
        label: 'About us',
        click: async () => {
          await AboutUsWindow();
        },
      },
    ],
  };

  const menuList = [serverMenu, manageMenu, helpMenu];
  let menuItems = menuList;
  if (excludeMenuItemIds) {
    menuItems = menuList.filter((menu) => !excludeMenuItemIds.includes(menu.id));
    menuItems.forEach((menu) => {
      menu.submenu = menu.submenu.filter((item: any) => !excludeMenuItemIds.includes(item.id));
    });
  } else if (includeMenuItemIds) {
    menuItems = menuList.filter((menu) => includeMenuItemIds.includes(menu.id));
    menuItems.forEach((menu) => {
      menu.submenu = menu.submenu.filter((item: any) => includeMenuItemIds.includes(item.id));
    });
  }

  addMenuItems(menuItems, mainWindow);
};

export const addMenuItem = (menuItem: Electron.MenuItemConstructorOptions) => {
  const buildFromTemplate = Menu.buildFromTemplate([menuItem]);
  const currentMenu = Menu.getApplicationMenu();
  buildFromTemplate.items.forEach((item) => {
    currentMenu.append(item);
  });
  Menu.setApplicationMenu(currentMenu);
};

export const addMenuItems = (menuItems: Electron.MenuItemConstructorOptions[], window?: BrowserWindow) => {
  const buildFromTemplate = Menu.buildFromTemplate(menuItems);
  if (window) {
    window.setMenu(buildFromTemplate);
  } else {
    const currentMenu = Menu.getApplicationMenu();
    buildFromTemplate.items.forEach((item) => {
      currentMenu.append(item);
    });
    Menu.setApplicationMenu(currentMenu);
  }
};
