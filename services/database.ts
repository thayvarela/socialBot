
import { CollectedProfile, ActionPerformed, SocialAccount, Platform } from "../types";

const STORAGE_KEYS = {
  PROFILES: 'socialbot_profiles_v2',
  ACTIONS: 'socialbot_actions_v2',
  INTERACTED: 'socialbot_interacted_v2',
  ACCOUNTS: 'socialbot_accounts_v2'
};

export const db = {
  // Accounts Management
  getAccounts: (): SocialAccount[] => {
    const data = localStorage.getItem(STORAGE_KEYS.ACCOUNTS);
    return data ? JSON.parse(data) : [];
  },
  
  addAccount: (account: Omit<SocialAccount, 'id' | 'createdAt'>) => {
    const accounts = db.getAccounts();
    const newAccount: SocialAccount = {
      ...account,
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString()
    };
    localStorage.setItem(STORAGE_KEYS.ACCOUNTS, JSON.stringify([...accounts, newAccount]));
    return newAccount;
  },

  deleteAccount: (id: string) => {
    const accounts = db.getAccounts().filter(a => a.id !== id);
    localStorage.setItem(STORAGE_KEYS.ACCOUNTS, JSON.stringify(accounts));
  },

  // Profiles Management
  getProfiles: (platform?: Platform): CollectedProfile[] => {
    const data = localStorage.getItem(STORAGE_KEYS.PROFILES);
    const profiles: CollectedProfile[] = data ? JSON.parse(data) : [];
    return platform ? profiles.filter(p => p.plataforma === platform) : profiles;
  },

  addProfile: (profile: Omit<CollectedProfile, 'id' | 'data_insercao'>): boolean => {
    const profiles = db.getProfiles();
    const exists = profiles.some(p => p.perfil_usuario === profile.perfil_usuario && p.plataforma === profile.plataforma);
    if (exists) return false;

    const newProfile: CollectedProfile = {
      ...profile,
      id: crypto.randomUUID(),
      data_insercao: new Date().toISOString()
    };
    
    localStorage.setItem(STORAGE_KEYS.PROFILES, JSON.stringify([...profiles, newProfile]));
    return true;
  },

  // Actions
  getActions: (): ActionPerformed[] => {
    const data = localStorage.getItem(STORAGE_KEYS.ACTIONS);
    return data ? JSON.parse(data) : [];
  },

  addAction: (action: Omit<ActionPerformed, 'id' | 'data_acao'>) => {
    const actions = db.getActions();
    const newAction: ActionPerformed = {
      ...action,
      id: crypto.randomUUID(),
      data_acao: new Date().toISOString()
    };
    localStorage.setItem(STORAGE_KEYS.ACTIONS, JSON.stringify([...actions, newAction]));
    
    // Interacted list for ignoring
    const interactedKey = `${action.plataforma}_interacted`;
    const dataInteracted = localStorage.getItem(interactedKey);
    const interacted: string[] = dataInteracted ? JSON.parse(dataInteracted) : [];
    if (!interacted.includes(action.perfil_usuario)) {
        localStorage.setItem(interactedKey, JSON.stringify([...interacted, action.perfil_usuario]));
    }
  },

  getInteractedList: (platform: Platform): string[] => {
    const data = localStorage.getItem(`${platform}_interacted`);
    return data ? JSON.parse(data) : [];
  },

  clearAll: () => {
    Object.values(STORAGE_KEYS).forEach(k => localStorage.removeItem(k));
    ['instagram', 'tiktok', 'kwai', 'youtube'].forEach(p => localStorage.removeItem(`${p}_interacted`));
  }
};
