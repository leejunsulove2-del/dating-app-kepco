import express from 'express';
import path from 'path';
import fs from 'fs';
import { createServer as createViteServer } from 'vite';
import { INITIAL_PROFILES } from './src/services/mockProfiles';

interface ServerDatabase {
  users: any[];
  adminAccounts: any[];
  adminBoard: any[];
  adminLogs: any[];
  userInventories: Record<string, any>;
  likes: any[];
  reports: any[];
  userPasswords: Record<string, string>;
  chatMessages: Record<string, any[]>;
  firebaseConfig: any | null;
  lastUpdated: number;
}

const DB_FILE_PATH = path.join(process.cwd(), 'server_database.json');

const DEFAULT_SERVER_ADMINS = [
  {
    id: 'admin_master',
    email: 'admin@kepco.co.kr',
    name: '최고 관리자 (KEPCO)',
    department: '한국전력공사 시스템총괄실',
    isMaster: true,
    agencyDomain: 'kepco.co.kr',
    agencyName: '한국전력공사 (총괄)',
    passwordPlain: '12101074',
    eventBoxesRemaining: 999999,
    createdAt: 1700000000000,
  },
  {
    id: 'admin_agency_kepco1',
    email: 'hr_manager@kepco.co.kr',
    name: '김전력 (인사운영)',
    department: '한국전력공사 인재경영처',
    isMaster: false,
    agencyDomain: 'kepco.co.kr',
    agencyName: '한국전력공사',
    passwordPlain: '1234',
    eventBoxesRemaining: 1000,
    createdAt: 1700000001000,
    createdBy: 'admin@kepco.co.kr',
  },
  {
    id: 'admin_agency_kepco2',
    email: 'welfare@kepco.co.kr',
    name: '이복지 (사내복지)',
    department: '한국전력공사 노사복지부',
    isMaster: false,
    agencyDomain: 'kepco.co.kr',
    agencyName: '한국전력공사',
    passwordPlain: '1234',
    eventBoxesRemaining: 1000,
    createdAt: 1700000002000,
    createdBy: 'admin@kepco.co.kr',
  },
  {
    id: 'admin_agency_kwater',
    email: 'admin@kwater.or.kr',
    name: '박수자 (총무부)',
    department: '한국수자원공사 경영지원처',
    isMaster: false,
    agencyDomain: 'kwater.or.kr',
    agencyName: '한국수자원공사',
    passwordPlain: '1234',
    eventBoxesRemaining: 1000,
    createdAt: 1700000003000,
    createdBy: 'admin@kepco.co.kr',
  },
  {
    id: 'admin_agency_lh',
    email: 'admin@lh.or.kr',
    name: '최토지 (복지운영)',
    department: '한국토지주택공사 복지기획처',
    isMaster: false,
    agencyDomain: 'lh.or.kr',
    agencyName: '한국토지주택공사',
    passwordPlain: '1234',
    eventBoxesRemaining: 1000,
    createdAt: 1700000004000,
    createdBy: 'admin@kepco.co.kr',
  },
];

// Initialize or load database from persistent file
function loadDatabase(): ServerDatabase {
  let dbData: ServerDatabase = {
    users: [],
    adminAccounts: [],
    adminBoard: [],
    adminLogs: [],
    userInventories: {},
    likes: [],
    reports: [],
    userPasswords: {},
    chatMessages: {},
    firebaseConfig: null,
    lastUpdated: Date.now(),
  };

  try {
    if (fs.existsSync(DB_FILE_PATH)) {
      const raw = fs.readFileSync(DB_FILE_PATH, 'utf-8');
      const parsed = JSON.parse(raw);
      dbData = {
        users: parsed.users || [],
        adminAccounts: parsed.adminAccounts || [],
        adminBoard: parsed.adminBoard || [],
        adminLogs: parsed.adminLogs || [],
        userInventories: parsed.userInventories || {},
        likes: parsed.likes || [],
        reports: parsed.reports || [],
        userPasswords: parsed.userPasswords || {},
        chatMessages: parsed.chatMessages || {},
        firebaseConfig: parsed.firebaseConfig || null,
        lastUpdated: parsed.lastUpdated || Date.now(),
      };
    }
  } catch (err) {
    console.error('[Server DB] Error reading persistent database:', err);
  }

  // Seed default admin accounts if empty
  if (!dbData.adminAccounts || dbData.adminAccounts.length === 0) {
    dbData.adminAccounts = [...DEFAULT_SERVER_ADMINS];
  }

  // Seed default users from INITIAL_PROFILES if empty
  if (!dbData.users || dbData.users.length === 0) {
    dbData.users = INITIAL_PROFILES.map((p, idx) => ({
      ...p,
      approvalStatus: 'approved',
      verifiedEmail: true,
      location: {
        latitude: 37.4979 + ((idx * 7) % 20 - 10) * 0.003,
        longitude: 127.0276 + ((idx * 11) % 20 - 10) * 0.003,
        lastUpdated: Date.now(),
      },
      popularity: p.popularity ?? 110,
      isOnline: idx % 2 === 0,
      lastActive: Date.now() - (idx * 3 + 1) * 60000,
    }));
  }

  // Seed default passwords
  DEFAULT_SERVER_ADMINS.forEach((adm) => {
    const clean = adm.email.toLowerCase().trim();
    if (!dbData.userPasswords[clean]) {
      dbData.userPasswords[clean] = adm.passwordPlain;
    }
  });

  INITIAL_PROFILES.forEach((u) => {
    const clean = u.email.toLowerCase().trim();
    if (!dbData.userPasswords[clean]) {
      dbData.userPasswords[clean] = '1234';
    }
  });

  try {
    fs.writeFileSync(DB_FILE_PATH, JSON.stringify(dbData, null, 2), 'utf-8');
  } catch (err) {
    console.warn('[Server DB] Could not write initial DB file:', err);
  }

  return dbData;
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
    const pendingCount = db.users.filter((u) => u.approvalStatus === 'pending').length;
    res.json({
      status: 'ok',
      usersCount: db.users.length,
      pendingUsersCount: pendingCount,
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
      reports: db.reports,
      userPasswords: db.userPasswords,
      firebaseConfig: db.firebaseConfig,
      lastUpdated: db.lastUpdated,
    });
  });

  // 2. Users Management
  app.get('/api/sync/users', (req, res) => {
    res.json(db.users);
  });

  app.get('/api/sync/pending-users', (req, res) => {
    const pending = db.users.filter((u) => u.approvalStatus === 'pending');
    res.json(pending);
  });

  // Dedicated Register Endpoint
  app.post('/api/sync/register', (req, res) => {
    const { user, passwordPlain } = req.body;
    if (!user || !user.id || !user.email) {
      return res.status(400).json({ error: 'Valid user object required' });
    }

    const cleanEmail = user.email.toLowerCase().trim();
    if (passwordPlain) {
      db.userPasswords[cleanEmail] = passwordPlain;
    }

    const idx = db.users.findIndex((u) => u.id === user.id || u.email?.toLowerCase() === cleanEmail);
    if (idx >= 0) {
      db.users[idx] = { ...db.users[idx], ...user, updatedAt: Date.now() };
    } else {
      db.users.push({ ...user, updatedAt: Date.now() });
    }

    saveDatabase();
    console.log(`[Server DB] New registration received: ${user.name} (${user.email}) - Agency: ${user.company || user.agencyDomain}`);
    res.json({ success: true, user: db.users.find((u) => u.id === user.id) });
  });

  // Dedicated Approve User Endpoint
  app.post('/api/sync/approve-user', (req, res) => {
    const { userId, adminEmail, adminName } = req.body;
    const target = db.users.find((u) => u.id === userId);
    if (!target) {
      return res.status(404).json({ error: 'User not found' });
    }

    target.approvalStatus = 'approved';
    target.approvedAt = Date.now();
    target.approvedByAdmin = `${adminName} (${adminEmail})`;
    target.verifiedEmail = true;
    target.updatedAt = Date.now();

    saveDatabase();
    console.log(`[Server DB] User approved: ${target.name} (${target.email}) by ${adminName}`);
    res.json({ success: true, user: target });
  });

  // Dedicated Reject User Endpoint
  app.post('/api/sync/reject-user', (req, res) => {
    const { userId, reason, adminName } = req.body;
    const target = db.users.find((u) => u.id === userId);
    if (!target) {
      return res.status(404).json({ error: 'User not found' });
    }

    target.approvalStatus = 'rejected';
    target.rejectionReason = reason;
    target.rejectedAt = Date.now();
    target.rejectedByAdmin = adminName;
    target.updatedAt = Date.now();

    saveDatabase();
    console.log(`[Server DB] User rejected: ${target.name} (${target.email}) - Reason: ${reason}`);
    res.json({ success: true, user: target });
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

  // Check user existence & approval status directly
  app.post('/api/auth/check-user', (req, res) => {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: 'Email required' });
    const cleanEmail = String(email).toLowerCase().trim();
    const user = db.users.find((u) => u.email?.toLowerCase() === cleanEmail);
    if (!user) {
      return res.json({ exists: false });
    }
    return res.json({
      exists: true,
      user,
      approvalStatus: user.approvalStatus || 'approved',
      hasPassword: Boolean(db.userPasswords[cleanEmail]),
    });
  });

  // Passwords Sync endpoint
  app.get('/api/sync/passwords', (req, res) => {
    res.json(db.userPasswords || {});
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

  // 6. Reports Management
  app.get('/api/sync/reports', (req, res) => {
    res.json(db.reports);
  });

  app.post('/api/sync/reports', (req, res) => {
    const { reports } = req.body;
    if (Array.isArray(reports)) {
      const repMap = new Map<string, any>();
      for (const r of db.reports) {
        if (r && r.id) repMap.set(r.id, r);
      }
      for (const r of reports) {
        if (r && r.id) repMap.set(r.id, r);
      }
      db.reports = Array.from(repMap.values());
      saveDatabase();
      return res.json({ success: true });
    }
    res.status(400).json({ error: 'reports array required' });
  });

  app.post('/api/sync/report', (req, res) => {
    const report = req.body;
    if (report && report.id) {
      const idx = db.reports.findIndex((r) => r.id === report.id);
      if (idx >= 0) {
        db.reports[idx] = report;
      } else {
        db.reports.unshift(report);
      }
      saveDatabase();
    }
    res.json({ success: true });
  });

  // 7. User Passwords Management
  app.get('/api/sync/passwords', (req, res) => {
    res.json(db.userPasswords);
  });

  app.post('/api/sync/passwords', (req, res) => {
    const { passwords } = req.body;
    if (passwords && typeof passwords === 'object') {
      db.userPasswords = { ...db.userPasswords, ...passwords };
      saveDatabase();
    }
    res.json({ success: true });
  });

  // 8. User Inventory
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

  // 9. Likes & Matches
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

  // 10. Firebase Project Configuration
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
