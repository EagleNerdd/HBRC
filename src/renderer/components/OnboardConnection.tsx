import React, { useState } from 'react';
import { useAppContext } from '@renderer/context/app';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import QueryKeys from '@renderer/constants/queryKeys';
import { Button, Col, Flex, Input, Row, Layout, Modal, Space, List } from 'antd';
import { urlSafeB64DecodeString, b64DecodeString } from '@shared/utils/crypto';

const tunnelAPI = () => (window as any).tunnelAPI;

const DOWNLOAD_KEY: Record<string, string> = {
  cloudflare: 'cloudflared',
  frp: 'frpc',
};

const decodeConnectionString = (connectionString: string) => {
  let decodedConnectionString = '';
  try {
    decodedConnectionString = b64DecodeString(connectionString);
  } catch (e) {
    decodedConnectionString = urlSafeB64DecodeString(connectionString);
  }
  return JSON.parse(decodedConnectionString);
};

export default function OnboardConnection() {
  const [connectionString, setConnectionString] = React.useState('');
  const [pendingOptions, setPendingOptions] = useState<any>(null);
  const [requiredProviders, setRequiredProviders] = useState<Array<{ name: string; label: string }>>([]);
  const [isDownloading, setIsDownloading] = useState(false);

  const queryClient = useQueryClient();
  const { messageApi, application, applicationInfo } = useAppContext();

  const setApplicationOptions = useMutation({
    mutationFn: application.setApplicationOptions,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [QueryKeys.GET_APPLICATION_INFO] });
    },
  });

  const applyOptions = async (options: any) => {
    await setApplicationOptions.mutateAsync(options);
  };

  const handleConnectionString = async () => {
    try {
      const appOptions = decodeConnectionString(connectionString);

      const requiredNames: string[] = [];
      if (appOptions.tunnels?.frp) requiredNames.push('frp');
      if (appOptions.tunnels?.cloudflare) requiredNames.push('cloudflare');

      if (requiredNames.length > 0) {
        const tunnelState = await tunnelAPI().getState();
        const missing = requiredNames
          .map((name: string) => tunnelState.providers.find((p: any) => p.name === name))
          .filter((p: any) => p && !p.isDownloaded);

        if (missing.length > 0) {
          setPendingOptions(appOptions);
          setRequiredProviders(missing);
          return;
        }
      }

      await applyOptions(appOptions);
    } catch (e) {
      messageApi.error('Invalid connection string');
    }
  };

  const handleDownloadAndConnect = async () => {
    setIsDownloading(true);
    try {
      for (const provider of requiredProviders) {
        const componentKey = DOWNLOAD_KEY[provider.name];
        if (!componentKey) continue;
        const success = await tunnelAPI().download(componentKey);
        if (!success) return;
      }
      const options = pendingOptions;
      setPendingOptions(null);
      setRequiredProviders([]);
      await applyOptions(options);
    } catch (e) {
      messageApi.error('Download failed');
    } finally {
      setIsDownloading(false);
    }
  };

  const handleCancelDownload = () => {
    setPendingOptions(null);
    setRequiredProviders([]);
  };

  return (
    <>
      <Flex>
        <Layout.Content style={{ textAlign: 'center', alignContent: 'center', alignItems: 'center' }}>
          <Col span={24} style={{ textAlign: 'center' }}>
            <Row justify={'center'}>
              <h1 style={{ fontSize: 50 }}>HBRC</h1>
            </Row>
            <Row justify={'center'} style={{ marginTop: -25 }}>
              <span>Version: {applicationInfo.version}</span>
            </Row>
            <Row justify={'center'} style={{ marginTop: 20 }}>
              <Col span={12}>
                <Input.TextArea
                  value={connectionString}
                  onChange={(e) => {
                    setConnectionString(e.target.value);
                  }}
                  style={{ height: 150 }}
                  placeholder="Input your connection string here"
                />
              </Col>
            </Row>
            <Row justify={'center'} style={{ marginTop: 20 }}>
              <Button size="large" type="primary" disabled={!connectionString} onClick={handleConnectionString}>
                Connect
              </Button>
            </Row>
          </Col>
        </Layout.Content>
      </Flex>

      <Modal
        title="Download Required"
        open={!!pendingOptions}
        closable={!isDownloading}
        maskClosable={!isDownloading}
        onCancel={handleCancelDownload}
        footer={null}
      >
        <p>This connection string requires the following tunnel providers. Please download them to continue:</p>
        <List
          size="small"
          dataSource={requiredProviders}
          renderItem={(p) => <List.Item>{p.label}</List.Item>}
          style={{ marginBottom: 20 }}
        />
        <Space direction="vertical" style={{ width: '100%' }}>
          <Space>
            <Button type="primary" loading={isDownloading} onClick={handleDownloadAndConnect}>
              Download &amp; Connect
            </Button>
            <Button
              disabled={isDownloading}
              onClick={async () => {
                const options = pendingOptions;
                setPendingOptions(null);
                setRequiredProviders([]);
                await applyOptions(options);
              }}
            >
              Connect Only
            </Button>
            <Button disabled={isDownloading} onClick={handleCancelDownload}>
              Cancel
            </Button>
          </Space>
          <p style={{ margin: 0, fontSize: 12, color: '#faad14' }}>
            ⚠ Connecting without downloading the required providers may cause tunneling to not work as expected.
          </p>
        </Space>
      </Modal>
    </>
  );
}
