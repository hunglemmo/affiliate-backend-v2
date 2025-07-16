const mongoose = require('mongoose');

// Schema này dùng để lưu lại mỗi lần người dùng yêu cầu đổi thẻ
const RedemptionSchema = new mongoose.Schema({
    // ID của người dùng đã yêu cầu đổi thưởng
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
    },
    // Tên nhà mạng, ví dụ: 'Viettel', 'MobiFone'
    cardType: {
        type: String,
        required: true,
    },
    // Mệnh giá thẻ cào, tính bằng VNĐ (ví dụ: 10000, 20000)
    amount: {
        type: Number,
        required: true,
    },
    // Trạng thái của yêu cầu, mặc định là 'pending' (chờ xử lý)
    // Bạn có thể vào database và đổi thành 'completed' sau khi đã nạp thẻ
    status: {
        type: String,
        enum: ['pending', 'completed', 'failed'],
        default: 'pending',
    },
    // Sau khi nạp thẻ, bạn có thể điền mã thẻ vào đây (tùy chọn)
    cardCode: {
        type: String,
        default: null,
    },
    // Và số seri (tùy chọn)
    cardSerial: {
        type: String,
        default: null,
    },
}, { 
    // Tự động thêm trường createdAt và updatedAt
    timestamps: true 
});

module.exports = mongoose.model('Redemption', RedemptionSchema);
