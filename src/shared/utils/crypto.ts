import { isWeb } from './runtime';

export const b64EncodeString = (data: string): string => {
  if (isWeb()) {
    return btoa(data);
  } else {
    return Buffer.from(data).toString('base64');
  }
};

export const urlSafeB64EncodeString = (data: string): string => {
  if (isWeb()) {
    return btoa(data).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
  } else {
    return Buffer.from(data).toString('base64url').toString();
  }
};

export const b64DecodeString = (data: string): string => {
  if (isWeb()) {
    return atob(data);
  } else {
    return Buffer.from(data, 'base64').toString();
  }
};

export const urlSafeB64DecodeString = (data: string): string => {
  if (isWeb()) {
    return atob(data.replace(/-/g, '+').replace(/_/g, '/'));
  } else {
    return Buffer.from(data, 'base64url').toString();
  }
};
