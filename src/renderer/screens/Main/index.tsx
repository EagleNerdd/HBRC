import React from 'react';
import { Col, Divider, Row } from 'antd';
import { useAppContext } from '@renderer/context/app';
import FullScreenSpinner from '@renderer/components/common/FullScreenSpinner';
import ServerInfo from '@renderer/components/ServerInfo';
import BrowserInstanceManagerComponent from '@renderer/components/instance/BrowserInstanceManager';

export function MainScreen() {
  const { isLoading, applicationInfo } = useAppContext();
  if (isLoading) {
    return <FullScreenSpinner />;
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
