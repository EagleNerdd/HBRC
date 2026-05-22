import React from 'react';
import { Button, Badge, Space, Tag, Typography, Popconfirm } from 'antd';
import { ApplicationInfo } from '@shared/types';
import useApplication from '@renderer/hooks/useApplication';
import { MainEventKey } from '@shared/event/main';
import { useApplicationInfo } from '@renderer/hooks/useApplicationInfo';
import { DisconnectOutlined } from '@ant-design/icons';
import iconSvg from '../../../assets/icon.svg';

const STATUS_CONFIG: Record<string, { badge: 'success' | 'processing' | 'error'; label: string }> = {
  connected: { badge: 'success', label: 'Connected' },
  connecting: { badge: 'processing', label: 'Connecting' },
};

export default function ServerInfo({ applicationInfo }: { applicationInfo: ApplicationInfo }) {
  const { options, transporterStatus } = applicationInfo || {};
  const application = useApplication();
  const { isDebug } = useApplicationInfo();

  const status = STATUS_CONFIG[transporterStatus] ?? { badge: 'error', label: transporterStatus };

  return (
    <div
      style={{
        width: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 16,
        background: '#fff',
        borderRadius: 12,
        padding: '14px 20px',
        boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
        border: '1px solid #f0f0f0',
      }}
    >
      {/* Left: icon + server info */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <img src={iconSvg} width={64} height={64} style={{ flexShrink: 0 }} />
        <div>
          <Typography.Text
            strong
            style={{ fontSize: 15, cursor: 'pointer', display: 'block', lineHeight: 1.3 }}
            onClick={() => application.emitMainEvent(MainEventKey.CLICK_ENABLE_DEBUG)}
          >
            {options?.serverName}
          </Typography.Text>
          <Typography.Text type="secondary" style={{ fontSize: 12 }}>
            Remote server
          </Typography.Text>
        </div>
      </div>

      {/* Right: status + debug + disconnect */}
      <Space size={10} align="center">
        <Badge status={status.badge} text={status.label} />
        {isDebug && (
          <Tag color="warning" bordered={false}>
            Debug
          </Tag>
        )}
        <Popconfirm
          title="Disconnect from server?"
          description="This will stop all active tunnels and clear the connection."
          okText="Disconnect"
          okButtonProps={{ danger: true }}
          cancelText="Cancel"
          onConfirm={() => application.disconnectServer()}
          placement="bottomRight"
        >
          <Button size="small" danger icon={<DisconnectOutlined />}>
            Disconnect
          </Button>
        </Popconfirm>
      </Space>
    </div>
  );
}
