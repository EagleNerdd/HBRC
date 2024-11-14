import React from 'react';
import { Card, Tag, Popconfirm, message, Modal, Form, Input, Button, Divider } from 'antd';
import {
  SendOutlined,
  WindowsOutlined,
  DeleteOutlined,
  PlayCircleOutlined,
  PauseCircleOutlined,
} from '@ant-design/icons';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import QueryKeys from '@renderer/constants/queryKeys';
import useBrowserInstanceManager from '@renderer/hooks/useBrowserInstanceManager';
import { BrowserInstance, BrowserInstanceMessage } from '@shared/types';
import { useApplicationInfo } from '@renderer/hooks/useApplicationInfo';

const DeleteBtn = ({ disabled, onConfirm }) => {
  return (
    <Popconfirm
      disabled={disabled}
      title="Delete intance"
      description="Are you sure to delete this instance?"
      onConfirm={onConfirm}
      okText="Delete"
      cancelText="Cancel"
    >
      <DeleteOutlined style={{ color: 'red' }} onClick={async () => {}} />
    </Popconfirm>
  );
};

const CallFunctionModal = ({ isOpen, instance, setIsOpen }) => {
  const { sessionId } = instance;
  const instanceManager = useBrowserInstanceManager();
  const callFunction = useMutation({
    mutationFn: async ({ sessionId, method, args }: { sessionId: string; method: string; args: any[] }) =>
      instanceManager.callInstanceFunction(sessionId, method, ...args),
    onError(error, variables, context) {
      console.log({ error, variables, context });
      message.error('Send message failed');
    },
  });

  return (
    <Modal
      title="Call Function"
      open={isOpen}
      cancelText="Close"
      onCancel={() => {
        setIsOpen(false);
      }}
    >
      <Form
        onFinish={(values) => {
          callFunction.mutate({ sessionId, method: values.method, args: [values.code] });
        }}
        name="basic"
        labelCol={{ span: 8 }}
        wrapperCol={{ span: 16 }}
        style={{ maxWidth: 600 }}
        autoComplete="off"
      >
        <Form.Item label="Method" name="method" rules={[{ required: true, message: 'Please input method!' }]}>
          <Input />
        </Form.Item>

        <Form.Item label="Code" name="code" rules={[{ required: true, message: 'Please input your code!' }]}>
          <Input.TextArea />
        </Form.Item>
        <Form.Item wrapperCol={{ offset: 8, span: 16 }}>
          <Button type="primary" htmlType="submit">
            Execute
          </Button>
        </Form.Item>
      </Form>
    </Modal>
  );
};

export default function BrowserInstanceComponent({
  instance,
  instanceMessage,
}: {
  instance: BrowserInstance;
  instanceMessage?: BrowserInstanceMessage;
}) {
  const { status, sessionId } = instance;

  const { isDebug } = useApplicationInfo();

  const instanceManager = useBrowserInstanceManager();

  const queryClient = useQueryClient();

  const deleteChannel = useMutation({
    mutationFn: instanceManager.deleteInstance,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [QueryKeys.GET_INSTANCES] });
    },
    onError(error, variables, context) {
      message.error('Delete intance failed');
    },
  });

  const startInstance = useMutation({
    mutationFn: instanceManager.startInstance,
    onSuccess: () => {
      message.success('Start intance success');
    },
    onError(error, variables, context) {
      message.error('Start intance failed');
    },
  });

  const stopInstance = useMutation({
    mutationFn: instanceManager.stopInstance,
    onSuccess: () => {
      message.success('Stop intance success');
    },
    onError(error, variables, context) {
      message.error('Stop intance failed');
    },
  });

  const [isCFModalOpen, setCFModalOpen] = React.useState(false);

  const actions = [];

  if (status === 'Running') {
    actions.push(
      <PauseCircleOutlined
        style={{ color: 'orange' }}
        key="stop"
        onClick={() => {
          stopInstance.mutate(sessionId);
        }}
      />
    );
    actions.push(
      <WindowsOutlined
        key="showWindow"
        onClick={() => {
          instanceManager.showInstanceWindow(sessionId);
        }}
      />
    );
    if (isDebug) {
      actions.push(
        <SendOutlined
          key="call"
          onClick={() => {
            setCFModalOpen(true);
          }}
        />
      );
    }
  } else if (status === 'Stopped') {
    actions.push(
      <PlayCircleOutlined
        style={{ color: 'green' }}
        key="start"
        onClick={() => {
          startInstance.mutate(sessionId);
        }}
      />
    );
  }
  actions.push(
    <DeleteBtn key="delete" disabled={deleteChannel.isPending} onConfirm={() => deleteChannel.mutate(sessionId)} />
  );

  let statusColor = 'default';
  if (status === 'Running') {
    statusColor = 'green';
  } else if (status === 'Stopped') {
    statusColor = 'red';
  } else if (status === 'Starting' || status === 'Stopping') {
    statusColor = 'orange';
  }

  const renderInstanceMessage = () => {
    if (!instanceMessage || status !== 'Running') return null;
    return (
      <>
        <Divider />
        <div dangerouslySetInnerHTML={{ __html: instanceMessage.message }} />
      </>
    );
  };

  return (
    <Card actions={actions}>
      <Card.Meta
        title={instance.name}
        description={
          <div>
            <div>
              <Tag color={statusColor}>{status}</Tag>
              <Tag color="blue">{instance.url}</Tag>
            </div>
            {renderInstanceMessage()}
          </div>
        }
      />
      <CallFunctionModal instance={instance} isOpen={isCFModalOpen} setIsOpen={setCFModalOpen} />
    </Card>
  );
}
