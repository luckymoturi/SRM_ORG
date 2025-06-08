const express = require('express');
const { Pool } = require('pg');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// PostgreSQL Configuration using environment variables
const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'admin',
  database: process.env.DB_NAME || 'srm_db',
  port: parseInt(process.env.DB_PORT) || 5432,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
};

console.log('Database Configuration:', {
  host: dbConfig.host,
  user: dbConfig.user,
  database: dbConfig.database,
  port: dbConfig.port,
  ssl: dbConfig.ssl
});

// Create PostgreSQL pool
const pool = new Pool(dbConfig);

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public'), { index: false }));

// Test database connection with retry logic
async function testConnection(retries = 3) {
  for (let i = 0; i < retries; i++) {
    try {
      console.log(`Attempting database connection (attempt ${i + 1}/${retries})...`);
      const client = await pool.connect();
      await client.query('SELECT 1');
      console.log('✅ PostgreSQL connected successfully');
      client.release();
      return true;
    } catch (err) {
      console.error(`❌ PostgreSQL connection failed (attempt ${i + 1}/${retries}):`, err.message);
      if (i === retries - 1) return false;
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  }
  return false;
}

// Initialize database tables
async function initializeDatabase() {
  try {
    const client = await pool.connect();
    const createTableQuery = `
      CREATE TABLE IF NOT EXISTS supplier_evaluations (
        id SERIAL PRIMARY KEY,
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
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `;
    await client.query(createTableQuery);
    console.log('✅ Database tables initialized successfully');
    client.release();
  } catch (err) {
    console.error('❌ Database initialization failed:', err);
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
  let client;
  try {
    const { data } = req.body;
    if (!data) {
      return res.status(400).json({ success: false, message: 'No data provided' });
    }

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

    const keys = Object.keys(evaluationData);
    const values = Object.values(evaluationData);
    const placeholders = keys.map((_, i) => `$${i + 1}`).join(', ');

    const query = `
      INSERT INTO supplier_evaluations (${keys.join(', ')})
      VALUES (${placeholders})
      RETURNING id
    `;

    client = await pool.connect();
    const result = await client.query(query, values);

    res.json({
      success: true,
      message: 'Evaluation submitted successfully',
      evaluationId: result.rows[0].id
    });
  } catch (err) {
    console.error('Database Error:', err);
    res.status(500).json({
      success: false,
      message: 'Failed to save evaluation',
      error: process.env.NODE_ENV === 'production' ? 'Internal server error' : err.message
    });
  } finally {
    if (client) client.release();
  }
});

app.get('/api/evaluations', async (req, res) => {
  let client;
  try {
    client = await pool.connect();
    const result = await client.query(`
      SELECT id, supplier_name, evaluation_month, total_score, created_at
      FROM supplier_evaluations
      ORDER BY created_at DESC
      LIMIT 100
    `);
    res.json({ success: true, data: result.rows });
  } catch (err) {
    console.error('Database Error:', err);
    res.status(500).json({
      success: false,
      message: 'Failed to load evaluations',
      error: process.env.NODE_ENV === 'production' ? 'Internal server error' : err.message
    });
  } finally {
    if (client) client.release();
  }
});

// Error handling
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ success: false, message: 'Internal server error' });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ success: false, message: 'Route not found' });
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('SIGTERM received, shutting down...');
  await pool.end();
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('SIGINT received, shutting down...');
  await pool.end();
  process.exit(0);
});

// Start server
async function startServer() {
  console.log('Starting server...');
  const isConnected = await testConnection();
  if (isConnected) {
    await initializeDatabase();
    app.listen(PORT, '0.0.0.0', () => {
      console.log(`🚀 Server running on port ${PORT}`);
      console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
    });
  } else {
    console.error('❌ Database not connected. Server not started.');
    if (process.env.NODE_ENV === 'production') {
      console.log('⚠️ Starting server without DB (production fallback)');
      app.listen(PORT, '0.0.0.0', () => {
        console.log(`🚀 Server running on port ${PORT} (DB DISCONNECTED)`);
      });
    } else {
      process.exit(1);
    }
  }
}

startServer();
