import React from 'react';
import { Row, Col, Tag } from 'antd';
import { ApplicationInfo } from '@shared/types';

const tagStyle = { fontSize: 15 };

const rowStyle = { marginBottom: 5 };

export default function ServerInfo({ applicationInfo }: { applicationInfo: ApplicationInfo }) {
  const { options, transporterStatus } = applicationInfo || {};
  const statusColor =
    transporterStatus === 'connected' ? 'green' : transporterStatus === 'connecting' ? 'warning' : 'error';
  return (
    <Col>
      <Row style={rowStyle} gutter={[20, 20]}>
        <Tag color="processing" style={tagStyle}>
          Server name: {options?.serverName}
        </Tag>
      </Row>
      <Row style={rowStyle} gutter={[20, 20]}>
        <Tag style={tagStyle} color={statusColor}>
          Status: {transporterStatus}
        </Tag>
      </Row>
    </Col>
  );
}
