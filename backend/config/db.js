const mongoose = require('mongoose');

// Cache the connection on `global` so warm serverless invocations reuse it
// instead of opening a new pool per request.
const cached = global.__rankitMongoose || (global.__rankitMongoose = { conn: null, promise: null });

const connectDB = async () => {
    if (cached.conn && mongoose.connection.readyState === 1) {
        return cached.conn;
    }

    const uri = process.env.MONGODB_URI;
    if (!uri) {
        const error = new Error('MONGODB_URI is not configured.');
        error.code = 'DB_UNAVAILABLE';
        throw error;
    }

    if (!cached.promise) {
        cached.promise = mongoose
            .connect(uri, { serverSelectionTimeoutMS: 10000, maxPoolSize: 10 })
            .then((instance) => {
                console.log(`MongoDB connected: ${instance.connection.host}`);
                return instance;
            })
            .catch((error) => {
                cached.promise = null;
                throw error;
            });
    }

    cached.conn = await cached.promise;
    return cached.conn;
};

module.exports = connectDB;
