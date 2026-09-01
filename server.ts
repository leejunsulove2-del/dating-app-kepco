import express from 'express';
import path from 'path';
import fs from 'fs';
import { createServer as createViteServer } from 'vite';

interface ServerDatabase {
  users: any[];
  adminAccounts: any[];
  adminBoard: any[];
  adminLogs: any[];
  userInventories: Record<string, any>;
  likes: any[];
  chatMessages: Record<string, any[]>;
  firebaseConfig: any | null;
  lastUpdated: number;
}

const DB_FILE_PATH = path.join(process.cwd(), 'server_database.json');

// Initialize or load database from persistent file
function loadDatabase(): ServerDatabase {
  try {
    if (fs.existsSync(DB_FILE_PATH)) {
      const raw = fs.readFileSync(DB_FILE_PATH, 'utf-8');
      const parsed = JSON.parse(raw);
      return {
        users: parsed.users || [],
        adminAccounts: parsed.adminAccounts || [],
        adminBoard: parsed.adminBoard || [],
        adminLogs: parsed.adminLogs || [],
        userInventories: parsed.userInventories || {},
        likes: parsed.likes || [],
        chatMessages: parsed.chatMessages || {},
        firebaseConfig: parsed.firebaseConfig || null,
        lastUpdated: parsed.lastUpdated || Date.now(),
      };
    }
  } catch (err) {
    console.error('[Server DB] Error reading persistent database:', err);
  }

  return {
    users: [],
    adminAccounts: [],
    adminBoard: [],
    adminLogs: [],
    userInventories: {},
    likes: [],
    chatMessages: {},
    firebaseConfig: null,
    lastUpdated: Date.now(),
  };
}

let db = loadDatabase();

function saveDatabase() {
  try {
    db.lastUpdated = Date.now();
    fs.writeFileSync(DB_FILE_PATH, JSON.stringify(db, null, 2), 'utf-8');
  } catch (err) {
    console.error('[Server DB] Error saving persistent database:', err);
  }
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: '20mb' }));

  // =========================================================================
  // API ROUTES
  // =========================================================================

  app.get('/api/health', (req, res) => {
    res.json({
      status: 'ok',
      usersCount: db.users.length,
      adminsCount: db.adminAccounts.length,
      lastUpdated: db.lastUpdated,
      firebaseConfigured: Boolean(db.firebaseConfig && db.firebaseConfig.projectId),
    });
  });

  // 1. Full Database Sync
  app.get('/api/sync/all', (req, res) => {
    res.json({
      users: db.users,
      adminAccounts: db.adminAccounts,
      adminBoard: db.adminBoard,
      adminLogs: db.adminLogs,
      userInventories: db.userInventories,
      likes: db.likes,
      firebaseConfig: db.firebaseConfig,
      lastUpdated: db.lastUpdated,
    });
  });

  // 2. Users Management
  app.get('/api/sync/users', (req, res) => {
    res.json(db.users);
  });

  app.post('/api/sync/users', (req, res) => {
    const { users } = req.body;
    if (Array.isArray(users)) {
      const userMap = new Map<string, any>();
      // Preserve existing
      for (const u of db.users) {
        if (u && u.id) userMap.set(u.id, u);
      }
      // Merge new
      for (const u of users) {
        if (u && u.id) {
          userMap.set(u.id, { ...userMap.get(u.id), ...u, updatedAt: Date.now() });
        }
      }
      db.users = Array.from(userMap.values());
      saveDatabase();
      return res.json({ success: true, count: db.users.length });
    }
    res.status(400).json({ error: 'users array required' });
  });

  app.post('/api/sync/user', (req, res) => {
    const user = req.body;
    if (!user || !user.id) {
      return res.status(400).json({ error: 'Invalid user profile' });
    }

    const idx = db.users.findIndex((u) => u.id === user.id);
    if (idx >= 0) {
      db.users[idx] = { ...db.users[idx], ...user, updatedAt: Date.now() };
    } else {
      db.users.push({ ...user, updatedAt: Date.now() });
    }

    saveDatabase();
    res.json({ success: true, user: db.users.find((u) => u.id === user.id) });
  });

  app.delete('/api/sync/user/:id', (req, res) => {
    const { id } = req.params;
    db.users = db.users.filter((u) => u.id !== id);
    saveDatabase();
    res.json({ success: true });
  });

  // 3. Admin Accounts Management
  app.get('/api/sync/admin-accounts', (req, res) => {
    res.json(db.adminAccounts);
  });

  app.post('/api/sync/admin-accounts', (req, res) => {
    const { adminAccounts } = req.body;
    if (Array.isArray(adminAccounts)) {
      const adminMap = new Map<string, any>();
      for (const a of db.adminAccounts) {
        if (a && a.id) adminMap.set(a.id, a);
      }
      for (const a of adminAccounts) {
        if (a && a.id) adminMap.set(a.id, { ...adminMap.get(a.id), ...a });
      }
      db.adminAccounts = Array.from(adminMap.values());
      saveDatabase();
      return res.json({ success: true, count: db.adminAccounts.length });
    }
    res.status(400).json({ error: 'adminAccounts array required' });
  });

  app.post('/api/sync/admin-account', (req, res) => {
    const admin = req.body;
    if (!admin || !admin.id) {
      return res.status(400).json({ error: 'Invalid admin account' });
    }

    const idx = db.adminAccounts.findIndex((a) => a.id === admin.id);
    if (idx >= 0) {
      db.adminAccounts[idx] = { ...db.adminAccounts[idx], ...admin };
    } else {
      db.adminAccounts.push(admin);
    }

    saveDatabase();
    res.json({ success: true, admin });
  });

  app.delete('/api/sync/admin-account/:id', (req, res) => {
    const { id } = req.params;
    db.adminAccounts = db.adminAccounts.filter((a) => a.id !== id);
    saveDatabase();
    res.json({ success: true });
  });

  // 4. Admin Board Posts
  app.get('/api/sync/board', (req, res) => {
    res.json(db.adminBoard);
  });

  app.post('/api/sync/board', (req, res) => {
    const post = req.body;
    if (!post || !post.id) {
      return res.status(400).json({ error: 'Invalid board post' });
    }

    const idx = db.adminBoard.findIndex((p) => p.id === post.id);
    if (idx >= 0) {
      db.adminBoard[idx] = post;
    } else {
      db.adminBoard.unshift(post);
    }

    saveDatabase();
    res.json({ success: true, post });
  });

  // 5. Admin Logs
  app.get('/api/sync/logs', (req, res) => {
    res.json(db.adminLogs);
  });

  app.post('/api/sync/logs', (req, res) => {
    const log = req.body;
    if (log && log.id) {
      db.adminLogs.unshift(log);
      if (db.adminLogs.length > 500) {
        db.adminLogs = db.adminLogs.slice(0, 500);
      }
      saveDatabase();
    }
    res.json({ success: true });
  });

  // 6. User Inventory
  app.get('/api/sync/inventory/:userId', (req, res) => {
    const { userId } = req.params;
    res.json(db.userInventories[userId] || null);
  });

  app.post('/api/sync/inventory/:userId', (req, res) => {
    const { userId } = req.params;
    const inventory = req.body;
    if (userId && inventory) {
      db.userInventories[userId] = inventory;
      saveDatabase();
    }
    res.json({ success: true });
  });

  // 7. Likes & Matches
  app.get('/api/sync/likes', (req, res) => {
    res.json(db.likes);
  });

  app.post('/api/sync/like', (req, res) => {
    const like = req.body;
    if (like && like.id) {
      const idx = db.likes.findIndex((l) => l.id === like.id);
      if (idx >= 0) {
        db.likes[idx] = like;
      } else {
        db.likes.push(like);
      }
      saveDatabase();
    }
    res.json({ success: true });
  });

  // 8. Firebase Project Configuration
  app.get('/api/sync/firebase-config', (req, res) => {
    res.json({
      config: db.firebaseConfig || null,
      envConfig: {
        apiKey: process.env.VITE_FIREBASE_API_KEY || '',
        projectId: process.env.VITE_FIREBASE_PROJECT_ID || '',
        authDomain: process.env.VITE_FIREBASE_AUTH_DOMAIN || '',
        storageBucket: process.env.VITE_FIREBASE_STORAGE_BUCKET || '',
        appId: process.env.VITE_FIREBASE_APP_ID || '',
        databaseURL: process.env.VITE_FIREBASE_DATABASE_URL || '',
      },
    });
  });

  app.post('/api/sync/firebase-config', (req, res) => {
    const { config } = req.body;
    db.firebaseConfig = config;
    saveDatabase();
    res.json({ success: true, config: db.firebaseConfig });
  });

  // =========================================================================
  // VITE & STATIC SERVING
  // =========================================================================

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[Server] 공공기관 매칭 시스템 Full-Stack API server running on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
});
