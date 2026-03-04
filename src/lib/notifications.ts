import { createContext, useContext } from "react";

export interface AppNotification {
  id: string;
  type: "post_aura" | "post_comment";
  postId: string;
  postTitle: string;
  actorId: string;
  actorAlias: string;
  createdAt: number;
  vote?: 1 | -1;
}

interface NotificationsContextValue {
  notifications: AppNotification[];
  unreadCount: number;
  lastReadAt: number;
  markAllAsRead: () => void;
}

const defaultValue: NotificationsContextValue = {
  notifications: [],
  unreadCount: 0,
  lastReadAt: 0,
  markAllAsRead: () => {}
};

export const NotificationsContext = createContext<NotificationsContextValue>(defaultValue);

export const useNotifications = (): NotificationsContextValue => useContext(NotificationsContext);
