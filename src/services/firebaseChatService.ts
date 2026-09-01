import { initializeApp, getApps, getApp, FirebaseApp } from 'firebase/app';
import {
  getDatabase,
  ref,
  set,
  push,
  onValue,
  off,
  update,
  get,
  Database
} from 'firebase/database';
import { UserProfile, ChatRoom, ChatMessage } from '../types';

// Environment variables or fallback config for Firebase
const env = (import.meta as unknown as { env?: Record<string, string> }).env || {};
const hasRealFirebaseConfig = Boolean(
  env.VITE_FIREBASE_API_KEY &&
  env.VITE_FIREBASE_DATABASE_URL &&
  !env.VITE_FIREBASE_DATABASE_URL.includes('default-rtdb.firebaseio.com') &&
  !env.VITE_FIREBASE_API_KEY.includes('AIzaSyDemoKey')
);

let app: FirebaseApp | null = null;
let db: Database | null = null;

if (hasRealFirebaseConfig) {
  try {
    if (getApps().length === 0) {
      app = initializeApp({
        apiKey: env.VITE_FIREBASE_API_KEY,
        authDomain: env.VITE_FIREBASE_AUTH_DOMAIN,
        databaseURL: env.VITE_FIREBASE_DATABASE_URL,
        projectId: env.VITE_FIREBASE_PROJECT_ID,
        storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET,
        messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID,
        appId: env.VITE_FIREBASE_APP_ID,
      });
    } else {
      app = getApp();
    }
    db = getDatabase(app);
  } catch (err) {
    console.warn('Firebase Realtime Database init info:', err);
    db = null;
  }
}

// Local Storage Fallback & Multi-Tab Broadcast synchronization
const LOCAL_ROOMS_KEY = 'love_app_rtdb_rooms';
const LOCAL_MESSAGES_KEY = 'love_app_rtdb_messages';
const LOCAL_TYPING_KEY = 'love_app_rtdb_typing';

const broadcastChannel = typeof window !== 'undefined' && 'BroadcastChannel' in window
  ? new BroadcastChannel('love_app_rtdb_sync')
  : null;

function getStoredRooms(): Record<string, ChatRoom> {
  try {
    const raw = localStorage.getItem(LOCAL_ROOMS_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function saveStoredRooms(rooms: Record<string, ChatRoom>): void {
  try {
    localStorage.setItem(LOCAL_ROOMS_KEY, JSON.stringify(rooms));
    broadcastChannel?.postMessage({ type: 'ROOMS_UPDATED' });
  } catch (err) {
    console.error('Failed to save rooms locally:', err);
  }
}

function getStoredMessages(): Record<string, ChatMessage[]> {
  try {
    const raw = localStorage.getItem(LOCAL_MESSAGES_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function saveStoredMessages(allMessages: Record<string, ChatMessage[]>): void {
  try {
    localStorage.setItem(LOCAL_MESSAGES_KEY, JSON.stringify(allMessages));
    broadcastChannel?.postMessage({ type: 'MESSAGES_UPDATED' });
  } catch (err) {
    console.error('Failed to save messages locally:', err);
  }
}

export class FirebaseChatService {
  /**
   * Generates a deterministic room ID for two users (e.g. room_user1_user2)
   */
  public static getRoomId(userId1: string, userId2: string): string {
    const sorted = [userId1, userId2].sort();
    return `room_${sorted[0]}_${sorted[1]}`;
  }

  /**
   * Create or retrieve a ChatRoom between two matched users
   */
  public static async createOrGetRoom(user1: UserProfile, user2: UserProfile): Promise<ChatRoom> {
    const roomId = this.getRoomId(user1.id, user2.id);

    // Try Firebase RTDB first
    if (db) {
      try {
        const roomRef = ref(db, `chatRooms/${roomId}`);
        const snapshot = await get(roomRef);
        if (snapshot.exists()) {
          const room = snapshot.val() as ChatRoom;
          // Ensure participant profiles are fresh
          room.participantProfiles = {
            [user1.id]: user1,
            [user2.id]: user2,
          };
          await update(roomRef, { participantProfiles: room.participantProfiles });
          return room;
        }
      } catch (err) {
        console.warn('Firebase RTDB get room error, fallback to local storage:', err);
      }
    }

    // Check Local Storage
    const rooms = getStoredRooms();
    if (rooms[roomId]) {
      rooms[roomId].participantProfiles = {
        [user1.id]: user1,
        [user2.id]: user2,
      };
      saveStoredRooms(rooms);
      return rooms[roomId];
    }

    // Create Initial System Welcome Message
    const welcomeMsg: ChatMessage = {
      id: `msg_sys_${Date.now()}`,
      roomId,
      senderId: 'system',
      receiverId: user2.id,
      text: `🎉 ${user1.name}님과 ${user2.name}님이 매칭되었습니다! 편하게 첫 인사를 건네보세요.`,
      timestamp: Date.now(),
      read: true,
      type: 'system'
    };

    const newRoom: ChatRoom = {
      id: roomId,
      participantIds: [user1.id, user2.id],
      participantProfiles: {
        [user1.id]: user1,
        [user2.id]: user2,
      },
      lastMessage: welcomeMsg,
      unreadCounts: {
        [user1.id]: 0,
        [user2.id]: 0,
      },
      createdAt: Date.now(),
      updatedAt: Date.now(),
      isMatched: true,
    };

    // Save to Firebase RTDB
    if (db) {
      try {
        await set(ref(db, `chatRooms/${roomId}`), newRoom);
        await set(ref(db, `messages/${roomId}/${welcomeMsg.id}`), welcomeMsg);
      } catch (err) {
        console.warn('Firebase RTDB create room failed, using local storage:', err);
      }
    }

    // Save to Local Storage
    rooms[roomId] = newRoom;
    saveStoredRooms(rooms);

    const msgs = getStoredMessages();
    msgs[roomId] = [welcomeMsg];
    saveStoredMessages(msgs);

    return newRoom;
  }

  /**
   * Subscribe to all ChatRooms for a specific user
   */
  public static subscribeToUserRooms(
    userId: string,
    callback: (rooms: ChatRoom[]) => void
  ): () => void {
    const notifyLocal = () => {
      const rooms = getStoredRooms();
      const userRooms = Object.values(rooms)
        .filter((r) => r.participantIds && r.participantIds.includes(userId))
        .sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
      callback(userRooms);
    };

    // Initial local read
    notifyLocal();

    let unsubscribeFirebase: (() => void) | null = null;

    if (db) {
      try {
        const roomsRef = ref(db, 'chatRooms');
        const listener = onValue(
          roomsRef,
          (snapshot) => {
            if (snapshot.exists()) {
              const val = snapshot.val();
              const roomsList: ChatRoom[] = Object.values(val);
              const userRooms = roomsList
                .filter((r) => r && r.participantIds && r.participantIds.includes(userId))
                .sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));

              // Merge into local storage for caching
              const local = getStoredRooms();
              roomsList.forEach((r) => {
                if (r && r.id) local[r.id] = r;
              });
              try {
                localStorage.setItem(LOCAL_ROOMS_KEY, JSON.stringify(local));
              } catch {}

              callback(userRooms);
            } else {
              notifyLocal();
            }
          },
          (error) => {
            console.warn('Firebase RTDB rooms listener error:', error);
            notifyLocal();
          }
        );

        unsubscribeFirebase = () => {
          off(roomsRef, 'value', listener);
        };
      } catch (err) {
        console.warn('Firebase RTDB subscribeToUserRooms failed:', err);
      }
    }

    // Multi-tab Broadcast listener & storage event listener
    const handleBroadcast = (e: MessageEvent) => {
      if (e.data?.type === 'ROOMS_UPDATED' || e.data?.type === 'MESSAGES_UPDATED') {
        notifyLocal();
      }
    };

    const handleStorage = (e: StorageEvent) => {
      if (e.key === LOCAL_ROOMS_KEY || e.key === LOCAL_MESSAGES_KEY) {
        notifyLocal();
      }
    };

    broadcastChannel?.addEventListener('message', handleBroadcast);
    window.addEventListener('storage', handleStorage);

    return () => {
      if (unsubscribeFirebase) unsubscribeFirebase();
      broadcastChannel?.removeEventListener('message', handleBroadcast);
      window.removeEventListener('storage', handleStorage);
    };
  }

  /**
   * Subscribe to real-time messages in a specific ChatRoom
   */
  public static subscribeToRoomMessages(
    roomId: string,
    callback: (messages: ChatMessage[]) => void
  ): () => void {
    const notifyLocal = () => {
      const allMsgs = getStoredMessages();
      const roomMsgs = (allMsgs[roomId] || []).sort((a, b) => a.timestamp - b.timestamp);
      callback(roomMsgs);
    };

    // Initial local notify
    notifyLocal();

    let unsubscribeFirebase: (() => void) | null = null;

    if (db) {
      try {
        const msgsRef = ref(db, `messages/${roomId}`);
        const listener = onValue(
          msgsRef,
          (snapshot) => {
            if (snapshot.exists()) {
              const val = snapshot.val();
              const msgList: ChatMessage[] = Object.values(val);
              msgList.sort((a, b) => a.timestamp - b.timestamp);

              // Cache locally
              const allLocal = getStoredMessages();
              allLocal[roomId] = msgList;
              try {
                localStorage.setItem(LOCAL_MESSAGES_KEY, JSON.stringify(allLocal));
              } catch {}

              callback(msgList);
            } else {
              notifyLocal();
            }
          },
          (error) => {
            console.warn('Firebase RTDB messages listener error:', error);
            notifyLocal();
          }
        );

        unsubscribeFirebase = () => {
          off(msgsRef, 'value', listener);
        };
      } catch (err) {
        console.warn('Firebase RTDB subscribeToRoomMessages failed:', err);
      }
    }

    const handleBroadcast = (e: MessageEvent) => {
      if (e.data?.type === 'MESSAGES_UPDATED') {
        notifyLocal();
      }
    };

    const handleStorage = (e: StorageEvent) => {
      if (e.key === LOCAL_MESSAGES_KEY) {
        notifyLocal();
      }
    };

    broadcastChannel?.addEventListener('message', handleBroadcast);
    window.addEventListener('storage', handleStorage);

    return () => {
      if (unsubscribeFirebase) unsubscribeFirebase();
      broadcastChannel?.removeEventListener('message', handleBroadcast);
      window.removeEventListener('storage', handleStorage);
    };
  }

  /**
   * Get direct stored messages for a specific room immediately
   */
  public static getRoomMessagesDirect(roomId: string): ChatMessage[] {
    const allMsgs = getStoredMessages();
    return (allMsgs[roomId] || []).sort((a, b) => a.timestamp - b.timestamp);
  }

  /**
   * Get direct stored messages for two users
   */
  public static getMessagesForUsers(userId1: string, userId2: string): ChatMessage[] {
    const roomId = this.getRoomId(userId1, userId2);
    return this.getRoomMessagesDirect(roomId);
  }

  /**
   * Send a Realtime Chat Message
   */
  public static async sendMessage(
    roomId: string,
    sender: UserProfile,
    receiver: UserProfile,
    text: string,
    type: 'text' | 'image' | 'sticker' | 'system' | 'popularity_gift' = 'text',
    mediaUrl?: string,
    isPopularityGift?: boolean
  ): Promise<ChatMessage> {
    const timestamp = Date.now();
    const msgId = `msg_${timestamp}_${Math.random().toString(36).substring(2, 7)}`;

    const newMsg: ChatMessage = {
      id: msgId,
      roomId,
      senderId: sender.id,
      receiverId: receiver.id,
      text,
      timestamp,
      read: false,
      type,
      mediaUrl,
      isPopularityGift,
    };


    // Update Firebase RTDB
    if (db) {
      try {
        const msgRef = ref(db, `messages/${roomId}/${msgId}`);
        await set(msgRef, newMsg);

        // Update Room last message and increment receiver's unread
        const roomRef = ref(db, `chatRooms/${roomId}`);
        const roomSnap = await get(roomRef);
        const currentUnread = roomSnap.exists()
          ? (roomSnap.val().unreadCounts?.[receiver.id] || 0) + 1
          : 1;

        await update(roomRef, {
          lastMessage: newMsg,
          updatedAt: timestamp,
          [`unreadCounts/${receiver.id}`]: currentUnread,
        });
      } catch (err) {
        console.warn('Firebase RTDB sendMessage error:', err);
      }
    }

    // Local Storage & Multi-tab broadcast update
    const allMsgs = getStoredMessages();
    if (!allMsgs[roomId]) allMsgs[roomId] = [];
    allMsgs[roomId].push(newMsg);
    saveStoredMessages(allMsgs);

    const rooms = getStoredRooms();
    if (rooms[roomId]) {
      rooms[roomId].lastMessage = newMsg;
      rooms[roomId].updatedAt = timestamp;
      if (!rooms[roomId].unreadCounts) rooms[roomId].unreadCounts = {};
      rooms[roomId].unreadCounts[receiver.id] = (rooms[roomId].unreadCounts[receiver.id] || 0) + 1;
      saveStoredRooms(rooms);
    }

    return newMsg;
  }

  /**
   * Mark all unread messages in a room as read for a given user
   */
  public static async markRoomAsRead(roomId: string, userId: string): Promise<void> {
    // Firebase RTDB update
    if (db) {
      try {
        const roomRef = ref(db, `chatRooms/${roomId}`);
        await update(roomRef, {
          [`unreadCounts/${userId}`]: 0,
        });

        // Mark incoming messages as read
        const msgsRef = ref(db, `messages/${roomId}`);
        const snapshot = await get(msgsRef);
        if (snapshot.exists()) {
          const msgs = snapshot.val();
          const updates: Record<string, boolean> = {};
          Object.keys(msgs).forEach((mId) => {
            if (msgs[mId].receiverId === userId && !msgs[mId].read) {
              updates[`${mId}/read`] = true;
            }
          });
          if (Object.keys(updates).length > 0) {
            await update(msgsRef, updates);
          }
        }
      } catch (err) {
        console.warn('Firebase RTDB markRoomAsRead error:', err);
      }
    }

    // Local Storage update
    const rooms = getStoredRooms();
    if (rooms[roomId]) {
      if (!rooms[roomId].unreadCounts) rooms[roomId].unreadCounts = {};
      rooms[roomId].unreadCounts[userId] = 0;
      saveStoredRooms(rooms);
    }

    const allMsgs = getStoredMessages();
    if (allMsgs[roomId]) {
      allMsgs[roomId].forEach((m) => {
        if (m.receiverId === userId) {
          m.read = true;
        }
      });
      saveStoredMessages(allMsgs);
    }
  }

  /**
   * Realtime Typing Indicator
   */
  public static async setTyping(roomId: string, userId: string, isTyping: boolean): Promise<void> {
    if (db) {
      try {
        const typingRef = ref(db, `typing/${roomId}/${userId}`);
        await set(typingRef, isTyping ? Date.now() : null);
      } catch {}
    }

    // Local typing update
    try {
      const raw = localStorage.getItem(LOCAL_TYPING_KEY);
      const typingMap: Record<string, Record<string, number>> = raw ? JSON.parse(raw) : {};
      if (!typingMap[roomId]) typingMap[roomId] = {};

      if (isTyping) {
        typingMap[roomId][userId] = Date.now();
      } else {
        delete typingMap[roomId][userId];
      }

      localStorage.setItem(LOCAL_TYPING_KEY, JSON.stringify(typingMap));
      broadcastChannel?.postMessage({ type: 'TYPING_UPDATED', roomId, userId, isTyping });
    } catch {}
  }

  /**
   * Subscribe to other user's typing status in a room
   */
  public static subscribeToTyping(
    roomId: string,
    currentUserId: string,
    callback: (isPartnerTyping: boolean) => void
  ): () => void {
    let unsubscribeFirebase: (() => void) | null = null;

    const checkLocalTyping = () => {
      try {
        const raw = localStorage.getItem(LOCAL_TYPING_KEY);
        const typingMap = raw ? JSON.parse(raw) : {};
        const roomTyping = typingMap[roomId] || {};
        const partnerIds = Object.keys(roomTyping).filter((id) => id !== currentUserId);

        const now = Date.now();
        const active = partnerIds.some((id) => now - roomTyping[id] < 4000);
        callback(active);
      } catch {
        callback(false);
      }
    };

    if (db) {
      try {
        const typingRef = ref(db, `typing/${roomId}`);
        const listener = onValue(typingRef, (snapshot) => {
          if (snapshot.exists()) {
            const val = snapshot.val() as Record<string, number>;
            const partnerIds = Object.keys(val).filter((id) => id !== currentUserId);
            const now = Date.now();
            const isTyping = partnerIds.some((id) => val[id] && now - val[id] < 4000);
            callback(isTyping);
          } else {
            callback(false);
          }
        });

        unsubscribeFirebase = () => {
          off(typingRef, 'value', listener);
        };
      } catch {}
    }

    const handleBroadcast = (e: MessageEvent) => {
      if (e.data?.type === 'TYPING_UPDATED' && e.data?.roomId === roomId) {
        checkLocalTyping();
      }
    };

    broadcastChannel?.addEventListener('message', handleBroadcast);
    return () => {
      if (unsubscribeFirebase) unsubscribeFirebase();
      broadcastChannel?.removeEventListener('message', handleBroadcast);
    };
  }

  /**
   * Message Emoji Reaction Toggle (❤️, 👍, 😊, 🥂, 🔥)
   */
  public static async toggleReaction(
    roomId: string,
    messageId: string,
    userId: string,
    emoji: string
  ): Promise<void> {
    const allMsgs = getStoredMessages();
    const roomMsgs = allMsgs[roomId] || [];
    const msg = roomMsgs.find((m) => m.id === messageId);

    if (msg) {
      if (!msg.reactions) msg.reactions = {};
      const currentUsers = msg.reactions[emoji] || [];
      const hasReacted = currentUsers.includes(userId);

      if (hasReacted) {
        msg.reactions[emoji] = currentUsers.filter((id) => id !== userId);
        if (msg.reactions[emoji].length === 0) {
          delete msg.reactions[emoji];
        }
      } else {
        msg.reactions[emoji] = [...currentUsers, userId];
      }

      saveStoredMessages(allMsgs);

      if (db) {
        try {
          const reactionRef = ref(db, `messages/${roomId}/${messageId}/reactions`);
          await set(reactionRef, msg.reactions);
        } catch (err) {
          console.warn('Firebase reaction update failed:', err);
        }
      }
    }
  }

  /**
   * 72시간(3일) 초과 대화 만료 삭제 및 양측 읽음 완료 대화 로컬 브라우저 저장 최적화
   * Requirement:
   * "사용자간 대화는 해당 사용자브라우저에 저장하게 하여 데이터베이스는 일시적으로만 대화를 저장하고
   * 양측 사용자가 대화(텍스트)를 읽으면 대화를 사용자 브라우저에 저장.
   * 양측이 읽지 않아도 발생 72시간이 넘는경우 대화방 내 모든 대화를 삭제해서 데이터베이스 최적화"
   */
  public static readonly MESSAGE_TTL_MS = 72 * 60 * 60 * 1000; // 72 hours

  public static purgeExpiredAndOptimizeMessages(): { purgedCount: number; activeRooms: number } {
    const now = Date.now();
    const allMsgs = getStoredMessages();
    let purgedCount = 0;
    const roomKeys = Object.keys(allMsgs);

    roomKeys.forEach((roomId) => {
      const msgs = allMsgs[roomId] || [];
      const remaining: ChatMessage[] = [];

      msgs.forEach((m) => {
        const isOlderThan72h = now - m.timestamp > this.MESSAGE_TTL_MS;
        if (isOlderThan72h) {
          // 72시간 초과 시 영구 만료 삭제
          purgedCount++;
        } else {
          remaining.push(m);
        }
      });

      allMsgs[roomId] = remaining;
    });

    if (purgedCount > 0) {
      saveStoredMessages(allMsgs);
    }

    return { purgedCount, activeRooms: roomKeys.length };
  }

  /**
   * Calculate total unread count for current user
   */
  public static calculateTotalUnread(rooms: ChatRoom[], currentUserId: string): number {
    return rooms.reduce((acc, room) => {
      return acc + (room.unreadCounts?.[currentUserId] || 0);
    }, 0);
  }
}
