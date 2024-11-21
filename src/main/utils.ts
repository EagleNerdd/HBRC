import { app } from 'electron';
import path from 'path';

let _isDebuging = false;

const setDebugging = (val: boolean) => {
  _isDebuging = val;
};

const isDebugging = () => {
  return _isDebuging;
};

const getDataPath = (...paths: any[]) => {
  if (app.isPackaged) {
    return path.join(app.getPath('userData'), 'data', ...paths);
  } else {
    return path.join(app.getAppPath(), 'out', 'data', ...paths);
  }
};

const getLogFilePath = (...paths: any[]) => {
  if (app.isPackaged) {
    return path.join(app.getPath('userData'), 'logs', ...paths);
  } else {
    return path.join(app.getAppPath(), 'out', 'logs', ...paths);
  }
};

let USER_AGENTS = [
  'Mozilla/5.0 (Linux x86_64; rv:128.0) Gecko/20100101 Firefox/128.0',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36 Edg/131.0.2903.48',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 14.7; rv:128.0) Gecko/20100101 Firefox/128.0',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 14.7; rv:132.0) Gecko/20100101 Firefox/132.0',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_7_1) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36 Edg/131.0.2903.48',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:128.0) Gecko/20100101 Firefox/128.0',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:132.0) Gecko/20100101 Firefox/132.0',
  'Mozilla/5.0 (X11; Fedora; Linux x86_64; rv:128.0) Gecko/20100101 Firefox/128.0',
  'Mozilla/5.0 (X11; Fedora; Linux x86_64; rv:132.0) Gecko/20100101 Firefox/132.0',
  'Mozilla/5.0 (X11; Linux i686; rv:128.0) Gecko/20100101 Firefox/128.0',
  'Mozilla/5.0 (X11; Linux i686; rv:132.0) Gecko/20100101 Firefox/132.0',
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
  'Mozilla/5.0 (X11; Linux x86_64; rv:132.0) Gecko/20100101 Firefox/132.0',
  'Mozilla/5.0 (X11; Ubuntu; Linux i686; rv:128.0) Gecko/20100101 Firefox/128.0',
  'Mozilla/5.0 (X11; Ubuntu; Linux i686; rv:132.0) Gecko/20100101 Firefox/132.0',
  'Mozilla/5.0 (X11; Ubuntu; Linux x86_64; rv:128.0) Gecko/20100101 Firefox/128.0',
  'Mozilla/5.0 (X11; Ubuntu; Linux x86_64; rv:132.0) Gecko/20100101 Firefox/132.0',
];

const updateUserAgents = async () => {
  try {
    const url = 'https://jnrbsn.github.io/user-agents/user-agents.json';
    const resp = await fetch(url, { signal: AbortSignal.timeout(5000) });
    if (!resp.ok) {
      throw new Error(`${resp.status} - ${resp.statusText}`);
    }
    USER_AGENTS = await resp.json();
  } catch (e) {
    console.warn('Failed to fetch user agents', e);
  }
};

const getLatestUserAgent = (os: string, browser: string) => {
  for (const userAgent of USER_AGENTS) {
    const lowerUserAgent = userAgent.toLowerCase();
    if (lowerUserAgent.includes(os.toLowerCase()) && lowerUserAgent.includes(browser.toLowerCase())) {
      return userAgent;
    }
  }
  return null;
};

export { getDataPath, getLogFilePath, isDebugging, setDebugging, getLatestUserAgent, updateUserAgents };
