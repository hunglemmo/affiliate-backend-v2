const express = require('express');
const axios = require('axios');
const cors = require('cors');
require('dotenv').config();
const { google } = require('googleapis');
const { OAuth2Client } = require('google-auth-library');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('./models/User');

const app = express();

// --- Cấu hình Middleware ---
const whitelist = ['http://localhost:3000', 'http://localhost:3001'];
const corsOptions = {
  origin: function (origin, callback) {
    if (!origin || whitelist.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  }
};
app.use(cors(corsOptions));
app.use(express.json());

// --- Kết nối Cơ sở dữ liệu MongoDB ---
mongoose.connect(process.env.MONGODB_URI)
    .then(() => console.log('MongoDB Connected...'))
    .catch(err => console.error('MongoDB Connection Error:', err));

// --- Cấu hình Google ---
const googleSheetsAuth = new google.auth.GoogleAuth({
    credentials: JSON.parse(process.env.GOOGLE_CREDENTIALS),
    scopes: "https://www.googleapis.com/auth/spreadsheets",
});
const spreadsheetId = process.env.SPREADSHEET_ID;
const googleAuthClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);


// --- CÁC API ENDPOINTS ---

// 1. API để lấy offers từ AccessTrade
app.get('/api/offers', async (req, res) => {
  try {
    const queryParams = req.query;
    const response = await axios.get('https://api.accesstrade.vn/v1/offers_informations', {
      headers: { 'Authorization': `Token ${process.env.ACCESSTRADE_API_KEY}` },
      params: queryParams,
      timeout: 15000
    });
    res.status(200).json(response.data);
  } catch (error) {
    if (error.code === 'ECONNABORTED') {
      return res.status(504).json({ message: 'Không nhận được phản hồi từ AccessTrade. Vui lòng thử lại sau.' });
    }
    res.status(500).json({ message: 'Lỗi khi kết nối đến AccessTrade từ server.', error: error.message });
  }
});

// 2. API để xử lý Đăng ký
app.post('/api/register', async (req, res) => {
    const { username, password } = req.body;
    try {
        if (!username || !password) return res.status(400).json({ success: false, message: 'Vui lòng nhập đủ thông tin.' });
        let user = await User.findOne({ username });
        if (user) return res.status(400).json({ success: false, message: 'Tên đăng nhập đã tồn tại.' });
        const uniqueReferralCode = username.toUpperCase() + Math.random().toString(36).substring(2, 6).toUpperCase();
        user = new User({ username, password, referralCode: uniqueReferralCode });
        await user.save();
        res.status(201).json({ success: true, message: 'Đăng ký thành công! Vui lòng đăng nhập.' });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Lỗi máy chủ khi đăng ký.'});
    }
});

// 3. API để xử lý Đăng nhập
app.post('/api/login', async (req, res) => {
    const { username, password } = req.body;
    try {
        const user = await User.findOne({ username });
        if (!user) return res.status(400).json({ success: false, message: 'Sai tên đăng nhập hoặc mật khẩu' });
        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) return res.status(400).json({ success: false, message: 'Sai tên đăng nhập hoặc mật khẩu' });
        res.status(200).json({ 
            success: true, 
            message: 'Đăng nhập thành công',
            user: { id: user._id, username: user.username, referralCode: user.referralCode, coins: user.coins }
        });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Lỗi máy chủ khi đăng nhập.'});
    }
});

// 4. API Đăng nhập bằng Google
app.post('/api/auth/google', async (req, res) => {
    const { token } = req.body;
    try {
        const ticket = await googleAuthClient.verifyIdToken({
            idToken: token,
            audience: process.env.GOOGLE_CLIENT_ID,
        });
        const payload = ticket.getPayload();
        const { sub: googleId, email } = payload;
        let user = await User.findOne({ googleId });
        if (!user) {
            let userByEmail = await User.findOne({ username: email });
            if (userByEmail) return res.status(400).json({ success: false, message: 'Email này đã được dùng để đăng ký tài khoản thường. Vui lòng đăng nhập bằng mật khẩu.' });
            const uniqueReferralCode = email.split('@')[0].toUpperCase() + Math.random().toString(36).substring(2, 6).toUpperCase();
            user = new User({ username: email, googleId: googleId, referralCode: uniqueReferralCode });
            await user.save();
        }
        res.status(200).json({
            success: true,
            message: 'Đăng nhập thành công',
            user: { id: user._id, username: user.username, referralCode: user.referralCode, coins: user.coins }
        });
    } catch (error) {
        res.status(400).json({ success: false, message: 'Xác thực Google thất bại.' });
    }
});
    
// 5. API để xử lý yêu cầu rút tiền
app.post('/api/withdraw', async (req, res) => {
    const { bank, accountNumber, accountName, amount } = req.body;
    try {
        const client = await googleSheetsAuth.getClient();
        const googleSheets = google.sheets({ version: "v4", auth: client });

        const newRow = [
            new Date().toLocaleString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" }),
            bank,
            accountNumber,
            accountName,
            amount,
            'Pending'
        ];
        
        const sheetName = "Trang tính1"; 

        await googleSheets.spreadsheets.values.append({
            auth: googleSheetsAuth, 
            spreadsheetId,
            range: `${sheetName}!A:F`,
            valueInputOption: "USER_ENTERED",
            resource: {
                values: [newRow],
            },
        });
        
        res.status(200).json({ success: true, message: "Yêu cầu rút tiền đã được gửi thành công!" });

    } catch (error) {
        console.error("Lỗi khi ghi vào Google Sheet:", error.message);
        res.status(500).json({ success: false, message: "Có lỗi xảy ra khi ghi dữ liệu vào Google Sheet." });
    }
});

// 6. API để người dùng tự cập nhật số xu
app.post('/api/user/update-coins', async (req, res) => {
    const { userId, newCoins } = req.body;
    if (!userId || newCoins === undefined) {
        return res.status(400).json({ success: false, message: 'Thiếu thông tin.' });
    }
    try {
        await User.findByIdAndUpdate(userId, { coins: newCoins });
        res.status(200).json({ success: true, message: 'Cập nhật xu thành công.' });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Lỗi máy chủ.' });
    }
});

// 7. API để Admin cộng xu
app.post('/api/admin/add-coins', async (req, res) => {
    const { targetUsername, amount, adminKey } = req.body;
    if (adminKey !== process.env.ADMIN_SECRET_KEY) {
        return res.status(403).json({ success: false, message: 'Không có quyền truy cập.' });
    }
    try {
        const user = await User.findOneAndUpdate(
            { username: targetUsername },
            { $inc: { coins: amount } },
            { new: true }
        );
        if (!user) return res.status(404).json({ success: false, message: 'Không tìm thấy người dùng mục tiêu.' });
        res.status(200).json({ success: true, message: `Đã cộng ${amount} xu cho ${targetUsername}. Số dư mới: ${user.coins}` });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Lỗi máy chủ.' });
    }
});

// Xuất app để Vercel có thể sử dụng
module.exports = app;