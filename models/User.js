const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const UserSchema = new mongoose.Schema({
    username: {
        type: String,
        required: true,
        unique: true,
        trim: true
    },
    password: {
        type: String,
        // Mật khẩu chỉ bắt buộc khi người dùng không đăng ký bằng Google
        required: function() { return !this.googleId; }
    },
    // Thêm trường mới để lưu ID từ Google
    googleId: {
        type: String,
        sparse: true, // Cho phép nhiều giá trị null, nhưng các giá trị có thật phải là duy nhất
        unique: true
    },
    referralCode: {
        type: String,
        unique: true
    }
}, { timestamps: true });

// Mã hóa mật khẩu trước khi lưu vào database
UserSchema.pre('save', async function(next) {
    // Chỉ mã hóa nếu mật khẩu được thay đổi (hoặc là người dùng mới) và có tồn tại
    if (!this.isModified('password') || !this.password) {
        return next();
    }
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    next();
});

module.exports = mongoose.model('User', UserSchema);