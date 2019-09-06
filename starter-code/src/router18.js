'use strict';

const express = require('express');
const router = express.router();
const auth = require('./middleware/auth');

// should be visible by anyone
router.get('/public-stuff', () => {}); 

// should require only a valid login
router.get('/hidden-stuff', auth(), () => {});

// should require the read capability
router.get('/something-to-read', auth('read'), () => {});

// should require the create capability
router.post('/create-a-thing', auth('create'), () => {});

// should require the update capability
router.put('/update', auth('update'), () => {});

// should require the update capability
router.patch('/jp', auth('update'), () => {});

// should require the delete capability
router.delete('/bye-bye', auth('delete'), () => {});

// should require the superuser capability
router.get('/everything', auth('superuser'), () => {});

module.exports = router;