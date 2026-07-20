export interface Profile {
  name: string;
  role: string;
  location: string;
  bio: string;
  email: string;
  github: string;
  linkedin: string;
  twitter: string;
  skills: string[];
}

export interface Message {
  id: string;
  senderName: string;
  senderEmail: string;
  content: string;
  timestamp: string;
}
