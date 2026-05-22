import React from 'react';
import { Col, Divider, Row } from 'antd';
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
      <Row>
        <ServerInfo applicationInfo={applicationInfo} />
      </Row>
      <Divider />
      <Row>
        <Col span={24}>
          <BrowserInstanceManagerComponent />
        </Col>
      </Row>
    </>
  );
}
