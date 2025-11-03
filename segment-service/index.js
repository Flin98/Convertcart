require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

// Connect to MongoDB
mongoose.connect(process.env.MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

// Define Product schema
const productSchema = new mongoose.Schema({
  id: Number,
  title: String,
  price: Number,
  stock_status: String,
  stock_quantity: Number,
  category: String,
  tags: [String],
  on_sale: Boolean,
  created_at: Date,
  brand: String,        // Optional: add brand if stored during ingestion
  rating: Number,       // Optional: add rating if stored during ingestion
});
const Product = mongoose.model('Product', productSchema);

// Parse conditions into MongoDB query
function parseConditions(conditions) {
  const query = {};
  for (const cond of conditions) {
    // Regex to parse: field operator value
    const match = cond.match(/^(\w+)\s*(=|>=|>|<=|<|\|=)\s*(.+)$/);
    if (!match) continue;

    const [, field, operator, rawValue] = match;
    const value = parseValue(rawValue);

    switch (operator) {
      case '=':
        query[field] = value;
        break;
      case '>':
        query[field] = { $gt: value };
        break;
      case '>=':
        query[field] = { $gte: value };
        break;
      case '<':
        query[field] = { $lt: value };
        break;
      case '<=':
        query[field] = { $lte: value };
        break;
      case '|=':
        query[field] = { $regex: value, $options: 'i' };
        break;
      default:
        break;
    }
  }
  return query;
}

function parseValue(val) {
  const trimmedVal = val.trim().replace(/^["']|["']$/g, '');
  if (trimmedVal.toLowerCase() === 'true') return true;
  if (trimmedVal.toLowerCase() === 'false') return false;
  if (!isNaN(trimmedVal)) return Number(trimmedVal);
  return trimmedVal;
}

// Endpoint to evaluate segments based on conditions
app.post('/segments/evaluate', async (req, res) => {
  try {
    if (!req.body.conditions) {
      return res.status(400).json({ message: 'Conditions are required' });
    }
    const conditions = req.body.conditions;
    const mongoQuery = parseConditions(conditions);
    const products = await Product.find(mongoQuery);
    res.json(products);
  } catch (error) {
    res.status(500).json({ message: 'Error evaluating segment', error: error.message });
  }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Segment service running on port ${PORT}`);
});
