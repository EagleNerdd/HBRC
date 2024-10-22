import React from 'react';
import { Row, Col, Tag } from 'antd';
import { ApplicationInfo } from '@shared/types';
import useApplication from '@renderer/hooks/useApplication';
import { MainEventKey } from '@shared/event/main';
import { useApplicationInfo } from '@renderer/hooks/useApplicationInfo';

const tagStyle = { fontSize: 15 };

const rowStyle = { marginBottom: 5 };

export default function ServerInfo({ applicationInfo }: { applicationInfo: ApplicationInfo }) {
  const { options, transporterStatus } = applicationInfo || {};
  const application = useApplication();
  const { isDebug } = useApplicationInfo();
  const statusColor =
    transporterStatus === 'connected' ? 'green' : transporterStatus === 'connecting' ? 'warning' : 'error';

  const onServerNameClick = () => {
    application.emitMainEvent(MainEventKey.CLICK_ENABLE_DEBUG);
  };

  return (
    <Col>
      <Row style={rowStyle} gutter={[20, 20]}>
        <Tag color="processing" style={tagStyle} onClick={onServerNameClick}>
          Server name: {options?.serverName}
        </Tag>
      </Row>
      <Row style={rowStyle} gutter={[20, 20]}>
        <Tag style={tagStyle} color={statusColor}>
          Status: {transporterStatus}
        </Tag>
      </Row>
      {isDebug && (
        <Row style={rowStyle} gutter={[20, 20]}>
          <Tag style={tagStyle} color={'warning'}>
            Debug: On
          </Tag>
        </Row>
      )}
    </Col>
  );
}
