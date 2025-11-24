const mongoose = require('mongoose');

const TaskSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    title: { type: String, required: true },
      description: { type: String },
        status: { type: String, enum: ['todo','in_progress','done'], default: 'todo' },
          priority: { type: String, enum: ['low','medium','high'], default: 'medium' },
            dueDate: { type: Date },
              createdAt: { type: Date, default: Date.now },
                updatedAt: { type: Date, default: Date.now }
                });

                module.exports = mongoose.model('Task', TaskSchema);