const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const UserSchema = new mongoose.Schema({
    username: { type: String, required: true, unique: true, trim: true },
    password: { type: String, required: function() { return !this.googleId; } },
    googleId: { type: String, sparse: true, unique: true },
    referralCode: { type: String, unique: true },
    coins: { type: Number, default: 100 },
    lastClaimedDaily: { type: Date },
    // THÊM TRƯỜNG MỚI: Lưu danh sách ID của các offer yêu thích
    favorites: {
        type: [String],
        default: []
    }
}, { timestamps: true });

// Mã hóa mật khẩu trước khi lưu
UserSchema.pre('save', async function(next) {
    if (!this.isModified('password') || !this.password) {
        return next();
    }
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    next();
});

module.exports = mongoose.model('User', UserSchema);
