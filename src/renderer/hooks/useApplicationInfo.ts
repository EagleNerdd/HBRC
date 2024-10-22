import { useAppContext } from '@renderer/context/app';

export const useApplicationInfo = () => {
  const { applicationInfo } = useAppContext();
  return applicationInfo;
};
