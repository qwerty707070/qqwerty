import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { PlayerAccount } from '../types/launcher';

export function generateRandomUserNick(): string {
  let num = 10000;
  if (typeof globalThis.crypto !== 'undefined' && typeof globalThis.crypto.getRandomValues === 'function') {
    const arr = new Uint32Array(1);
    globalThis.crypto.getRandomValues(arr);
    num = 10000 + (arr[0] % 90000);
  } else {
    num = 10000 + Math.floor(Math.random() * 90000);
  }
  return `user${num}`;
}

export function generateDeterministicUuid(name: string): string {
  let h = 2166136261;
  for (let i = 0; i < name.length; i++) {
    h ^= name.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  const hex = Math.abs(h).toString(16).padStart(8, '0');
  return `${hex}-3a9b-4e12-8c4f-${hex}a91b`;
}

function createDefaultUserAccount(): PlayerAccount {
  const nick = generateRandomUserNick();
  return {
    id: 'acc-local-user',
    username: nick,
    uuid: generateDeterministicUuid(nick),
    authType: 'local',
    skinPreset: 'winvisual',
    capeName: 'WinVisual Crown Shader',
    online: true,
    lastUsed: 'Active session',
  };
}

interface AccountState {
  accounts: PlayerAccount[];
  activeAccountId: string;
  setActiveAccount: (id: string) => void;
  renameActiveAccount: (username: string) => PlayerAccount;
  randomizeActiveAccount: () => PlayerAccount;
  addOfflineProfile: (username: string, skinPreset: PlayerAccount['skinPreset']) => PlayerAccount;
  upsertMicrosoftAccount: (username: string, uuid: string) => PlayerAccount;
  removeAccount: (id: string) => void;
}

const DEFAULT_ACCOUNT = createDefaultUserAccount();

export const useAccountStore = create<AccountState>()(
  persist(
    (set, get) => ({
      accounts: [DEFAULT_ACCOUNT],
      activeAccountId: DEFAULT_ACCOUNT.id,
      setActiveAccount: (id) => {
        if (get().accounts.some((a) => a.id === id)) {
          set({ activeAccountId: id });
        }
      },
      renameActiveAccount: (username) => {
        const clean = username.trim().slice(0, 16) || generateRandomUserNick();
        const currentId = get().activeAccountId;
        let updatedAccount: PlayerAccount = createDefaultUserAccount();
        set((state) => {
          const next = state.accounts.map((acc) => {
            if (acc.id !== currentId) return acc;
            updatedAccount = {
              ...acc,
              username: clean,
              uuid: acc.authType === 'microsoft' ? acc.uuid : generateDeterministicUuid(clean),
            };
            return updatedAccount;
          });
          return { accounts: next };
        });
        return updatedAccount;
      },
      randomizeActiveAccount: () => {
        return get().renameActiveAccount(generateRandomUserNick());
      },
      addOfflineProfile: (username, skinPreset) => {
        const clean = username.trim().slice(0, 16) || generateRandomUserNick();
        const created: PlayerAccount = {
          id: `acc-${Date.now().toString(36)}`,
          username: clean,
          uuid: generateDeterministicUuid(clean),
          authType: 'local',
          skinPreset,
          capeName: 'WinVisual Default Cloak',
          online: true,
          lastUsed: 'Just created',
        };
        set((state) => ({
          accounts: [created, ...state.accounts],
          activeAccountId: created.id,
        }));
        return created;
      },
      upsertMicrosoftAccount: (username, uuid) => {
        const entry: PlayerAccount = {
          id: `ms-${uuid.slice(0, 8)}`,
          username,
          uuid,
          authType: 'microsoft',
          skinPreset: 'winvisual',
          capeName: 'WinVisual Crown Shader',
          online: true,
          lastUsed: 'Microsoft Verified',
        };
        set((state) => ({
          accounts: [entry, ...state.accounts.filter((a) => a.uuid !== uuid)],
          activeAccountId: entry.id,
        }));
        return entry;
      },
      removeAccount: (id) =>
        set((state) => {
          if (state.accounts.length <= 1) return state;
          const remaining = state.accounts.filter((a) => a.id !== id);
          const nextActive =
            state.activeAccountId === id ? remaining[0].id : state.activeAccountId;
          return {
            accounts: remaining,
            activeAccountId: nextActive,
          };
        }),
    }),
    {
      name: 'winvisual-accounts-v4',
      merge: (persistedState, currentState) => {
        const raw = persistedState as Partial<AccountState> | undefined;
        if (!raw || !Array.isArray(raw.accounts) || raw.accounts.length === 0) {
          return currentState;
        }
        const sanitized = raw.accounts.map((acc) => {
          if (!acc.username || /^(winvisual|aethervisual)$/i.test(acc.username.trim())) {
            const replacement = generateRandomUserNick();
            return {
              ...acc,
              username: replacement,
              uuid: generateDeterministicUuid(replacement),
            };
          }
          return acc;
        });
        const validActive = sanitized.some((a) => a.id === raw.activeAccountId)
          ? (raw.activeAccountId as string)
          : sanitized[0].id;
        return {
          ...currentState,
          accounts: sanitized,
          activeAccountId: validActive,
        };
      },
    }
  )
);
