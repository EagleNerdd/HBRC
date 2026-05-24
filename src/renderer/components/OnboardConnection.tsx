import React, { useState } from 'react';
import { useAppContext } from '@renderer/context/app';
import { Button, Card, Input, Typography, Tag } from 'antd';
import { CheckCircleFilled, EditOutlined } from '@ant-design/icons';
import { urlSafeB64DecodeString, b64DecodeString } from '@shared/utils/crypto';
import { HBRCIcon } from './icons';
import TunnelProviderDownloadModal from './TunnelProviderDownloadModal';

const tunnelAPI = () => (window as any).tunnelAPI;

const DOWNLOAD_KEY: Record<string, string> = {
  cloudflare: 'cloudflared',
  frp: 'frpc',
};

const decodeConnectionString = (connectionString: string) => {
  let decoded = '';
  try {
    decoded = b64DecodeString(connectionString);
  } catch {
    decoded = urlSafeB64DecodeString(connectionString);
  }
  return JSON.parse(decoded);
};

const tryParse = (value: string) => {
  try {
    return decodeConnectionString(value);
  } catch {
    return null;
  }
};

export default function OnboardConnection() {
  const [connectionString, setConnectionString] = React.useState('');
  const [parsedOptions, setParsedOptions] = useState<any>(null);
  const [pendingOptions, setPendingOptions] = useState<any>(null);
  const [requiredProviders, setRequiredProviders] = useState<Array<{ name: string; label: string }>>([]);
  const [isDownloading, setIsDownloading] = useState(false);

  const { messageApi, applicationInfo, applyOptions, isApplyingOptions } = useAppContext();

  const handleChange = (value: string) => {
    setConnectionString(value);
    setParsedOptions(tryParse(value));
  };

  const handleConnect = async (options: any) => {
    try {
      const requiredNames: string[] = [];
      if (options.tunnels?.frp) requiredNames.push('frp');
      if (options.tunnels?.cloudflare) requiredNames.push('cloudflare');

      if (requiredNames.length > 0) {
        const tunnelState = await tunnelAPI().getState();
        const missing = requiredNames
          .map((name: string) => tunnelState.providers.find((p: any) => p.name === name))
          .filter((p: any) => p && !p.isDownloaded);

        if (missing.length > 0) {
          setPendingOptions(options);
          setRequiredProviders(missing);
          return;
        }
      }

      await applyOptions(options);
    } catch {
      messageApi.error('Invalid connection string');
    }
  };

  const handleDownloadAndConnect = async (selectedProviders: string[]) => {
    setIsDownloading(true);
    try {
      for (const provider of requiredProviders.filter((p) => selectedProviders.includes(p.name))) {
        const componentKey = DOWNLOAD_KEY[provider.name];
        if (!componentKey) continue;
        const success = await tunnelAPI().download(componentKey);
        if (!success) return;
      }
      const options = pendingOptions;
      setPendingOptions(null);
      setRequiredProviders([]);
      await applyOptions(options);
    } catch {
      messageApi.error('Download failed');
    } finally {
      setIsDownloading(false);
    }
  };

  const handleConnectOnly = async () => {
    const options = pendingOptions;
    setPendingOptions(null);
    setRequiredProviders([]);
    await applyOptions(options);
  };

  const handleCancelDownload = () => {
    setPendingOptions(null);
    setRequiredProviders([]);
  };

  return (
    <>
      <div
        style={{
          position: 'fixed',
          inset: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'linear-gradient(135deg, #f0f2f5 0%, #e6f0ff 100%)',
          overflow: 'auto',
        }}
      >
        <Card
          style={{
            width: 480,
            borderRadius: 16,
            boxShadow: '0 8px 32px rgba(0,0,0,0.10)',
            border: 'none',
          }}
          styles={{ body: { padding: '40px 40px 36px' } }}
        >
          {/* Logo / Brand */}
          <div style={{ textAlign: 'center', marginBottom: 32 }}>
            <HBRCIcon size={128} />
            <Typography.Title level={2} style={{ margin: 0, letterSpacing: -0.5 }}>
              HBRC
            </Typography.Title>
            <Typography.Text type="secondary" style={{ fontSize: 13 }}>
              Headless Browser Remote Controller &nbsp;
              <Tag bordered={false} color="blue" style={{ fontSize: 11 }}>
                v{applicationInfo.version}
              </Tag>
            </Typography.Text>
          </div>

          {/* Input or parsed preview */}
          <div style={{ marginBottom: 20 }}>
            <Typography.Text strong style={{ display: 'block', marginBottom: 8, fontSize: 13 }}>
              Connection String
            </Typography.Text>

            {parsedOptions ? (
              <div
                style={{
                  borderRadius: 8,
                  border: '1px solid #b7eb8f',
                  background: '#f6ffed',
                  padding: '12px 16px',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                      <CheckCircleFilled style={{ color: '#52c41a', fontSize: 15 }} />
                      <Typography.Text strong style={{ fontSize: 14 }}>
                        {parsedOptions.serverName ?? 'Unknown server'}
                      </Typography.Text>
                    </div>
                  </div>
                  <Button
                    size="small"
                    type="text"
                    icon={<EditOutlined />}
                    onClick={() => {
                      setParsedOptions(null);
                    }}
                    style={{ color: '#8c8c8c', flexShrink: 0 }}
                  >
                    Change
                  </Button>
                </div>
              </div>
            ) : (
              <Input.TextArea
                value={connectionString}
                onChange={(e) => handleChange(e.target.value)}
                placeholder="Paste your connection string here..."
                autoSize={{ minRows: 4, maxRows: 6 }}
                style={{ borderRadius: 8, fontFamily: 'monospace', fontSize: 12, resize: 'none' }}
              />
            )}
          </div>

          <Button
            type="primary"
            size="large"
            block
            disabled={!parsedOptions}
            loading={isApplyingOptions}
            onClick={() => handleConnect(parsedOptions)}
            style={{ borderRadius: 8, height: 44, fontWeight: 600 }}
          >
            {isApplyingOptions ? 'Connecting...' : 'Connect'}
          </Button>
        </Card>
      </div>

      <TunnelProviderDownloadModal
        open={!!pendingOptions}
        providers={requiredProviders}
        isDownloading={isDownloading}
        onDownloadAndConnect={handleDownloadAndConnect}
        onConnectOnly={handleConnectOnly}
        onCancel={handleCancelDownload}
      />
    </>
  );
}
