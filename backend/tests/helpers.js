const { MongoMemoryServer } = require('mongodb-memory-server');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const request = require('supertest');

const PASSWORD = 'correct-horse-1';
let mongo;

const startApp = async () => {
  mongo = await MongoMemoryServer.create();
  process.env.MONGODB_URI = mongo.getUri('rankit_test');
  process.env.JWT_SECRET = 'test-secret-value';
  process.env.NODE_ENV = 'test';
  const app = require('../server');
  await require('../config/db')();
  return app;
};

const stopApp = async () => {
  await mongoose.disconnect();
  if (mongo) await mongo.stop();
};

const createUser = async (name, role, { approved = true } = {}) => {
  const User = require('../models/User');
  return User.create({
    username: name,
    password: await bcrypt.hash(PASSWORD, 4),
    role,
    isApproved: approved,
    approvalStatus: approved ? 'approved' : 'pending'
  });
};

// Returns a supertest agent that keeps the auth cookie between requests.
const loginAs = async (app, user) => {
  const agent = request.agent(app);
  const res = await agent.post('/api/users/login').send({ username: user.username, password: PASSWORD });
  if (res.status !== 200) throw new Error(`login failed for ${user.username}: ${res.status} ${res.text}`);
  agent.token = res.body.token;
  return agent;
};

module.exports = { PASSWORD, startApp, stopApp, createUser, loginAs, request };
