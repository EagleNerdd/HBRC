import React from 'react';
import { Divider } from 'antd';
import { useAppContext } from '@renderer/context/app';
import FullScreenSpinner from '@renderer/components/common/FullScreenSpinner';
import ServerInfo from '@renderer/components/ServerInfo';
import BrowserInstanceManagerComponent from '@renderer/components/instance/BrowserInstanceManager';
import OnboardConnection from '@renderer/components/OnboardConnection';

export function MainScreen() {
  const { isLoading, isOnboarded, isApplyingOptions, applicationInfo } = useAppContext();
  if (isLoading && !isApplyingOptions) {
    return <FullScreenSpinner />;
  }
  if (!isOnboarded) {
    return <OnboardConnection />;
  }
  return (
    <>
      <ServerInfo applicationInfo={applicationInfo} />
      <Divider style={{ margin: '16px 0' }} />
      <BrowserInstanceManagerComponent />
    </>
  );
}
