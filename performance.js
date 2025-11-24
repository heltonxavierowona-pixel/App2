const mongoose = require('mongoose');

const PerfSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    date: { type: Date, required: true },
      tasksCompleted: { type: Number, default: 0 },
        score: { type: Number, default: 0 }
        });

        module.exports = mongoose.model('Performance', PerfSchema);