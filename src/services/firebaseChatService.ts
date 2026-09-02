import {
  collection,
  doc,
  setDoc,
  getDoc,
  getDocs,
  onSnapshot,
  query,
  where,
  orderBy,
  updateDoc,
  limit,
  deleteDoc,
  Unsubscribe,
} from 'firebase/firestore';
import { initFirebaseApp } from './firebaseConfig';
import { UserProfile, ChatRoom, ChatMessage } from '../types';

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

  private static getDb() {
    const { db } = initFirebaseApp();
    return db;
  }

  /**
   * Create or retrieve a ChatRoom between two matched users
   */
  public static async createOrGetRoom(user1: UserProfile, user2: UserProfile): Promise<ChatRoom> {
    const roomId = this.getRoomId(user1.id, user2.id);
    const db = this.getDb();

    // 1. Try Firestore
    if (db) {
      try {
        const roomRef = doc(db, 'chat_rooms', roomId);
        const snapshot = await getDoc(roomRef);

        if (snapshot.exists()) {
          const roomData = snapshot.data() as ChatRoom;
          // Refresh participant profiles
          const updatedProfiles = {
            ...(roomData.participantProfiles || {}),
            [user1.id]: user1,
            [user2.id]: user2,
          };
          await updateDoc(roomRef, { participantProfiles: updatedProfiles, updatedAt: Date.now() });
          
          const freshRoom: ChatRoom = {
            ...roomData,
            id: roomId,
            participantProfiles: updatedProfiles,
          };

          // Cache locally
          const rooms = getStoredRooms();
          rooms[roomId] = freshRoom;
          saveStoredRooms(rooms);

          return freshRoom;
        }
      } catch (err) {
        console.warn('[FirebaseChat] Firestore get room error:', err);
      }
    }

    // 2. Check Local Storage
    const rooms = getStoredRooms();
    if (rooms[roomId]) {
      rooms[roomId].participantProfiles = {
        [user1.id]: user1,
        [user2.id]: user2,
      };
      saveStoredRooms(rooms);
      return rooms[roomId];
    }

    // 3. Create Initial Welcome Message & Room
    const welcomeMsg: ChatMessage = {
      id: `msg_sys_${Date.now()}`,
      roomId,
      senderId: 'system',
      receiverId: user2.id,
      text: `🎉 ${user1.name}님과 ${user2.name}님이 매칭되었습니다! 편하게 첫 인사를 건네보세요.`,
      timestamp: Date.now(),
      read: true,
      type: 'system',
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

    // Save to Firestore
    if (db) {
      try {
        const cleanRoom = JSON.parse(JSON.stringify(newRoom));
        await setDoc(doc(db, 'chat_rooms', roomId), cleanRoom, { merge: true });
        
        const cleanMsg = JSON.parse(JSON.stringify(welcomeMsg));
        await setDoc(doc(db, 'chat_rooms', roomId, 'messages', welcomeMsg.id), cleanMsg);
      } catch (err) {
        console.warn('[FirebaseChat] Firestore create room failed:', err);
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

    let unsubscribeFirestore: Unsubscribe | null = null;
    const db = this.getDb();

    if (db) {
      try {
        const roomsRef = collection(db, 'chat_rooms');
        // Realtime Firestore Listener
        unsubscribeFirestore = onSnapshot(
          roomsRef,
          (snapshot) => {
            const roomsList: ChatRoom[] = [];
            const local = getStoredRooms();

            snapshot.forEach((docSnap) => {
              const r = docSnap.data() as ChatRoom;
              r.id = docSnap.id;
              if (r.participantIds && r.participantIds.includes(userId)) {
                roomsList.push(r);
              }
              local[docSnap.id] = r;
            });

            // Sort by latest update
            roomsList.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));

            // Sync to local storage
            try {
              localStorage.setItem(LOCAL_ROOMS_KEY, JSON.stringify(local));
            } catch {}

            callback(roomsList);
          },
          (error) => {
            console.warn('[FirebaseChat] Firestore rooms listener error:', error);
            notifyLocal();
          }
        );
      } catch (err) {
        console.warn('[FirebaseChat] Firestore subscribeToUserRooms failed:', err);
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
      if (unsubscribeFirestore) unsubscribeFirestore();
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

    let unsubscribeFirestore: Unsubscribe | null = null;
    const db = this.getDb();

    if (db && roomId) {
      try {
        const msgsRef = collection(db, 'chat_rooms', roomId, 'messages');
        
        unsubscribeFirestore = onSnapshot(
          msgsRef,
          (snapshot) => {
            const msgList: ChatMessage[] = [];
            snapshot.forEach((docSnap) => {
              const m = docSnap.data() as ChatMessage;
              m.id = docSnap.id;
              msgList.push(m);
            });

            msgList.sort((a, b) => a.timestamp - b.timestamp);

            // Cache locally
            const allLocal = getStoredMessages();
            allLocal[roomId] = msgList;
            try {
              localStorage.setItem(LOCAL_MESSAGES_KEY, JSON.stringify(allLocal));
            } catch {}

            callback(msgList);
          },
          (error) => {
            console.warn('[FirebaseChat] Firestore messages listener error:', error);
            notifyLocal();
          }
        );
      } catch (err) {
        console.warn('[FirebaseChat] Firestore subscribeToRoomMessages failed:', err);
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
      if (unsubscribeFirestore) unsubscribeFirestore();
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
   * Send a Realtime Chat Message (Direct Firestore Sync)
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

    const db = this.getDb();

    // 1. Update Firestore
    if (db) {
      try {
        const cleanMsg = JSON.parse(JSON.stringify(newMsg));
        // Save message in subcollection
        await setDoc(doc(db, 'chat_rooms', roomId, 'messages', msgId), cleanMsg);

        // Update Room last message and receiver unread count
        const roomRef = doc(db, 'chat_rooms', roomId);
        const roomSnap = await getDoc(roomRef);
        const currentUnread = roomSnap.exists()
          ? (roomSnap.data()?.unreadCounts?.[receiver.id] || 0) + 1
          : 1;

        await setDoc(
          roomRef,
          {
            id: roomId,
            participantIds: [sender.id, receiver.id],
            participantProfiles: {
              [sender.id]: sender,
              [receiver.id]: receiver,
            },
            lastMessage: cleanMsg,
            updatedAt: timestamp,
            unreadCounts: {
              [receiver.id]: currentUnread,
              [sender.id]: 0,
            },
          },
          { merge: true }
        );
      } catch (err) {
        console.warn('[FirebaseChat] Firestore sendMessage error:', err);
      }
    }

    // 2. Local Storage & Multi-tab broadcast update
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
    const db = this.getDb();

    // 1. Firestore update
    if (db && roomId) {
      try {
        const roomRef = doc(db, 'chat_rooms', roomId);
        await updateDoc(roomRef, {
          [`unreadCounts.${userId}`]: 0,
        }).catch(() => {});

        // Mark incoming messages as read in subcollection
        const msgsRef = collection(db, 'chat_rooms', roomId, 'messages');
        const unreadQuery = query(msgsRef, where('receiverId', '==', userId), where('read', '==', false));
        const unreadDocs = await getDocs(unreadQuery);

        unreadDocs.forEach((d) => {
          updateDoc(d.ref, { read: true }).catch(() => {});
        });
      } catch (err) {
        console.warn('[FirebaseChat] Firestore markRoomAsRead error:', err);
      }
    }

    // 2. Local Storage update
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
    const db = this.getDb();
    if (db && roomId) {
      try {
        const typingRef = doc(db, 'chat_rooms', roomId, 'typing', userId);
        if (isTyping) {
          await setDoc(typingRef, { timestamp: Date.now(), userId });
        } else {
          await deleteDoc(typingRef).catch(() => {});
        }
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
    let unsubscribeFirestore: Unsubscribe | null = null;
    const db = this.getDb();

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

    if (db && roomId) {
      try {
        const typingCol = collection(db, 'chat_rooms', roomId, 'typing');
        unsubscribeFirestore = onSnapshot(typingCol, (snapshot) => {
          let isTyping = false;
          const now = Date.now();
          snapshot.forEach((d) => {
            if (d.id !== currentUserId) {
              const data = d.data();
              if (data?.timestamp && now - data.timestamp < 4000) {
                isTyping = true;
              }
            }
          });
          callback(isTyping);
        }, () => {
          checkLocalTyping();
        });
      } catch {}
    }

    const handleBroadcast = (e: MessageEvent) => {
      if (e.data?.type === 'TYPING_UPDATED' && e.data?.roomId === roomId) {
        checkLocalTyping();
      }
    };

    broadcastChannel?.addEventListener('message', handleBroadcast);
    return () => {
      if (unsubscribeFirestore) unsubscribeFirestore();
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

      const db = this.getDb();
      if (db && roomId) {
        try {
          const msgRef = doc(db, 'chat_rooms', roomId, 'messages', messageId);
          await updateDoc(msgRef, { reactions: msg.reactions });
        } catch (err) {
          console.warn('[FirebaseChat] Reaction update failed:', err);
        }
      }
    }
  }

  /**
   * 72시간(3일) 초과 대화 만료 삭제 및 양측 읽음 완료 대화 로컬 브라우저 저장 최적화
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
