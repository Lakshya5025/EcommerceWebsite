const mongoose = require('mongoose');

const form = mongoose.Schema({
    fname: String,
    lname: String,
    email: {
        type: String,
        required: true,
        unique: true, // Email should be unique 
        trim: true
    },
    password: {
        type: String,
        required: true,
        trim: true
    },
    filename: String
})

module.exports = mongoose.model("Form", form);