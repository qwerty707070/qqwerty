import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { PlayerAccount } from '../types/launcher';

interface AccountState {
  accounts: PlayerAccount[];
  activeAccountId: string;
  setActiveAccount: (id: string) => void;
  addOfflineProfile: (username: string, skinPreset: PlayerAccount['skinPreset']) => PlayerAccount;
  upsertMicrosoftAccount: (username: string, uuid: string) => PlayerAccount;
  removeAccount: (id: string) => void;
}

const INITIAL_ACCOUNTS: PlayerAccount[] = [
  {
    id: 'acc-winvisual',
    username: 'WinVisual',
    uuid: '8f4e2a91-4d3b-49c2-9b1e-77a910c3e804',
    authType: 'local',
    skinPreset: 'winvisual',
    capeName: 'WinVisual Crown Shader',
    online: true,
    lastUsed: 'Active session',
  },
  {
    id: 'acc-notch-preview',
    username: 'Notch',
    uuid: '069a79f4-44e9-4726-a5be-fca90e38aaf5',
    authType: 'microsoft-demo',
    skinPreset: 'obsidian',
    capeName: 'Founder Obsidian Cloak',
    online: true,
    lastUsed: 'Demo Preview Profile',
  },
  {
    id: 'acc-valkyrie',
    username: 'Valkyrie',
    uuid: '3c19b7d0-91fa-42e8-b03a-18f2049e51d2',
    authType: 'local',
    skinPreset: 'slim',
    capeName: 'Aurora Silk Cape',
    online: false,
    lastUsed: '2 days ago',
  },
];

function generateDeterministicUuid(name: string): string {
  let h = 2166136261;
  for (let i = 0; i < name.length; i++) {
    h ^= name.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  const hex = Math.abs(h).toString(16).padStart(8, '0');
  return `${hex}-3a9b-4e12-8c4f-${hex}a91b`;
}

export const useAccountStore = create<AccountState>()(
  persist(
    (set, get) => ({
      accounts: INITIAL_ACCOUNTS,
      activeAccountId: INITIAL_ACCOUNTS[0].id,
      setActiveAccount: (id) => {
        if (get().accounts.some((a) => a.id === id)) {
          set({ activeAccountId: id });
        }
      },
      addOfflineProfile: (username, skinPreset) => {
        const clean = username.trim().slice(0, 16) || 'Player';
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
      name: 'winvisual-accounts-v3',
    }
  )
);
