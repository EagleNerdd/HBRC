import React from 'react';
import { useAppContext } from '@renderer/context/app';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import QueryKeys from '@renderer/constants/queryKeys';
import { Button, Col, Input, Row, Tag } from 'antd';
import useApplication from '@renderer/hooks/useApplication';
import { b64DecodeString } from '@shared/utils/crypto';

export default function ConnectionStringComponent() {
  const [connectionString, setConnectionString] = React.useState('');

  const { messageApi } = useAppContext();

  const app = useApplication();

  const queryClient = useQueryClient();

  const setApplicationOptions = useMutation({
    mutationFn: app.setApplicationOptions,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [QueryKeys.GET_APPLICATION_INFO] });
    },
  });

  const { data: applicationInfo, isFetching: isFetchOptions } = useQuery({
    queryKey: [QueryKeys.GET_APPLICATION_INFO],
    queryFn: app.getApplicationInfo,
  });

  const handleConnectionString = async () => {
    try {
      const appOptions = JSON.parse(b64DecodeString(connectionString));
      await setApplicationOptions.mutateAsync(appOptions);
    } catch (e) {
      messageApi.error('Invalid connection string');
    }
  };

  if (isFetchOptions) {
    return <Tag color="blue">Loading...</Tag>;
  }

  const renderAppInfo = () => {
    if (!applicationInfo) {
      return <Tag color="red">You are not connect to any server please input your connection string</Tag>;
    }
    console.log('applicationInfo', applicationInfo);
    return (
      <>
        <Tag>Server name: {applicationInfo.options?.serverName}</Tag>
        <div className="flex justify-end">
          <Button
            danger
            type="primary"
            onClick={() => {
              alert('coming soon');
            }}
          >
            Disconnect
          </Button>
        </div>
      </>
    );
  };

  const renderInput = () => {
    return (
      <>
        <Tag color="blue">Input your connection string</Tag>
        <Input
          value={connectionString}
          onChange={(e) => {
            setConnectionString(e.target.value);
          }}
        />
        <div className="flex justify-end">
          <Button type="primary" disabled={!connectionString} onClick={handleConnectionString}>
            Connect
          </Button>
        </div>
      </>
    );
  };

  return (
    <Row>
      <Col span={12}>{renderAppInfo()}</Col>
      <Col span={12}>{renderInput()}</Col>
    </Row>
  );
}
