const express = require('express');
const axios = require('axios');
const cors = require('cors');
require('dotenv').config();
const { google } = require('googleapis');

const app = express();

// Middleware
app.use(cors());
app.use(express.json()); // Rất quan trọng để đọc body của request

// --- CẤU HÌNH GOOGLE SHEETS ---
const auth = new google.auth.GoogleAuth({
    credentials: JSON.parse(process.env.GOOGLE_CREDENTIALS),
    scopes: "https://www.googleapis.com/auth/spreadsheets",
});
const spreadsheetId = process.env.SPREADSHEET_ID;

// --- CÁC API ENDPOINTS ---

// 1. API để lấy offers từ AccessTrade
app.get('/api/offers', async (req, res) => {
  try {
    const queryParams = req.query;
    const response = await axios.get('https://api.accesstrade.vn/v1/offers_informations', {
      headers: { 'Authorization': `Token ${process.env.ACCESSTRADE_API_KEY}` },
      params: queryParams
    });
    res.status(200).json(response.data);
  } catch (error) {
    console.error('Error calling AccessTrade API:', error.message);
    res.status(500).json({ message: 'Lỗi khi kết nối đến AccessTrade từ server.', error: error.message });
  }
});

// 2. API để xử lý đăng nhập
app.post('/api/login', (req, res) => {
    const { username, password } = req.body;
    // Ví dụ minh họa với người dùng có sẵn.
    // TRONG THỰC TẾ: Bạn sẽ thay thế logic này bằng việc truy vấn database
    if (username === 'demo' && password === '123456') {
        res.status(200).json({ success: true, message: 'Đăng nhập thành công' });
    } else {
        res.status(401).json({ success: false, message: 'Sai tên đăng nhập hoặc mật khẩu' });
    }
});

// 3. API để xử lý yêu cầu rút tiền
app.post('/api/withdraw', async (req, res) => {
    const { bank, accountNumber, accountName, amount } = req.body;
    try {
        const client = await auth.getClient();
        const googleSheets = google.sheets({ version: "v4", auth: client });
        const newRow = [ new Date().toISOString(), bank, accountNumber, accountName, amount, 'Pending' ];
        await googleSheets.spreadsheets.values.append({
            auth,
            spreadsheetId,
            range: "Sheet1!A:F",
            valueInputOption: "USER_ENTERED",
            resource: { values: [newRow] },
        });
        res.status(200).json({ success: true, message: "Yêu cầu rút tiền đã được gửi thành công!" });
    } catch (error) {
        console.error("Lỗi khi ghi vào Google Sheet:", error);
        res.status(500).json({ success: false, message: "Có lỗi xảy ra khi gửi yêu cầu." });
    }
});

// Xuất app để Vercel có thể sử dụng
module.exports = app;