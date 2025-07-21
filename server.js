const express = require('express');
const axios = require('axios');
const cors = require('cors');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const User = require('./models/User');
const Redemption = require('./models/Redemption');

const app = express();

// --- Cấu hình Middleware ---
app.use(cors({
    origin: "*",
    methods: "GET,HEAD,PUT,PATCH,POST,DELETE",
    preflightContinue: false,
    optionsSuccessStatus: 204
}));
app.use(express.json());


// --- Kết nối Cơ sở dữ liệu MongoDB ---
const connectDB = async () => {
    try {
        if (!mongoose.connection.readyState) {
            await mongoose.connect(process.env.MONGODB_URI);
            console.log('MongoDB Connected...');
        }
    } catch (err) {
        console.error('MongoDB Connection Error:', err.message);
        process.exit(1);
    }
};
connectDB();


// --- Middleware Xác thực Token (Quan trọng) ---
const protect = async (req, res, next) => {
    let token;
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
        try {
            token = req.headers.authorization.split(' ')[1];
            const decoded = jwt.verify(token, process.env.JWT_SECRET);
            req.user = await User.findById(decoded.userId).select('-password');
            if (!req.user) {
                return res.status(401).json({ success: false, message: 'Người dùng không tồn tại' });
            }
            next();
        } catch (error) {
            return res.status(401).json({ success: false, message: 'Token không hợp lệ hoặc đã hết hạn' });
        }
    }
    if (!token) {
        return res.status(401).json({ success: false, message: 'Không có quyền truy cập, vui lòng đăng nhập' });
    }
};

// --- HÀM HỖ TRỢ ---
const isSameDay = (date1, date2) => {
    if (!date1 || !date2) return false;
    const d1 = new Date(date1);
    const d2 = new Date(date2);
    // So sánh dựa trên ngày/tháng/năm của múi giờ UTC
    return d1.getUTCFullYear() === d2.getUTCFullYear() &&
           d1.getUTCMonth() === d2.getUTCMonth() &&
           d1.getUTCDate() === d2.getUTCDate();
};

// --- CÁC API CÔNG KHAI (Không cần đăng nhập) ---

app.get('/api/offers', async (req, res) => {
    try {
        const { page = 1, limit = 20, keyword = '' } = req.query;
        const params = { page, limit, ...(keyword && { keyword }) };
        const response = await axios.get('https://api.accesstrade.vn/v1/offers_informations', {
            headers: { 'Authorization': `Token ${process.env.ACCESSTRADE_API_KEY}` },
            params: params,
            timeout: 15000
        });
        res.status(200).json(response.data);
    } catch (error) {
        console.error('Error fetching offers:', error.message);
        res.status(500).json({ message: 'Lỗi khi kết nối đến AccessTrade.', error: error.message });
    }
});

app.get('/api/categories', async (req, res) => {
    try {
        const response = await axios.get('https://api.accesstrade.vn/v1/offers_informations', {
            headers: { 'Authorization': `Token ${process.env.ACCESSTRADE_API_KEY}` },
            params: { limit: 100 },
            timeout: 20000
        });
        const offers = response.data.data || [];
        const platformDomains = new Set();
        offers.forEach(p => {
            if (p.domain?.includes('shopee')) platformDomains.add('shopee');
            if (p.domain?.includes('lazada')) platformDomains.add('lazada');
            if (p.domain?.includes('tiki')) platformDomains.add('tiki');
        });
        res.status(200).json({ success: true, platforms: [...platformDomains] });
    } catch (error) {
        console.error('Error fetching categories:', error.message);
        res.status(500).json({ success: false, message: 'Không thể lấy danh sách danh mục.' });
    }
});

app.post('/api/register', async (req, res) => {
    const { username, password, referralCode } = req.body;
    try {
        if (!username || !password) {
            return res.status(400).json({ success: false, message: 'Vui lòng nhập đủ thông tin.' });
        }
        let user = await User.findOne({ username });
        if (user) {
            return res.status(400).json({ success: false, message: 'Tên đăng nhập đã tồn tại.' });
        }

        let initialCoins = 100;

        if (referralCode) {
            const referrer = await User.findOne({ referralCode: referralCode.trim().toUpperCase() });
            
            if (referrer) {
                referrer.coins += 100;
                await referrer.save();
                console.log(`User ${referrer.username} referred ${username}. Both get 100 coins.`);
            }
        }

        const uniqueReferralCode = username.toUpperCase() + Math.random().toString(36).substring(2, 6).toUpperCase();
        
        user = new User({ 
            username, 
            password, 
            referralCode: uniqueReferralCode,
            coins: initialCoins,
            lastClaimedDaily: null
        });
        
        await user.save();
        
        res.status(201).json({ success: true, message: 'Đăng ký thành công! Vui lòng đăng nhập.' });

    } catch (error) {
        console.error('Error in /api/register:', error.message);
        res.status(500).json({ success: false, message: 'Lỗi máy chủ khi đăng ký.'});
    }
});


app.post('/api/login', async (req, res) => {
    const { username, password } = req.body;
    try {
        const user = await User.findOne({ username });
        if (!user) return res.status(400).json({ success: false, message: 'Sai tên đăng nhập hoặc mật khẩu' });
        if (!user.password) {
            return res.status(400).json({ success: false, message: 'Tài khoản này được đăng ký qua Google. Vui lòng đăng nhập bằng Google.' });
        }
        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) return res.status(400).json({ success: false, message: 'Sai tên đăng nhập hoặc mật khẩu' });
        
        const token = jwt.sign({ userId: user._id }, process.env.JWT_SECRET, { expiresIn: '7d' });
        
        const canClaimBonus = !isSameDay(user.lastClaimedDaily, new Date());

        // THÊM VÀO: Khối code chẩn đoán
        const responseData = { 
            success: true, 
            message: 'Đăng nhập thành công',
            token: token,
            user: { id: user._id, username: user.username, referralCode: user.referralCode, coins: user.coins, canClaimBonus }
        };
        console.log("BACKEND LOGIN RESPONSE:", JSON.stringify(responseData, null, 2));
        res.status(200).json(responseData);

    } catch (error) {
        console.error('Error in /api/login:', error.message);
        res.status(500).json({ success: false, message: 'Lỗi máy chủ khi đăng nhập.'});
    }
});

app.post('/api/auth/google', async (req, res) => {
    const { token } = req.body;
    const { OAuth2Client } = require('google-auth-library');
    const googleAuthClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);
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
            
            user = new User({ 
                username: email, 
                googleId: googleId, 
                referralCode: uniqueReferralCode,
                coins: 100,
                lastClaimedDaily: null
            });
            await user.save();
        }
        
        const authToken = jwt.sign({ userId: user._id }, process.env.JWT_SECRET, { expiresIn: '7d' });

        const canClaimBonus = !isSameDay(user.lastClaimedDaily, new Date());

        // THÊM VÀO: Khối code chẩn đoán
        const responseData = {
            success: true,
            message: 'Đăng nhập thành công',
            token: authToken,
            user: { id: user._id, username: user.username, referralCode: user.referralCode, coins: user.coins, canClaimBonus }
        };
        console.log("BACKEND GOOGLE RESPONSE:", JSON.stringify(responseData, null, 2));
        res.status(200).json(responseData);

    } catch (error) {
        console.error('Error in /api/auth/google:', error.message);
        res.status(400).json({ success: false, message: 'Xác thực Google thất bại.' });
    }
});
    
// --- API Yêu cầu đăng nhập ---

app.post('/api/redeem-card', protect, async (req, res) => {
    const { cardType, amount } = req.body;
    const userId = req.user._id;
    const requiredCoins = amount / 10; 

    try {
        const user = req.user;
        if (user.coins < requiredCoins) {
            return res.status(400).json({ success: false, message: 'Số xu không đủ để đổi thẻ này.' });
        }
        user.coins -= requiredCoins;
        await user.save();
        const newRedemption = new Redemption({
            user: userId,
            cardType,
            amount,
            status: 'pending',
        });
        await newRedemption.save();
        res.status(200).json({ 
            success: true, 
            message: "Yêu cầu đổi thẻ đã được gửi. Chúng tôi sẽ xử lý trong 24 giờ.",
            newCoins: user.coins
        });
    } catch (error) {
        console.error('Error in /api/redeem-card:', error.message);
        res.status(500).json({ success: false, message: "Có lỗi xảy ra, vui lòng thử lại." });
    }
});

app.get('/api/redemption-history', protect, async (req, res) => {
    try {
        const redemptions = await Redemption.find({ user: req.user._id }).sort({ createdAt: -1 });
        res.status(200).json({ success: true, data: redemptions });
    } catch (error) {
        console.error('Error in /api/redemption-history:', error.message);
        res.status(500).json({ success: false, message: 'Không thể lấy lịch sử đổi thưởng.' });
    }
});

app.post('/api/user/claim-daily', protect, async (req, res) => {
    try {
        const user = req.user;
        if (isSameDay(user.lastClaimedDaily, new Date())) {
            return res.status(400).json({ success: false, message: 'Bạn đã nhận thưởng hôm nay rồi.' });
        }
        user.coins += 10;
        user.lastClaimedDaily = new Date();
        await user.save();
        res.status(200).json({ success: true, newCoins: user.coins, message: 'Nhận thưởng thành công!' });
    } catch (error) {
        console.error('Error in /api/user/claim-daily:', error.message);
        res.status(500).json({ success: false, message: 'Lỗi máy chủ.' });
    }
});

app.post('/api/user/add-coins', protect, async (req, res) => {
    const { amountToAdd } = req.body; 
    const userId = req.user._id;

    if (!amountToAdd || amountToAdd <= 0 || amountToAdd > 100) { 
        return res.status(400).json({ success: false, message: 'Số xu cộng vào không hợp lệ.' });
    }
    try {
        const updatedUser = await User.findByIdAndUpdate(
            userId, { $inc: { coins: amountToAdd } }, { new: true }
        );
        res.status(200).json({
            success: true,
            message: `Bạn đã được cộng ${amountToAdd} xu!`,
            newCoins: updatedUser.coins 
        });
    } catch (error) {
        console.error('Error in /api/user/add-coins:', error.message);
        res.status(500).json({ success: false, message: 'Lỗi máy chủ khi cập nhật xu.' });
    }
});

app.post('/api/admin/add-coins', async (req, res) => {
    const { targetUsername, amount, adminKey } = req.body;
    if (adminKey !== process.env.ADMIN_SECRET_KEY) {
        return res.status(403).json({ success: false, message: 'Không có quyền truy cập.' });
    }
    try {
        const user = await User.findOneAndUpdate(
            { username: targetUsername }, { $inc: { coins: amount } }, { new: true }
        );
        if (!user) return res.status(404).json({ success: false, message: 'Không tìm thấy người dùng mục tiêu.' });
        res.status(200).json({ success: true, message: `Đã cộng ${amount} xu cho ${targetUsername}. Số dư mới: ${user.coins}` });
    } catch (error) {
        console.error('Error in /api/admin/add-coins:', error.message);
        res.status(500).json({ success: false, message: 'Lỗi máy chủ.' });
    }
});


// Xuất app để Vercel có thể sử dụng
module.exports = app;