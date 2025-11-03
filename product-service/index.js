require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const axios = require('axios');
const cors = require('cors');
const cron = require('node-cron');

// App setup
const app = express();
app.use(cors());
app.use(express.json());

// MongoDB connection
mongoose.connect(process.env.MONGO_URI, {useNewUrlParser: true, useUnifiedTopology: true});
const productSchema = new mongoose.Schema({
  id: Number,
  title: String,
  price: Number,
  stock_status: String,
  stock_quantity: Number,
  category: String,
  tags: [String],
  on_sale: Boolean,
  created_at: Date
});
const Product = mongoose.model('Product', productSchema);

// WooCommerce API config from .env
const WC_BASE_URL = process.env.WC_BASE_URL;
const CONSUMER_KEY = process.env.CONSUMER_KEY;
const CONSUMER_SECRET = process.env.CONSUMER_SECRET;

// Fetch products from WooCommerce and save in DB
async function fetchAndStoreProducts() {
  try {
    const response = await axios.get(`${WC_BASE_URL}/wp-json/wc/v3/products`, {
      params: { consumer_key: CONSUMER_KEY, consumer_secret: CONSUMER_SECRET }
    });
    const products = response.data;

    // Transform and upsert products
    for (const p of products) {
      await Product.findOneAndUpdate(
        { id: p.id },
        {
          id: p.id,
          title: p.name,
          price: parseFloat(p.price),
          stock_status: p.stock_status,
          stock_quantity: p.stock_quantity,
          category: p.categories?.[0]?.name || '',
          tags: p.tags?.map(t => t.name) || [],
          on_sale: p.on_sale,
          created_at: new Date(p.date_created)
        },
        { upsert: true }
      );
    }
    console.log('Products ingested and stored.');
  } catch (err) {
    console.error('Error fetching WooCommerce products:', err.message);
  }
}

// Setup cron job for every hour
cron.schedule('0 * * * *', fetchAndStoreProducts);

// API endpoint to get products
app.get('/products', async (req, res) => {
  try {
    const products = await Product.find();
    res.json(products);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching products' });
  }
});

// Start server
const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`Product service running on port ${PORT}`);
  fetchAndStoreProducts();  // Initial fetch on start
});
