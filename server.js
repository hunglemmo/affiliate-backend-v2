const express = require('express');
const axios = require('axios');
const cors = require('cors');
require('dotenv').config();

const app = express();

// Cấu hình CORS để cho phép mọi domain truy cập
// Điều này quan trọng để Vercel và máy local của bạn có thể gọi được
app.use(cors());

// API Endpoint chính để lấy dữ liệu từ AccessTrade
app.get('/api/offers', async (req, res) => {
    try {
        const queryParams = req.query;

        const response = await axios.get('https://api.accesstrade.vn/v1/offers_informations', {
            headers: {
                'Authorization': `Token ${process.env.ACCESSTRADE_API_KEY}`
            },
            params: queryParams
        });

        // Trả về dữ liệu thành công
        res.status(200).json(response.data);

    } catch (error) {
        // Ghi lại lỗi chi tiết trên server của Vercel (bạn có thể xem ở mục Logs)
        console.error('Error calling AccessTrade API:', error.message);
        
        // Trả về một thông báo lỗi rõ ràng cho frontend
        res.status(500).json({ 
            message: 'Lỗi khi kết nối đến AccessTrade từ server.',
            error: error.message 
        });
    }
});

// Xuất app để Vercel có thể sử dụng
module.exports = app;
