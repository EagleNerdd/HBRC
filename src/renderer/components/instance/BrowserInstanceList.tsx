import React, { useEffect } from 'react';
import { Row, Col, Empty, Spin } from 'antd';
import { useQuery } from '@tanstack/react-query';
import QueryKeys from '@renderer/constants/queryKeys';
import useBrowserInstanceManager from '@renderer/hooks/useBrowserInstanceManager';
import BrowserInstanceComponent from './BrowserInstance';
import useApplication from '@renderer/hooks/useApplication';
import { PreloadEventKey } from '@shared/event/preload';
import { BrowserInstanceMessage } from '@shared/types';

function renderSpin() {
  return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
      <Spin size="large"></Spin>
    </div>
  );
}

function renderInstances(instances: any[], messageMap: Record<string, BrowserInstanceMessage>) {
  return (
    <Row gutter={[16, 16]}>
      {instances.map((instance) => {
        return (
          <Col key={instance.sessionId} span={10}>
            <BrowserInstanceComponent instance={instance} instanceMessage={messageMap[instance.sessionId]} />
          </Col>
        );
      })}
    </Row>
  );
}

const instanceMessageMapData = {};

export default function BrowserInstanceList() {
  const instanceManager = useBrowserInstanceManager();
  const application = useApplication();
  const [instanceMessageMap, setInstanceMessageMap] =
    React.useState<Record<string, BrowserInstanceMessage>>(instanceMessageMapData);

  const handleSetInstanceMessageMap = (sessionId: string, message: BrowserInstanceMessage) => {
    instanceMessageMapData[sessionId] = message;
    setInstanceMessageMap((prev) => {
      return {
        ...prev,
        [sessionId]: message,
      };
    });
  };

  const {
    data: instances,
    isFetching,
    refetch,
  } = useQuery({
    queryKey: [QueryKeys.GET_INSTANCES],
    queryFn: instanceManager.getInstances,
  });

  useEffect(() => {
    application.subscribeEvent(PreloadEventKey.INSTANCE_UPDATED, () => {
      refetch();
    });
    application.subscribeEvent(
      PreloadEventKey.INSTANCE_MESSAGE,
      (data: { sessionId: string; message: BrowserInstanceMessage }) => {
        handleSetInstanceMessageMap(data.sessionId, data.message);
      }
    );
  }, []);

  const isEmpty = !instances || !instances.length;

  return (
    <>
      {isFetching && renderSpin()}
      {!isFetching && isEmpty && <Empty />}
      {!isEmpty && renderInstances(instances, instanceMessageMap)}
    </>
  );
}
