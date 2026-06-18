export interface PluginMessageReceipt {
  id: string;
  channelId: string;
}

import type { ComponentsV2Message, CoreMessage, EmbedMessage } from '@nexura/types';

export interface PluginMessages {
  build(input: unknown): CoreMessage;
  sendChannel(channelId: string, message: CoreMessage): Promise<PluginMessageReceipt>;
  sendDirect(userId: string, message: CoreMessage): Promise<PluginMessageReceipt>;
  sendVisualCard(
    channelId: string,
    layout: unknown,
    previewData: Record<string, string>,
  ): Promise<PluginMessageReceipt>;
  delete(channelId: string, messageId: string): Promise<void>;
}

export interface PluginEmbeds {
  build(input: Record<string, unknown>): EmbedMessage;
}

export interface PluginComponents {
  build(input: Record<string, unknown>): ComponentsV2Message;
}
