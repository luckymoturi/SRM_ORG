const express = require('express');
const mysql = require('mysql2/promise');
const path = require('path');
const app = express();
const PORT = 3000;

// MySQL Configuration
const dbConfig = {
  host: 'localhost',
  user: 'root',
  password: 'password', // Change to your MySQL password
  database: 'srm_db',
  port: 3306,       // Your MySQL port
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
};

// Create MySQL pool
const pool = mysql.createPool(dbConfig);

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public'), { index: false }));

// Test database connection
async function testConnection() {
  try {
    const conn = await pool.getConnection();
    console.log('✅ MySQL connected successfully');
    conn.release();
    return true;
  } catch (err) {
    console.error('❌ MySQL connection failed:', err);
    return false;
  }
}

// Routes
app.get('/home', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'login.html'));
});


app.post('/api/evaluations', async (req, res) => {
  try {
    const { data } = req.body;
    
    // Map form fields to database columns
    const evaluationData = {
      category: data.category,
      sub_category: data.subCategory,
      supplier_name: data.supplierName,
      evaluation_month: data.month, 
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

    const [result] = await pool.query(
      `INSERT INTO supplier_evaluations SET ?`,
      evaluationData
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
      error: err.message
    });
  }
});

app.get('/api/evaluations', async (req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT id, supplier_name, evaluation_month, total_score, created_at
      FROM supplier_evaluations
      ORDER BY created_at DESC
      LIMIT 100
    `);
    res.json({ success: true, data: rows });
  } catch (err) {
    console.error('Database Error:', err);
    res.status(500).json({ success: false, message: 'Failed to load evaluations' });
  }
});

// Start Server
async function startServer() {
  if (await testConnection()) {
    app.listen(PORT, () => {
      console.log(`Server running on http://localhost:${PORT}`);
      console.log(`MySQL database: ${dbConfig.database} on port ${dbConfig.port}`);
    });
  } else {
    console.error('Failed to start server due to database connection issues');
    process.exit(1);
  }
}

startServer();