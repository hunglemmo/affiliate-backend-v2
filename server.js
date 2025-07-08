// 1. Import các thư viện đã cài đặt
const express = require('express');
const axios = require('axios');
const cors = require('cors');
require('dotenv').config(); // Lệnh này để nạp các biến từ file .env

// 2. Khởi tạo Express app
const app = express();
const PORT = process.env.PORT || 3001; // Backend sẽ chạy trên cổng 3001

// 3. Cấu hình CORS
// Dòng này cho phép ứng dụng React (thường chạy ở cổng 3000) có thể gọi đến backend này
app.use(cors());

// 4. Tạo API Endpoint chính để lấy dữ liệu từ AccessTrade
// Endpoint này sẽ là "cầu nối" an toàn
app.get('/api/offers', async (req, res) => {
    try {
        // Lấy các tham số lọc từ request của frontend (ví dụ: ?coupon=1)
        const queryParams = req.query;

        console.log('Đang gọi API AccessTrade với params:', queryParams);

        // Gọi đến API của AccessTrade, đính kèm API Key trong header
        const response = await axios.get('https://api.accesstrade.vn/v1/offers_informations', {
            headers: {
                // Đây là nơi sử dụng API Key một cách an toàn
                'Authorization': `Token ${process.env.ACCESSTRADE_API_KEY}`
            },
            params: queryParams // Chuyển tiếp các tham số lọc đến AccessTrade
        });

        // 5. Gửi dữ liệu nhận được về cho frontend
        res.json(response.data);

    } catch (error) {
        console.error('Lỗi khi gọi API AccessTrade:', error.response ? error.response.data : error.message);
        res.status(500).json({ message: 'Lỗi khi kết nối đến AccessTrade' });
    }
});

// 6. Khởi động server
app.listen(PORT, () => {
    console.log(`Backend server đang chạy tại http://localhost:${PORT}`);
});