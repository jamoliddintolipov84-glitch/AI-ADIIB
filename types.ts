
export enum Mood {
  STRESS = 'Stress',
  MOTIVATION = 'Motivatsiya',
  SADNESS = 'Qayg\'u',
  EXPLORATION = 'Izlanish',
  CALM = 'Xotirjamlik'
}

export interface GroundingSource {
  title: string;
  uri: string;
}

export interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  imageUrl?: string;
  timestamp: Date;
  groundingSources?: GroundingSource[];
}

export interface ChatSession {
  id: string;
  title: string;
  messages: Message[];
  mood: Mood | null;
  updatedAt: Date;
}

export interface AdibState {
  chats: ChatSession[];
  activeChatId: string | null;
  isLoading: boolean;
  wisdomOfTheDay: string | null;
  currentTask: string | null;
  stars: number;
}
