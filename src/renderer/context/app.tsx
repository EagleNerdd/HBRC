import { message } from 'antd';
import { MessageInstance } from 'antd/es/message/interface';
import React, { useEffect } from 'react';
import useApplication from '@renderer/hooks/useApplication';
import { ApplicationAPI, ApplicationInfo } from '@shared/types';
import QueryKeys from '@renderer/constants/queryKeys';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { PreloadEventKey } from '@shared/event/preload';
import { MenuItemId } from '@shared/constants';

type AppContextType = {
  messageApi: MessageInstance;
  messageContextHolder: React.ReactElement;
  application: ApplicationAPI;
  applicationInfo: ApplicationInfo;
  isLoading: boolean;
  isOnboarded: boolean;
  isApplyingOptions: boolean;
  applyOptions: (options: any) => Promise<void>;
};

const AppContext = React.createContext<AppContextType>({
  messageApi: undefined,
  messageContextHolder: null,
  application: null,
  applicationInfo: null,
  isLoading: true,
  isOnboarded: false,
  isApplyingOptions: false,
  applyOptions: async () => {},
});

export default function AppContextProvider({ children }) {
  const [messageApi, messageContextHolder] = message.useMessage();
  const [isApplicationReady, setIsApplicationReady] = React.useState(true);
  const [isApplyingOptions, setIsApplyingOptions] = React.useState(false);
  const application = useApplication();
  const queryClient = useQueryClient();

  const {
    data: applicationInfo,
    isFetching: isFetchingAppInfo,
    refetch,
  } = useQuery<ApplicationInfo>({
    queryKey: [QueryKeys.GET_APPLICATION_INFO],
    queryFn: application.getApplicationInfo,
    enabled: isApplicationReady,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });
  const [isOnboarded, setIsOnboarded] = React.useState(false);

  const applyOptions = async (options: any) => {
    setIsApplyingOptions(true);
    try {
      await application.setApplicationOptions(options);
      await queryClient.invalidateQueries({ queryKey: [QueryKeys.GET_APPLICATION_INFO] });
    } finally {
      setIsApplyingOptions(false);
    }
  };

  useEffect(() => {
    const apReadySubId = application.subscribeEvent(PreloadEventKey.APPLICATION_READY, () => {
      setIsApplicationReady(true);
    });
    const serverDisSubId = application.subscribeEvent(PreloadEventKey.SERVER_DISCONNECTED, () => {
      refetch();
    });
    const transporterStatusSubId = application.subscribeEvent(PreloadEventKey.TRANSPORTER_STATUS_CHANGED, () => {
      refetch();
    });
    const onStartAllInstancesSubId = application.onMenuItemProcessed(MenuItemId.START_ALL_INSTANCES, () => {
      messageApi.success('All instances started');
    });
    const onStopAllInstancesSubId = application.onMenuItemProcessed(MenuItemId.STOP_ALL_INSTANCES, () => {
      messageApi.success('All instances stopped');
    });
    return () => {
      application.unsubscribeEvent(apReadySubId);
      application.unsubscribeEvent(serverDisSubId);
      application.unsubscribeEvent(transporterStatusSubId);
      application.unsubscribeEvent(onStartAllInstancesSubId);
      application.unsubscribeEvent(onStopAllInstancesSubId);
    };
  }, []);

  useEffect(() => {
    if (applicationInfo) {
      setIsOnboarded(!!applicationInfo.options?.serverName);
    }
  }, [applicationInfo]);

  return (
    <AppContext.Provider
      value={{
        messageApi,
        messageContextHolder,
        application,
        applicationInfo,
        isLoading: !isApplicationReady || isFetchingAppInfo,
        isOnboarded: isOnboarded && !isApplyingOptions,
        isApplyingOptions,
        applyOptions,
      }}
    >
      {messageContextHolder}
      {children}
    </AppContext.Provider>
  );
}

export const useAppContext = () => React.useContext(AppContext);
