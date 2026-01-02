
export type Platform = 'instagram' | 'tiktok' | 'kwai' | 'youtube';
export type Sentiment = 'positivo' | 'neutro' | 'negativo';
export type OriginType = 'curtida' | 'comentario';
export type ActionType = 'curtir' | 'comentar' | 'direct' | 'follow' | 'unfollow';

export interface SocialAccount {
  id: string;
  username: string;
  password?: string;
  platform: Platform;
  status: 'ativa' | 'inativa';
  createdAt: string;
}

export interface CollectedProfile {
  id: string;
  perfil_usuario: string;
  plataforma: Platform;
  tipo_origem: OriginType;
  perfil_origem: string;
  comentario?: string;
  tipo_comentario?: Sentiment;
  nicho: string;
  data_insercao: string;
}

// Interface for tracking actions performed by the automated system
export interface ActionPerformed {
  id: string;
  perfil_usuario: string;
  plataforma: Platform;
  tipo_acao: ActionType;
  data_acao: string;
  conteudo?: string;
}

export interface PostIdea {
  id: string;
  platform: Platform;
  title: string;
  script: string;
  narratorScript?: string; // Para YouTube
  videoDuration?: number; // Segundos
  caption: string;
  hashtags: string[];
  cta: string;
  overlayText: string; // Texto viral por cima do post
  visualMode: 'ai_generated' | 'web_search';
  imageUrl?: string;
  storyboard?: { time: string; description: string; webUri: string }[];
}

export interface LogEntry {
  timestamp: string;
  message: string;
  type: 'info' | 'success' | 'warning' | 'error';
  platform?: Platform;
}

export interface SystemUser {
  id: string;
  email: string;
  isAuthenticated: boolean;
}
