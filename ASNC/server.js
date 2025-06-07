const express = require('express');
const mysql = require('mysql2/promise');
const path = require('path');
const app = express();
const PORT = process.env.PORT || 3000;

// MySQL Configuration using environment variables
const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || 'password',
  database: process.env.DB_NAME || 'srm_db',
  port: parseInt(process.env.DB_PORT) || 3306,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  namedPlaceholders: true,
  // Add SSL configuration for cloud databases
  ssl: process.env.NODE_ENV === 'production' ? {
    rejectUnauthorized: false
  } : false
};

console.log('Database Configuration:', {
  host: dbConfig.host,
  user: dbConfig.user,
  database: dbConfig.database,
  port: dbConfig.port,
  ssl: dbConfig.ssl
});

// Create MySQL pool - Don't exit on failure
let pool;
try {
  pool = mysql.createPool(dbConfig);
  console.log('✅ MySQL pool created');
} catch (err) {
  console.error('❌ Failed to create MySQL pool:', err);
  // Don't exit - continue without database for debugging
}

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public'), { index: false }));

// Debug middleware - logs all requests
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.url}`);
  console.log('User-Agent:', req.get('User-Agent'));
  next();
});

// Test database connection with retry logic
async function testConnection(retries = 3) {
  if (!pool) {
    console.log('❌ No database pool to test');
    return false;
  }

  for (let i = 0; i < retries; i++) {
    try {
      console.log(`Attempting database connection (attempt ${i + 1}/${retries})...`);
      const conn = await pool.getConnection();
      
      // Test the connection with a simple query
      await conn.query('SELECT 1');
      
      console.log('✅ MySQL connected successfully');
      conn.release();
      return true;
    } catch (err) {
      console.error(`❌ MySQL connection failed (attempt ${i + 1}/${retries}):`, err.message);
      
      if (i === retries - 1) {
        console.error('All connection attempts failed');
        return false;
      }
      
      // Wait 2 seconds before retry
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  }
  return false;
}

// Initialize database tables
async function initializeDatabase() {
  if (!pool) {
    console.log('❌ Cannot initialize database - no pool');
    return false;
  }

  try {
    const conn = await pool.getConnection();
    
    // Create database if it doesn't exist (using query instead of execute)
    await conn.query(`CREATE DATABASE IF NOT EXISTS ${dbConfig.database}`);
    await conn.query(`USE ${dbConfig.database}`);
    
    // Create supplier_evaluations table
    const createTableQuery = `
      CREATE TABLE IF NOT EXISTS supplier_evaluations (
        id INT AUTO_INCREMENT PRIMARY KEY,
        category VARCHAR(100) NOT NULL,
        sub_category VARCHAR(100),
        supplier_name VARCHAR(255) NOT NULL,
        evaluation_month VARCHAR(20) NOT NULL,
        portfolio_diversity DECIMAL(5,2) DEFAULT 0,
        credit_term DECIMAL(5,2) DEFAULT 0,
        capacity_utilisation DECIMAL(5,2) DEFAULT 0,
        strategic_partnership DECIMAL(5,2) DEFAULT 0,
        business_etiquette DECIMAL(5,2) DEFAULT 0,
        inventory_carrying DECIMAL(5,2) DEFAULT 0,
        advance_notice DECIMAL(5,2) DEFAULT 0,
        knowledge_sharing DECIMAL(5,2) DEFAULT 0,
        legal_contracts DECIMAL(5,2) DEFAULT 0,
        cost_competitiveness DECIMAL(5,2) DEFAULT 0,
        cost_model DECIMAL(5,2) DEFAULT 0,
        sdp_rating DECIMAL(5,2) DEFAULT 0,
        labelling_rating DECIMAL(5,2) DEFAULT 0,
        supplier_quality DECIMAL(5,2) DEFAULT 0,
        total_score DECIMAL(6,2) GENERATED ALWAYS AS (
          portfolio_diversity + credit_term + capacity_utilisation + 
          strategic_partnership + business_etiquette + inventory_carrying + 
          advance_notice + knowledge_sharing + legal_contracts + 
          cost_competitiveness + cost_model + sdp_rating + 
          labelling_rating + supplier_quality
        ) STORED,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      )
    `;
    
    await conn.query(createTableQuery);
    console.log('✅ Database tables initialized successfully');
    
    conn.release();
    return true;
  } catch (err) {
    console.error('❌ Database initialization failed:', err);
    return false;
  }
}

// Routes
app.get('/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    database: pool ? 'Pool exists' : 'Pool not initialized',
    environment: process.env.NODE_ENV || 'development',
    dbConfig: {
      host: process.env.DB_HOST || 'NOT SET',
      user: process.env.DB_USER || 'NOT SET',
      database: process.env.DB_NAME || 'NOT SET',
      port: process.env.DB_PORT || 'NOT SET',
      hasPassword: !!process.env.DB_PASSWORD
    },
    envVarsSet: {
      DB_HOST: !!process.env.DB_HOST,
      DB_USER: !!process.env.DB_USER,
      DB_PASSWORD: !!process.env.DB_PASSWORD,
      DB_NAME: !!process.env.DB_NAME,
      DB_PORT: !!process.env.DB_PORT
    }
  });
});

// Debug configuration endpoint
app.get('/api/debug-config', (req, res) => {
  res.json({
    environment: process.env.NODE_ENV,
    databaseConfig: {
      host: process.env.DB_HOST || 'localhost',
      user: process.env.DB_USER || 'root', 
      database: process.env.DB_NAME || 'srm_db',
      port: process.env.DB_PORT || 3306,
      hasPassword: !!process.env.DB_PASSWORD,
      passwordLength: process.env.DB_PASSWORD ? process.env.DB_PASSWORD.length : 0,
      ssl: process.env.NODE_ENV === 'production' ? 'enabled' : 'disabled'
    },
    allEnvVars: Object.keys(process.env).filter(key => key.startsWith('DB_'))
  });
});

app.get('/api/db-status', async (req, res) => {
  console.log('DB Status endpoint hit');
  
  if (!pool) {
    return res.status(503).json({
      success: false,
      message: 'Database pool not initialized',
      timestamp: new Date().toISOString()
    });
  }

  try {
    const conn = await pool.getConnection();
    await conn.query('SELECT 1');
    conn.release();
    
    res.json({
      success: true,
      message: 'Database connection is working',
      timestamp: new Date().toISOString()
    });
  } catch (err) {
    console.error('Database status check failed:', err);
    res.status(500).json({
      success: false,
      message: 'Database connection failed',
      error: err.message,
      code: err.code,
      errno: err.errno,
      sqlState: err.sqlState
    });
  }
});

app.get('/home', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'login.html'));
});

app.post('/api/evaluations', async (req, res) => {
  console.log('POST /api/evaluations hit');
  
  if (!pool) {
    return res.status(503).json({
      success: false,
      message: 'Database not available'
    });
  }

  let conn;
  try {
    const { data } = req.body;

    if (!data) {
      return res.status(400).json({
        success: false,
        message: 'No data provided'
      });
    }

    // Map form fields to database columns
    const evaluationData = {
      category: data.category || '',
      sub_category: data.subCategory || '',
      supplier_name: data.supplierName || '',
      evaluation_month: data.month || '',
      portfolio_diversity: parseFloat(data.portfolio_diversity) || 0,
      credit_term: parseFloat(data.credit_term) || 0,
      capacity_utilisation: parseFloat(data.capacity_utilisation) || 0,
      strategic_partnership: parseFloat(data.strategic_partnership) || 0,
      business_etiquette: parseFloat(data.business_etiquette) || 0,
      inventory_carrying: parseFloat(data.inventory_carrying) || 0,
      advance_notice: parseFloat(data.advance_notice) || 0,
      knowledge_sharing: parseFloat(data.knowledge_sharing) || 0,
      legal_contracts: parseFloat(data.legal_contracts) || 0,
      cost_competitiveness: parseFloat(data.cost_competitiveness) || 0,
      cost_model: parseFloat(data.cost_model) || 0,
      sdp_rating: parseFloat(data.sdp_rating) || 0,
      labelling_rating: parseFloat(data.labelling_rating) || 0,
      supplier_quality: parseFloat(data.supplier_quality) || 0
    };

    conn = await pool.getConnection();
    const [result] = await conn.query(
      'INSERT INTO supplier_evaluations SET ?',
      [evaluationData]
    );

    res.json({
      success: true,
      message: 'Evaluation submitted successfully',
      evaluationId: result.insertId
    });
  } catch (err) {
    console.error('Database Error:', err);
    res.status(500).json({
      success: false,
      message: 'Failed to save evaluation',
      error: process.env.NODE_ENV === 'production' ? 'Internal server error' : err.message
    });
  } finally {
    if (conn) conn.release();
  }
});

app.get('/api/evaluations', async (req, res) => {
  console.log('GET /api/evaluations hit');
  
  if (!pool) {
    return res.status(503).json({
      success: false,
      message: 'Database not available',
      error: 'Database pool not initialized'
    });
  }

  let conn;
  try {
    conn = await pool.getConnection();
    
    // First check if table exists
    const [tables] = await conn.query(
      "SHOW TABLES LIKE 'supplier_evaluations'"
    );
    
    if (tables.length === 0) {
      return res.json({
        success: true,
        data: [],
        message: 'Table not found, returning empty data'
      });
    }
    
    const [rows] = await conn.query(`
      SELECT id, supplier_name, evaluation_month, total_score, created_at
      FROM supplier_evaluations
      ORDER BY created_at DESC
      LIMIT 100
    `);
    
    res.json({ success: true, data: rows });
  } catch (err) {
    console.error('Database Error in /api/evaluations:', err);
    console.error('Error details:', {
      code: err.code,
      errno: err.errno,
      sqlMessage: err.sqlMessage,
      sqlState: err.sqlState
    });
    
    res.status(500).json({ 
      success: false, 
      message: 'Failed to load evaluations',
      error: process.env.NODE_ENV === 'production' ? 'Internal server error' : err.message,
      details: process.env.NODE_ENV === 'production' ? null : {
        code: err.code,
        errno: err.errno
      }
    });
  } finally {
    if (conn) conn.release();
  }
});

// Show all registered routes after they're defined
console.log('=== REGISTERED ROUTES ===');
setTimeout(() => {
  app._router.stack.forEach(function(r){
    if (r.route && r.route.path){
      console.log('Registered route:', Object.keys(r.route.methods)[0].toUpperCase(), r.route.path);
    }
  });
  console.log('========================');
}, 100);

// Catch-all debug route - before error handling
app.use('*', (req, res, next) => {
  console.log('Catch-all route hit for:', req.method, req.originalUrl);
  next();
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({
    success: false,
    message: 'Internal server error'
  });
});

// Handle 404 routes
app.use((req, res) => {
  console.log('404 handler hit for:', req.method, req.url);
  res.status(404).json({
    success: false,
    message: 'Route not found',
    requestedPath: req.url,
    method: req.method
  });
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('SIGTERM received, shutting down gracefully');
  if (pool) {
    await pool.end();
  }
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('SIGINT received, shutting down gracefully');
  if (pool) {
    await pool.end();
  }
  process.exit(0);
});

// Start Server - Always start the server, handle database separately
async function startServer() {
  try {
    console.log('Starting server...');
    
    // Start the server first
    const server = app.listen(PORT, '0.0.0.0', () => {
      console.log(`🚀 Server running on port ${PORT}`);
      console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
      console.log(`Database config: ${dbConfig.host}:${dbConfig.port}/${dbConfig.database}`);
    });

    // Then try to connect to database (but don't block server startup)
    if (pool) {
      const isConnected = await testConnection();
      if (isConnected) {
        await initializeDatabase();
        console.log('✅ Database ready');
      } else {
        console.log('⚠️  Server running without database connection');
      }
    } else {
      console.log('⚠️  Server running without database pool');
    }
  } catch (err) {
    console.error('❌ Failed to start server:', err);
    process.exit(1);
  }
}

startServer();
