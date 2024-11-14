import React from 'react';
import BrowserInstanceList from './BrowserInstanceList';
import { Modal } from 'antd';
import { MenuItemId } from '@shared/constants';
import { AddInstanceComponent } from './AddInstance';
import { useMenuItem } from '@renderer/hooks/useMenuItem';

export default function BrowserInstanceManagerComponent() {
  const [isOpenAddInstanceModal, setIsOpenAddInstanceModal] = React.useState(false);

  useMenuItem(MenuItemId.ADD_INSTANCE, () => {
    setIsOpenAddInstanceModal(true);
  });

  return (
    <>
      <BrowserInstanceList />
      <Modal
        title="Add Instance"
        open={isOpenAddInstanceModal}
        onCancel={() => {
          setIsOpenAddInstanceModal(false);
        }}
        footer={null}
      >
        <AddInstanceComponent />
      </Modal>
    </>
  );
}
