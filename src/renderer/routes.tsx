import React from 'react';
import { Router, Route } from 'electron-router-dom';

import { MainScreen, TunnelConfigScreen } from './screens';
import { DebugScreen } from './screens/Debug';
import { AboutUsScreen } from './screens/AboutUs';

export function AppRoutes() {
  return (
    <Router
      main={
        <>
          <Route path="/" element={<MainScreen />} />
          <Route path="/anotherScreen" element={<MainScreen />} />
        </>
      }
      aboutUs={<Route path="/" element={<AboutUsScreen />} />}
      debug={<Route path="/" element={<DebugScreen />} />}
      tunnelConfig={<Route path="/" element={<TunnelConfigScreen />} />}
    />
  );
}
