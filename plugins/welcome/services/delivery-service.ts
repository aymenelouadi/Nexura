import type { CoreMessage, PluginTemplate } from '@nexura/types';
import type { PluginContext, PluginMessageReceipt } from '@nexura/shared';

export class WelcomeDeliveryService {
  constructor(private readonly context: PluginContext) {}

  async sendChannel(
    channelId: string,
    template: PluginTemplate,
    variables: Record<string, string>,
  ): Promise<PluginMessageReceipt> {
    if (template.contentMode === 'visual_card') {
      return this.context.messages.sendVisualCard(
        channelId,
        template.content,
        variables,
      );
    }
    return this.context.messages.sendChannel(
      channelId,
      resolveMessage(template.content as CoreMessage, variables, this.context),
    );
  }

  sendDirect(
    userId: string,
    template: PluginTemplate,
    variables: Record<string, string>,
  ): Promise<PluginMessageReceipt> {
    return this.context.messages.sendDirect(
      userId,
      resolveMessage(template.content as CoreMessage, variables, this.context),
    );
  }

  scheduleDelete(receipt: PluginMessageReceipt, seconds: number): void {
    this.context.scheduler.schedule(`delete:${receipt.channelId}:${receipt.id}`, seconds * 1_000, () =>
      this.context.messages.delete(receipt.channelId, receipt.id),
    );
  }
}

function resolveMessage(
  message: CoreMessage,
  variables: Record<string, string>,
  context: PluginContext,
): CoreMessage {
  return mapStrings(message, (value) => context.variables.resolve(value, variables)) as CoreMessage;
}

function mapStrings(value: unknown, resolve: (value: string) => string): unknown {
  if (typeof value === 'string') {
    return resolve(value);
  }
  if (Array.isArray(value)) {
    return value.map((item) => mapStrings(item, resolve));
  }
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [key, mapStrings(item, resolve)]),
    );
  }
  return value;
}
