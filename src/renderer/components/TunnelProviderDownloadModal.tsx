import React, { useEffect, useState } from 'react';
import { Alert, Button, Checkbox, Modal, Space, Typography } from 'antd';
import { WarningOutlined } from '@ant-design/icons';

interface Provider {
  name: string;
  label: string;
}

interface TunnelProviderDownloadModalProps {
  open: boolean;
  providers: Provider[];
  isDownloading: boolean;
  onDownloadAndConnect: (selectedProviders: string[]) => void;
  onConnectOnly: () => void;
  onCancel: () => void;
}

export default function TunnelProviderDownloadModal({
  open,
  providers,
  isDownloading,
  onDownloadAndConnect,
  onConnectOnly,
  onCancel,
}: TunnelProviderDownloadModalProps) {
  const [selectedProviders, setSelectedProviders] = useState<string[]>([]);

  useEffect(() => {
    if (open) setSelectedProviders(providers.map((p) => p.name));
  }, [open]);

  return (
    <Modal
      title="Download Required"
      open={open}
      closable={!isDownloading}
      maskClosable={!isDownloading}
      onCancel={onCancel}
      footer={null}
    >
      <p style={{ marginBottom: 12 }}>
        This connection requires the following tunnel providers. Select the ones you want to download:
      </p>
      <Space direction="vertical" style={{ width: '100%', marginBottom: 16 }}>
        {providers.map((p) => (
          <div key={p.name}>
            <Checkbox
              checked={selectedProviders.includes(p.name)}
              disabled={isDownloading}
              onChange={(e) =>
                setSelectedProviders((prev) =>
                  e.target.checked ? [...prev, p.name] : prev.filter((n) => n !== p.name)
                )
              }
            >
              {p.label}
            </Checkbox>
            {p.name === 'frp' && selectedProviders.includes('frp') && (
              <Alert
                type="warning"
                showIcon
                style={{ marginTop: 8, fontSize: 12 }}
                message="FRP is an open source project, not a virus. However, some antivirus software may flag it as a threat. If you use FRP, please disable your antivirus before downloading."
              />
            )}
          </div>
        ))}
      </Space>
      <Space direction="vertical" style={{ width: '100%' }}>
        <Space>
          {selectedProviders.length > 0 ? (
            <Button type="primary" loading={isDownloading} onClick={() => onDownloadAndConnect(selectedProviders)}>
              Download &amp; Connect
            </Button>
          ) : (
            <Button type="primary" disabled={isDownloading} onClick={onConnectOnly}>
              Connect Only
            </Button>
          )}
          <Button disabled={isDownloading} onClick={onCancel}>
            Cancel
          </Button>
        </Space>
        {selectedProviders.length === 0 && (
          <Typography.Text style={{ fontSize: 12, color: '#faad14' }}>
            <WarningOutlined style={{ marginRight: 6 }} />
            Connecting without downloading the required providers may cause tunneling to not work as expected.
          </Typography.Text>
        )}
      </Space>
    </Modal>
  );
}
