import { registerPlugin } from '@capacitor/core';

export interface AlsPlugin {
  start(): Promise<void>;
  stop(): Promise<void>;
  addListener(
    eventName: 'luxChanged',
    listenerFunc: (data: { lux: number }) => void,
  ): Promise<PluginListenerHandle> & PluginListenerHandle;
}

export interface PluginListenerHandle {
  remove: () => void;
}

export const AlsPlugin = registerPlugin<AlsPlugin>('AlsPlugin');
