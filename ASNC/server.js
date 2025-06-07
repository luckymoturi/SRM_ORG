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

// Create MySQL pool
let pool;
try {
  pool = mysql.createPool(dbConfig);
} catch (err) {
  console.error('❌ Failed to create MySQL pool:', err);
  process.exit(1);
}

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public'), { index: false }));

// Test database connection with retry logic
async function testConnection(retries = 3) {
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
    database: pool ? 'Connected' : 'Disconnected'
  });
});

app.get('/home', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'login.html'));
});

app.post('/api/evaluations', async (req, res) => {
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
  let conn;
  try {
    conn = await pool.getConnection();
    const [rows] = await conn.query(`
      SELECT id, supplier_name, evaluation_month, total_score, created_at
      FROM supplier_evaluations
      ORDER BY created_at DESC
      LIMIT 100
    `);
    res.json({ success: true, data: rows });
  } catch (err) {
    console.error('Database Error:', err);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to load evaluations',
      error: process.env.NODE_ENV === 'production' ? 'Internal server error' : err.message
    });
  } finally {
    if (conn) conn.release();
  }
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
  res.status(404).json({
    success: false,
    message: 'Route not found'
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

// Start Server
async function startServer() {
  try {
    console.log('Starting server...');
    
    // Test database connection
    const isConnected = await testConnection();
    
    if (isConnected) {
      // Initialize database tables
      await initializeDatabase();
      
      // Start the server
      app.listen(PORT, '0.0.0.0', () => {
        console.log(`🚀 Server running on port ${PORT}`);
        console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
      });
    } else {
      console.error('❌ Failed to connect to database');
      
      // In production, you might want to start the server anyway
      // and handle database errors gracefully
      if (process.env.NODE_ENV === 'production') {
        console.log('⚠️  Starting server without database connection (production mode)');
        app.listen(PORT, '0.0.0.0', () => {
          console.log(`🚀 Server running on port ${PORT} (DATABASE DISCONNECTED)`);
        });
      } else {
        process.exit(1);
      }
    }
  } catch (err) {
    console.error('❌ Failed to start server:', err);
    process.exit(1);
  }
}

startServer();
