export type TunnelProviderState = {
  name: string;
  label: string;
  isDownloaded: boolean;
};

export type TunnelState = {
  isActive: boolean;
  currentUrl: string | null;
  providers: TunnelProviderState[];
  selectedProviders: string[];
};
