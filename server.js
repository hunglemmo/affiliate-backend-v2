const express = require('express');
const axios = require('axios');
const cors = require('cors');
require('dotenv').config();
const { google } = require('googleapis');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('./models/User'); // Import User model

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// --- KẾT NỐI CƠ SỞ DỮ LIỆU MONGODB ---
mongoose.connect(process.env.MONGODB_URI)
    .then(() => console.log('MongoDB Connected...'))
    .catch(err => console.error('MongoDB Connection Error:', err));


// --- CẤU HÌNH GOOGLE SHEETS (Giữ nguyên) ---
const auth = new google.auth.GoogleAuth({ /* ... */ });
const spreadsheetId = process.env.SPREADSHEET_ID;


// --- CÁC API ENDPOINTS ---

// 1. API lấy offers (Giữ nguyên)
app.get('/api/offers', async (req, res) => { /* ... */ });

// 2. API ĐĂNG KÝ (Nâng cấp)
app.post('/api/register', async (req, res) => {
    const { username, password } = req.body;
    try {
        let user = await User.findOne({ username });
        if (user) {
            return res.status(400).json({ success: false, message: 'Tên đăng nhập đã tồn tại.' });
        }
        user = new User({ username, password });
        await user.save();
        res.status(201).json({ success: true, message: 'Đăng ký thành công! Vui lòng đăng nhập.' });
    } catch (error) {
        console.error(error.message);
        res.status(500).send('Lỗi máy chủ');
    }
});

// 3. API ĐĂNG NHẬP (Nâng cấp)
app.post('/api/login', async (req, res) => {
    const { username, password } = req.body;
    try {
        const user = await User.findOne({ username });
        if (!user) {
            return res.status(400).json({ success: false, message: 'Sai tên đăng nhập hoặc mật khẩu' });
        }
        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return res.status(400).json({ success: false, message: 'Sai tên đăng nhập hoặc mật khẩu' });
        }
        res.status(200).json({ success: true, message: 'Đăng nhập thành công' });
    } catch (error) {
        console.error(error.message);
        res.status(500).send('Lỗi máy chủ');
    }
});

// 4. API rút tiền (Giữ nguyên)
app.post('/api/withdraw', async (req, res) => { /* ... */ });


// Xuất app để Vercel sử dụng
module.exports = app;