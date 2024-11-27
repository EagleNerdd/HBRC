import React from 'react';
import { useAppContext } from '@renderer/context/app';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import QueryKeys from '@renderer/constants/queryKeys';
import { Button, Col, Flex, Input, Row, Layout } from 'antd';
import { urlSafeB64DecodeString, b64DecodeString } from '@shared/utils/crypto';

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

  const queryClient = useQueryClient();

  const { messageApi, application, applicationInfo } = useAppContext();

  const setApplicationOptions = useMutation({
    mutationFn: application.setApplicationOptions,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [QueryKeys.GET_APPLICATION_INFO] });
    },
  });

  const handleConnectionString = async () => {
    try {
      const appOptions = decodeConnectionString(connectionString);
      await setApplicationOptions.mutateAsync(appOptions);
    } catch (e) {
      messageApi.error('Invalid connection string');
    }
  };

  return (
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
  );
}
