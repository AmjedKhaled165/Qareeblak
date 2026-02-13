const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const pool = require('../db');

const JWT_SECRET = process.env.JWT_SECRET || 'halan-secret-key-2026';

// Middleware to authenticate partner users
const authenticatePartner = async (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({ success: false, error: 'غير مصرح' });
        }

        const token = authHeader.split(' ')[1];
        const decoded = jwt.verify(token, JWT_SECRET);
        req.user = decoded;
        next();
    } catch (error) {
        res.status(401).json({ success: false, error: 'التوكن غير صالح' });
    }
};

// GET all products for autocomplete
router.get('/', authenticatePartner, async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM halan_products ORDER BY name ASC');
        res.json({ success: true, data: result.rows });
    } catch (error) {
        console.error('Error fetching products:', error);
        res.status(500).json({ success: false, error: 'Internal server error' });
    }
});

// POST new product (Owner only)
router.post('/', authenticatePartner, async (req, res) => {
    try {
        const { name } = req.body;
        if (!name) return res.status(400).json({ success: false, error: 'اسم المنتج مطلوب' });

        // Optional: Check if user is owner
        if (req.user.role !== 'owner') {
            return res.status(403).json({ success: false, error: 'غير مسموح إلا للمالك' });
        }

        const checkExists = await pool.query('SELECT id FROM halan_products WHERE name = $1', [name]);
        if (checkExists.rows.length > 0) {
            return res.status(400).json({ success: false, error: 'هذا المنتج موجود بالفعل' });
        }

        const result = await pool.query(
            'INSERT INTO halan_products (name) VALUES ($1) RETURNING *',
            [name]
        );
        res.json({ success: true, data: result.rows[0] });
    } catch (error) {
        console.error('Error adding product:', error);
        res.status(500).json({ success: false, error: 'Internal server error' });
    }
});

// DELETE product (Owner only)
router.delete('/:id', authenticatePartner, async (req, res) => {
    try {
        const { id } = req.params;

        if (req.user.role !== 'owner') {
            return res.status(403).json({ success: false, error: 'غير مسموح إلا للمالك' });
        }

        await pool.query('DELETE FROM halan_products WHERE id = $1', [id]);
        res.json({ success: true, message: 'تم حذف المنتج' });
    } catch (error) {
        console.error('Error deleting product:', error);
        res.status(500).json({ success: false, error: 'Internal server error' });
    }
});

module.exports = router;
