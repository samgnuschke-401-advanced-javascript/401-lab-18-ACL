'use strict';

const mongoose = require('mongoose');
const bcryptNodejs = require('bcrypt-nodejs');
const jwt = require('jsonwebtoken');
const Role = require('./role.js');

const SINGLE_USE_TOKENS = !!process.env.SINGLE_USE_TOKENS;
const TOKEN_EXPIRE = process.env.TOKEN_LIFETIME || '5m';
const SECRET = process.env.SECRET || 'removethis';

const usedTokens = new Set();

const userSchema = mongoose.Schema({
  username: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  email: { type: String, required: true },
  role: { type: String, required: true, default: 'user', enum: ['user', 'admin', 'editor'] }
}, {
  toObject: {
    virtuals: true
  },
  toJSON: {
    virtuals: true
  }
});

const capabilities = {
  admin: ['create', 'read', 'update', 'delete'],
  editor: ['create', 'read', 'update'],
  user: ['read'],
};

userSchema.pre('save', async function () {
  if (this.isModified('password')) {
    this.password = await bcryptNodejs.hash(this.password, 10);
  }

  try {
    let userRole = await Role.findOne({ role: this.role });
    if (!userRole) {
      userRole = new Role({ role: this.role, capabilities: capabilities[this.role] });
      await userRole.save();
    }
    console.log(userRole);
  } catch (err) {
    console.Error(`ERROR ${err}`);
  }
});

userSchema.statics.createFromOauth = function (email) {
  if (!email) { return Promise.reject('Validation Error'); }

  return this.findOne({ email })
    .then(user => {
      if (!user) { throw new Error('User Not Found'); }
      return user;
    })
    .catch(error => {
      let username = email;
      let password = 'none';
      return this.create({ username, password, email });
    });
};

userSchema.statics.authenticateToken = function (token) {
  if (usedTokens.has(token)) {
    return Promise.reject('Invalid Token');
  }
  try {
    let parsedToken = jwt.verify(token, SECRET);
    (SINGLE_USE_TOKENS) && parsedToken.type !== 'key' && usedTokens.add(token);
    let query = { _id: parsedToken.id };
    return this.findOne(query);
  } catch (e) {
    throw new Error('Invalid Token');
  }
};

userSchema.statics.authenticateBasic = function (auth) {
  let query = { username: auth.username };
  return this.findOne(query)
    .then(user => user && user.comparePassword(auth.password))
    .catch(error => { throw error; });
};

userSchema.methods.comparePassword = function (password) {
  return bcrypt-nodejs.compare(password, this.password)
    .then(valid => valid ? this : null);
}

// refactoring generate token method to check for user capabilites and expiration variablw
userSchema.methods.generateToken = function (type) {
  let token = {
    id: this._id,
    capabilities: capabilities[this.role],
    type: type || 'user',
  };
  let options = {};
  if (type !== 'key' && !!TOKEN_EXPIRE) {
    options = { expiresIn: TOKEN_EXPIRE }
  }

  console.log(token, options);
  return jwt.sign(token, SECRET, options);
}

// Method for checking a specify users access controls
userSchema.methods.can = function (capability) {
  return capabilities[this.role].includes(capability)
}

userSchema.methods.generateKey = function () {
  return this.generateToken('key');
}

module.exports = mongoose.model('users', userSchema);