import React, { useEffect } from 'react';
import { Button, Card, Divider, Form, Input, message, Modal, Popconfirm, Select, Space, Tag } from 'antd';
import {
  DeleteOutlined,
  EditOutlined,
  EyeInvisibleOutlined,
  PauseCircleOutlined,
  PlayCircleOutlined,
  PlusOutlined,
  SendOutlined,
  WindowsOutlined,
} from '@ant-design/icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import QueryKeys from '@renderer/constants/queryKeys';
import useBrowserInstanceManager from '@renderer/hooks/useBrowserInstanceManager';
import { BrowserInstance, BrowserInstanceMessage, BrowserInstanceNames } from '@shared/types';
import { useApplicationInfo } from '@renderer/hooks/useApplicationInfo';

const DeleteBtn = ({ disabled, onConfirm }) => {
  return (
    <Popconfirm
      disabled={disabled}
      title="Delete instance"
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

const AttributeField = ({ form, name, restField, presets, onRemove }) => {
  const currentKey = Form.useWatch(['attributes', name, 'key'], form);
  const preset = presets?.find((p) => p.key === currentKey);
  const hasEnum = preset?.enum?.length > 0;
  const isMulti = preset?.type === 'multiselect';

  return (
    <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start', marginBottom: 8 }}>
      {preset ? (
        <>
          <Form.Item {...restField} name={[name, 'key']} hidden>
            <Input />
          </Form.Item>
          <Input value={preset.label} disabled style={{ width: 150, flexShrink: 0 }} />
        </>
      ) : (
        <Form.Item
          {...restField}
          name={[name, 'key']}
          rules={[{ required: true, message: 'Key required' }]}
          style={{ margin: 0 }}
        >
          <Input placeholder="Key" style={{ width: 150 }} />
        </Form.Item>
      )}
      <Form.Item
        {...restField}
        name={[name, 'value']}
        rules={[{ required: true, message: 'Value required' }]}
        style={{ margin: 0, flex: 1 }}
      >
        {hasEnum ? (
          <Select
            mode={isMulti ? 'multiple' : undefined}
            options={preset.enum.map((e) => ({ value: e.key, label: e.label }))}
            placeholder="Select value"
            style={{ width: '100%' }}
            allowClear
            showSearch
            optionFilterProp="label"
          />
        ) : (
          <Input placeholder="Value" />
        )}
      </Form.Item>
      <Button onClick={() => onRemove(name)} danger icon={<DeleteOutlined />} style={{ flexShrink: 0 }} />
    </div>
  );
};

const EditInstanceModal = ({ isOpen, instance, setIsOpen }) => {
  const [form] = Form.useForm();
  const instanceManager = useBrowserInstanceManager();
  const presets = instance.attributePresets ?? [];
  const currentAttributes = Form.useWatch('attributes', form) ?? [];
  const usedPresetKeys = new Set(
    currentAttributes.map((a: { key: string }) => a?.key).filter((k: string) => presets.some((p) => p.key === k))
  );
  const availablePresets = presets.filter((p) => !usedPresetKeys.has(p.key));

  const updateInstance = useMutation({
    mutationFn: ({ name, attributes }: { name: string; attributes: Record<string, string | string[]> }) =>
      instanceManager.updateInstance(
        instance.sessionId,
        { name, attributes },
        { restart: false, notifyToTransporter: true, notifyToRenderer: true }
      ),
    onSuccess: () => {
      message.success('Update attributes success');
      setIsOpen(false);
    },
    onError(error, variables, context) {
      console.log({ error, variables, context });
      message.error('Update attributes failed');
    },
  });

  useEffect(() => {
    if (instance) {
      form.setFieldsValue({
        name: instance.name,
        attributes: Object.entries(instance.attributes || {}).map(([key, value]) => ({ key, value })),
      });
    }
  }, [instance, presets]);

  return (
    <Modal
      title={`${instance?.name} - Edit Instance`}
      open={isOpen}
      onOk={async () => {
        const values = form.getFieldsValue();
        const attributes: Record<string, string | string[]> = {};
        for (const { key, value } of values.attributes ?? []) {
          if (!key) {
            message.error('Key and value are required');
            return;
          }
          attributes[key] = value ?? '';
        }
        updateInstance.mutate({ name: values.name, attributes });
      }}
      onCancel={() => setIsOpen(false)}
      width={700}
      okText="Save"
    >
      <Form form={form} name="editInstance">
        <h4>Instance</h4>
        <Form.Item label="Name" name="name" rules={[{ required: true, message: 'Please input instance name!' }]}>
          <Input placeholder="Example 1" />
        </Form.Item>
      </Form>
      <Form form={form} layout="vertical" name="editAttributes">
        <h4>Attributes</h4>
        <Form.List name="attributes">
          {(fields, { add, remove }) => (
            <>
              {fields.map(({ key, name, ...restField }) => (
                <AttributeField
                  key={key}
                  form={form}
                  name={name}
                  restField={restField}
                  presets={presets}
                  onRemove={remove}
                />
              ))}
              <Form.Item>
                <Space>
                  <Button type="dashed" onClick={() => add()} icon={<PlusOutlined />}>
                    Add Attribute
                  </Button>
                  {presets.length > 0 && (
                    <Select
                      placeholder="Add from preset..."
                      style={{ width: 220 }}
                      value={null}
                      onSelect={(presetKey) => {
                        const preset = presets.find((p) => p.key === (presetKey as string));
                        if (preset) {
                          add({ key: preset.key, value: preset.type === 'multiselect' ? [] : undefined });
                        }
                      }}
                      options={availablePresets.map((p) => ({ value: p.key, label: p.label }))}
                    />
                  )}
                </Space>
              </Form.Item>
            </>
          )}
        </Form.List>
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
      message.error('Delete instance failed');
    },
  });

  const startInstance = useMutation({
    mutationFn: instanceManager.startInstance,
    onSuccess: () => {
      message.success('Start instance success');
    },
    onError(error, variables, context) {
      message.error('Start instance failed');
    },
  });

  const stopInstance = useMutation({
    mutationFn: instanceManager.stopInstance,
    onSuccess: () => {
      message.success('Stop instance success');
    },
    onError(error, variables, context) {
      message.error('Stop instance failed');
    },
  });

  const [isCFModalOpen, setCFModalOpen] = React.useState(false);
  const [isSetAttributesModalOpen, setEditInstanceModalOpen] = React.useState(false);

  const actions = [];

  actions.push(
    <EditOutlined
      key="edit"
      onClick={() => {
        setEditInstanceModalOpen(true);
      }}
    />
  );

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
    if ((instance.type != 'puppeteer' && instance.type != 'single-puppeteer') || instance.headless) {
      actions.push(
        <WindowsOutlined
          key="showWindow"
          onClick={() => {
            instanceManager.showInstanceWindow(sessionId);
          }}
        />
      );
    } else {
      actions.push(
        <EyeInvisibleOutlined
          key="hideWindow"
          onClick={() => {
            instanceManager.hideInstanceWindow(sessionId);
          }}
        />
      );
    }
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
              {instance.type != 'electron' && (
                <Tag color="purple">{BrowserInstanceNames[instance.type] ?? instance.type}</Tag>
              )}
              {instance.headless && <Tag color="red">headless</Tag>}
              <Tag color="blue">{instance.url}</Tag>
            </div>
            {renderInstanceMessage()}
          </div>
        }
      />
      <CallFunctionModal instance={instance} isOpen={isCFModalOpen} setIsOpen={setCFModalOpen} />
      <EditInstanceModal instance={instance} isOpen={isSetAttributesModalOpen} setIsOpen={setEditInstanceModalOpen} />
    </Card>
  );
}
