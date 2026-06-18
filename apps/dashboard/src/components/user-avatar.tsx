import { Avatar, AvatarFallback, AvatarImage } from '@nexura/ui';
import type { User } from '@nexura/types';

import { getInitials, getUserAvatarUrl } from '../lib/discord-images.js';

export function UserAvatar({ user, className }: { user: User; className?: string }) {
  const displayName = user.globalName ?? user.username;
  return (
    <Avatar className={className}>
      <AvatarImage src={getUserAvatarUrl(user.discordId, user.avatar)} alt="" />
      <AvatarFallback>{getInitials(displayName)}</AvatarFallback>
    </Avatar>
  );
}
