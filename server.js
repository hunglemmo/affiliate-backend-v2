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
// Cấu hình CORS để chỉ cho phép các domain cụ thể
const corsOptions = {
    origin: [
        'http://localhost:3000', // Cho phép app React khi chạy local
        'http://localhost:3001', // Cho phép app React khi chạy local ở cổng khác
        // SAU NÀY KHI BẠN DEPLOY FRONTEND, HÃY THÊM URL CỦA NÓ VÀO ĐÂY
        // ví dụ: 'https://affiliate-frontend-abcd.vercel.app' 
    ]
};

app.use(cors(corsOptions));
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
app.get('/api/offers', async (req, res) => {
  try {
    const queryParams = req.query;

    const response = await axios.get('https://api.accesstrade.vn/v1/offers_informations', {
      headers: {
        'Authorization': `Token ${process.env.ACCESSTRADE_API_KEY}`
      },
      params: queryParams,
      timeout: 15000 // THÊM DÒNG NÀY: Tự ngắt kết nối sau 15 giây nếu AccessTrade không trả lời
    });

    res.status(200).json(response.data);

  } catch (error) {
    // Thêm logic để xử lý lỗi timeout một cách rõ ràng hơn
    if (error.code === 'ECONNABORTED') {
      console.error('AccessTrade API timed out.');
      return res.status(504).json({ message: 'Không nhận được phản hồi từ AccessTrade. Vui lòng thử lại sau.' });
    }
    
    console.error('Error calling AccessTrade API:', error.message);
    res.status(500).json({
      message: 'Lỗi khi kết nối đến AccessTrade từ server.',
      error: error.message
    });
  }
});

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