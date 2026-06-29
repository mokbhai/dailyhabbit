import { TrpcProvider } from './TrpcProvider';
import { UserList } from './UserList';

interface UsersIslandMessages {
  loading: string;
  error: string;
  empty: string;
  badge: string;
}

export function UsersIsland({
  messages,
  variant,
}: {
  messages: UsersIslandMessages;
  variant?: 'light' | 'dark';
}) {
  return (
    <TrpcProvider>
      <UserList messages={messages} variant={variant} />
    </TrpcProvider>
  );
}
