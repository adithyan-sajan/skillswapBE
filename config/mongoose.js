const mongoose = require('mongoose');

const connectToDB = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI)
        console.log("connected to DB successfully")
    } catch (error) {
        console.log("Something went wrong while trying to connect:", error)
    }
}

module.exports = connectToDB;