import React from 'react';
import { Button, Divider, Row } from 'antd';
import { useAppContext } from '@renderer/context/app';
import { MainEventKey } from '@shared/event/main';
export function DebugScreen() {
  const { applicationInfo, application } = useAppContext();

  const { userPath } = applicationInfo || {};

  return (
    <>
      <Row>
        <h1>Debug</h1>
      </Row>
      <Row>
        <h3>User path: {userPath}</h3>
      </Row>
      <Row>
        <Button
          type="primary"
          onClick={() => {
            application.emitMainEvent(MainEventKey.TOGGLE_DEBUG);
          }}
        >
          Exit debug mode
        </Button>
      </Row>
      <Divider />
    </>
  );
}
