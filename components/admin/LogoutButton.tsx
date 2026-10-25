'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

export function LogoutButton() {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  return (
    <button
      type="button"
      className="btn btn--ghost btn--sm"
      style={{ width: '100%' }}
      disabled={pending}
      onClick={async () => {
        setPending(true);
        // POST, а не GET-ссылка: выход не должен срабатывать от перехода по URL
        await fetch('/api/auth/logout', { method: 'POST' });
        router.replace('/admin/login');
        router.refresh();
      }}
    >
      {pending ? 'Выходим…' : 'Выйти'}
    </button>
  );
}
