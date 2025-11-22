import React from 'react';
import { ChromeFilled } from '@ant-design/icons';
import { Button, Form, Input, Row, Select } from 'antd';
import useBrowserInstanceManager from '@renderer/hooks/useBrowserInstanceManager';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import QueryKeys from '@renderer/constants/queryKeys';
import { useAppContext } from '@renderer/context/app';
import { BrowserInstanceType } from '@shared/types';

export function AddInstanceComponent() {
  const { messageApi } = useAppContext();

  const instanceManager = useBrowserInstanceManager();

  const queryClient = useQueryClient();

  const addInstance = useMutation<any, any, any, any>({
    mutationFn: async ({ name, url, type }) => await instanceManager.addInstance(name, url, type),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [QueryKeys.GET_INSTANCES] });
    },
  });

  type FieldType = {
    name: string;
    url: string;
    type: BrowserInstanceType;
  };

  const handleAddInstance = async (data: FieldType) => {
    try {
      await addInstance.mutateAsync(data);
    } catch (e) {
      messageApi.error(`Add instance error: ${e.message}`);
    }
  };

  return (
    <Row style={{ width: '100%' }}>
      <Form
        style={{ width: '100%' }}
        name="addInstance"
        onFinish={handleAddInstance}
        autoComplete="on"
        initialValues={{ type: 'electron' }}
      >
        <Form.Item<FieldType>
          label="Name"
          name="name"
          rules={[{ required: true, message: 'Please input instance name!' }]}
        >
          <Input placeholder="Example 1" />
        </Form.Item>

        <Form.Item<FieldType>
          label="Type"
          name="type"
          rules={[{ required: true, message: 'Please select instance type!' }]}
        >
          <Select>
            <Select.Option value="electron">Electron</Select.Option>
            <Select.Option value="puppeteer">Puppeteer</Select.Option>
            <Select.Option value="single-puppeteer">Single Puppeteer</Select.Option>
          </Select>
        </Form.Item>

        <Form.Item<FieldType>
          label="Url"
          name="url"
          rules={[{ required: true, message: 'Please input instance url!' }]}
        >
          <Input placeholder="https://google.com" />
        </Form.Item>
        <Button htmlType="submit" type="primary" icon={<ChromeFilled />}>
          Add instance
        </Button>
      </Form>
    </Row>
  );
}
