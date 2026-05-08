const { Router } = require('express');
const asyncHandler = require('../utils/async-handler');
const signupPublicController = require('../controllers/signup-public.controller');

const signupPublicRoutes = Router();

signupPublicRoutes.post('/intent', asyncHandler((req, res) => signupPublicController.createIntent(req, res)));
signupPublicRoutes.get('/intent/:id', asyncHandler((req, res) => signupPublicController.getIntent(req, res)));
signupPublicRoutes.post('/intent/:id/start', asyncHandler((req, res) => signupPublicController.startPayment(req, res)));
signupPublicRoutes.post('/intent/:id/confirm-stripe', asyncHandler((req, res) => signupPublicController.confirmStripe(req, res)));

module.exports = signupPublicRoutes;
