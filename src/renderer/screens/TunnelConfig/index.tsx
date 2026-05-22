import React, { useEffect, useState } from 'react';
import { Alert, Button, Checkbox, Space, Typography, Spin } from 'antd';
import { TunnelState } from '@shared/types';

const tunnelAPI = () => (window as any).tunnelAPI;

const DOWNLOAD_KEY: Record<string, string> = {
  cloudflare: 'cloudflared',
  frp: 'frpc',
};

export function TunnelConfigScreen() {
  const [state, setState] = useState<TunnelState | null>(null);
  const [selected, setSelected] = useState<string[]>([]);
  const [downloading, setDownloading] = useState<string | null>(null);
  const [activating, setActivating] = useState(false);
  const [deactivating, setDeactivating] = useState(false);

  const loadState = async (initSelected = false) => {
    const s = await tunnelAPI().getState();
    setState(s);
    if (initSelected) setSelected(s.selectedProviders ?? []);
  };

  useEffect(() => {
    loadState(true);
  }, []);

  const handleDownload = async (providerName: string) => {
    const component = DOWNLOAD_KEY[providerName];
    if (!component) return;
    setDownloading(providerName);
    try {
      await tunnelAPI().download(component);
      await loadState();
    } finally {
      setDownloading(null);
    }
  };

  const handleToggle = (name: string, checked: boolean) => {
    setSelected((prev) => (checked ? [...prev, name] : prev.filter((s) => s !== name)));
  };

  const handleActivate = async () => {
    setActivating(true);
    try {
      await tunnelAPI().activate(selected);
      await loadState();
    } finally {
      setActivating(false);
    }
  };

  const handleDeactivate = async () => {
    setDeactivating(true);
    try {
      await tunnelAPI().deactivate();
      await loadState();
    } finally {
      setDeactivating(false);
    }
  };

  if (!state) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
        <Spin />
      </div>
    );
  }

  return (
    <div style={{ padding: 24, fontFamily: 'system-ui' }}>
      <Typography.Title level={4} style={{ marginTop: 0 }}>
        Configure Tunnel
      </Typography.Title>

      {state.isActive && <Alert type="success" showIcon style={{ marginBottom: 20 }} message="Tunnel is active" />}

      <Typography.Paragraph type="secondary" style={{ marginBottom: 16 }}>
        Select providers. The activation order follows your selection order (first checked = highest priority).
      </Typography.Paragraph>

      <Space direction="vertical" style={{ width: '100%', marginBottom: 24 }}>
        {state.providers.map((p) => {
          const priority = selected.indexOf(p.name);
          const isSelected = priority !== -1;
          return (
            <div key={p.name} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Checkbox
                checked={isSelected}
                disabled={!p.isDownloaded}
                onChange={(e) => handleToggle(p.name, e.target.checked)}
              >
                {p.label}
              </Checkbox>
              {isSelected && (
                <span
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: 18,
                    height: 18,
                    borderRadius: '50%',
                    background: '#1677ff',
                    color: '#fff',
                    fontSize: 11,
                    fontWeight: 600,
                    lineHeight: 1,
                  }}
                >
                  {priority + 1}
                </span>
              )}
              {!p.isDownloaded && (
                <Button
                  size="small"
                  loading={downloading === p.name}
                  disabled={!!downloading && downloading !== p.name}
                  onClick={() => handleDownload(p.name)}
                >
                  Download
                </Button>
              )}
            </div>
          );
        })}
      </Space>

      <Space>
        {(!state.isActive || selected.join(',') !== (state.selectedProviders ?? []).join(',')) && (
          <Button
            type="primary"
            loading={activating}
            disabled={selected.length === 0 || !!downloading || deactivating}
            onClick={handleActivate}
          >
            Activate
          </Button>
        )}
        {state.isActive && (
          <Button danger loading={deactivating} disabled={activating || !!downloading} onClick={handleDeactivate}>
            Deactivate
          </Button>
        )}
        <Button onClick={() => window.close()}>Close</Button>
      </Space>
    </div>
  );
}
